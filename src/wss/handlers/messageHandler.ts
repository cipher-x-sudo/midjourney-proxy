import { MessageType } from '../../enums/MessageType';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { TaskAction } from '../../enums/TaskAction';
import { TaskStatus } from '../../enums/TaskStatus';
import { Task } from '../../models/Task';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { getPrimaryPrompt, ContentParseData } from '../../utils/convertUtils';
import {
  TASK_PROPERTY_FINAL_PROMPT,
  TASK_PROPERTY_MESSAGE_ID,
  TASK_PROPERTY_MESSAGE_HASH,
  TASK_PROPERTY_FLAGS,
  MJ_MESSAGE_HANDLED,
  TASK_PROPERTY_SEED,
} from '../../constants';

/**
 * Message handler interface
 */
export abstract class MessageHandler {
  protected discordHelper: DiscordHelper;

  constructor(discordHelper: DiscordHelper) {
    this.discordHelper = discordHelper;
  }

  /**
   * Handle message
   */
  abstract handle(instance: DiscordInstance, messageType: MessageType, message: any): void;

  /**
   * Get handler order (lower = earlier)
   */
  order(): number {
    return 100;
  }

  /**
   * Get message content
   */
  protected getMessageContent(message: any): string {
    return message.content || '';
  }

  /**
   * Get message nonce
   */
  protected getMessageNonce(message: any): string {
    return message.nonce || '';
  }

  /**
   * Get interaction name
   */
  protected getInteractionName(message: any): string {
    return message.interaction?.name || '';
  }

  /**
   * Get reference message ID
   */
  protected getReferenceMessageId(message: any): string {
    return message.message_reference?.message_id || '';
  }

  /**
   * Find and finish image task
   */
  protected findAndFinishImageTask(
    instance: DiscordInstance,
    action: TaskAction,
    finalPrompt: string,
    message: any
  ): void {
    if (!finalPrompt) {
      return;
    }

    const imageUrl = this.getImageUrl(message);
    const messageHash = imageUrl ? this.discordHelper.getMessageHash(imageUrl) : null;
    
    const condition = new TaskCondition()
      .setActionSet(new Set([action]))
      .setFinalPrompt(finalPrompt)
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS]));

    if (messageHash) {
      condition.setMessageHash(messageHash);
    }

    let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;

    if (!task) {
      condition.setMessageHash(undefined);
      const tasks = instance.findRunningTask(condition.toFunction());
      task = tasks.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0] || null;
    }

    if (!task && action !== TaskAction.BLEND) {
      condition.setFinalPrompt(undefined);
      condition.setStatusSet(new Set([TaskStatus.SUBMITTED]));
      const matchPrompt = getPrimaryPrompt(finalPrompt).replace(/\s+/g, '');
      const tasks = instance.findRunningTask(condition.toFunction());
      task = tasks
        .filter(t => {
          const taskPrompt = t.promptEn || '';
          return matchPrompt === getPrimaryPrompt(taskPrompt).replace(/\s+/g, '');
        })
        .sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0] || null;
    }

    if (!task) {
      return;
    }

    message[MJ_MESSAGE_HANDLED] = true;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, finalPrompt);
    if (messageHash) {
      task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
    }
    if (imageUrl) {
      task.imageUrl = imageUrl;
    }
    this.finishTask(instance, task, message);
  }

  /**
   * Finish task
   */
  protected finishTask(instance: DiscordInstance, task: Task, message: any): void {
    if (message.id) {
      task.setProperty(TASK_PROPERTY_MESSAGE_ID, message.id);
    }
    task.setProperty(TASK_PROPERTY_FLAGS, message.flags || 0);
    if (task.imageUrl) {
      const messageHash = this.discordHelper.getMessageHash(task.imageUrl);
      if (messageHash) {
        task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
      }
    }
    task.success();

    // Automatically react with envelope emoji to request seed
    if (task.imageUrl && message.id) {
      const messageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID) || message.id;
      const channelId = instance.account().channelId;
      
      // Only react if we have both messageId and channelId
      if (messageId && channelId) {
        const envelopeEmoji = '\u{2709}\u{FE0F}'; // ✉️ envelope emoji (U+2709 with variation selector)
        
        // Fire-and-forget: react with envelope emoji (don't await, don't block)
        instance.reactWithEmoji(messageId, channelId, envelopeEmoji).catch((error: any) => {
          console.warn(`[message-handler] Failed to react with envelope emoji for task ${task.id}:`, error.message);
        });
      }
    }
  }

  /**
   * Check if message has image
   */
  protected hasImage(message: any): boolean {
    return message.attachments && message.attachments.length > 0;
  }

  /**
   * Get image URL
   */
  protected getImageUrl(message: any): string | null {
    if (message.attachments && message.attachments.length > 0) {
      const imageUrl = message.attachments[0].url;
      return this.replaceCdnUrl(imageUrl);
    }
    return null;
  }

  /**
   * Replace CDN URL
   */
  protected replaceCdnUrl(imageUrl: string): string {
    if (!imageUrl) {
      return imageUrl;
    }
    const cdn = this.discordHelper.getCdn();
    if (imageUrl.startsWith(cdn)) {
      return imageUrl;
    }
    const DISCORD_CDN_URL = 'https://cdn.discordapp.com';
    return imageUrl.replace(DISCORD_CDN_URL, cdn);
  }
}

