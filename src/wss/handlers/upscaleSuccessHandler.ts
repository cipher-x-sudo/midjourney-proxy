import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { TaskStatus } from '../../enums/TaskStatus';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContentWithRegex, ContentParseData } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';
import { Task } from '../../models/Task';
import { TaskCondition } from '../../support/taskCondition';
import { TASK_PROPERTY_REFERENCED_MESSAGE_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_MESSAGE_HASH, MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * U content parse data (with index)
 */
interface UContentParseData extends ContentParseData {
  index: number;
}

/**
 * Upscale success handler
 * Handles: **cat** - Upscaled (Beta\Light\Creative等) by <@1083152202048217169> (fast)
 * Handles: **cat** - Upscaled by <@1083152202048217169> (fast)
 * Handles: **cat** - Image #1 <@1012983546824114217>
 */
export class UpscaleSuccessHandler extends MessageHandler {
  private static readonly CONTENT_REGEX_1 = '\\*\\*(.*)\\*\\* - Upscaled \\(.*?\\) by <@\\d+> \\((.*?)\\)';
  private static readonly CONTENT_REGEX_2 = '\\*\\*(.*)\\*\\* - Upscaled by <@\\d+> \\((.*?)\\)';
  private static readonly CONTENT_REGEX_U = '\\*\\*(.*)\\*\\* - Image #(\\d) <@\\d+>';

  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const content = this.getMessageContent(message);
    const parseData = this.getParseData(content);
    
    if (messageType === MessageType.CREATE && parseData && this.hasImage(message)) {
      if ('index' in parseData) {
        const uParseData = parseData as UContentParseData;
        this.findAndFinishUTask(instance, uParseData.prompt, uParseData.index, message);
      } else {
        this.findAndFinishImageTask(instance, TaskAction.UPSCALE, parseData.prompt, message);
      }
    }
  }

  private findAndFinishUTask(instance: DiscordInstance, finalPrompt: string, index: number, message: any): void {
    const imageUrl = this.getImageUrl(message);
    const messageHash = imageUrl ? this.discordHelper.getMessageHash(imageUrl) : null;
    
    const condition = new TaskCondition()
      .setActionSet(new Set([TaskAction.UPSCALE]))
      .setFinalPrompt(finalPrompt)
      .setStatusSet(new Set([TaskStatus.IN_PROGRESS]));

    if (messageHash) {
      condition.setMessageHash(messageHash);
    }

    let task = instance.findRunningTask(condition.toFunction()).find(t => t) || null;

    if (!task) {
      condition.setMessageHash(undefined);
      const referencedMessageId = this.getReferencedMessageId(message);
      const tasks = instance.findRunningTask(condition.toFunction()).filter(t => {
        if (!t.description?.endsWith(`U${index}`)) {
          return false;
        }
        if (referencedMessageId) {
          return t.getProperty(TASK_PROPERTY_REFERENCED_MESSAGE_ID) === referencedMessageId;
        }
        return true;
      });
      task = tasks.sort((a, b) => (a.startTime || 0) - (b.startTime || 0))[0] || null;
    }

    if (!task) {
      return;
    }

    message[MJ_MESSAGE_HANDLED] = true;
    task.setProperty(TASK_PROPERTY_FINAL_PROMPT, finalPrompt);
    if (messageHash) {
      task.setProperty(TASK_PROPERTY_MESSAGE_HASH, messageHash);
    }
    if (imageUrl) {
      task.imageUrl = imageUrl;
    }
    this.finishTask(instance, task, message);
  }

  private getReferencedMessageId(message: any): string {
    return message.referenced_message?.id || '';
  }

  private getParseData(content: string): ContentParseData | UContentParseData | null {
    let parseData = parseContentWithRegex(content, UpscaleSuccessHandler.CONTENT_REGEX_1);
    if (!parseData) {
      parseData = parseContentWithRegex(content, UpscaleSuccessHandler.CONTENT_REGEX_2);
    }
    if (parseData) {
      return parseData;
    }

    const match = content.match(new RegExp(UpscaleSuccessHandler.CONTENT_REGEX_U));
    if (!match || match.length < 3) {
      return null;
    }

    const uData: UContentParseData = {
      prompt: match[1] || '',
      status: 'done',
      index: parseInt(match[2] || '1', 10),
    };
    return uData;
  }
}

