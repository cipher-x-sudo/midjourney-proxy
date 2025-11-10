import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { TaskAction } from '../../enums/TaskAction';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { parseContent, ContentParseData } from '../../utils/convertUtils';
import { DiscordHelper } from '../../support/discordHelper';

/**
 * Blend success handler
 * Handles: **<https://s.mj.run/JWu6jaL1D-8> <https://s.mj.run/QhfnQY-l68o> --v 5.1** - <@1012983546824114217> (relaxed)
 */
export class BlendSuccessHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    return 89;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const content = this.getMessageContent(message);
    const parseData = parseContent(content);
    
    if (!parseData || messageType !== MessageType.CREATE) {
      return;
    }

    const interactionName = this.getInteractionName(message);
    if (interactionName === 'blend') {
      // Set prompt when blend task starts
      const task = instance.getRunningTaskByNonce(this.getMessageNonce(message));
      if (task) {
        task.promptEn = parseData.prompt;
        task.prompt = parseData.prompt;
      }
    }

    if (this.hasImage(message)) {
      this.findAndFinishImageTask(instance, TaskAction.BLEND, parseData.prompt, message);
    }
  }
}

