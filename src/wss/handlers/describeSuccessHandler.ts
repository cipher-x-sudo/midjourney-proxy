import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * Describe success handler
 */
export class DescribeSuccessHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    return 10;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const messageId = message.id;
    
    if (messageType === MessageType.CREATE) {
      const interactionName = this.getInteractionName(message);
      if (interactionName !== 'describe') {
        return;
      }
      // Task started
      message[MJ_MESSAGE_HANDLED] = true;
      const nonce = this.getMessageNonce(message);
      const task = instance.getRunningTaskByNonce(nonce);
      if (!task) {
        return;
      }
      task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, messageId);
    } else if (messageType === MessageType.UPDATE) {
      this.finishDescribeTask(instance, message, messageId);
    }
  }

  private finishDescribeTask(instance: DiscordInstance, message: any, progressMessageId: string): void {
    const embeds = message.embeds;
    if (!progressMessageId || !embeds || embeds.length === 0) {
      return;
    }

    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.DESCRIBE]))
      .setProgressMessageId(progressMessageId);

    const task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
    if (!task) {
      return;
    }

    message[MJ_MESSAGE_HANDLED] = true;
    const description = embeds[0].description;
    task.prompt = description;
    task.promptEn = description;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, description);
    
    if (embeds[0].image?.url) {
      const imageUrl = embeds[0].image.url;
      task.imageUrl = this.replaceCdnUrl(imageUrl);
    }
    
    this.finishTask(instance, task, message);
  }
}

