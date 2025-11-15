import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskStatus } from '../../enums/TaskStatus';
import { TASK_PROPERTY_SEED, TASK_PROPERTY_DISCORD_INSTANCE_ID, MJ_MESSAGE_HANDLED } from '../../constants';
import { extractSeedFromMessage } from '../../utils/seedUtils';
import { TaskStoreService } from '../../services/store/taskStoreService';
import { Task } from '../../models/Task';

/**
 * Seed DM handler
 * Handles DM messages from MidJourney bot containing seed information
 */
export class SeedDmHandler extends MessageHandler {
  private static readonly MIDJOURNEY_BOT_ID = '936929561302675456';
  private static readonly SEED_MATCH_TIME_WINDOW = 180000; // 3 minutes (180 seconds) - DMs may arrive with delay
  private taskStoreService: TaskStoreService;

  constructor(discordHelper: DiscordHelper, taskStoreService: TaskStoreService) {
    super(discordHelper);
    this.taskStoreService = taskStoreService;
  }

  order(): number {
    return 5;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    // Only handle CREATE messages (new DMs)
    if (messageType !== MessageType.CREATE) {
      return;
    }

    // Check if message is from DM channel
    // DM channels have type 1 or guild_id is null
    const channelType = message.channel_type;
    const guildId = message.guild_id;
    const isDM = channelType === 1 || !guildId;

    if (!isDM) {
      return;
    }

    // Check if message is from MidJourney bot
    const authorId = message.author?.id;
    const applicationId = message.application_id;
    const isFromMidJourneyBot = 
      authorId === SeedDmHandler.MIDJOURNEY_BOT_ID || 
      applicationId === SeedDmHandler.MIDJOURNEY_BOT_ID ||
      (message.author?.username && message.author.username.toLowerCase().includes('midjourney'));

    if (!isFromMidJourneyBot) {
      return;
    }

    // Log DM received
    console.log(`[seed-dm-handler-${instance.getInstanceId()}] DM received from MidJourney bot`);

    // Extract seed from message
    const seed = extractSeedFromMessage(message);
    if (!seed) {
      console.log(`[seed-dm-handler-${instance.getInstanceId()}] No seed found in DM message from MidJourney bot`);
      return;
    }

    console.log(`[seed-dm-handler-${instance.getInstanceId()}] Extracted seed: ${seed}`);

    message[MJ_MESSAGE_HANDLED] = true;

    // Process asynchronously (fire-and-forget) to allow async store operations
    this.processSeedMessage(instance, message, seed).catch(error => {
      console.error(`[seed-dm-handler-${instance.getInstanceId()}] Error processing seed message:`, error);
    });
  }

