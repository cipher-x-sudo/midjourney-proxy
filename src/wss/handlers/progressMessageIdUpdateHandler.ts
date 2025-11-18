import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContent } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_DISCORD_INSTANCE_ID, TASK_PROPERTY_NONCE, MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * Progress Message ID Update Handler
 * 
 * Pre-processes MESSAGE_UPDATE events to fix progressMessageId matching.
 * Discord uses different message IDs for MESSAGE_CREATE vs MESSAGE_UPDATE,
 * so this handler updates progressMessageId when first MESSAGE_UPDATE arrives.
 * 
 * Runs BEFORE StartAndProgressHandler (order 85 vs 90) to ensure
 * progressMessageId is updated before StartAndProgressHandler tries to match.
 */
export class ProgressMessageIdUpdateHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    return 85; // Run BEFORE StartAndProgressHandler (order 90)
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    // Only process MESSAGE_UPDATE events
    if (messageType !== MessageType.UPDATE) {
      return;
    }

    const content = this.getMessageContent(message);
    const parseData = parseContent(content);
    
    // Skip if content can't be parsed
    if (!parseData) {
      return;
    }

    // Skip if status is 'Stopped'
    if (parseData.status === 'Stopped') {
      return;
    }

    // Skip if message is already handled
    if (message[MJ_MESSAGE_HANDLED] === true) {
      return;
    }

    // First, try to find task by progressMessageId (existing logic)
    const condition = new TaskCondition()
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setProgressMessageId(message.id);

    let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;

    // If task found by progressMessageId, no need to update (already correct)
    if (task) {
      return;
    }

    // Task not found by progressMessageId - try to find by other means
    console.log(`[progress-id-update-handler-${instance.getInstanceId()}] MESSAGE_UPDATE: Task not found by progressMessageId=${message.id}, trying alternative matching...`);

    // Strategy 1: Try matching by nonce (if available)
    const nonce = this.getMessageNonce(message);
    if (nonce) {
      const nonceTask = instance.getRunningTaskByNonce(nonce);
      if (nonceTask && (nonceTask.status === TaskStatus.IN_PROGRESS || nonceTask.status === TaskStatus.SUBMITTED)) {
        task = nonceTask;
        const oldProgressMessageId = task.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
        task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
        console.log(`[progress-id-update-handler-${instance.getInstanceId()}] ✓ Found task ${task.id} by nonce, updated progressMessageId: ${oldProgressMessageId || 'none'} -> ${message.id}`);
        return; // Don't mark as handled - let StartAndProgressHandler process it
      }
    }

    // Strategy 2: Try matching by prompt/finalPrompt
    if (parseData.prompt) {
      const instanceId = instance.getInstanceId();
      
      const promptTasks = instance.findRunningTask((t) => {
        const finalPrompt = t.getProperty(TASK_PROPERTY_FINAL_PROMPT);
        const status = t.status;
        const taskInstanceId = t.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
        const matchesPrompt = finalPrompt === parseData.prompt;
        const matchesStatus = status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED;
        const matchesInstance = taskInstanceId === instanceId;
        
        return matchesPrompt && matchesStatus && matchesInstance;
      });

      if (promptTasks.length > 0) {
        // Take the most recent task if multiple matches
        const sortedTasks = promptTasks.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
        task = sortedTasks[0];
        
        const oldProgressMessageId = task.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
        task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
        console.log(`[progress-id-update-handler-${instance.getInstanceId()}] ✓ Found task ${task.id} by prompt, updated progressMessageId: ${oldProgressMessageId || 'none'} -> ${message.id}`);
        return; // Don't mark as handled - let StartAndProgressHandler process it
      }
    }

    // Strategy 3: Try matching by status and instance (last resort - most recent task)
    const instanceId = instance.getInstanceId();
    
    const statusTasks = instance.findRunningTask((t) => {
      const status = t.status;
      const taskInstanceId = t.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
      const matchesStatus = status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED;
      const matchesInstance = taskInstanceId === instanceId;
      const hasProgressMessageId = t.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID); // Prefer tasks that already have one
      
      // Prefer tasks without progressMessageId (they need updating)
      return matchesStatus && matchesInstance && !hasProgressMessageId;
    });

    if (statusTasks.length > 0) {
      // Take the most recent task
      const sortedTasks = statusTasks.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      task = sortedTasks[0];
      
      const oldProgressMessageId = task.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
      task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
      console.log(`[progress-id-update-handler-${instance.getInstanceId()}] ✓ Found task ${task.id} by status (last resort), updated progressMessageId: ${oldProgressMessageId || 'none'} -> ${message.id}`);
      return; // Don't mark as handled - let StartAndProgressHandler process it
    }

    // No matching task found
    console.log(`[progress-id-update-handler-${instance.getInstanceId()}] MESSAGE_UPDATE: No matching task found for message.id=${message.id}, prompt="${parseData.prompt?.substring(0, 40)}..."`);
  }
}

