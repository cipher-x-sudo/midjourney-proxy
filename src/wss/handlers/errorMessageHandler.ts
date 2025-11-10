import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * Error message handler
 */
export class ErrorMessageHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    return 2;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const content = this.getMessageContent(message);
    
    if (content.startsWith('Failed')) {
      // Official MJ error
      message[MJ_MESSAGE_HANDLED] = true;
      const nonce = this.getMessageNonce(message);
      const task = instance.getRunningTaskByNonce(nonce);
      if (task) {
        task.fail(content);
      }
      return;
    }

    const embeds = message.embeds;
    if (!embeds || embeds.length === 0) {
      return;
    }

    const embed = embeds[0];
    const title = embed.title || '';
    if (!title) {
      return;
    }

    const description = embed.description || '';
    const footerText = embed.footer?.text || '';
    const color = embed.color || 0;

    if (color === 16239475) {
      console.warn(`${instance.getInstanceId()} - MJ警告信息: ${title}\n${description}\nfooter: ${footerText}`);
    } else if (color === 16711680) {
      message[MJ_MESSAGE_HANDLED] = true;
      console.error(`${instance.getInstanceId()} - MJ异常信息: ${title}\n${description}\nfooter: ${footerText}`);
      const nonce = this.getMessageNonce(message);
      let task;
      if (nonce) {
        task = instance.getRunningTaskByNonce(nonce);
      } else {
        task = this.findTaskWhenError(instance, messageType, message);
      }
      if (task) {
        task.fail(`[${title}] ${description}`);
      }
    } else {
      if (embed.type === 'link' || !description) {
        return;
      }
      // Handle errors like "Invalid link!" or "Could not complete"
      const task = this.findTaskWhenError(instance, messageType, message);
      if (task) {
        message[MJ_MESSAGE_HANDLED] = true;
        console.warn(`${instance.getInstanceId()} - MJ可能的异常信息: ${title}\n${description}\nfooter: ${footerText}`);
        task.fail(`[${title}] ${description}`);
      }
    }
  }

  private findTaskWhenError(instance: DiscordInstance, messageType: MessageType, message: any): any {
    let progressMessageId: string | undefined;
    
    if (messageType === MessageType.CREATE) {
      progressMessageId = this.getReferenceMessageId(message);
    } else if (messageType === MessageType.UPDATE) {
      progressMessageId = message.id;
    }

    if (!progressMessageId) {
      return null;
    }

    const condition = new TaskCondition()
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setProgressMessageId(progressMessageId);

    return instance.findRunningTask(condition.toFunction()).find(t => t) || null;
  }
}

