import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContent } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_MESSAGE_HASH, MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * Start and progress handler
 */
export class StartAndProgressHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    return 90;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const nonce = this.getMessageNonce(message);
    const content = this.getMessageContent(message);
    const parseData = parseContent(content);

    if (messageType === MessageType.CREATE && nonce) {
      // Task started
      const task = instance.getRunningTaskByNonce(nonce);
      if (!task) {
        return;
      }
      message[MJ_MESSAGE_HANDLED] = true;
      task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
      // Handle cases where content might be empty
      if (parseData) {
        task.setProperty(TASK_PROPERTY_FINAL_PROMPT, parseData.prompt);
      }
      task.status = TaskStatus.IN_PROGRESS;
    } else if (messageType === MessageType.UPDATE && parseData) {
      // Task progress
      if (parseData.status === 'Stopped') {
        return;
      }

      const condition = new TaskCondition()
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setProgressMessageId(message.id);

      const task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
      if (!task) {
        return;
      }

      message[MJ_MESSAGE_HANDLED] = true;
      task.setProperty(TASK_PROPERTY_FINAL_PROMPT, parseData.prompt);
      task.status = TaskStatus.IN_PROGRESS;
      task.progress = parseData.status;
      
      const imageUrl = this.getImageUrl(message);
      if (imageUrl) {
        task.imageUrl = imageUrl;
        const messageHash = this.discordHelper.getMessageHash(imageUrl);
        if (messageHash) {
          task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
        }
      }
    }
  }
}
