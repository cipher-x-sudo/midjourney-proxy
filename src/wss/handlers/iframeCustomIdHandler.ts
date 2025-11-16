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
      
      // Try to extract iframe custom_id from the message
      const iframeCustomId = instance.extractIframeCustomId(message);
      
      if (iframeCustomId) {
        console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Found iframe custom_id in ${eventTypeStr} event for message ${messageId}: ${iframeCustomId}`);
        
        // Notify any pending listeners waiting for this message ID
        if (instance.notifyIframeCustomId) {
          instance.notifyIframeCustomId(messageId, iframeCustomId);
        }
      } else {
        // Log when we check a message but don't find iframe (for debugging)
        // Only log if message has components or embeds (might contain iframe)
        if (message.components || message.embeds) {
          console.debug(`[iframe-custom-id-handler-${instance.getInstanceId()}] Checked ${eventTypeStr} event for message ${messageId} - no iframe custom_id found`);
        }
      }
      return;
    }

    // Handle INTERACTION_MODAL_CREATE or INTERACTION_IFRAME_MODAL_CREATE events
    if (eventTypeStr === 'INTERACTION_MODAL_CREATE' || eventTypeStr === 'INTERACTION_IFRAME_MODAL_CREATE') {
      console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Received ${eventTypeStr} event`);
      console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Interaction event data structure:`, JSON.stringify(message).substring(0, 1000));
      
      // Extract custom_id from interaction data
      // The interaction might have custom_id directly, or in data.url, or in data.custom_id
      let iframeCustomId: string | null = null;
      
      // Check for custom_id in various locations
      if (message.custom_id && typeof message.custom_id === 'string' && message.custom_id.includes('MJ::iframe::')) {
        iframeCustomId = message.custom_id;
        console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Found custom_id in message.custom_id: ${iframeCustomId}`);
      } else if (message.data?.custom_id && typeof message.data.custom_id === 'string' && message.data.custom_id.includes('MJ::iframe::')) {
        iframeCustomId = message.data.custom_id;
        console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Found custom_id in message.data.custom_id: ${iframeCustomId}`);
      } else if (message.url && typeof message.url === 'string') {
        // Extract from URL if present
        console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Checking message.url for iframe custom_id: ${message.url.substring(0, 200)}`);
        iframeCustomId = instance.extractIframeCustomId({ content: message.url });
      } else {
        // Try recursive extraction from the entire interaction object
        console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Attempting recursive extraction from interaction object`);
        iframeCustomId = instance.extractIframeCustomId(message);
      }
      
      if (iframeCustomId) {
        console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Found iframe custom_id in ${eventTypeStr} event: ${iframeCustomId}`);
        
        // For interaction events, we need to match by message_id from the interaction
        // The interaction should have a message_id (the original message where button was clicked)
        const messageId = message.message?.id || message.message_id || message.data?.message_id;
        
        if (messageId && instance.notifyIframeCustomId) {
          console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Notifying pending listener for message ${messageId} with custom_id: ${iframeCustomId}`);
          instance.notifyIframeCustomId(messageId, iframeCustomId);
        } else {
          // If no message_id, try to notify all pending listeners (fallback)
          console.warn(`[iframe-custom-id-handler-${instance.getInstanceId()}] Found iframe custom_id in ${eventTypeStr} but no message_id to match. Custom_id: ${iframeCustomId}`);
          console.warn(`[iframe-custom-id-handler-${instance.getInstanceId()}] Interaction structure - message: ${message.message?.id}, message_id: ${message.message_id}, data.message_id: ${message.data?.message_id}`);
        }
      } else {
        console.debug(`[iframe-custom-id-handler-${instance.getInstanceId()}] Checked ${eventTypeStr} event - no iframe custom_id found. Full message structure:`, JSON.stringify(message).substring(0, 2000));
      }
      return;
    }

    // Handle INTERACTION_CREATE events (button clicks)
    if (eventTypeStr === 'INTERACTION_CREATE') {
      // This is when the button is clicked - the iframe modal will be created after this
      // We can log this for debugging but don't extract custom_id here yet
      if (message.data?.custom_id && message.data.custom_id.includes('MJ::Inpaint::')) {
        console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Detected Inpaint button click via INTERACTION_CREATE - waiting for modal creation event`);
      }
      return;
    }
  }
}

