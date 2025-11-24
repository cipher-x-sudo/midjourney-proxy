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
      // Check if this is a completion message (bot author, embeds with image and description)
      const isBot = message.author?.bot === true;
      const authorUsername = message.author?.username || '';
      const embeds = message.embeds;
      const hasEmbeds = embeds && embeds.length > 0;
      const hasEmbedsWithImage = hasEmbeds && embeds[0]?.image?.url;
      const hasEmbedsWithDescription = hasEmbeds && embeds[0]?.description;
      const isJourneyBot = authorUsername.toLowerCase().includes('journey');
      
      // Skip "Waiting to start" messages
      const content = this.getMessageContent(message);
      if (content && content.includes('(Waiting to start)')) {
        return;
      }
      
      // Check if it's a completion message (has embeds with description - the describe result)
      if (isBot && isJourneyBot && hasEmbedsWithDescription) {
        console.log(`[describe-handler-${instance.getInstanceId()}] Detected completion message in CREATE event: messageId=${messageId}, hasImage=${!!hasEmbedsWithImage}, hasDescription=${!!hasEmbedsWithDescription}`);
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
        console.log(`[describe-handler-${instance.getInstanceId()}] Task started: taskId=${task.id}, progressMessageId=${messageId}`);
      }
    } else if (messageType === MessageType.UPDATE) {
      // Check if this UPDATE is a completion (has embeds with description)
      const embeds = message.embeds;
      const hasEmbedsWithDescription = embeds && embeds.length > 0 && embeds[0]?.description;
      
      if (hasEmbedsWithDescription) {
        console.log(`[describe-handler-${instance.getInstanceId()}] Detected completion message in UPDATE event: messageId=${messageId}`);
      }
      
      this.finishDescribeTask(instance, message, messageId);
    }
  }

  /**
   * Finish describe task from CREATE event (completion message)
   * Follows C# pattern: match by messageId first, then interactionMetadata.id, then progressMessageId
   */
  private finishDescribeTaskFromCreate(instance: DiscordInstance, message: any, messageId: string): void {
    const embeds = message.embeds;
    if (!embeds || embeds.length === 0 || !embeds[0]?.description) {
      console.log(`[describe-handler-${instance.getInstanceId()}] finishDescribeTaskFromCreate: Missing embeds or description, messageId=${messageId}`);
      return;
    }

    // Try matching by interactionMetadata.id first (most reliable for describe)
    let condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.DESCRIBE]))
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]));
    
    let task: any = null;
    
    if (message.interaction_metadata?.id) {
      condition.setInteractionMetadataId(message.interaction_metadata.id);
      task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
      if (task) {
        console.log(`[describe-handler-${instance.getInstanceId()}] Matched task by interactionMetadata.id: taskId=${task.id}, interactionMetadataId=${message.interaction_metadata.id}`);
      }
    }

    // If not found, try matching by progressMessageId (the message that was set when task started)
    if (!task && messageId) {
      condition = new TaskCondition()
        .setActionSet(new Set([TaskAction.DESCRIBE]))
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setProgressMessageId(messageId);
      
      task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
      if (task) {
        console.log(`[describe-handler-${instance.getInstanceId()}] Matched task by progressMessageId: taskId=${task.id}, progressMessageId=${messageId}`);
      }
    }

    // If still not found, try matching by messageId (in case it was already set)
    if (!task) {
      condition = new TaskCondition()
        .setActionSet(new Set([TaskAction.DESCRIBE]))
        .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
        .setMessageId(messageId);
      
      task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
      if (task) {
        console.log(`[describe-handler-${instance.getInstanceId()}] Matched task by messageId: taskId=${task.id}, messageId=${messageId}`);
      }
    }

    if (!task) {
      console.log(`[describe-handler-${instance.getInstanceId()}] Could not find matching DESCRIBE task for completion message: messageId=${messageId}, interactionMetadataId=${message.interaction_metadata?.id || 'none'}`);
      // Log all running describe tasks for debugging
      const allDescribeTasks = instance.findRunningTask((t: any) => t.action === TaskAction.DESCRIBE);
      console.log(`[describe-handler-${instance.getInstanceId()}] Running DESCRIBE tasks: ${allDescribeTasks.map((t: any) => ({
        id: t.id,
        status: t.status,
        progressMessageId: t.getProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID),
        interactionMetadataId: t.getProperty(TASK_PROPERTY_INTERACTION_METADATA_ID),
        messageId: t.getProperty(TASK_PROPERTY_MESSAGE_ID)
      })).join(', ')}`);
      return;
    }

    // Skip if task is already completed
    if (task.status === TaskStatus.SUCCESS || task.status === TaskStatus.FAILURE) {
      console.log(`[describe-handler-${instance.getInstanceId()}] Task ${task.id} already completed with status ${task.status}, skipping`);
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
    
    console.log(`[describe-handler-${instance.getInstanceId()}] Finishing describe task: taskId=${task.id}, description length=${description?.length || 0}`);
    this.finishTask(instance, task, message);
  }

  /**
   * Finish describe task from UPDATE event (progress update or completion)
   * Matches by progressMessageId
   */
  private finishDescribeTask(instance: DiscordInstance, message: any, progressMessageId: string): void {
    const embeds = message.embeds;
    if (!progressMessageId || !embeds || embeds.length === 0) {
      return;
    }

    // Check if this is a completion (has description in embeds)
    const hasDescription = embeds[0]?.description;
    if (!hasDescription) {
      // This is just a progress update, not completion
      return;
    }

    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.DESCRIBE]))
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]))
      .setProgressMessageId(progressMessageId);

    const task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;
    if (!task) {
      console.log(`[describe-handler-${instance.getInstanceId()}] Could not find DESCRIBE task for UPDATE: progressMessageId=${progressMessageId}`);
      return;
    }

    // Skip if task is already completed
    if (task.status === TaskStatus.SUCCESS || task.status === TaskStatus.FAILURE) {
      console.log(`[describe-handler-${instance.getInstanceId()}] Task ${task.id} already completed with status ${task.status}, skipping`);
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
    
    console.log(`[describe-handler-${instance.getInstanceId()}] Finishing describe task from UPDATE: taskId=${task.id}, description length=${description?.length || 0}`);
    this.finishTask(instance, task, message);
  }
}

