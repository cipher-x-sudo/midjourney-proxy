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

    console.log(`[Tracker] Handler called: type=${messageType}, nonce=${nonce || 'none'}, hasParseData=${!!parseData}, messageId=${message.id}`);

    if (messageType === MessageType.CREATE && nonce) {
      // Task started
      const task = instance.getRunningTaskByNonce(nonce);
      console.log(`[Tracker] MESSAGE_CREATE: Found task=${!!task}, taskId=${task?.id || 'none'}, nonce=${nonce}`);
      if (!task) {
        return;
      }
      message[MJ_MESSAGE_HANDLED] = true;
      task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
      console.log(`[Tracker] MESSAGE_CREATE: Set progressMessageId=${message.id} for task ${task.id}`);
      // Handle cases where content might be empty
      if (parseData) {
        task.setProperty(TASK_PROPERTY_FINAL_PROMPT, parseData.prompt);
        console.log(`[Tracker] MESSAGE_CREATE: Set finalPrompt="${parseData.prompt}" for task ${task.id}`);
      }
      task.status = TaskStatus.IN_PROGRESS;
    } else if (messageType === MessageType.UPDATE && parseData) {
      // Task progress
      console.log(`[Tracker] MESSAGE_UPDATE: messageId=${message.id}, progress=${parseData.status}, prompt="${parseData.prompt?.substring(0, 30)}..."`);
      
      if (parseData.status === 'Stopped') {
        console.log(`[Tracker] MESSAGE_UPDATE: Status is 'Stopped', skipping`);
        return;
      }

      const condition = new TaskCondition()
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setProgressMessageId(message.id);

      const task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
      console.log(`[Tracker] MESSAGE_UPDATE: Found task=${!!task}, taskId=${task?.id || 'none'}, storedProgressMessageId=${task?.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID) || 'none'}`);
      
      if (!task) {
        console.log(`[Tracker] MESSAGE_UPDATE: No task found with progressMessageId=${message.id}, skipping update`);
        return;
      }

      message[MJ_MESSAGE_HANDLED] = true;
      task.setProperty(TASK_PROPERTY_FINAL_PROMPT, parseData.prompt);
      task.status = TaskStatus.IN_PROGRESS;
      task.progress = parseData.status;
      console.log(`[Tracker] MESSAGE_UPDATE: Updated task ${task.id} progress to ${parseData.status}`);
      
      const imageUrl = this.getImageUrl(message);
      if (imageUrl) {
        task.imageUrl = imageUrl;
        const messageHash = this.discordHelper.getMessageHash(imageUrl);
        if (messageHash) {
          task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
        }
        console.log(`[Tracker] MESSAGE_UPDATE: Set imageUrl and messageHash for task ${task.id}`);
      }
    } else {
      console.log(`[Tracker] Handler did nothing: type=${messageType}, nonce=${nonce || 'none'}, hasParseData=${!!parseData}`);
    }
  }
}

