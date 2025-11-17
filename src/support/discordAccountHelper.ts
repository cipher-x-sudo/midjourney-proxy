import { DiscordAccount } from '../models/DiscordAccount';
import { DiscordInstance, DiscordInstanceImpl } from '../loadbalancer/discordInstance';
import { DiscordGateway, SuccessCallback, FailureCallback } from '../wss/discordGateway';
import { UserMessageListener } from '../wss/userMessageListener';
import { DiscordHelper } from './discordHelper';
import { DiscordService, DiscordServiceImpl } from '../services/discordService';
import { TaskStoreService } from '../services/store/taskStoreService';
import { NotifyService } from '../services/notifyService';
import { MessageHandler } from '../wss/handlers/messageHandler';
import { ImagineSuccessHandler } from '../wss/handlers/imagineSuccessHandler';
import { UpscaleSuccessHandler } from '../wss/handlers/upscaleSuccessHandler';
import { VariationSuccessHandler } from '../wss/handlers/variationSuccessHandler';
import { RerollSuccessHandler } from '../wss/handlers/rerollSuccessHandler';
import { DescribeSuccessHandler } from '../wss/handlers/describeSuccessHandler';
import { ShortenSuccessHandler } from '../wss/handlers/shortenSuccessHandler';
import { SeedDmHandler } from '../wss/handlers/seedDmHandler';
import { BlendSuccessHandler } from '../wss/handlers/blendSuccessHandler';
import { StartAndProgressHandler } from '../wss/handlers/startAndProgressHandler';
import { ErrorMessageHandler } from '../wss/handlers/errorMessageHandler';
import { CaptchaEmbeddedHandler } from '../wss/handlers/captchaEmbeddedHandler';
import { IframeCustomIdHandler } from '../wss/handlers/iframeCustomIdHandler';
import { ReturnCode } from '../constants';
import { getLock } from '../utils/asyncLock';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Discord account helper
 */
export class DiscordAccountHelper {
  private discordHelper: DiscordHelper;
  private taskStoreService: TaskStoreService;
  private notifyService: NotifyService;

  constructor(
    discordHelper: DiscordHelper,
    taskStoreService: TaskStoreService,
    notifyService: NotifyService
  ) {
    this.discordHelper = discordHelper;
    this.taskStoreService = taskStoreService;
    this.notifyService = notifyService;
  }

  /**
   * Create Discord instance
   */
  createDiscordInstance(account: DiscordAccount): DiscordInstance {
    // Load API params templates
    const paramsMap = this.loadApiParams();

    // Create Discord service
    const discordService = new DiscordServiceImpl(account, paramsMap, this.discordHelper);

    // Create message handlers
    const messageHandlers = this.createMessageHandlers();

    // Create user message listener
    const userMessageListener = new UserMessageListener(messageHandlers);

    // Create WebSocket gateway
    const wssServer = this.discordHelper.getWss();
    const resumeWss = this.discordHelper.getResumeWss();

    const successCallback: SuccessCallback = {
      onSuccess: (sessionId: string, sequence: number | null, resumeGatewayUrl: string) => {
        this.notifyWssLock(account.id!, ReturnCode.SUCCESS, '');
      },
    };

    const failureCallback: FailureCallback = {
      onFailure: (code: number, reason: string) => {
        this.notifyWssLock(account.id!, code, reason);
      },
    };

    const gateway = new DiscordGateway(
      account,
      userMessageListener,
      this.discordHelper,
      wssServer,
      resumeWss,
      successCallback,
      failureCallback
    );

    // Create Discord instance
    const instance = new DiscordInstanceImpl(
      account,
      this.taskStoreService,
      this.notifyService,
      discordService,
      gateway
    );

    // Set instance in user message listener
    userMessageListener.setInstance(instance);

    return instance;
  }

  /**
   * Load API params templates
   */
  private loadApiParams(): Map<string, any> {
    const paramsMap = new Map<string, any>();
    const paramsDir = path.join(__dirname, '../../resources/api-params');

    try {
      const files = ['imagine.json', 'upscale.json', 'variation.json', 'reroll.json', 'describe.json', 'shorten.json', 'blend.json', 'message.json', 'custom-action.json', 'modal-submit.json', 'edits.json'];
      for (const file of files) {
        const filePath = path.join(paramsDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const key = file.replace('.json', '');
          paramsMap.set(key, content);
        }
      }
    } catch (error) {
      console.error('Error loading API params:', error);
    }

    return paramsMap;
  }

  /**
   * Create message handlers
   */
  private createMessageHandlers(): MessageHandler[] {
    return [
      new ErrorMessageHandler(this.discordHelper),
      new CaptchaEmbeddedHandler(this.discordHelper),
      new IframeCustomIdHandler(this.discordHelper, this.taskStoreService), // Early in chain to catch iframe events quickly
      new SeedDmHandler(this.discordHelper, this.taskStoreService),
      new DescribeSuccessHandler(this.discordHelper),
      new ShortenSuccessHandler(this.discordHelper),
      new BlendSuccessHandler(this.discordHelper),
      new StartAndProgressHandler(this.discordHelper),
      new ImagineSuccessHandler(this.discordHelper),
      new UpscaleSuccessHandler(this.discordHelper),
      new VariationSuccessHandler(this.discordHelper),
      new RerollSuccessHandler(this.discordHelper),
    ];
  }

  /**
   * Notify WebSocket lock
   */
  private notifyWssLock(accountId: string, code: number, reason: string): void {
    const lock = getLock(`wss:${accountId}`);
    if (lock) {
      lock.setProperty('code', code);
      lock.setProperty('description', reason);
      lock.awake();
    }
  }
}

