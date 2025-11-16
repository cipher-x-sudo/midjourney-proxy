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
   * Handle message update events to extract iframe custom_id
   */
  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    // Only handle CREATE and UPDATE events (iframe might appear in either)
    if (messageType !== MessageType.CREATE && messageType !== MessageType.UPDATE) {
      return;
    }

    // Check if message has an ID (required for matching)
    if (!message.id) {
      return;
    }

    const messageId = message.id;
    
    // Try to extract iframe custom_id from the message
    const iframeCustomId = instance.extractIframeCustomId(message);
    
    if (iframeCustomId) {
      console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Found iframe custom_id in ${messageType} event for message ${messageId}: ${iframeCustomId}`);
      
      // Notify any pending listeners waiting for this message ID
      if (instance.notifyIframeCustomId) {
        instance.notifyIframeCustomId(messageId, iframeCustomId);
      }
    } else {
      // Log when we check a message but don't find iframe (for debugging)
      // Only log if message has components or embeds (might contain iframe)
      if (message.components || message.embeds) {
        console.debug(`[iframe-custom-id-handler-${instance.getInstanceId()}] Checked ${messageType} event for message ${messageId} - no iframe custom_id found`);
      }
    }
  }
}

