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
  private static readonly CONNECT_RETRY_LIMIT = 5;

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

  private decompressor: zlib.InflateRaw | null = null;
  private inflateBuffer: Buffer = Buffer.alloc(0);

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
    this.sessionClosing = false;
    
    // Clean up previous connection
    this.closeSocket();
    
    const gatewayUrl = this.getGatewayUrl(reconnect);
    
    return new Promise((resolve, reject) => {
      const headers = {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
        'User-Agent': this.account.userAgent || '',
      };

      this.ws = new WebSocket(gatewayUrl, { headers });

      // Reset buffer for new connection
      this.inflateBuffer = Buffer.alloc(0);
      this.decompressor = null;

      this.ws.on('open', () => {
        // Initialize zlib decompressor for zlib-stream after WebSocket is open
        // This ensures the decompressor is ready before any data arrives
        this.decompressor = zlib.createInflateRaw({
          chunkSize: 1024 * 16, // 16KB chunks
          flush: zlib.constants.Z_SYNC_FLUSH,
        });

        this.decompressor.on('data', (chunk: Buffer) => {
          this.inflateBuffer = Buffer.concat([this.inflateBuffer, chunk]);
          // Try to parse complete JSON messages
          this.processInflateBuffer();
        });

        this.decompressor.on('error', (error: Error) => {
          console.error(`[wss-${this.account.getDisplay()}] Decompressor error:`, error);
          // Decompressor error means the stream is corrupted - cannot recover mid-stream
          // Close the connection and trigger reconnect
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(DiscordGateway.CLOSE_CODE_EXCEPTION, 'decompressor error');
          }
        });

        // Connection opened - resolve immediately
        // The actual connection success is signaled by onSuccess() when READY/RESUMED is received
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        if (Buffer.isBuffer(data)) {
          // Handle zlib-stream compression
          this.handleWebSocketMessage(data);
        } else if (typeof data === 'string') {
          // Handle uncompressed messages (shouldn't happen with zlib-stream)
          this.handleMessage(data);
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error(`[wss-${this.account.getDisplay()}] WebSocket error:`, error);
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
          this.doResumeOrIdentify();
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
   * Handle WebSocket message (buffer for zlib-stream)
   */
  private handleWebSocketMessage(data: Buffer): void {
    // Validate connection state before processing
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Validate decompressor exists and is ready
    if (!this.decompressor) {
      console.warn(`[wss-${this.account.getDisplay()}] Received data but decompressor not initialized`);
      return;
    }

    try {
      // Write to decompressor - data will be processed in 'data' event
      this.decompressor.write(data);
    } catch (error) {
      console.error(`[wss-${this.account.getDisplay()}] Error writing to decompressor:`, error);
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
      this.sessionId = content.session_id;
      this.resumeGatewayUrl = content.resume_gateway_url;
      this.onSuccess();
    } else if (eventType === 'RESUMED') {
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
    if (!this.sessionId) {
      this.sendIdentify();
    } else {
      this.sendResume();
    }
  }

  /**
   * Send IDENTIFY
   */
  private sendIdentify(): void {
    const authData = this.createAuthData();
    this.sendMessage(WebSocketCode.IDENTIFY, authData);
  }

  /**
   * Send RESUME
   */
  private sendResume(): void {
    const data = {
      token: this.account.userToken,
      session_id: this.sessionId,
      seq: this.sequence,
    };
    this.sendMessage(WebSocketCode.RESUME, data);
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

    if (code >= 4000) {
      console.warn(`[wss-${this.account.getDisplay()}] Can't reconnect! Account disabled. Closed by ${code}(${reason}).`);
      this.disableAccount();
    } else if (code === DiscordGateway.CLOSE_CODE_RECONNECT) {
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

    // Close WebSocket first
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.sessionClosing = true;
          // Remove listeners to prevent event handling during cleanup
          this.ws.removeAllListeners();
          this.ws.close();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      this.ws = null;
    }

    // Then cleanup decompressor (after WebSocket is closed to prevent new data)
    if (this.decompressor) {
      try {
        // Remove all event listeners first
        this.decompressor.removeAllListeners();
        // End the stream gracefully
        this.decompressor.end();
      } catch (error) {
        // Ignore cleanup errors - decompressor may already be closed
      }
      this.decompressor = null;
    }
    
    // Reset buffer last
    this.inflateBuffer = Buffer.alloc(0);
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
        // Incomplete message, keep buffer
        if (start > 0) {
          this.inflateBuffer = this.inflateBuffer.slice(start);
        }
        break;
      }
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
}

