import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContent } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_MESSAGE_HASH, TASK_PROPERTY_MESSAGE_ID, TASK_PROPERTY_INTERACTION_METADATA_ID, MJ_MESSAGE_HANDLED } from '../../constants';

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

      // Primary match: Try matching by progressMessageId
      let condition = new TaskCondition()
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setProgressMessageId(message.id);

      let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;

      // Fallback 1: Try matching by messageId (TASK_PROPERTY_MESSAGE_ID)
      if (!task && message.id) {
        condition = new TaskCondition()
          .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
          .setMessageId(message.id);
        task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
      }

      // Fallback 2: Try matching by interactionMetadataId
      if (!task && message.interactionMetadata?.id) {
        // TaskCondition doesn't have a method for interactionMetadataId, so use custom function
        const tasks = instance.findRunningTask((t) => {
          if (t.status !== TaskStatus.IN_PROGRESS && t.status !== TaskStatus.SUBMITTED) {
            return false;
          }
          const interactionMetadataId = t.getProperty(TASK_PROPERTY_INTERACTION_METADATA_ID);
          return interactionMetadataId === message.interactionMetadata.id;
        });
        task = tasks.find(t => t) || null;
      }

      // Fallback 3: Try matching by finalPrompt (parseData.prompt) and status
      if (!task && parseData.prompt) {
        condition = new TaskCondition()
          .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
          .setFinalPrompt(parseData.prompt);
        const tasks = instance.findRunningTask(condition.toFunction());
        // Sort by startTime and take the earliest matching task
        task = tasks.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0] || null;
      }

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

