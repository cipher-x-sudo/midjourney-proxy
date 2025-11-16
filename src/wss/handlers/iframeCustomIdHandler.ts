import { MessageHandler } from './messageHandler';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { MessageType } from '../../enums/MessageType';
import { DiscordHelper } from '../../support/discordHelper';

/**
 * Handler for extracting iframe custom_id from WebSocket MESSAGE_UPDATE events
 * This handler listens for message updates that contain iframe modal data after clicking vary region button
 */
export class IframeCustomIdHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  /**
   * Handler order - run early to catch iframe events quickly
   */
  order(): number {
    return 10;
  }

  /**
   * Handle message update events and interaction events to extract iframe custom_id
   */
  handle(instance: DiscordInstance, messageType: MessageType, message: any, eventType?: string): void {
    const eventTypeStr = eventType || 'UNKNOWN';
    
    // Handle MESSAGE_CREATE and MESSAGE_UPDATE events
    if (messageType === MessageType.CREATE || messageType === MessageType.UPDATE) {
      // Check if message has an ID (required for matching)
      if (!message.id) {
        return;
      }

      const messageId = message.id;
      
      // Try to extract iframe data from the message
      const iframeData = instance.extractIframeCustomId(message);
      
      if (iframeData) {
        console.log(`[iframe-result-${instance.getInstanceId()}] Found iframe data in ${eventTypeStr} event for message ${messageId}: custom_id=${iframeData.custom_id.substring(0, 50)}..., instance_id=${iframeData.instance_id ? 'present' : 'missing'}, frame_id=${iframeData.frame_id || 'missing'}`);
        
        // Notify any pending listeners waiting for this message ID
        if (instance.notifyIframeCustomId) {
          console.log(`[iframe-notify-${instance.getInstanceId()}] Notifying pending listener for message ${messageId} with iframe data`);
          instance.notifyIframeCustomId(messageId, iframeData);
        }
      } else {
        // Log when we check a message but don't find iframe (for debugging)
        // Only log if message has components or embeds (might contain iframe)
        if (message.components || message.embeds) {
          console.debug(`[iframe-result-${instance.getInstanceId()}] Checked ${eventTypeStr} event for message ${messageId} - no iframe data found`);
        }
      }
      return;
    }

    // Handle INTERACTION_MODAL_CREATE or INTERACTION_IFRAME_MODAL_CREATE events
    if (eventTypeStr === 'INTERACTION_MODAL_CREATE' || eventTypeStr === 'INTERACTION_IFRAME_MODAL_CREATE') {
      console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Received ${eventTypeStr} event`);
      
      // Debug: Search for URLs in the entire message object
      const allUrls: Array<{ path: string; url: string }> = [];
      const findUrlsInObject = (obj: any, path: string = ''): void => {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const currentPath = path ? `${path}.${key}` : key;
            if (typeof value === 'string' && value.includes('discordsays.com')) {
              allUrls.push({ path: currentPath, url: value });
            } else if (value && typeof value === 'object') {
              findUrlsInObject(value, currentPath);
            }
          }
        }
      };
      findUrlsInObject(message);
      
      if (allUrls.length > 0) {
        console.log(`[iframe-url-${instance.getInstanceId()}] Found ${allUrls.length} iframe URL(s) in interaction event:`);
        allUrls.forEach((item, idx) => {
          console.log(`[iframe-url-${instance.getInstanceId()}]   iframe-url[${idx}]: ${item.path} = ${item.url.substring(0, 200)}${item.url.length > 200 ? '...' : ''}`);
        });
      } else {
        console.log(`[iframe-url-${instance.getInstanceId()}] No iframe URLs found in interaction event structure`);
      }
      
      // Debug: Log interaction event structure
      console.log(`[iframe-structure-${instance.getInstanceId()}] Interaction event data structure:`, JSON.stringify(message).substring(0, 2000));
      
      // Extract iframe data from interaction data
      // The interaction might have custom_id directly, or in data.url, or in data.custom_id
      let iframeData = null;
      
      // Debug: Check common URL locations
      console.log(`[iframe-location-${instance.getInstanceId()}] Checking common URL locations in interaction event`);
      const urlLocations = [
        { name: 'message.url', value: message.url },
        { name: 'message.data.url', value: message.data?.url },
        { name: 'message.data.iframeUrl', value: message.data?.iframeUrl },
        { name: 'message.data.iframe_url', value: message.data?.iframe_url },
        { name: 'message.iframeUrl', value: message.iframeUrl },
        { name: 'message.iframe_url', value: message.iframe_url },
        { name: 'message.src', value: message.src },
        { name: 'message.href', value: message.href },
      ];
      
      for (const location of urlLocations) {
        if (location.value && typeof location.value === 'string' && location.value.includes('discordsays.com')) {
          console.log(`[iframe-location-${instance.getInstanceId()}] Found URL in ${location.name}: ${location.value.substring(0, 200)}`);
          iframeData = instance.extractIframeCustomId({ content: location.value });
          if (iframeData) {
            console.log(`[iframe-location-${instance.getInstanceId()}] Successfully extracted iframe data from ${location.name}`);
            break;
          }
        }
      }
      
      // If no URL found, try recursive extraction from the entire interaction object
      if (!iframeData) {
        console.log(`[iframe-recursive-${instance.getInstanceId()}] No URL found in common locations, attempting recursive extraction from interaction object`);
        iframeData = instance.extractIframeCustomId(message);
      }
      
      if (iframeData) {
        console.log(`[iframe-result-${instance.getInstanceId()}] Found iframe data in ${eventTypeStr} event: custom_id=${iframeData.custom_id.substring(0, 50)}..., instance_id=${iframeData.instance_id ? 'present' : 'missing'}, frame_id=${iframeData.frame_id || 'missing'}`);
        
        // For interaction events, we need to match by message_id from the interaction
        // The interaction should have a message_id (the original message where button was clicked)
        const messageId = message.message?.id || message.message_id || message.data?.message_id;
        
        if (messageId && instance.notifyIframeCustomId) {
          console.log(`[iframe-notify-${instance.getInstanceId()}] Notifying pending listener for message ${messageId} with iframe data`);
          instance.notifyIframeCustomId(messageId, iframeData);
        } else {
          // If no message_id, try to notify all pending listeners (fallback)
          console.warn(`[iframe-notify-${instance.getInstanceId()}] Found iframe data in ${eventTypeStr} but no message_id to match. Custom_id: ${iframeData.custom_id.substring(0, 50)}...`);
          console.warn(`[iframe-notify-${instance.getInstanceId()}] Interaction structure - message: ${message.message?.id}, message_id: ${message.message_id}, data.message_id: ${message.data?.message_id}`);
        }
      } else {
        console.debug(`[iframe-result-${instance.getInstanceId()}] Checked ${eventTypeStr} event - no iframe data found`);
      }
      return;
    }

    // Handle INTERACTION_CREATE events (button clicks)
    if (eventTypeStr === 'INTERACTION_CREATE') {
      // This is when the button is clicked - the iframe modal will be created after this
      // We can log this for debugging but don't extract custom_id here yet
      if (message.data?.custom_id && message.data.custom_id.includes('MJ::Inpaint::')) {
        console.log(`[iframe-click-${instance.getInstanceId()}] Detected Inpaint button click via INTERACTION_CREATE - waiting for modal creation event`);
      }
      return;
    }
  }
}

