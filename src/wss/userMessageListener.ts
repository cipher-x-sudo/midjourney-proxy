import { MessageType, getMessageType } from '../enums/MessageType';
import { MessageHandler } from './handlers/messageHandler';
import { DiscordInstance } from '../loadbalancer/discordInstance';
import { MJ_MESSAGE_HANDLED } from '../constants';

/**
 * User message listener
 */
export class UserMessageListener {
  private instance: DiscordInstance | null = null;
  private messageHandlers: MessageHandler[];

  constructor(messageHandlers: MessageHandler[]) {
    this.messageHandlers = messageHandlers.sort((a, b) => a.order() - b.order());
  }

  /**
   * Set Discord instance
   */
  setInstance(instance: DiscordInstance): void {
    this.instance = instance;
  }

  /**
   * Handle message
   */
  onMessage(raw: any): void {
    if (!this.instance) {
      return;
    }

    const eventType = raw.t;
    const messageType = getMessageType(eventType);
    
    // Pass through all events to handlers, not just MESSAGE_* events
    // This allows handlers to process INTERACTION_* events (like INTERACTION_MODAL_CREATE)
    const data = raw.d;
    
    // For MESSAGE_* events, use existing filtering logic
    if (messageType) {
      if (messageType === MessageType.DELETE) {
        return;
      }
      if (this.ignoreAndLogMessage(data, messageType)) {
        return;
      }
    } else {
      // For non-MESSAGE events (like INTERACTION_*), log for debugging
      console.debug(`[user-message-listener-${this.instance.getInstanceId()}] Received non-MESSAGE event: ${eventType}`);
    }

    // Small delay to ensure message is fully processed
    setTimeout(() => {
      for (const handler of this.messageHandlers) {
        if (data[MJ_MESSAGE_HANDLED] === true) {
          return;
        }
        // Pass both messageType (null for non-MESSAGE events) and raw event type
        handler.handle(this.instance!, messageType || MessageType.CREATE, data, eventType);
      }
    }, 50);
  }

  /**
   * Check if message should be ignored
   */
  private ignoreAndLogMessage(data: any, messageType: MessageType): boolean {
    const channelId = data.channel_id;
    const guildId = data.guild_id;
    
    // Allow DM messages (no guild_id) to pass through
    const isDM = !guildId || data.channel_type === 1;
    
    if (!this.instance) {
      return true;
    }
    
    // For non-DM messages, filter by channel_id
    if (!isDM && channelId !== this.instance.account().channelId) {
      return true;
    }

    const authorName = data.author?.username || 'System';
    const content = data.content || '';
    const channelTypeStr = isDM ? 'DM' : 'Channel';
    console.debug(
      `${this.instance.account().getDisplay()} - ${messageType} - ${channelTypeStr} - ${authorName}: ${content}`
    );

    return false;
  }
}

