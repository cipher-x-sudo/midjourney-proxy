import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskStatus } from '../../enums/TaskStatus';
import { TASK_PROPERTY_SEED, MJ_MESSAGE_HANDLED } from '../../constants';
import { extractSeedFromMessage } from '../../utils/seedUtils';

/**
 * Seed DM handler
 * Handles DM messages from MidJourney bot containing seed information
 */
export class SeedDmHandler extends MessageHandler {
  private static readonly MIDJOURNEY_BOT_ID = '936929561302675456';
  private static readonly SEED_MATCH_TIME_WINDOW = 30000; // 30 seconds

  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
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

    // Find matching task by timestamp proximity
    // Look for recently completed tasks (within time window)
    const messageTimestamp = message.timestamp ? new Date(message.timestamp).getTime() : Date.now();
    const runningTasks = instance.getRunningTasks();
    
    // Find recently completed tasks with image
    const completedTasks = runningTasks.filter(task => {
      if (!task.finishTime || !task.imageUrl) {
        return false;
      }
      // Task was completed within time window
      const timeDiff = Math.abs(messageTimestamp - task.finishTime);
      return timeDiff <= SeedDmHandler.SEED_MATCH_TIME_WINDOW && 
             task.status === TaskStatus.SUCCESS;
    });

    // Sort by completion time (most recent first)
    completedTasks.sort((a, b) => (b.finishTime || 0) - (a.finishTime || 0));

    // Match to the most recent completed task without seed
    const targetTask = completedTasks.find(task => !task.getProperty(TASK_PROPERTY_SEED));

    if (targetTask) {
      targetTask.setProperty(TASK_PROPERTY_SEED, seed);
      console.debug(`[seed-dm-handler-${instance.getInstanceId()}] Seed ${seed} extracted from DM and stored for task ${targetTask.id}`);
    } else if (completedTasks.length > 0) {
      // If all tasks have seeds, update the most recent one
      completedTasks[0].setProperty(TASK_PROPERTY_SEED, seed);
      console.debug(`[seed-dm-handler-${instance.getInstanceId()}] Seed ${seed} extracted from DM and stored for task ${completedTasks[0].id}`);
    } else {
      // No matching task found, but log the seed anyway
      console.debug(`[seed-dm-handler-${instance.getInstanceId()}] Seed ${seed} extracted from DM but no matching task found`);
    }
  }
}

