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

    const messageType = getMessageType(raw.t);
    if (!messageType || messageType === MessageType.DELETE) {
      return;
    }

    const data = raw.d;
    if (this.ignoreAndLogMessage(data, messageType)) {
      return;
    }

    // Small delay to ensure message is fully processed
    setTimeout(() => {
      for (const handler of this.messageHandlers) {
        if (data[MJ_MESSAGE_HANDLED] === true) {
          return;
        }
        handler.handle(this.instance!, messageType, data);
      }
    }, 50);
  }

  /**
   * Check if message should be ignored
   */
  private ignoreAndLogMessage(data: any, messageType: MessageType): boolean {
    const channelId = data.channel_id;
    if (!this.instance || channelId !== this.instance.account().channelId) {
      return true;
    }

    const authorName = data.author?.username || 'System';
    const content = data.content || '';
    console.debug(
      `${this.instance.account().getDisplay()} - ${messageType} - ${authorName}: ${content}`
    );

    return false;
  }
}

