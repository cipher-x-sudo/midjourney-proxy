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
  private static readonly SEED_MATCH_TIME_WINDOW = 60000; // 60 seconds (increased to catch tasks already in store)
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

    // Extract seed from message
    const seed = extractSeedFromMessage(message);
    if (!seed) {
      return;
    }

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
    
    // Check both running tasks (in-memory) and stored tasks (persistent)
    const runningTasks = instance.getRunningTasks();
    let allCompletedTasks: Task[] = [];
    
    // Find recently completed tasks with image from running tasks
    const completedRunningTasks = runningTasks.filter(task => {
      if (!task.finishTime || !task.imageUrl) {
        return false;
      }
      // Task was completed within time window
      const timeDiff = Math.abs(messageTimestamp - task.finishTime);
      return timeDiff <= SeedDmHandler.SEED_MATCH_TIME_WINDOW && 
             task.status === TaskStatus.SUCCESS;
    });
    allCompletedTasks.push(...completedRunningTasks);

    // Also check stored tasks for recently completed tasks
    // This handles cases where task was removed from runningTasks before DM arrives
    try {
      const storedTasks = await this.getStoredCompletedTasks(instance, messageTimestamp);
      // Filter out duplicates (tasks might be in both running and stored)
      const storedTaskIds = new Set(allCompletedTasks.map(t => t.id));
      const uniqueStoredTasks = storedTasks.filter(t => !storedTaskIds.has(t.id));
      allCompletedTasks.push(...uniqueStoredTasks);
    } catch (error) {
      console.warn(`[seed-dm-handler-${instance.getInstanceId()}] Error fetching stored tasks:`, error);
    }

    // Sort by completion time (most recent first)
    allCompletedTasks.sort((a, b) => (b.finishTime || 0) - (a.finishTime || 0));

    // Match to the most recent completed task without seed
    const targetTask = allCompletedTasks.find(task => !task.getProperty(TASK_PROPERTY_SEED));

    if (targetTask) {
      targetTask.setProperty(TASK_PROPERTY_SEED, seed);
      // Save updated task to store
      await this.taskStoreService.save(targetTask);
      console.debug(`[seed-dm-handler-${instance.getInstanceId()}] Seed ${seed} extracted from DM and stored for task ${targetTask.id}`);
    } else if (allCompletedTasks.length > 0) {
      // If all tasks have seeds, update the most recent one
      allCompletedTasks[0].setProperty(TASK_PROPERTY_SEED, seed);
      await this.taskStoreService.save(allCompletedTasks[0]);
      console.debug(`[seed-dm-handler-${instance.getInstanceId()}] Seed ${seed} extracted from DM and stored for task ${allCompletedTasks[0].id}`);
    } else {
      // No matching task found, but log the seed anyway
      console.debug(`[seed-dm-handler-${instance.getInstanceId()}] Seed ${seed} extracted from DM but no matching task found (checked ${completedRunningTasks.length} running + stored tasks)`);
    }
  }

  /**
   * Get recently completed tasks from store
   */
  private async getStoredCompletedTasks(instance: DiscordInstance, messageTimestamp: number): Promise<Task[]> {
    try {
      const instanceId = instance.getInstanceId();
      const allStoredTasks = await this.taskStoreService.list();
      
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
      
      return recentCompletedTasks;
    } catch (error) {
      console.warn(`[seed-dm-handler-${instance.getInstanceId()}] Error getting stored tasks:`, error);
      return [];
    }
  }
}

