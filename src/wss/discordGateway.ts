import WebSocket from 'ws';
import * as zlib from 'zlib';
import { DiscordAccount } from '../models/DiscordAccount';
import { DiscordHelper } from '../support/discordHelper';
import { WebSocketCode } from '../constants';
import { UserMessageListener } from './userMessageListener';
import { getLock } from '../utils/asyncLock';

/**
 * Resume data for session resume
 */
export interface ResumeData {
  sessionId: string;
  sequence: number | null;
  resumeGatewayUrl: string;
}

/**
 * Success callback
 */
export interface SuccessCallback {
  onSuccess(sessionId: string, sequence: number | null, resumeGatewayUrl: string): void;
}

/**
 * Failure callback
 */
export interface FailureCallback {
  onFailure(code: number, reason: string): void;
}

/**
 * Discord Gateway WebSocket client
 */
export class DiscordGateway {
  private static readonly CLOSE_CODE_RECONNECT = 2001;
  private static readonly CLOSE_CODE_INVALIDATE = 1009;
  private static readonly CLOSE_CODE_EXCEPTION = 1011;
  private static readonly CLOSE_CODE_ALREADY_AUTHENTICATED = 4005;
  private static readonly CONNECT_RETRY_LIMIT = 5;
  private static readonly AUTH_CONFLICT_RETRY_LIMIT = 3; // Max retries for 4005 errors
  private static readonly AUTH_CONFLICT_RETRY_DELAY = 5000; // 5 second delay for 4005 retries
  
  // Fatal error codes that should disable the account
  private static readonly FATAL_ERROR_CODES = [4011, 4012, 4013, 4014]; // Authentication/authorization failures

  private account: DiscordAccount;
  private userMessageListener: UserMessageListener;
  private discordHelper: DiscordHelper;
  private wssServer: string;
  private resumeWss: string;

  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private sequence: number | null = null;
  private resumeGatewayUrl: string | null = null;
  private resumeData: ResumeData | null = null;
  private interval: number = 41250;
  private heartbeatAck: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private sessionClosing: boolean = false;

  private decompressor: zlib.Inflate | null = null;
  private inflateBuffer: Buffer = Buffer.alloc(0);

  // Debugging and tracking variables
  private connectionStartTime: number | null = null;
  private websocketOpenTime: number | null = null;
  private messageCount: number = 0;
  private lastMessageTime: number | null = null;
  private lastDataReceived: Buffer | null = null;
  private decompressorCreatedTime: number | null = null;
  
  // Track retry attempts for 4005 errors
  private authConflictRetryCount: number = 0;
  
  // Flags to prevent duplicate processing
  private readyReceived: boolean = false;
  private identifySent: boolean = false;

  private successCallback: SuccessCallback;
  private failureCallback: FailureCallback;

  constructor(
    account: DiscordAccount,
    userMessageListener: UserMessageListener,
    discordHelper: DiscordHelper,
    wssServer: string,
    resumeWss: string,
    successCallback: SuccessCallback,
    failureCallback: FailureCallback
  ) {
    this.account = account;
    this.userMessageListener = userMessageListener;
    this.discordHelper = discordHelper;
    this.wssServer = wssServer;
    this.resumeWss = resumeWss;
    this.successCallback = successCallback;
    this.failureCallback = failureCallback;
  }

