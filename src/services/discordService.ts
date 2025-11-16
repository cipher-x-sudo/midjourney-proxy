import { Message } from '../result/Message';
import { BlendDimensions, getBlendDimensionsValue } from '../enums/BlendDimensions';
import { DataUrl } from '../utils/convertUtils';
import { DiscordAccount } from '../models/DiscordAccount';
import { DiscordHelper } from '../support/discordHelper';
import axios, { AxiosInstance } from 'axios';
import { ReturnCode } from '../constants';

/**
 * Discord service interface
 */
export interface DiscordService {
  imagine(prompt: string, nonce: string): Promise<Message<void>>;
  upscale(messageId: string, index: number, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>>;
  variation(messageId: string, index: number, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>>;
  reroll(messageId: string, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>>;
  describe(finalFileName: string, nonce: string): Promise<Message<void>>;
  shorten(prompt: string, nonce: string): Promise<Message<void>>;
  blend(finalFileNames: string[], dimensions: BlendDimensions, nonce: string): Promise<Message<void>>;
  upload(fileName: string, dataUrl: DataUrl): Promise<Message<string>>;
  sendImageMessage(content: string, finalFileName: string): Promise<Message<string>>;
  reactWithEmoji(messageId: string, channelId: string, emoji: string): Promise<Message<void>>;
  removeOwnReaction(messageId: string, channelId: string, emoji: string): Promise<Message<void>>;
  customAction(messageId: string, messageFlags: number, customId: string, nonce: string): Promise<Message<void>>;
  modalSubmit(taskId: string, fields: { prompt?: string; maskBase64?: string }, nonce: string): Promise<Message<void>>;
  edits(messageId: string, customId: string, nonce: string): Promise<Message<void>>;
  submitInpaint(customId: string, maskBase64: string, prompt: string): Promise<Message<void>>;
  fetchMessage(messageId: string): Promise<Message<any>>;
  extractIframeCustomId(message: any): string | null;
}

/**
 * Discord service implementation
 */
export class DiscordServiceImpl implements DiscordService {
  private static readonly DEFAULT_SESSION_ID = 'f1a313a09ce079ce252459dc70231f30';
  private account: DiscordAccount;
  private paramsMap: Map<string, any>;
  private httpClient: AxiosInstance;
  private discordHelper: DiscordHelper;
  private discordInteractionUrl: string;
  private discordAttachmentUrl: string;
  private discordMessageUrl: string;
  private sessionId: string | null = null;
  private getSessionIdCallback: (() => string | null) | null = null;

  constructor(account: DiscordAccount, paramsMap: Map<string, any>, discordHelper: DiscordHelper) {
    this.account = account;
    this.paramsMap = paramsMap;
    this.discordHelper = discordHelper;
    
    const discordServer = this.discordHelper.getServer();
    this.discordInteractionUrl = `${discordServer}/api/v9/interactions`;
    this.discordAttachmentUrl = `${discordServer}/api/v9/channels/${account.channelId}/attachments`;
    this.discordMessageUrl = `${discordServer}/api/v9/channels/${account.channelId}/messages`;

    // Create HTTP client with Discord headers
    this.httpClient = axios.create({
      headers: {
        'Authorization': account.userToken,
        'Content-Type': 'application/json',
        'User-Agent': account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }

  /**
   * Set session ID getter callback
   */
  setSessionIdGetter(callback: () => string | null): void {
    this.getSessionIdCallback = callback;
  }

  /**
   * Set session ID directly
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  /**
   * Get current session ID
   */
  private getSessionId(): string {
    // Try callback first (dynamic from gateway)
    if (this.getSessionIdCallback) {
      const callbackSessionId = this.getSessionIdCallback();
      if (callbackSessionId) {
        console.debug(`[discord-service-${this.account.getDisplay()}] Using session ID from gateway: ${callbackSessionId}`);
        return callbackSessionId;
      }
    }
    // Try stored session ID
    if (this.sessionId) {
      console.debug(`[discord-service-${this.account.getDisplay()}] Using stored session ID: ${this.sessionId}`);
      return this.sessionId;
    }
    // Fall back to default (for backward compatibility, though this should not happen in normal operation)
    console.warn(`[discord-service-${this.account.getDisplay()}] WARNING: No session ID available, using default. This should not happen in normal operation.`);
    return DiscordServiceImpl.DEFAULT_SESSION_ID;
  }

  /**
   * Replace interaction parameters
   */
  private replaceInteractionParams(template: string, nonce: string): string {
    const sessionId = this.getSessionId();
    return template
      .replace('$guild_id', this.account.guildId || '')
      .replace('$channel_id', this.account.channelId || '')
      .replace('$session_id', sessionId)
      .replace('$nonce', nonce);
  }

  /**
   * Post JSON and check status
   */
  private async postJsonAndCheckStatus(json: string): Promise<Message<void>> {
    try {
      const payload = JSON.parse(json);
      const sessionId = payload.session_id;
      console.debug(`[discord-service-${this.account.getDisplay()}] Sending interaction to Discord - sessionId:${sessionId}, type:${payload.type}, guildId:${payload.guild_id}, channelId:${payload.channel_id}`);
      
      const response = await this.httpClient.post(this.discordInteractionUrl, payload);
      if (response.status === 200 || response.status === 204) {
        console.debug(`[discord-service-${this.account.getDisplay()}] Interaction sent successfully - status:${response.status}`);
        return Message.success<void>();
      }
      console.warn(`[discord-service-${this.account.getDisplay()}] Interaction failed - HTTP ${response.status}`);
      return Message.failureWithDescription<void>(`HTTP ${response.status}`);
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        console.error(`[discord-service-${this.account.getDisplay()}] Discord API error - HTTP ${status}: ${statusText}`, errorData);
        return Message.failureWithDescription<void>(`HTTP ${status}: ${statusText}`);
      }
      console.error(`[discord-service-${this.account.getDisplay()}] Request error:`, error.message);
      return Message.failureWithDescription<void>(error.message);
    }
  }

  async imagine(prompt: string, nonce: string): Promise<Message<void>> {
    const paramsStr = this.replaceInteractionParams(this.paramsMap.get('imagine'), nonce);
    const params = JSON.parse(paramsStr);
    params.data.options[0].value = prompt;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async upscale(messageId: string, index: number, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>> {
    let paramsStr = this.replaceInteractionParams(this.paramsMap.get('upscale'), nonce)
      .replace('$message_id', messageId)
      .replace('$index', String(index))
      .replace('$message_hash', messageHash);
    const params = JSON.parse(paramsStr);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async variation(messageId: string, index: number, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>> {
    let paramsStr = this.replaceInteractionParams(this.paramsMap.get('variation'), nonce)
      .replace('$message_id', messageId)
      .replace('$index', String(index))
      .replace('$message_hash', messageHash);
    const params = JSON.parse(paramsStr);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async reroll(messageId: string, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>> {
    let paramsStr = this.replaceInteractionParams(this.paramsMap.get('reroll'), nonce)
      .replace('$message_id', messageId)
      .replace('$message_hash', messageHash);
    const params = JSON.parse(paramsStr);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async describe(finalFileName: string, nonce: string): Promise<Message<void>> {
    const fileName = finalFileName.substring(finalFileName.lastIndexOf('/') + 1);
    const paramsStr = this.replaceInteractionParams(this.paramsMap.get('describe'), nonce)
      .replace('$file_name', fileName)
      .replace('$final_file_name', finalFileName);
    return this.postJsonAndCheckStatus(paramsStr);
  }

  async shorten(prompt: string, nonce: string): Promise<Message<void>> {
    const paramsStr = this.replaceInteractionParams(this.paramsMap.get('shorten'), nonce);
    const params = JSON.parse(paramsStr);
    params.data.options[0].value = prompt;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async blend(finalFileNames: string[], dimensions: BlendDimensions, nonce: string): Promise<Message<void>> {
    const paramsStr = this.replaceInteractionParams(this.paramsMap.get('blend'), nonce);
    const params = JSON.parse(paramsStr);
    const options = params.data.options || [];
    const attachments = params.data.attachments || [];
    
    for (let i = 0; i < finalFileNames.length; i++) {
      const finalFileName = finalFileNames[i];
      const fileName = finalFileName.substring(finalFileName.lastIndexOf('/') + 1);
      attachments.push({
        id: String(i),
        filename: fileName,
        uploaded_filename: finalFileName,
      });
      options.push({
        type: 11,
        name: `image${i + 1}`,
        value: i,
      });
    }
    
    // Add dimensions option
    options.push({
      type: 3,
      name: 'dimensions',
      value: `--ar ${getBlendDimensionsValue(dimensions)}`,
    });
    
    params.data.options = options;
    params.data.attachments = attachments;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async customAction(messageId: string, messageFlags: number, customId: string, nonce: string): Promise<Message<void>> {
    let paramsStr = this.replaceInteractionParams(this.paramsMap.get('custom-action'), nonce)
      .replace('$message_id', messageId)
      .replace('$custom_id', customId);
    const params = JSON.parse(paramsStr);
    params.message_flags = messageFlags;
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async modalSubmit(taskId: string, fields: { prompt?: string; maskBase64?: string }, nonce: string): Promise<Message<void>> {
    let paramsStr = this.replaceInteractionParams(this.paramsMap.get('modal-submit'), nonce)
      .replace('$task_id', taskId);
    const params = JSON.parse(paramsStr);

    // Fill fields if present
    if (fields && params.data) {
      if (typeof fields.prompt === 'string') {
        params.data.prompt = fields.prompt;
      }
      if (typeof fields.maskBase64 === 'string') {
        params.data.maskBase64 = fields.maskBase64;
      }
    }
    return this.postJsonAndCheckStatus(JSON.stringify(params));
  }

  async edits(messageId: string, customId: string, nonce: string): Promise<Message<void>> {
    // Use edits template (button interaction format)
    const editsTemplate = this.paramsMap.get('edits');
    if (editsTemplate) {
      let paramsStr = this.replaceInteractionParams(editsTemplate, nonce)
        .replace('$message_id', messageId)
        .replace('$custom_id', customId);
      const params = JSON.parse(paramsStr);
      return this.postJsonAndCheckStatus(JSON.stringify(params));
    }

    // Fallback: Use custom action format
    const customActionTemplate = this.paramsMap.get('custom-action');
    if (customActionTemplate) {
      let paramsStr = this.replaceInteractionParams(customActionTemplate, nonce)
        .replace('$message_id', messageId)
        .replace('$custom_id', customId);
      const params = JSON.parse(paramsStr);
      return this.postJsonAndCheckStatus(JSON.stringify(params));
    }

    return Message.failureWithDescription<void>('Edits template not found');
  }

  async submitInpaint(customId: string, maskBase64: string, prompt: string): Promise<Message<void>> {
    try {
      // Extract raw base64 from data URL if needed
      let maskData = maskBase64;
      if (maskBase64.startsWith('data:')) {
        const base64Match = maskBase64.match(/base64,(.+)$/);
        if (base64Match) {
          maskData = base64Match[1];
        }
      }

      // Call the direct inpaint API endpoint
      const inpaintUrl = `https://936929561302675456.discordsays.com/.proxy/inpaint/api/submit-job`;
      
      const payload = {
        username: '0',
        userId: '0',
        customId: customId,
        mask: maskData,
        prompt: prompt,
        full_prompt: null
      };

      const response = await this.httpClient.post(inpaintUrl, payload, {
        headers: {
          'Authorization': this.account.userToken,
          'Content-Type': 'application/json',
          'User-Agent': this.account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (response.status === 200 || response.status === 201) {
        console.debug(`[discord-service-${this.account.getDisplay()}] Inpaint job submitted successfully`);
        return Message.success<void>();
      }
      
      console.warn(`[discord-service-${this.account.getDisplay()}] Inpaint submission failed - HTTP ${response.status}`);
      return Message.failureWithDescription<void>(`HTTP ${response.status}`);
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        console.error(`[discord-service-${this.account.getDisplay()}] Inpaint API error - HTTP ${status}: ${statusText}`, errorData);
        return Message.failureWithDescription<void>(`HTTP ${status}: ${statusText}`);
      }
      console.error(`[discord-service-${this.account.getDisplay()}] Inpaint request error:`, error.message);
      return Message.failureWithDescription<void>(error.message);
    }
  }

  async upload(fileName: string, dataUrl: DataUrl): Promise<Message<string>> {
    try {
      // First, request upload URL
      const fileObj = {
        filename: fileName,
        file_size: dataUrl.data.length,
        id: '0',
      };
      const params = {
        files: [fileObj],
      };

      const response = await this.httpClient.post(this.discordAttachmentUrl, params);
      if (response.status !== 200 || !response.data.attachments || response.data.attachments.length === 0) {
        return Message.failureWithDescription<string>('Failed to get upload URL');
      }

      const attachment = response.data.attachments[0];
      const uploadUrl = attachment.upload_url;
      const uploadFilename = attachment.upload_filename;

      // Replace upload URL if ngDiscord upload server is configured
      const actualUploadUrl = this.discordHelper.getDiscordUploadUrl(uploadUrl);

      // Upload file
      await this.httpClient.put(actualUploadUrl, dataUrl.data, {
        headers: {
          'Content-Type': dataUrl.mimeType,
          'Content-Length': String(dataUrl.data.length),
          'User-Agent': this.account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      return Message.successWithResult<string>(uploadFilename);
    } catch (error: any) {
      console.error('Failed to upload image to Discord:', error);
      return Message.failureWithDescription<string>(error.message);
    }
  }

  async sendImageMessage(content: string, finalFileName: string): Promise<Message<string>> {
    try {
      const fileName = finalFileName.substring(finalFileName.lastIndexOf('/') + 1);
      const messageTemplate = this.paramsMap.get('message');
      if (!messageTemplate) {
        return Message.failureWithDescription<string>('Message template not found');
      }
      
      const payloadStr = messageTemplate
        .replace('$content', content)
        .replace('$channel_id', this.account.channelId || '')
        .replace('$file_name', fileName)
        .replace('$final_file_name', finalFileName);
      
      const payload = JSON.parse(payloadStr);
      const response = await this.httpClient.post(this.discordMessageUrl, payload);
      
      if (response.status === 200) {
        const attachments = response.data.attachments;
        if (attachments && attachments.length > 0) {
          // Return image URL for use in imagine commands
          // The URL is what's needed for referencing images in prompts
          return Message.successWithResult<string>(attachments[0].url);
        }
      }
      return Message.failureWithDescription<string>('Failed to send image message: image does not exist');
    } catch (error: any) {
      console.error('Failed to send image message to Discord:', error);
      return Message.failureWithDescription<string>(error.message);
    }
  }

  async reactWithEmoji(messageId: string, channelId: string, emoji: string): Promise<Message<void>> {
    try {
      const discordServer = this.discordHelper.getServer();
      // URL encode the emoji for the API endpoint
      const encodedEmoji = encodeURIComponent(emoji);
      const reactionUrl = `${discordServer}/api/v9/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`;
      
      console.debug(`[discord-service-${this.account.getDisplay()}] Reacting with emoji ${emoji} to message ${messageId} in channel ${channelId}`);
      
      const response = await this.httpClient.put(reactionUrl, {});
      
      if (response.status === 204) {
        console.debug(`[discord-service-${this.account.getDisplay()}] Reaction sent successfully`);
        return Message.success<void>();
      }
      console.warn(`[discord-service-${this.account.getDisplay()}] Reaction failed - HTTP ${response.status}`);
      return Message.failureWithDescription<void>(`HTTP ${response.status}`);
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        console.error(`[discord-service-${this.account.getDisplay()}] Discord reaction API error - HTTP ${status}: ${statusText}`, errorData);
        return Message.failureWithDescription<void>(`HTTP ${status}: ${statusText}`);
      }
      console.error(`[discord-service-${this.account.getDisplay()}] Reaction request error:`, error.message);
      return Message.failureWithDescription<void>(error.message);
    }
  }

  async removeOwnReaction(messageId: string, channelId: string, emoji: string): Promise<Message<void>> {
    try {
      const discordServer = this.discordHelper.getServer();
      const encodedEmoji = encodeURIComponent(emoji);
      const reactionUrl = `${discordServer}/api/v9/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`;
      
      console.debug(`[discord-service-${this.account.getDisplay()}] Removing own reaction ${emoji} from message ${messageId} in channel ${channelId}`);
      
      const response = await this.httpClient.delete(reactionUrl);
      if (response.status === 204) {
        console.debug(`[discord-service-${this.account.getDisplay()}] Reaction removed successfully`);
        return Message.success<void>();
      }
      console.warn(`[discord-service-${this.account.getDisplay()}] Remove reaction failed - HTTP ${response.status}`);
      return Message.failureWithDescription<void>(`HTTP ${response.status}`);
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        console.error(`[discord-service-${this.account.getDisplay()}] Discord remove reaction API error - HTTP ${status}: ${statusText}`, errorData);
        return Message.failureWithDescription<void>(`HTTP ${status}: ${statusText}`);
      }
      console.error(`[discord-service-${this.account.getDisplay()}] Remove reaction request error:`, error.message);
      return Message.failureWithDescription<void>(error.message);
    }
  }

  async fetchMessage(messageId: string): Promise<Message<any>> {
    try {
      const discordServer = this.discordHelper.getServer();
      const messageUrl = `${discordServer}/api/v9/channels/${this.account.channelId}/messages/${messageId}`;
      
      console.debug(`[discord-service-${this.account.getDisplay()}] Fetching message ${messageId} from channel ${this.account.channelId}`);
      
      const response = await this.httpClient.get(messageUrl);
      
      if (response.status === 200) {
        console.debug(`[discord-service-${this.account.getDisplay()}] Message fetched successfully`);
        return Message.successWithResult<any>(response.data);
      }
      
      console.warn(`[discord-service-${this.account.getDisplay()}] Fetch message failed - HTTP ${response.status}`);
      return Message.failureWithDescription<any>(`HTTP ${response.status}`);
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        console.error(`[discord-service-${this.account.getDisplay()}] Discord fetch message API error - HTTP ${status}: ${statusText}`, errorData);
        return Message.failureWithDescription<any>(`HTTP ${status}: ${statusText}`);
      }
      console.error(`[discord-service-${this.account.getDisplay()}] Fetch message request error:`, error.message);
      return Message.failureWithDescription<any>(error.message);
    }
  }

  /**
   * Extract iframe custom_id from Discord message
   * Looks for iframe URL pattern: https://936929561302675456.discordsays.com/.proxy/inpaint/index.html?custom_id=MJ::iframe::...
   * @param message Discord message object
   * @returns The MJ::iframe:: custom_id if found, null otherwise
   */
  extractIframeCustomId(message: any): string | null {
    console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId called`);
    
    if (!message) {
      console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Message is null/undefined`);
      return null;
    }

    // Check embeds for iframe URL
    if (message.embeds && Array.isArray(message.embeds)) {
      console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking ${message.embeds.length} embed(s)`);
      
      for (let i = 0; i < message.embeds.length; i++) {
        const embed = message.embeds[i];
        
        // Check embed URL
        if (embed.url) {
          console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking embed[${i}].url: ${embed.url}`);
          const customId = this.extractCustomIdFromUrl(embed.url);
          if (customId) {
            console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Found custom_id in embed[${i}].url: ${customId}`);
            return customId;
          }
        }
        
        // Check embed fields for URLs
        if (embed.fields && Array.isArray(embed.fields)) {
          console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking ${embed.fields.length} field(s) in embed[${i}]`);
          
          for (let j = 0; j < embed.fields.length; j++) {
            const field = embed.fields[j];
            if (field.value && typeof field.value === 'string') {
              console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking embed[${i}].fields[${j}].value (length: ${field.value.length})`);
              const customId = this.extractCustomIdFromUrl(field.value);
              if (customId) {
                console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Found custom_id in embed[${i}].fields[${j}].value: ${customId}`);
                return customId;
              }
            }
          }
        }
      }
    } else {
      console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - No embeds found or embeds is not an array`);
    }

    // Check components for iframe URL
    if (message.components && Array.isArray(message.components)) {
      console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking ${message.components.length} component(s)`);
      
      for (let i = 0; i < message.components.length; i++) {
        const component = message.components[i];
        
        if (component.components && Array.isArray(component.components)) {
          console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking ${component.components.length} sub-component(s) in component[${i}]`);
          
          for (let j = 0; j < component.components.length; j++) {
            const subComponent = component.components[j];
            
            // Check button URL
            if (subComponent.url) {
              console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking component[${i}].components[${j}].url: ${subComponent.url}`);
              const customId = this.extractCustomIdFromUrl(subComponent.url);
              if (customId) {
                console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Found custom_id in component[${i}].components[${j}].url: ${customId}`);
                return customId;
              }
            }
            
            // Check if custom_id itself is an iframe custom_id
            if (subComponent.custom_id) {
              console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking component[${i}].components[${j}].custom_id: ${subComponent.custom_id}`);
              if (subComponent.custom_id.includes('MJ::iframe::')) {
                console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Found iframe custom_id directly: ${subComponent.custom_id}`);
                return subComponent.custom_id;
              }
            }
          }
        }
      }
    } else {
      console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - No components found or components is not an array`);
    }

    // Check message content for iframe URL
    if (message.content && typeof message.content === 'string') {
      console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Checking message.content (length: ${message.content.length})`);
      const customId = this.extractCustomIdFromUrl(message.content);
      if (customId) {
        console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - Found custom_id in message.content: ${customId}`);
        return customId;
      }
    } else {
      console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - No message.content or content is not a string`);
    }

    console.log(`[discord-service-${this.account.getDisplay()}] extractIframeCustomId - No iframe custom_id found in message`);
    return null;
  }

  /**
   * Extract custom_id from URL if it matches the inpaint iframe pattern
   * @param url URL string to check
   * @returns The MJ::iframe:: custom_id if found, null otherwise
   */
  private extractCustomIdFromUrl(url: string): string | null {
    try {
      console.log(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - Checking URL: ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
      
      // Pattern: https://936929561302675456.discordsays.com/.proxy/inpaint/index.html?custom_id=MJ::iframe::...
      const iframeUrlPattern = /936929561302675456\.discordsays\.com\/\.proxy\/inpaint\/index\.html/;
      
      if (!iframeUrlPattern.test(url)) {
        console.log(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - URL does not match iframe pattern`);
        return null;
      }

      console.log(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - URL matches iframe pattern, parsing...`);

      // Ensure URL has protocol for parsing
      let urlToParse = url;
      const originalUrl = url;
      if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
        urlToParse = 'https://' + urlToParse;
        console.log(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - Added https:// protocol: ${urlToParse.substring(0, 100)}...`);
      }

      // Extract custom_id from URL query parameters
      const urlObj = new URL(urlToParse);
      const customId = urlObj.searchParams.get('custom_id');
      
      console.log(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - Extracted custom_id param: ${customId ? customId.substring(0, 50) + '...' : 'null'}`);
      
      if (customId && customId.includes('MJ::iframe::')) {
        console.log(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - SUCCESS - Found iframe custom_id: ${customId}`);
        return customId;
      } else {
        console.log(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - custom_id param does not contain 'MJ::iframe::'`);
      }
    } catch (error: any) {
      // URL parsing failed, not a valid URL or doesn't match pattern
      console.error(`[discord-service-${this.account.getDisplay()}] extractCustomIdFromUrl - Error parsing URL: ${error.message}`, error);
      return null;
    }

    return null;
  }
}

