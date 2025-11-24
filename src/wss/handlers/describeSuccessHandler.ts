import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_MESSAGE_ID, TASK_PROPERTY_BUTTONS, MJ_MESSAGE_HANDLED } from '../../constants';
import { extractButtonsFromMessage } from '../../utils/buttonUtils';

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

    // Primary matching strategy: try to find task by progressMessageId
    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.DESCRIBE]))
      .setProgressMessageId(progressMessageId);

    let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;

    // Fallback matching strategies if primary match fails
    if (!task) {
      const instanceId = instance.getInstanceId();
      console.log(`[describe-handler-${instanceId}] Task not found by progressMessageId=${progressMessageId}, trying fallback strategies...`);

      // Strategy 1: Try matching by nonce (if available in UPDATE message)
      const nonce = this.getMessageNonce(message);
      if (nonce) {
        const nonceTask = instance.getRunningTaskByNonce(nonce);
        if (nonceTask && nonceTask.action === TaskAction.DESCRIBE && 
            (nonceTask.status === TaskStatus.IN_PROGRESS || nonceTask.status === TaskStatus.SUBMITTED)) {
          task = nonceTask;
          const oldProgressMessageId = task.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
          task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, progressMessageId);
          console.log(`[describe-handler-${instanceId}] ✓ Found task ${task.id} by nonce (${nonce}), updated progressMessageId: ${oldProgressMessageId || 'none'} -> ${progressMessageId}`);
        }
      }

      // Strategy 2: Match by action + status (last resort)
      if (!task) {
        const actionStatusCondition = new TaskCondition()
          .setActionSet(new Set([TaskAction.DESCRIBE]))
          .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]));

        const matchingTasks = instance.findRunningTask(actionStatusCondition.toFunction());
        if (matchingTasks.length > 0) {
          // Sort by startTime (most recent first)
          const sortedTasks = matchingTasks.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
          task = sortedTasks[0];
          const oldProgressMessageId = task.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
          task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, progressMessageId);
          console.log(`[describe-handler-${instanceId}] ✓ Found task ${task.id} by action+status (last resort), updated progressMessageId: ${oldProgressMessageId || 'none'} -> ${progressMessageId}`);
        }
      }

      // If still no task found, log and return
      if (!task) {
        console.log(`[describe-handler-${instanceId}] ✗ No matching describe task found for progressMessageId=${progressMessageId}`);
        return;
      }
    }

    // Verify task is DESCRIBE action before proceeding
    if (task.action !== TaskAction.DESCRIBE) {
      return;
    }

    // Extract buttons before calling finishTask (message might be modified)
    const buttons = extractButtonsFromMessage(message);

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

    // Find the task that was just finished and add buttons to it
    // The finishTask method sets TASK_PROPERTY_MESSAGE_ID
    const messageId = message.id;
    if (messageId && buttons.length > 0) {
      const condition = new TaskCondition()
        .setActionSet(new Set([TaskAction.DESCRIBE]))
        .setStatusSet(new Set([TaskStatus.SUCCESS]));
      
      // Try to find by message ID first (most reliable)
      const tasks = instance.findRunningTask(condition.toFunction());
      const finishedTask = tasks.find(t => t.getProperty(TASK_PROPERTY_MESSAGE_ID) === messageId) || null;
      
      if (finishedTask) {
        finishedTask.setProperty(TASK_PROPERTY_BUTTONS, buttons);
        const instanceId = instance.getInstanceId();
        console.log(`[describe-handler-${instanceId}] Added ${buttons.length} button(s) to task ${finishedTask.id}`);
      }
    }
  }
}