  /**
   * Start WebSocket connection
   */
  async start(reconnect: boolean = false): Promise<void> {
    // Clean up previous connection first
    this.closeSocket();
    
    // Reset session closing flag AFTER cleanup to allow new connection
    this.sessionClosing = false;
    
    const gatewayUrl = this.getGatewayUrl(reconnect);
    
    return new Promise((resolve, reject) => {
      const headers = {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // DO NOT include Sec-WebSocket-Extensions - Discord uses application-level zlib-stream,
        // not WebSocket-level permessage-deflate. They conflict with each other.
        'User-Agent': this.account.userAgent || '',
      };

      // Reset buffer for new connection
      this.inflateBuffer = Buffer.alloc(0);
      
      // Initialize tracking variables
      this.connectionStartTime = Date.now();
      this.websocketOpenTime = null;
      this.messageCount = 0;
      this.lastMessageTime = null;
      this.lastDataReceived = null;
      
      // Reset flags for new connection
      this.readyReceived = false;
      this.identifySent = false;
      
      // Note: authConflictRetryCount is NOT reset here
      // It's only reset when READY/RESUMED is received (successful connection)
      // This allows tracking consecutive 4005 failures across retry attempts
      
      // Initialize zlib decompressor BEFORE creating WebSocket
      // This ensures it's ready before any data can arrive
      // IMPORTANT: Discord Gateway uses zlib-stream with zlib headers (not raw deflate)
      // The first chunk contains the zlib header (78 da), so we use createInflate (not createInflateRaw)
      this.decompressorCreatedTime = Date.now();
      const decompressorOptions = {
        chunkSize: 1024 * 16, // 16KB chunks
        flush: zlib.constants.Z_SYNC_FLUSH,
      };
      
      console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Creating decompressor - ` +
        `options:${JSON.stringify(decompressorOptions)}, ` +
        `time:${this.decompressorCreatedTime}, ` +
        `connectionStartTime:${this.connectionStartTime}, ` +
        `type:createInflate (zlib with headers)`);
      
      // Use createInflate instead of createInflateRaw because Discord sends zlib headers
      // The first message contains the zlib header (78 da), subsequent messages are continuation chunks
      this.decompressor = zlib.createInflate(decompressorOptions);

      this.decompressor.on('data', (chunk: Buffer) => {
        // Ignore data if connection is closing
        if (this.sessionClosing) {
          console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Ignoring decompressor data - connection is closing`);
          return;
        }
        
        console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Decompressor emitted data - ` +
          `chunkSize:${chunk.length} bytes, ` +
          `bufferBefore:${this.inflateBuffer.length} bytes`);
        this.inflateBuffer = Buffer.concat([this.inflateBuffer, chunk]);
        // Try to parse complete JSON messages
        this.processInflateBuffer();
      });

      this.decompressor.on('error', (error: Error) => {
        // Ignore errors if connection is already closing
        if (this.sessionClosing) {
          console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Decompressor error during cleanup - ignoring: ${error.message}`);
          return;
        }
        
        const now = Date.now();
        const timeSinceStart = this.connectionStartTime ? (now - this.connectionStartTime) : -1;
        const timeSinceOpen = this.websocketOpenTime ? (now - this.websocketOpenTime) : -1;
        const timeSinceLastMessage = this.lastMessageTime ? (now - this.lastMessageTime) : -1;
        const timeSinceDecompressorCreated = this.decompressorCreatedTime ? (now - this.decompressorCreatedTime) : -1;
        
        console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Decompressor error occurred:`, error);
        console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Error context - ` +
          `errorName:${error.name}, ` +
          `errorMessage:${error.message}, ` +
          `errorCode:${(error as any).code}, ` +
          `errorErrno:${(error as any).errno}, ` +
          `timeSinceStart:${timeSinceStart}ms, ` +
          `timeSinceOpen:${timeSinceOpen}ms, ` +
          `timeSinceLastMessage:${timeSinceLastMessage}ms, ` +
          `timeSinceDecompressorCreated:${timeSinceDecompressorCreated}ms, ` +
          `messageCount:${this.messageCount}, ` +
          `running:${this.running}, ` +
          `sessionClosing:${this.sessionClosing}, ` +
          `decompressorState:${this.getDecompressorState()}, ` +
          `inflateBufferLength:${this.inflateBuffer.length} bytes, ` +
          `websocketState:${this.ws ? (this.ws.readyState === WebSocket.OPEN ? 'OPEN' : 'NOT_OPEN') : 'NULL'}`);
        
        if (this.lastDataReceived) {
          console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Last data received before error - ` +
            `length:${this.lastDataReceived.length} bytes, ` +
            `hex:${this.getHexDump(this.lastDataReceived)}, ` +
            `isZlibCompressed:${this.isZlibCompressed(this.lastDataReceived)}, ` +
            `isJson:${this.isJsonData(this.lastDataReceived)}`);
        } else {
          console.error(`[wss-${this.account.getDisplay()}] [DEBUG] No data was received before error`);
        }
        
        if (this.inflateBuffer.length > 0) {
          console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Inflate buffer contents - ` +
            `length:${this.inflateBuffer.length} bytes, ` +
            `firstBytes:${this.getHexDump(this.inflateBuffer, 64)}, ` +
            `asString:${this.inflateBuffer.slice(0, 200).toString('utf-8').replace(/\n/g, '\\n')}`);
        }
        
        // Decompressor error means the stream is corrupted - cannot recover mid-stream
        // Close the connection and trigger reconnect
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Closing WebSocket due to decompressor error`);
          this.ws.close(DiscordGateway.CLOSE_CODE_EXCEPTION, 'decompressor error');
        } else {
          console.error(`[wss-${this.account.getDisplay()}] [DEBUG] WebSocket not open, cannot close - ` +
            `ws:${this.ws ? 'exists' : 'null'}, ` +
            `readyState:${this.ws ? this.ws.readyState : 'N/A'}`);
        }
      });

      const websocketCreatedTime = Date.now();
      console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Creating WebSocket - ` +
        `url:${gatewayUrl}, ` +
        `time:${websocketCreatedTime}, ` +
        `timeSinceConnectionStart:${websocketCreatedTime - this.connectionStartTime!}ms, ` +
        `timeSinceDecompressorCreated:${websocketCreatedTime - this.decompressorCreatedTime!}ms`);
      
      this.ws = new WebSocket(gatewayUrl, { headers });

      this.ws.on('open', () => {
        this.websocketOpenTime = Date.now();
        const timeSinceStart = this.websocketOpenTime - this.connectionStartTime!;
        const timeSinceDecompressorCreated = this.websocketOpenTime - this.decompressorCreatedTime!;
        
        console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] WebSocket opened - ` +
          `time:${this.websocketOpenTime}, ` +
          `timeSinceStart:${timeSinceStart}ms, ` +
          `timeSinceDecompressorCreated:${timeSinceDecompressorCreated}ms`);
        
        // Connection opened - resolve immediately
        // The actual connection success is signaled by onSuccess() when READY/RESUMED is received
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        const dataType = Buffer.isBuffer(data) ? 'Buffer' : typeof data;
        const dataSize = Buffer.isBuffer(data) ? data.length : (typeof data === 'string' ? data.length : 0);
        
        console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] WebSocket 'message' event - ` +
          `type:${dataType}, ` +
          `size:${dataSize}, ` +
          `timeSinceOpen:${this.websocketOpenTime ? (Date.now() - this.websocketOpenTime) : -1}ms`);
        
        if (Buffer.isBuffer(data)) {
          // Handle zlib-stream compression
          this.handleWebSocketMessage(data);
        } else if (typeof data === 'string') {
          // Handle uncompressed messages (shouldn't happen with zlib-stream)
          console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] WARNING: Received string data but expecting Buffer! ` +
            `Data: ${data.substring(0, 100)}`);
          this.handleMessage(data);
        } else {
          console.error(`[wss-${this.account.getDisplay()}] [DEBUG] ERROR: Received unexpected data type: ${dataType}`);
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error(`[wss-${this.account.getDisplay()}] WebSocket error:`, error);
        // Clean up decompressor if WebSocket creation fails
        if (this.decompressor) {
          try {
            this.decompressor.removeAllListeners();
            this.decompressor.destroy();
          } catch (e) {
            // Ignore cleanup errors
          }
          this.decompressor = null;
        }
        this.onFailure(DiscordGateway.CLOSE_CODE_EXCEPTION, error.message || 'transport error');
        reject(error);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        const reasonStr = reason.toString('utf-8');
        this.onFailure(code, reasonStr);
      });
    });
  }

  /**
   * Get gateway URL
   */
  private getGatewayUrl(reconnect: boolean): string {
    if (reconnect && this.resumeGatewayUrl) {
      const server = this.resumeWss || this.resumeGatewayUrl;
      return `${server}/?encoding=json&v=9&compress=zlib-stream`;
    }
    return `${this.wssServer}/?encoding=json&v=9&compress=zlib-stream`;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(json: string): void {
    // Don't process messages if connection is closing or closed
    if (this.sessionClosing) {
      console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Ignoring message - connection is closing`);
      return;
    }
    
    // Validate WebSocket is still open
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Ignoring message - WebSocket not open (state: ${this.ws ? this.ws.readyState : 'null'})`);
      return;
    }
    
    try {
      const data = JSON.parse(json);
      const opCode = data.op;

      switch (opCode) {
        case WebSocketCode.HEARTBEAT:
          this.handleHeartbeat();
          break;
        case WebSocketCode.HEARTBEAT_ACK:
          this.heartbeatAck = true;
          this.clearHeartbeatTimeout();
          break;
        case WebSocketCode.HELLO:
          this.handleHello(data);
          // Only send IDENTIFY/RESUME if not already sent and connection is not established
          if (!this.identifySent && !this.running) {
            this.doResumeOrIdentify();
          } else {
            console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] HELLO received but IDENTIFY already sent or connection established - ignoring`);
          }
          break;
        case WebSocketCode.RESUME:
          this.onSuccess();
          break;
        case WebSocketCode.RECONNECT:
          this.onFailure(DiscordGateway.CLOSE_CODE_RECONNECT, 'receive server reconnect');
          break;
        case WebSocketCode.INVALIDATE_SESSION:
          this.onFailure(DiscordGateway.CLOSE_CODE_INVALIDATE, 'receive session invalid');
          break;
        case WebSocketCode.DISPATCH:
          this.handleDispatch(data);
          break;
        default:
          console.debug(`[wss-${this.account.getDisplay()}] Receive unknown code:`, data);
      }
    } catch (error) {
      console.error(`[wss-${this.account.getDisplay()}] Error parsing message:`, error);
    }
  }

  /**
   * Check if data appears to be zlib compressed
   */
  private isZlibCompressed(data: Buffer): boolean {
    if (data.length < 2) {
      return false;
    }
    // Zlib magic bytes: 0x78 0x9C (default), 0x78 0x01 (best speed), 0x78 0xDA (best compression), etc.
    const byte1 = data[0];
    const byte2 = data[1];
    return byte1 === 0x78 && (byte2 === 0x9C || byte2 === 0x01 || byte2 === 0xDA || byte2 === 0x5E || byte2 === 0x9D || byte2 === 0xBB);
  }

  /**
   * Check if data appears to be JSON (uncompressed)
   */
  private isJsonData(data: Buffer): boolean {
    if (data.length === 0) {
      return false;
    }
    // Check if starts with { or [
    const firstChar = data[0];
    return firstChar === 0x7B || firstChar === 0x5B; // { or [
  }

  /**
   * Get hex dump of buffer (first N bytes)
   */
  private getHexDump(data: Buffer, maxBytes: number = 32): string {
    const length = Math.min(data.length, maxBytes);
    const hex = Array.from(data.slice(0, length))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    return length < data.length ? `${hex}... (${data.length} total bytes)` : hex;
  }

  /**
   * Get decompressor state information
   */
  private getDecompressorState(): string {
    if (!this.decompressor) {
      return 'null';
    }
    try {
      const readable = this.decompressor.readable;
      const writable = this.decompressor.writable;
      const destroyed = this.decompressor.destroyed;
      return `readable:${readable}, writable:${writable}, destroyed:${destroyed}`;
    } catch (error: any) {
      return `error getting state: ${error.message}`;
    }
  }

  /**
   * Handle WebSocket message (buffer for zlib-stream)
   */
  private handleWebSocketMessage(data: Buffer): void {
    // Don't process messages if connection is closing
    if (this.sessionClosing) {
      console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Ignoring WebSocket message - connection is closing`);
      return;
    }
    
    const now = Date.now();
    this.lastMessageTime = now;
    this.lastDataReceived = data;
    this.messageCount++;

    // Log data arrival
    const timeSinceOpen = this.websocketOpenTime ? (now - this.websocketOpenTime) : -1;
    const timeSinceStart = this.connectionStartTime ? (now - this.connectionStartTime) : -1;
    
    console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] WebSocket message received - ` +
      `count:${this.messageCount}, ` +
      `size:${data.length} bytes, ` +
      `timeSinceOpen:${timeSinceOpen}ms, ` +
      `timeSinceStart:${timeSinceStart}ms, ` +
      `hex:${this.getHexDump(data, 16)}`);

    // Validate connection state before processing
    if (!this.ws) {
      console.error(`[wss-${this.account.getDisplay()}] [DEBUG] WebSocket is null`);
      return;
    }

    const wsState = this.ws.readyState;
    const wsStateStr = wsState === WebSocket.CONNECTING ? 'CONNECTING' :
                      wsState === WebSocket.OPEN ? 'OPEN' :
                      wsState === WebSocket.CLOSING ? 'CLOSING' :
                      wsState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN';

    if (wsState !== WebSocket.OPEN) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] WebSocket not OPEN, state: ${wsStateStr} - ignoring message`);
      return;
    }

    // Validate decompressor exists and is ready
    if (!this.decompressor) {
      console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Received data but decompressor not initialized`);
      return;
    }

    // Check data characteristics
    const isCompressed = this.isZlibCompressed(data);
    const isJson = this.isJsonData(data);
    const decompressorState = this.getDecompressorState();
    const bufferLength = this.inflateBuffer.length;

    console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Before writing to decompressor - ` +
      `isZlibCompressed:${isCompressed}, ` +
      `isJson:${isJson}, ` +
      `decompressorState:${decompressorState}, ` +
      `inflateBufferLength:${bufferLength}, ` +
      `running:${this.running}, ` +
      `sessionClosing:${this.sessionClosing}`);

    // In zlib-stream format:
    // - First message contains zlib header (78 da, etc.)
    // - Subsequent messages are continuation chunks (no header, just raw deflate data)
    // So we only check for zlib header on the first message
    const isFirstMessage = this.messageCount === 1;
    
    // Warn if first message doesn't have zlib header (should have one)
    if (isFirstMessage && !isCompressed && !isJson) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] WARNING: First message doesn't have zlib header! ` +
        `First bytes: ${this.getHexDump(data, 32)}`);
    }
    
    // Warn if we receive JSON data (shouldn't happen with zlib-stream)
    if (isJson) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] WARNING: Received JSON data but expecting zlib-stream! ` +
        `First bytes: ${this.getHexDump(data, 32)}`);
    }
    
    // Continuation chunks (messageCount > 1) don't have zlib headers - this is normal
    // Only log if it's the first message and doesn't match expected format
    if (isFirstMessage && !isCompressed && !isJson && data.length > 0) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] WARNING: First message doesn't look like zlib! ` +
        `First bytes: ${this.getHexDump(data, 32)}`);
    }

    try {
      // Write to decompressor - data will be processed in 'data' event
      console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Writing ${data.length} bytes to decompressor`);
      this.decompressor.write(data);
      console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Successfully wrote to decompressor`);
    } catch (error: any) {
      console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Error writing to decompressor:`, error);
      console.error(`[wss-${this.account.getDisplay()}] [DEBUG] Error context - ` +
        `dataLength:${data.length}, ` +
        `dataHex:${this.getHexDump(data)}, ` +
        `decompressorState:${this.getDecompressorState()}, ` +
        `inflateBufferLength:${this.inflateBuffer.length}, ` +
        `errorMessage:${error.message}, ` +
        `errorStack:${error.stack}`);
      // If write fails, close connection to trigger reconnect
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(DiscordGateway.CLOSE_CODE_EXCEPTION, 'decompressor write error');
      }
    }
  }

  /**
   * Handle HELLO event
   */
  private handleHello(data: any): void {
    this.clearHeartbeatInterval();
    this.interval = data.d.heartbeat_interval;
    this.heartbeatAck = true;

    // Start heartbeat interval with random jitter
    const jitter = Math.floor(Math.random() * this.interval);
    this.heartbeatInterval = setInterval(() => {
      if (this.heartbeatAck) {
        this.heartbeatAck = false;
        this.sendHeartbeat();
      } else {
        this.onFailure(DiscordGateway.CLOSE_CODE_RECONNECT, 'heartbeat has not ack interval');
      }
    }, this.interval);

    // Initial heartbeat after jitter
    setTimeout(() => {
      if (this.heartbeatAck) {
        this.heartbeatAck = false;
        this.sendHeartbeat();
      }
    }, jitter);
  }

  /**
   * Handle HEARTBEAT event (server requests heartbeat)
   */
  private handleHeartbeat(): void {
    this.sendHeartbeat();
    this.heartbeatTimeout = setTimeout(() => {
      this.onFailure(DiscordGateway.CLOSE_CODE_RECONNECT, 'heartbeat has not ack');
    }, this.interval);
  }

  /**
   * Send heartbeat
   */
  private sendHeartbeat(): void {
    this.sendMessage(WebSocketCode.HEARTBEAT, this.sequence);
  }

  /**
   * Handle DISPATCH event
   */
  private handleDispatch(data: any): void {
    this.sequence = data.s || null;

    if (!data.d || typeof data.d !== 'object') {
      return;
    }

    const eventType = data.t;
    const content = data.d;

    if (eventType === 'READY') {
      // Prevent processing READY twice
      if (this.readyReceived) {
        console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] READY event received again - ignoring duplicate. ` +
          `sessionId:${content.session_id}, currentSessionId:${this.sessionId}`);
        return;
      }
      
      // Don't process READY if connection is closing
      if (this.sessionClosing) {
        console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] READY event received but connection is closing - ignoring`);
        return;
      }
      
      this.sessionId = content.session_id;
      this.resumeGatewayUrl = content.resume_gateway_url;
      this.readyReceived = true;
      console.debug(`[wss-${this.account.getDisplay()}] READY event received - sessionId:${this.sessionId}, resumeGatewayUrl:${this.resumeGatewayUrl}`);
      // Reset auth conflict retry count on successful connection
      this.authConflictRetryCount = 0;
      this.onSuccess();
    } else if (eventType === 'RESUMED') {
      // Prevent processing RESUMED twice
      if (this.readyReceived) {
        console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] RESUMED event received but READY already processed - ignoring`);
        return;
      }
      
      // Don't process RESUMED if connection is closing
      if (this.sessionClosing) {
        console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] RESUMED event received but connection is closing - ignoring`);
        return;
      }
      
      this.readyReceived = true;
      console.debug(`[wss-${this.account.getDisplay()}] RESUMED event received`);
      // Reset auth conflict retry count on successful resume
      this.authConflictRetryCount = 0;
      this.onSuccess();
    } else {
      try {
        this.userMessageListener.onMessage(data);
      } catch (error) {
        console.error(`[wss-${this.account.getDisplay()}] Handle message error:`, error);
      }
    }
  }

  /**
   * Resume or identify
   */
  private doResumeOrIdentify(): void {
    // Don't send IDENTIFY/RESUME if already sent or connection is established
    if (this.identifySent) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] IDENTIFY/RESUME already sent - ignoring duplicate call`);
      return;
    }
    
    if (this.running) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] Connection already established (running=true) - ignoring IDENTIFY/RESUME`);
      return;
    }
    
    if (!this.sessionId) {
      console.debug(`[wss-${this.account.getDisplay()}] No session ID, sending IDENTIFY (new connection)`);
      this.sendIdentify();
    } else {
      console.debug(`[wss-${this.account.getDisplay()}] Session ID exists, sending RESUME - sessionId:${this.sessionId}, sequence:${this.sequence}`);
      this.sendResume();
    }
  }

  /**
   * Send IDENTIFY
   */
  private sendIdentify(): void {
    // Guard against duplicate sends
    if (this.identifySent) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] IDENTIFY already sent - ignoring duplicate`);
      return;
    }
    
    const authData = this.createAuthData();
    console.debug(`[wss-${this.account.getDisplay()}] Sending IDENTIFY payload`);
    this.sendMessage(WebSocketCode.IDENTIFY, authData);
    this.identifySent = true;
  }

  /**
   * Send RESUME
   */
  private sendResume(): void {
    // Guard against duplicate sends
    if (this.identifySent) {
      console.warn(`[wss-${this.account.getDisplay()}] [DEBUG] RESUME/IDENTIFY already sent - ignoring duplicate`);
      return;
    }
    
    const data = {
      token: this.account.userToken,
      session_id: this.sessionId,
      seq: this.sequence,
    };
    console.debug(`[wss-${this.account.getDisplay()}] Sending RESUME payload - sessionId:${this.sessionId}, seq:${this.sequence}`);
    this.sendMessage(WebSocketCode.RESUME, data);
    this.identifySent = true;
  }

  /**
   * Create auth data for IDENTIFY
   */
  private createAuthData(): any {
    // Parse user agent (simplified)
    const userAgent = this.account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    const browserName = browserMatch ? browserMatch[1] : 'Chrome';
    const browserVersion = browserMatch ? browserMatch[2] : '112';

    const connectionProperties = {
      browser: browserName,
      browser_user_agent: userAgent,
      browser_version: browserVersion,
      client_build_number: 222963,
      client_event_source: null,
      device: '',
      os: 'Mac OS X',
      referer: 'https://www.midjourney.com',
      referrer_current: '',
      referring_domain: 'www.midjourney.com',
      referring_domain_current: '',
      release_channel: 'stable',
      system_locale: 'zh-CN',
    };

    const presence = {
      activities: [],
      afk: false,
      since: 0,
      status: 'online',
    };

    const clientState = {
      api_code_version: 0,
      guild_versions: {},
      highest_last_message_id: '0',
      private_channels_version: '0',
      read_state_version: 0,
      user_guild_settings_version: -1,
      user_settings_version: -1,
    };

    return {
      capabilities: 16381,
      client_state: clientState,
      compress: false,
      presence,
      properties: connectionProperties,
      token: this.account.userToken,
    };
  }

  /**
   * Send message
   */
  private sendMessage(op: number, d: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = JSON.stringify({ op, d });
    this.ws.send(message);
  }

  /**
   * On success
   */
  private onSuccess(): void {
    this.running = true;
    const resumeData: ResumeData = {
      sessionId: this.sessionId || '',
      sequence: this.sequence,
      resumeGatewayUrl: this.resumeGatewayUrl || '',
    };
    this.resumeData = resumeData;
    
    // Notify lock
    const lock = getLock(`wss:${this.account.id}`);
    if (lock) {
      lock.setProperty('code', 1); // ReturnCode.SUCCESS
      lock.setProperty('description', '');
      lock.awake();
    }
    
    this.successCallback.onSuccess(
      resumeData.sessionId,
      resumeData.sequence,
      resumeData.resumeGatewayUrl
    );
  }

  /**
   * On failure
   */
  private onFailure(code: number, reason: string): void {
    // Notify lock first
    const lock = getLock(`wss:${this.account.id}`);
    if (lock) {
      lock.setProperty('code', code);
      lock.setProperty('description', reason);
      lock.awake();
    }

    if (this.sessionClosing) {
      this.sessionClosing = false;
      return;
    }

    this.closeSocket();

    if (!this.running) {
      this.failureCallback.onFailure(code, reason);
      return;
    }

    this.running = false;

    // Handle special case: 4005 "Already authenticated" - clear session and retry
    if (code === DiscordGateway.CLOSE_CODE_ALREADY_AUTHENTICATED) {
      this.authConflictRetryCount++;
      console.warn(`[wss-${this.account.getDisplay()}] Session conflict (${code}): ${reason}`);
      console.warn(`[wss-${this.account.getDisplay()}] Current session state - sessionId:${this.sessionId}, sequence:${this.sequence}, running:${this.running}`);
      console.warn(`[wss-${this.account.getDisplay()}] Auth conflict retry count: ${this.authConflictRetryCount}/${DiscordGateway.AUTH_CONFLICT_RETRY_LIMIT}`);
      
      // If we've retried too many times, disable account to prevent infinite loop
      if (this.authConflictRetryCount >= DiscordGateway.AUTH_CONFLICT_RETRY_LIMIT) {
        console.error(`[wss-${this.account.getDisplay()}] Too many auth conflicts (${this.authConflictRetryCount}). ` +
          `This usually means the token is being used elsewhere (browser, app, or another instance). ` +
          `Account will be disabled. Please check if the token is used in multiple places.`);
        this.disableAccount();
        return;
      }
      
      console.warn(`[wss-${this.account.getDisplay()}] Clearing session and retrying with fresh IDENTIFY in ${DiscordGateway.AUTH_CONFLICT_RETRY_DELAY}ms...`);
      // Clear session data to force a fresh connection (IDENTIFY instead of RESUME)
      this.sessionId = null;
      this.sequence = null;
      this.resumeGatewayUrl = null;
      this.resumeData = null;
      // Wait longer before retrying to avoid immediate conflict
      // This gives Discord time to close the conflicting session
      // Also gives time for any other client using the token to disconnect
      setTimeout(() => {
        console.debug(`[wss-${this.account.getDisplay()}] Retrying connection after 4005 error (attempt ${this.authConflictRetryCount})...`);
        this.tryNewConnect();
      }, DiscordGateway.AUTH_CONFLICT_RETRY_DELAY);
      return;
    }
    
    // Handle fatal authentication errors - disable account
    if (DiscordGateway.FATAL_ERROR_CODES.includes(code)) {
      console.warn(`[wss-${this.account.getDisplay()}] Fatal error! Account disabled. Closed by ${code}(${reason}).`);
      this.disableAccount();
      return;
    }
    
    // Handle other 4xxx errors - log but don't disable (might be recoverable)
    if (code >= 4000) {
      console.warn(`[wss-${this.account.getDisplay()}] Gateway error ${code}(${reason}). Attempting reconnection...`);
      this.tryNewConnect();
      return;
    }
    
    if (code === DiscordGateway.CLOSE_CODE_RECONNECT) {
      console.warn(`[wss-${this.account.getDisplay()}] Closed by ${code}(${reason}). Try reconnect...`);
      this.tryReconnect();
    } else {
      console.warn(`[wss-${this.account.getDisplay()}] Closed by ${code}(${reason}). Try new connection...`);
      this.tryNewConnect();
    }
  }

  /**
   * Try reconnect
   */
  private async tryReconnect(): Promise<void> {
    try {
      await this.start(true);
      console.debug(`[wss-${this.account.getDisplay()}] Reconnect success.`);
    } catch (error: any) {
      console.warn(`[wss-${this.account.getDisplay()}] Reconnect fail: ${error.message}. Try new connection...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.tryNewConnect();
    }
  }

  /**
   * Try new connect
   */
  private async tryNewConnect(): Promise<void> {
    for (let i = 1; i <= DiscordGateway.CONNECT_RETRY_LIMIT; i++) {
      try {
        await this.start(false);
        console.debug(`[wss-${this.account.getDisplay()}] New connect success.`);
        return;
      } catch (error: any) {
        console.warn(`[wss-${this.account.getDisplay()}] New connect fail (${i}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    console.error(`[wss-${this.account.getDisplay()}] Account disabled`);
    this.disableAccount();
  }

  /**
   * Disable account
   */
  private disableAccount(): void {
    if (!this.account.enable) {
      return;
    }
    this.account.enable = false;
  }

  /**
   * Close socket
   */
  private closeSocket(): void {
    this.clearHeartbeatInterval();
    this.clearHeartbeatTimeout();

    // Set session closing flag immediately to prevent processing new messages
    this.sessionClosing = true;
    
    // CRITICAL: Clear buffer FIRST to prevent processing stale data
    this.inflateBuffer = Buffer.alloc(0);
    
    // CRITICAL: Destroy decompressor FIRST (before closing WebSocket)
    // This prevents decompressor from processing data after cleanup starts
    if (this.decompressor) {
      try {
        const decompressorState = this.getDecompressorState();
        console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Cleaning up decompressor - ` +
          `state:${decompressorState}, ` +
          `messageCount:${this.messageCount}, ` +
          `inflateBufferLength:${this.inflateBuffer.length}`);
        
        // Remove all event listeners FIRST to prevent new events from firing
        this.decompressor.removeAllListeners();
        // Destroy the stream to fully clean up internal state
        this.decompressor.destroy();
        
        console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Decompressor destroyed`);
      } catch (error: any) {
        // Ignore cleanup errors - decompressor may already be destroyed
        console.debug(`[wss-${this.account.getDisplay()}] [DEBUG] Error during decompressor cleanup: ${error.message}`);
      }
      this.decompressor = null;
      this.decompressorCreatedTime = null;
    }

    // THEN close WebSocket (after decompressor is destroyed)
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          // Remove listeners to prevent event handling during cleanup
          this.ws.removeAllListeners();
          this.ws.close();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      this.ws = null;
    }
    
    // Reset tracking variables
    this.messageCount = 0;
    this.lastMessageTime = null;
    this.lastDataReceived = null;
    this.websocketOpenTime = null;
    this.connectionStartTime = null;
    
    // Reset flags
    this.readyReceived = false;
    this.identifySent = false;
  }

  /**
   * Clear heartbeat interval
   */
  private clearHeartbeatInterval(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clear heartbeat timeout
   */
  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Process inflate buffer and extract complete JSON messages
   */
  private processInflateBuffer(): void {
    // Don't process buffer if connection is closing
    if (this.sessionClosing) {
      return;
    }
    
    let start = 0;
    
    while (start < this.inflateBuffer.length) {
      // Look for complete JSON objects
      let jsonEnd = -1;
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = start; i < this.inflateBuffer.length; i++) {
        const char = this.inflateBuffer[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === 0x5C) { // backslash
          escapeNext = true;
          continue;
        }

        if (char === 0x22) { // double quote
          inString = !inString;
          continue;
        }

        if (inString) {
          continue;
        }

        if (char === 0x7B) { // {
          braceCount++;
        } else if (char === 0x7D) { // }
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonEnd > start) {
        const jsonStr = this.inflateBuffer.slice(start, jsonEnd).toString('utf-8');
        this.handleMessage(jsonStr);
        start = jsonEnd;
        // Skip whitespace
        while (start < this.inflateBuffer.length && (this.inflateBuffer[start] === 0x20 || this.inflateBuffer[start] === 0x0A || this.inflateBuffer[start] === 0x0D)) {
          start++;
        }
      } else {
        // Incomplete message or no more complete messages
        break;
      }
    }
    
    // Remove processed data from buffer after processing all complete messages
    if (start > 0) {
      this.inflateBuffer = this.inflateBuffer.slice(start);
    }
  }

  /**
   * Get resume data
   */
  getResumeData(): ResumeData | null {
    if (!this.sessionId) {
      return null;
    }
    return {
      sessionId: this.sessionId,
      sequence: this.sequence,
      resumeGatewayUrl: this.resumeGatewayUrl || '',
    };
  }

  /**
   * Set resume data
   */
  setResumeData(resumeData: ResumeData): void {
    this.sessionId = resumeData.sessionId;
    this.sequence = resumeData.sequence;
    this.resumeGatewayUrl = resumeData.resumeGatewayUrl;
  }

  /**
   * Stop WebSocket
   */
  stop(): void {
    this.closeSocket();
    this.running = false;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    running: boolean;
    sessionId: string | null;
    sequence: number | null;
    websocketState: string;
    hasSession: boolean;
  } {
    let wsState = 'CLOSED';
    if (this.ws) {
      const state = this.ws.readyState;
      wsState = state === WebSocket.CONNECTING ? 'CONNECTING' :
                state === WebSocket.OPEN ? 'OPEN' :
                state === WebSocket.CLOSING ? 'CLOSING' :
                state === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN';
    }

    return {
      connected: this.running && this.ws?.readyState === WebSocket.OPEN,
      running: this.running,
      sessionId: this.sessionId,
      sequence: this.sequence,
      websocketState: wsState,
      hasSession: this.sessionId !== null,
    };
  }
}

