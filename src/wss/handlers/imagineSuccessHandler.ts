import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContentWithRegex } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { extractButtonsFromMessage } from '../../utils/buttonUtils';
import { TaskStatus } from '../../enums/TaskStatus';
import { TaskCondition } from '../../support/taskCondition';

/**
 * Imagine success handler
 * Handles: **cat** - <@1012983546824114217> (relaxed)
 */
export class ImagineSuccessHandler extends MessageHandler {
  private static readonly CONTENT_REGEX = '\\*\\*(.*)\\*\\* - <@\\d+> \\((.*?)\\)';

  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    return 101;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const content = this.getMessageContent(message);
    const parseData = parseContentWithRegex(content, ImagineSuccessHandler.CONTENT_REGEX);
    
    if (messageType === MessageType.CREATE && parseData && this.hasImage(message)) {
      // Check if this is an edits task that needs inpaint
      this.checkAndProcessEditsTask(instance, parseData.prompt, message);
      
      // Also handle as normal imagine task
      this.findAndFinishImageTask(instance, TaskAction.IMAGINE, parseData.prompt, message);
    }
  }

  /**
   * Check if this is an edits task and process it automatically
   */
  private checkAndProcessEditsTask(instance: DiscordInstance, finalPrompt: string, message: any): void {
    // Find tasks that are edits (have edits_mask_base64 property and description starts with /edits)
    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.VARIATION]))
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]));
    
    const tasks = instance.findRunningTask(condition.toFunction());
    const editsTask = tasks.find(t => 
      t.getProperty('edits_mask_base64') && 
      t.getProperty('edits_use_direct_api') === 'true' &&
      t.description?.startsWith('/edits')
    );
    
    if (!editsTask) {
      return;
    }

    // Extract buttons from the grid message
    const buttons = extractButtonsFromMessage(message);
    if (!buttons || buttons.length === 0) {
      return;
    }

    // Find the inpaint button (customId contains "Inpaint")
    const inpaintButton = buttons.find(btn => 
      btn.customId && btn.customId.toLowerCase().includes('inpaint')
    );

    if (!inpaintButton) {
      return;
    }

    // Get stored mask and prompt
    const maskBase64 = editsTask.getProperty('edits_mask_base64');
    const prompt = editsTask.getProperty('edits_prompt') || editsTask.promptEn || editsTask.prompt;

    if (!maskBase64 || !prompt) {
      return;
    }

    // Call submitInpaint automatically
    console.log(`[imagine-success-handler-${instance.getInstanceId()}] Auto-submitting inpaint for edits task ${editsTask.id}`);
    
    // Process asynchronously to avoid blocking
    instance.submitInpaint(inpaintButton.customId, maskBase64, prompt).catch((error: any) => {
      console.error(`[imagine-success-handler-${instance.getInstanceId()}] Error submitting inpaint:`, error);
      editsTask.fail(`Failed to submit inpaint: ${error.message || error}`);
    });
  }
}

