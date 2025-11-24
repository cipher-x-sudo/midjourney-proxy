import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_MESSAGE_ID, TASK_PROPERTY_INTERACTION_METADATA_ID, MJ_MESSAGE_HANDLED } from '../../constants';

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
      // Check if this is a completion message (bot author, embeds with image)
      const isBot = message.author?.bot === true;
      const authorUsername = message.author?.username || '';
      const hasEmbedsWithImage = message.embeds && 
        message.embeds.length > 0 && 
        message.embeds[0]?.image?.url;
      const isJourneyBot = authorUsername.toLowerCase().includes('journey');
      
      // Skip "Waiting to start" messages
      const content = this.getMessageContent(message);
      if (content && content.includes('(Waiting to start)')) {
        return;
      }
      
      // Check if it's a completion message
      if (isBot && isJourneyBot && hasEmbedsWithImage) {
        // This is a completion message - try to finish the task
        this.finishDescribeTaskFromCreate(instance, message, messageId);
        return;
      }
      
      // Otherwise, check if it's a task start (interaction name "describe")
      const interactionName = this.getInteractionName(message);
      if (interactionName === 'describe') {
        // Task started
        message[MJ_MESSAGE_HANDLED] = true;
        const nonce = this.getMessageNonce(message);
        const task = instance.getRunningTaskByNonce(nonce);
        if (!task) {
          return;
        }
        task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, messageId);
      }
    } else if (messageType === MessageType.UPDATE) {
      this.finishDescribeTask(instance, message, messageId);
    }
  }

  /**
   * Finish describe task from CREATE event (completion message)
   * Follows C# pattern: match by messageId first, then interactionMetadata.id, then progressMessageId
   */
  private finishDescribeTaskFromCreate(instance: DiscordInstance, message: any, messageId: string): void {
    const embeds = message.embeds;
    if (!embeds || embeds.length === 0 || !embeds[0]?.image?.url) {
      return;
    }

    // Try matching by messageId first
    let condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.DESCRIBE]))
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setMessageId(messageId);
    
    let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;

    // If not found, try matching by interactionMetadata.id
    if (!task && message.interaction_metadata?.id) {
      condition = new TaskCondition()
        .setActionSet(new Set([TaskAction.DESCRIBE]))
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setInteractionMetadataId(message.interaction_metadata.id);
      
      task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
    }

    // If still not found, try matching by progressMessageId
    if (!task && messageId) {
      condition = new TaskCondition()
        .setActionSet(new Set([TaskAction.DESCRIBE]))
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setProgressMessageId(messageId);
      
      task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
    }

    if (!task) {
      return;
    }

    // Skip if task is already completed
    if (task.status === TaskStatus.SUCCESS || task.status === TaskStatus.FAILURE) {
      return;
    }

    message[MJ_MESSAGE_HANDLED] = true;
    const description = embeds[0].description;
    task.prompt = description;
    task.promptEn = description;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, description);
    
    const imageUrl = embeds[0].image.url;
    task.imageUrl = this.replaceCdnUrl(imageUrl);
    
    this.finishTask(instance, task, message);
  }

  /**
   * Finish describe task from UPDATE event (progress update)
   * Matches by progressMessageId
   */
  private finishDescribeTask(instance: DiscordInstance, message: any, progressMessageId: string): void {
    const embeds = message.embeds;
    if (!progressMessageId || !embeds || embeds.length === 0) {
      return;
    }

    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.DESCRIBE]))
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setProgressMessageId(progressMessageId);

    const task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
    if (!task) {
      return;
    }

    // Skip if task is already completed
    if (task.status === TaskStatus.SUCCESS || task.status === TaskStatus.FAILURE) {
      return;
    }

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
  }
}