  /**
   * Process seed message asynchronously
   */
  private async processSeedMessage(instance: DiscordInstance, message: any, seed: string): Promise<void> {
    // Find matching task by timestamp proximity
    // Look for recently completed tasks (within time window)
    const messageTimestamp = message.timestamp ? new Date(message.timestamp).getTime() : Date.now();
    const instanceId = instance.getInstanceId();
    
    console.log(`[seed-dm-handler-${instanceId}] Processing seed ${seed} from DM, message timestamp: ${new Date(messageTimestamp).toISOString()}`);
    
    // Check both running tasks (in-memory) and stored tasks (persistent)
    const runningTasks = instance.getRunningTasks();
    console.log(`[seed-dm-handler-${instanceId}] Checking ${runningTasks.length} running tasks`);
    
    let allCompletedTasks: Task[] = [];
    
    // Find recently completed tasks with image from running tasks
    const completedRunningTasks = runningTasks.filter(task => {
      if (!task.finishTime || !task.imageUrl) {
        return false;
      }
      // Task was completed within time window
      const timeDiff = Math.abs(messageTimestamp - task.finishTime);
      const isInWindow = timeDiff <= SeedDmHandler.SEED_MATCH_TIME_WINDOW;
      const isSuccess = task.status === TaskStatus.SUCCESS;
      
      if (isInWindow && isSuccess) {
        console.log(`[seed-dm-handler-${instanceId}] Candidate task ${task.id}: finishTime=${new Date(task.finishTime).toISOString()}, timeDiff=${timeDiff}ms, hasSeed=${!!task.getProperty(TASK_PROPERTY_SEED)}`);
      }
      
      return isInWindow && isSuccess;
    });
    allCompletedTasks.push(...completedRunningTasks);
    console.log(`[seed-dm-handler-${instanceId}] Found ${completedRunningTasks.length} completed running tasks within time window`);

    // Also check stored tasks for recently completed tasks
    // This handles cases where task was removed from runningTasks before DM arrives
    try {
      const storedTasks = await this.getStoredCompletedTasks(instance, messageTimestamp);
      console.log(`[seed-dm-handler-${instanceId}] Checking stored tasks, found ${storedTasks.length} candidates`);
      
      // Log stored task candidates
      for (const task of storedTasks) {
        const timeDiff = Math.abs(messageTimestamp - (task.finishTime || 0));
        console.log(`[seed-dm-handler-${instanceId}] Stored candidate task ${task.id}: finishTime=${task.finishTime ? new Date(task.finishTime).toISOString() : 'N/A'}, timeDiff=${timeDiff}ms, hasSeed=${!!task.getProperty(TASK_PROPERTY_SEED)}`);
      }
      
      // Filter out duplicates (tasks might be in both running and stored)
      const storedTaskIds = new Set(allCompletedTasks.map(t => t.id));
      const uniqueStoredTasks = storedTasks.filter(t => !storedTaskIds.has(t.id));
      allCompletedTasks.push(...uniqueStoredTasks);
      console.log(`[seed-dm-handler-${instanceId}] Added ${uniqueStoredTasks.length} unique stored tasks`);
    } catch (error) {
      console.error(`[seed-dm-handler-${instanceId}] Error fetching stored tasks:`, error);
    }

    // Sort by completion time (most recent first)
    allCompletedTasks.sort((a, b) => (b.finishTime || 0) - (a.finishTime || 0));
    console.log(`[seed-dm-handler-${instanceId}] Total ${allCompletedTasks.length} candidate tasks found`);

    // Match to the most recent completed task without seed
    const targetTask = allCompletedTasks.find(task => !task.getProperty(TASK_PROPERTY_SEED));

    if (targetTask) {
      targetTask.setProperty(TASK_PROPERTY_SEED, seed);
      
      // Also update task if still in runningTasks array (modify in place)
      const runningTask = runningTasks.find(t => t.id === targetTask.id);
      if (runningTask) {
        runningTask.setProperty(TASK_PROPERTY_SEED, seed);
        console.log(`[seed-dm-handler-${instanceId}] Updated task ${targetTask.id} in runningTasks with seed ${seed}`);
      }
      
      // Save updated task to store
      try {
        await this.taskStoreService.save(targetTask);
        console.log(`[seed-dm-handler-${instanceId}] Matched seed ${seed} to task ${targetTask.id} and saved to store`);
      } catch (error) {
        console.error(`[seed-dm-handler-${instanceId}] Failed to save task ${targetTask.id} with seed ${seed}:`, error);
      }
    } else if (allCompletedTasks.length > 0) {
      // If all tasks have seeds, update the most recent one
      const task = allCompletedTasks[0];
      task.setProperty(TASK_PROPERTY_SEED, seed);
      
      // Also update task if still in runningTasks array (modify in place)
      const runningTask = runningTasks.find(t => t.id === task.id);
      if (runningTask) {
        runningTask.setProperty(TASK_PROPERTY_SEED, seed);
        console.log(`[seed-dm-handler-${instanceId}] Updated task ${task.id} in runningTasks with seed ${seed}`);
      }
      
      try {
        await this.taskStoreService.save(task);
        console.log(`[seed-dm-handler-${instanceId}] Updated most recent task ${task.id} (all had seeds) with seed ${seed} and saved to store`);
      } catch (error) {
        console.error(`[seed-dm-handler-${instanceId}] Failed to save task ${task.id} with seed ${seed}:`, error);
      }
    } else {
      // No matching task found, but log the seed anyway with detailed info
      console.log(`[seed-dm-handler-${instanceId}] Seed ${seed} extracted from DM but no matching task found`);
      console.log(`[seed-dm-handler-${instanceId}] Details: messageTimestamp=${new Date(messageTimestamp).toISOString()}, checked ${runningTasks.length} running tasks, time window=${SeedDmHandler.SEED_MATCH_TIME_WINDOW}ms`);
      console.log(`[seed-dm-handler-${instanceId}] Running tasks: ${runningTasks.map(t => ({ id: t.id, status: t.status, finishTime: t.finishTime ? new Date(t.finishTime).toISOString() : 'N/A' })).join(', ')}`);
    }
  }

  /**
   * Get recently completed tasks from store
   */
  private async getStoredCompletedTasks(instance: DiscordInstance, messageTimestamp: number): Promise<Task[]> {
    try {
      const instanceId = instance.getInstanceId();
      const allStoredTasks = await this.taskStoreService.list();
      console.log(`[seed-dm-handler-${instanceId}] Fetched ${allStoredTasks.length} total stored tasks`);
      
      // Filter for recently completed tasks from this instance
      const recentCompletedTasks = allStoredTasks.filter(task => {
        // Must be from this instance
        const taskInstanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
        if (taskInstanceId !== instanceId) {
          return false;
        }
        
        // Must have finish time and image URL
        if (!task.finishTime || !task.imageUrl) {
          return false;
        }
        
        // Must be completed within time window
        const timeDiff = Math.abs(messageTimestamp - task.finishTime);
        return timeDiff <= SeedDmHandler.SEED_MATCH_TIME_WINDOW && 
               task.status === TaskStatus.SUCCESS;
      });
      
      console.log(`[seed-dm-handler-${instanceId}] Filtered to ${recentCompletedTasks.length} recently completed tasks from this instance`);
      return recentCompletedTasks;
    } catch (error) {
      console.error(`[seed-dm-handler-${instance.getInstanceId()}] Error getting stored tasks:`, error);
      return [];
    }
  }
}

