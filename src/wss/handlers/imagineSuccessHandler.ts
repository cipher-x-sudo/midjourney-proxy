import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContentWithRegex } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';

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
      this.findAndFinishImageTask(instance, TaskAction.IMAGINE, parseData.prompt, message);
    }
  }
}

