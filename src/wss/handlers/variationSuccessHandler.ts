import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContentWithRegex, ContentParseData } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';

/**
 * Variation success handler
 * Handles: **cat** - Variations (Strong\Subtle\Region等) by <@1012983546824114217> (relaxed)
 * Handles: **cat** - Variations by <@1012983546824114217> (relaxed)
 */
export class VariationSuccessHandler extends MessageHandler {
  private static readonly CONTENT_REGEX_1 = '\\*\\*(.*)\\*\\* - Variations by <@\\d+> \\((.*?)\\)';
  private static readonly CONTENT_REGEX_2 = '\\*\\*(.*)\\*\\* - Variations \\(.*?\\) by <@\\d+> \\((.*?)\\)';

  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const content = this.getMessageContent(message);
    const parseData = this.getParseData(content);
    
    if (messageType === MessageType.CREATE && parseData && this.hasImage(message)) {
      this.findAndFinishImageTask(instance, TaskAction.VARIATION, parseData.prompt, message);
    }
  }

  private getParseData(content: string): ContentParseData | null {
    let parseData = parseContentWithRegex(content, VariationSuccessHandler.CONTENT_REGEX_1);
    if (!parseData) {
      parseData = parseContentWithRegex(content, VariationSuccessHandler.CONTENT_REGEX_2);
    }
    return parseData;
  }
}

