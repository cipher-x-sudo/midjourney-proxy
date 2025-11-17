import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContent } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TaskStoreService } from '../../services/store/taskStoreService';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_MESSAGE_HASH, TASK_PROPERTY_DISCORD_INSTANCE_ID, MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * Start and progress handler
 */
export class StartAndProgressHandler extends MessageHandler {
  private taskStoreService: TaskStoreService;

  constructor(discordHelper: DiscordHelper, taskStoreService: TaskStoreService) {
    super(discordHelper);
    this.taskStoreService = taskStoreService;
  }

  order(): number {
    return 90;
  }

  async handle(instance: DiscordInstance, messageType: MessageType, message: any): Promise<void> {
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

      let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
      let taskSource = 'runningTasks';
      
      console.log(`[Tracker] MESSAGE_UPDATE: Found task in runningTasks=${!!task}, taskId=${task?.id || 'none'}, storedProgressMessageId=${task?.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID) || 'none'}`);
      
      // Redis fallback: Check if task exists in Redis but not in runningTasks
      if (!task) {
        console.log(`[Tracker] MESSAGE_UPDATE: Task not in runningTasks, checking Redis fallback for progressMessageId=${message.id}`);
        
        try {
          // Search Redis for task with matching progressMessageId
          const redisTask = await this.taskStoreService.findOne((t: any) => {
            const progressMessageId = t.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
            const status = t.status;
            const matchesProgressMessageId = progressMessageId === message.id;
            const matchesStatus = status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED;
            
            return matchesProgressMessageId && matchesStatus;
          });
          
          if (redisTask) {
            task = redisTask;
            taskSource = 'redis-progressMessageId';
            console.log(`[Tracker] MESSAGE_UPDATE: ✓ Found task in Redis by progressMessageId! taskId=${task.id}, progressMessageId=${message.id}`);
          } else {
            console.log(`[Tracker] MESSAGE_UPDATE: Task not found by progressMessageId in Redis for ${message.id}`);
            
            // Level 3 fallback: Match by prompt (Discord sometimes uses different message IDs for progress updates)
            if (parseData.prompt) {
              console.log(`[Tracker] MESSAGE_UPDATE: Trying prompt-based fallback for prompt="${parseData.prompt.substring(0, 40)}..."`);
              
              const instanceId = instance.getInstanceId();
              const promptTaskList = await this.taskStoreService.list((t: any) => {
                const finalPrompt = t.getProperty(TASK_PROPERTY_FINAL_PROMPT);
                const status = t.status;
                const taskInstanceId = t.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
                const matchesPrompt = finalPrompt === parseData.prompt;
                const matchesStatus = status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED;
                const matchesInstance = taskInstanceId === instanceId;
                
                return matchesPrompt && matchesStatus && matchesInstance;
              });
              
              if (promptTaskList.length > 0) {
                // Take the most recent task if multiple matches
                const sortedTasks = promptTaskList.sort((a: any, b: any) => (b.startTime || 0) - (a.startTime || 0));
                task = sortedTasks[0];
                taskSource = 'redis-prompt';
                
                // CRITICAL: Update progressMessageId to the new message ID
                const oldProgressMessageId = task.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID);
                task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
                
                console.log(`[Tracker] MESSAGE_UPDATE: ✓ Found task in Redis by prompt! taskId=${task.id}, oldProgressMessageId=${oldProgressMessageId}, newProgressMessageId=${message.id}`);
              } else {
                console.log(`[Tracker] MESSAGE_UPDATE: Task not found by prompt either`);
              }
            }
          }
        } catch (error: any) {
          console.error(`[Tracker] MESSAGE_UPDATE: Error checking Redis fallback:`, error);
        }
        
        if (!task) {
          console.log(`[Tracker] MESSAGE_UPDATE: No task found with progressMessageId=${message.id}, skipping update`);
          return;
        }
      }

      message[MJ_MESSAGE_HANDLED] = true;
      task.setProperty(TASK_PROPERTY_FINAL_PROMPT, parseData.prompt);
      task.status = TaskStatus.IN_PROGRESS;
      task.progress = parseData.status;
      console.log(`[Tracker] MESSAGE_UPDATE: Updated task ${task.id} progress to ${parseData.status} (source: ${taskSource})`);
      
      const imageUrl = this.getImageUrl(message);
      if (imageUrl) {
        task.imageUrl = imageUrl;
        const messageHash = this.discordHelper.getMessageHash(imageUrl);
        if (messageHash) {
          task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
        }
        console.log(`[Tracker] MESSAGE_UPDATE: Set imageUrl and messageHash for task ${task.id}`);
      }
      
      // If task came from Redis, save it back to Redis
      if (taskSource === 'redis') {
        try {
          await this.taskStoreService.save(task);
          console.log(`[Tracker] MESSAGE_UPDATE: ✓ Saved updated task ${task.id} back to Redis`);
        } catch (error: any) {
          console.error(`[Tracker] MESSAGE_UPDATE: Failed to save task ${task.id} to Redis:`, error);
        }
      }
    } else {
      console.log(`[Tracker] Handler did nothing: type=${messageType}, nonce=${nonce || 'none'}, hasParseData=${!!parseData}`);
    }
  }
}

