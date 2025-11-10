import { MessageHandler } from './messageHandler';
import { MessageType } from '../../enums/MessageType';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { DiscordHelper } from '../../support/discordHelper';
import { MJ_MESSAGE_HANDLED } from '../../constants';

/**
 * Captcha embedded handler
 */
export class CaptchaEmbeddedHandler extends MessageHandler {
  constructor(discordHelper: DiscordHelper) {
    super(discordHelper);
  }

  order(): number {
    return 2;
  }

  handle(instance: DiscordInstance, messageType: MessageType, message: any): void {
    const iframePath = message.iframe_path || '';
    if (iframePath.startsWith('/captcha/embedded/')) {
      message[MJ_MESSAGE_HANDLED] = true;
      const title = message.title || '';
      const nonce = this.getMessageNonce(message);
      const task = instance.getRunningTaskByNonce(nonce);
      const reason = `[${title}] ${iframePath}`;
      if (task) {
        task.fail(reason);
      }
    }
  }
}

