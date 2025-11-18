import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContent, parseContentWithRegex } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { TASK_PROPERTY_PROGRESS_MESSAGE_ID, MJ_MESSAGE_HANDLED, TASK_PROPERTY_BUTTONS, TASK_PROPERTY_MESSAGE_ID } from '../../constants';
import { extractButtonsFromMessage } from '../../utils/buttonUtils';
import { TaskCondition } from '../../support/taskCondition';

/**
 * Vary Region (Inpaint) success handler
 * Handles: **prompt** - Variations (Region) by <@1012983546824114217> (relaxed)
 * 
 * This handler manages inpaint/vary region tasks from initial message through completion.
 * These tasks are created via modal submission and have empty prompt/promptEn fields.
 */
export class VaryRegionSuccessHandler extends MessageHandler {
  // Matches: **prompt** - Variations (Region) by <@user> (mode)
  private static readonly CONTENT_REGEX = '\\*\\*(.*)\\*\\* - Variations \\(Region\\) by <@\\d+> \\((.*?)\\)';

  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    // Run early to catch inpaint tasks before generic handlers
    return 95;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    if (messageType !== MessageType.CREATE) {
      return;
    }

    const content = this.getMessageContent(message);
    const nonce = this.getMessageNonce(message);
    
    // Try to handle as initial inpaint message (nonce-based)
    const handledAsStart = this.handleInpaintStart(instance, message, nonce, content);
    
    // If not handled as start, try as completion message (pattern-based)
    if (!handledAsStart) {
      this.handleInpaintCompletion(instance, message, content);
    }
  }

  /**
   * Handle initial inpaint message (task started)
   * Matches by nonce since inpaint tasks have empty prompt/promptEn
   * @returns true if message was handled, false otherwise
   */
  private handleInpaintStart(instance: DiscordInstance, message: any, nonce: string, content: string): boolean {
    if (!nonce) {
      return false;
    }

    // Try to find inpaint task by nonce
    const task = instance.getRunningTaskByNonce(nonce);
    if (!task) {
      return false;
    }

    // Verify this is an inpaint task (VARIATION action with empty prompt)
    const isInpaintTask = task.action === TaskAction.VARIATION && 
                          (!task.prompt || task.prompt === '') && 
                          (!task.promptEn || task.promptEn === '');
    
    if (!isInpaintTask) {
      // Not an inpaint task, let other handlers process it
      return false;
    }

    // Parse the content to get prompt and progress
    const parseData = parseContent(content);
    if (!parseData) {
      return false;
    }

    console.log(`[vary-region-handler-${instance.getInstanceId()}] Matched inpaint task ${task.id} by nonce: ${nonce}`);
    
    message[MJ_MESSAGE_HANDLED] = true;
    task.setProperty(TASK_PROPERTY_PROGRESS_MESSAGE_ID, message.id);
    
    // Set the final prompt from the Discord message
    if (parseData.prompt) {
      task.setProperty('finalPrompt', parseData.prompt);
      // Also set prompt/promptEn now that we know them
      task.prompt = parseData.prompt;
      task.promptEn = parseData.prompt;
    }
    
    task.status = TaskStatus.IN_PROGRESS;
    return true;
  }

  /**
   * Handle inpaint completion message (image ready)
   */
  private handleInpaintCompletion(instance: DiscordInstance, message: any, content: string): void {
    const parseData = parseContentWithRegex(content, VaryRegionSuccessHandler.CONTENT_REGEX);
    
    if (parseData && this.hasImage(message)) {
      console.log(`[vary-region-handler-${instance.getInstanceId()}] Inpaint task completed: ${parseData.prompt}`);
      
      // Use the standard findAndFinishImageTask method
      this.findAndFinishImageTask(instance, TaskAction.VARIATION, parseData.prompt, message);
    }
  }

  /**
   * Override findAndFinishImageTask to also extract buttons for vary region actions
   */
  protected findAndFinishImageTask(
    instance: DiscordInstance,
    action: TaskAction,
    finalPrompt: string,
    message: any
  ): void {
    // Extract buttons before calling parent (message might be modified)
    const buttons = extractButtonsFromMessage(message);
    
    // Call parent implementation
    super.findAndFinishImageTask(instance, action, finalPrompt, message);
    
    // Find the task that was just finished and add buttons to it
    // The parent method sets TASK_PROPERTY_MESSAGE_ID in finishTask
    const messageId = message.id;
    if (messageId && buttons.length > 0) {
      const condition = new TaskCondition()
        .setActionSet(new Set([action]))
        .setStatusSet(new Set([TaskStatus.SUCCESS]));
      
      // Try to find by message ID first (most reliable)
      const tasks = instance.findRunningTask(condition.toFunction());
      const task = tasks.find(t => t.getProperty(TASK_PROPERTY_MESSAGE_ID) === messageId) || null;
      
      if (task) {
        task.setProperty(TASK_PROPERTY_BUTTONS, buttons);
      }
    }
  }
}

