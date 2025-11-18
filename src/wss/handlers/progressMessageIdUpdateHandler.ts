import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContent } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_DISCORD_INSTANCE_ID, MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * Progress Message ID Update Handler
 * 
 * Fixes Discord's behavior of using DIFFERENT message IDs for MESSAGE_CREATE vs MESSAGE_UPDATE.
 * 
 * When MESSAGE_UPDATE arrives with a different message.id than the progressMessageId stored
 * from MESSAGE_CREATE, this handler finds the task by other means and updates progressMessageId
 * so StartAndProgressHandler can match it correctly.
 */
export class ProgressMessageIdUpdateHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    // Run BEFORE StartAndProgressHandler (order 90)
    return 85;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    // Only process MESSAGE_UPDATE events
    if (messageType !== MessageType.UPDATE) {
      return;
    }

    // Skip if message already handled
    if (message[MJ_MESSAGE_HANDLED]) {
      return;
    }

    const content = this.getMessageContent(message);
    const parseData = parseContent(content);
    
    if (!parseData || !message.id) {
      return;
    }

    // Try to find task by current progressMessageId (existing logic)
    const condition = new TaskCondition()
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setProgressMessageId(message.id);

    let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;

    // If task found by progressMessageId, nothing to do - StartAndProgressHandler will handle it
    if (task) {
      return;
    }

    // Task NOT found by progressMessageId - Discord must be using different message IDs!
    // Find task by other means and update progressMessageId

    console.log(`[progress-id-fix-${instance.getInstanceId()}] MESSAGE_UPDATE: No task found by progressMessageId=${message.id}, searching by other means...`);

    const instanceId = instance.getInstanceId();
    let matchingTask: any = null;

    // Strategy 1: Match by prompt/finalPrompt and status
    if (parseData.prompt) {
      const promptCondition = new TaskCondition()
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setFinalPrompt(parseData.prompt);

      const promptTasks = instance.findRunningTask(promptCondition.toFunction())
        .filter(t => {
          const taskInstanceId = t.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
          return taskInstanceId === instanceId;
        });

      if (promptTasks.length > 0) {
        // Take most recent task (by startTime)
        matchingTask = promptTasks.sort((a, b) => (b.startTime || 0) - (a.startTime || 0))[0];
        console.log(`[progress-id-fix-${instance.getInstanceId()}] Found task ${matchingTask.id} by prompt: "${parseData.prompt.substring(0, 40)}..."`);
      }
    }

    // Strategy 2: Match by nonce if available
    if (!matchingTask) {
      const nonce = this.getMessageNonce(message);
      if (nonce) {
        matchingTask = instance.getRunningTaskByNonce(nonce);
        if (matchingTask) {
          console.log(`[progress-id-fix-${instance.getInstanceId()}] Found task ${matchingTask.id} by nonce: ${nonce}`);
        }
      }
    }

    // If task found, update progressMessageId to current message.id
    if (matchingTask) {
      const oldProgressMessageId = matchingTask.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
      matchingTask.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
      console.log(`[progress-id-fix-${instance.getInstanceId()}] ✓ Updated task ${matchingTask.id} progressMessageId: ${oldProgressMessageId || 'none'} → ${message.id}`);
      
      // Don't mark message as handled - let StartAndProgressHandler process it
    } else {
      console.log(`[progress-id-fix-${instance.getInstanceId()}] No matching task found for MESSAGE_UPDATE message.id=${message.id}`);
    }
  }
}

