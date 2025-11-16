import { SubmitResultVO } from '../models/SubmitResultVO';
import { Task } from '../models/Task';
import { BlendDimensions } from '../enums/BlendDimensions';
import { DataUrl, convertBase64Array } from '../utils/convertUtils';
import { DiscordLoadBalancer } from '../loadbalancer/discordLoadBalancer';
import { DiscordInstance } from '../loadbalancer/discordInstance';
import { TaskStoreService } from './store/taskStoreService';
import { ReturnCode } from '../constants';
import { Message } from '../result/Message';
import { guessFileSuffix } from '../utils/mimeTypeUtils';
import { TASK_PROPERTY_DISCORD_INSTANCE_ID, TASK_PROPERTY_NONCE } from '../constants';
import { config } from '../config';

/**
 * Task service interface
 */
export interface TaskService {
  submitImagine(task: Task, dataUrls: DataUrl[]): Promise<SubmitResultVO>;
  submitUpscale(task: Task, targetMessageId: string, targetMessageHash: string, index: number, messageFlags: number): Promise<SubmitResultVO>;
  submitVariation(task: Task, targetMessageId: string, targetMessageHash: string, index: number, messageFlags: number): Promise<SubmitResultVO>;
  submitReroll(task: Task, targetMessageId: string, targetMessageHash: string, messageFlags: number): Promise<SubmitResultVO>;
  submitDescribe(task: Task, dataUrl: DataUrl): Promise<SubmitResultVO>;
  submitShorten(task: Task): Promise<SubmitResultVO>;
  submitBlend(task: Task, dataUrls: DataUrl[], dimensions: BlendDimensions): Promise<SubmitResultVO>;
  submitCustomAction(task: Task, targetMessageId: string, messageFlags: number, customId: string): Promise<SubmitResultVO>;
  submitModal(task: Task, payload: { modalTaskId: string; prompt?: string; maskBase64?: string }): Promise<SubmitResultVO>;
  submitEdits(task: Task, messageId: string, customId: string, maskBase64: string, prompt: string): Promise<SubmitResultVO>;
}

/**
 * Task service implementation
 */
export class TaskServiceImpl implements TaskService {
  private taskStoreService: TaskStoreService;
  private discordLoadBalancer: DiscordLoadBalancer;

  constructor(taskStoreService: TaskStoreService, discordLoadBalancer: DiscordLoadBalancer) {
    this.taskStoreService = taskStoreService;
    this.discordLoadBalancer = discordLoadBalancer;
  }

  async submitImagine(task: Task, dataUrls: DataUrl[]): Promise<SubmitResultVO> {
    const instance = this.discordLoadBalancer.chooseInstance();
    if (!instance) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    }

    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, instance.getInstanceId());

    return instance.submitTask(task, async () => {
      const imageUrls: string[] = [];
      
      for (const dataUrl of dataUrls) {
        const taskFileName = `${task.id}.${guessFileSuffix(dataUrl.mimeType) || 'png'}`;
        const uploadResult = await instance.upload(taskFileName, dataUrl);
        
        if (uploadResult.getCode() !== ReturnCode.SUCCESS) {
          return Message.of(uploadResult.getCode(), uploadResult.getDescription());
        }

        const finalFileName = uploadResult.getResult()!;
        const sendImageResult = await instance.sendImageMessage(`upload image: ${finalFileName}`, finalFileName);
        
        if (sendImageResult.getCode() !== ReturnCode.SUCCESS) {
          return Message.of(sendImageResult.getCode(), sendImageResult.getDescription());
        }

        imageUrls.push(sendImageResult.getResult()!);
      }

      if (imageUrls.length > 0) {
        task.prompt = `${imageUrls.join(' ')} ${task.prompt || ''}`;
        task.promptEn = `${imageUrls.join(' ')} ${task.promptEn || ''}`;
        task.description = `/imagine ${task.prompt}`;
        await this.taskStoreService.save(task);
      }

      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return instance.imagine(task.promptEn || task.prompt || '', nonce || '');
    });
  }

  async submitUpscale(task: Task, targetMessageId: string, targetMessageHash: string, index: number, messageFlags: number): Promise<SubmitResultVO> {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const discordInstance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    
    if (!discordInstance || !discordInstance.isAlive()) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    }

    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return discordInstance.submitTask(task, () => 
      discordInstance.upscale(targetMessageId, index, targetMessageHash, messageFlags, nonce || '')
    );
  }

  async submitVariation(task: Task, targetMessageId: string, targetMessageHash: string, index: number, messageFlags: number): Promise<SubmitResultVO> {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const discordInstance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    
    if (!discordInstance || !discordInstance.isAlive()) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    }

    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return discordInstance.submitTask(task, () => 
      discordInstance.variation(targetMessageId, index, targetMessageHash, messageFlags, nonce || '')
    );
  }

  async submitReroll(task: Task, targetMessageId: string, targetMessageHash: string, messageFlags: number): Promise<SubmitResultVO> {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const discordInstance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    
    if (!discordInstance || !discordInstance.isAlive()) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    }

    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return discordInstance.submitTask(task, () => 
      discordInstance.reroll(targetMessageId, targetMessageHash, messageFlags, nonce || '')
    );
  }

  async submitDescribe(task: Task, dataUrl: DataUrl): Promise<SubmitResultVO> {
    const discordInstance = this.discordLoadBalancer.chooseInstance();
    if (!discordInstance) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    }

    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, discordInstance.getInstanceId());

    return discordInstance.submitTask(task, async () => {
      const taskFileName = `${task.id}.${guessFileSuffix(dataUrl.mimeType) || 'png'}`;
      const uploadResult = await discordInstance.upload(taskFileName, dataUrl);
      
      if (uploadResult.getCode() !== ReturnCode.SUCCESS) {
        return Message.of(uploadResult.getCode(), uploadResult.getDescription());
      }

      const finalFileName = uploadResult.getResult()!;
      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return discordInstance.describe(finalFileName, nonce || '');
    });
  }

  async submitShorten(task: Task): Promise<SubmitResultVO> {
    const discordInstance = this.discordLoadBalancer.chooseInstance();
    if (!discordInstance) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    }

    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, discordInstance.getInstanceId());

    return discordInstance.submitTask(task, () => {
      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return discordInstance.shorten(task.promptEn || task.prompt || '', nonce || '');
    });
  }

  async submitBlend(task: Task, dataUrls: DataUrl[], dimensions: BlendDimensions): Promise<SubmitResultVO> {
    const discordInstance = this.discordLoadBalancer.chooseInstance();
    if (!discordInstance) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'No available account instance');
    }

    task.setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, discordInstance.getInstanceId());

    return discordInstance.submitTask(task, async () => {
      const finalFileNames: string[] = [];
      
      for (const dataUrl of dataUrls) {
        const taskFileName = `${task.id}.${guessFileSuffix(dataUrl.mimeType) || 'png'}`;
        const uploadResult = await discordInstance.upload(taskFileName, dataUrl);
        
        if (uploadResult.getCode() !== ReturnCode.SUCCESS) {
          return Message.of(uploadResult.getCode(), uploadResult.getDescription());
        }

        finalFileNames.push(uploadResult.getResult()!);
      }

      const nonce = task.getProperty(TASK_PROPERTY_NONCE);
      return discordInstance.blend(finalFileNames, dimensions, nonce || '');
    });
  }

  async submitCustomAction(task: Task, targetMessageId: string, messageFlags: number, customId: string): Promise<SubmitResultVO> {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const discordInstance = this.discordLoadBalancer.getDiscordInstance(instanceId);

    if (!discordInstance || !discordInstance.isAlive()) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    }

    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return discordInstance.submitTask(task, () =>
      // messageHash is not required for component interactions
      (discordInstance as any).customAction(targetMessageId, messageFlags, customId, nonce || '')
    );
  }

  async submitModal(task: Task, payload: { modalTaskId: string; prompt?: string; maskBase64?: string }): Promise<SubmitResultVO> {
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const discordInstance = this.discordLoadBalancer.getDiscordInstance(instanceId);

    if (!discordInstance || !discordInstance.isAlive()) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    }

    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    return discordInstance.submitTask(task, () =>
      (discordInstance as any).modalSubmit(payload.modalTaskId, { prompt: payload.prompt, maskBase64: payload.maskBase64 }, nonce || '')
    );
  }

  async submitEdits(task: Task, messageId: string, customId: string, maskBase64: string, prompt: string): Promise<SubmitResultVO> {
    console.log(`[task-service] submitEdits called - taskId: ${task.id}, messageId: ${messageId}, customId: ${customId}, prompt: ${prompt ? prompt.substring(0, 50) : 'empty'}`);
    
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const discordInstance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    
    if (!discordInstance || !discordInstance.isAlive()) {
      console.error(`[task-service] submitEdits failed - Account unavailable: ${instanceId}`);
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    }

    const messageFlags = task.getProperty('flags') || 0;
    console.log(`[task-service] submitEdits - Step 1: Clicking Vary Region/Inpaint button with messageId: ${messageId}, customId: ${customId}, flags: ${messageFlags}`);
    
    // Step 1: Click the Inpaint button using submitCustomAction
    // Discord returns 204 No Content (no body, no modal taskId in response)
    const buttonClickStartTime = Date.now();
    const actionResult = await this.submitCustomAction(task, messageId, messageFlags, customId);
    const buttonClickElapsed = Date.now() - buttonClickStartTime;
    
    console.log(`[task-service] submitEdits - Step 1 result: code=${actionResult.code}, description=${actionResult.description}, result=${actionResult.result}, elapsed=${buttonClickElapsed}ms`);
    
    if (actionResult.code !== ReturnCode.SUCCESS) {
      console.error(`[task-service] submitEdits failed at Step 1 - customAction failed: ${actionResult.description}`);
      return actionResult;
    }

    // Step 2: Wait for Discord to process and update the message with iframe URL
    // The iframe URL appears with MJ::iframe:: custom_id in URL parameters
    // Retry with delays in case iframe URL is not immediately available
    const maxRetries = 5;
    const retryDelay = 500; // 500ms between retries
    let iframeCustomId: string | null = null;
    let lastMessage: any = null;
    let allFoundUrls: Array<{ url: string; location: string }> = [];

    console.log(`[task-service] submitEdits - Step 2: Attempting to extract iframe custom_id from message ${messageId} (max retries: ${maxRetries}, retryDelay: ${retryDelay}ms)`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Wait before attempting to fetch (except first attempt)
      if (attempt > 0) {
        console.log(`[task-service] submitEdits - Step 2: Waiting ${retryDelay}ms before attempt ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      const attemptStartTime = Date.now();
      const elapsedSinceButtonClick = attemptStartTime - buttonClickStartTime;
      console.log(`[task-service] submitEdits - Step 2: Attempt ${attempt + 1}/${maxRetries} - Fetching message ${messageId} (${elapsedSinceButtonClick}ms since button click)`);

      // Fetch the message to get updated embeds/components
      const messageResult = await discordInstance.fetchMessage(messageId);
      
      if (messageResult.getCode() !== ReturnCode.SUCCESS) {
        // If fetch fails, continue to next retry
        console.warn(`[task-service] submitEdits - Step 2: Failed to fetch message ${messageId} on attempt ${attempt + 1}: ${messageResult.getDescription()}`);
        continue;
      }

      const message = messageResult.getResult();
      if (!message) {
        console.warn(`[task-service] submitEdits - Step 2: Message result is null on attempt ${attempt + 1}`);
        continue;
      }

      lastMessage = message; // Store for potential full dump on failure
      const attemptElapsed = Date.now() - attemptStartTime;

      // Log detailed message structure summary
      const embedsCount = message.embeds?.length || 0;
      const componentsCount = message.components?.length || 0;
      const contentLength = message.content?.length || 0;
      const hasAttachments = !!message.attachments && message.attachments.length > 0;
      
      console.log(`[task-service] submitEdits - Step 2: Message fetched successfully on attempt ${attempt + 1} (${attemptElapsed}ms)`);
      console.log(`[task-service] submitEdits - Message structure summary: embeds=${embedsCount}, components=${componentsCount}, contentLength=${contentLength}, hasAttachments=${hasAttachments}`);

      // Collect all URLs from the message for debugging
      const urlsInMessage = this.collectUrlsFromMessage(message);
      allFoundUrls.push(...urlsInMessage.map(url => ({ url, location: `attempt_${attempt + 1}` })));
      
      if (urlsInMessage.length > 0) {
        console.log(`[task-service] submitEdits - Step 2: Found ${urlsInMessage.length} URL(s) in message on attempt ${attempt + 1}:`);
        urlsInMessage.forEach((url, idx) => {
          const truncated = url.length > 150 ? url.substring(0, 150) + '...' : url;
          console.log(`[task-service] submitEdits - Step 2:   URL[${idx}]: ${truncated}`);
        });
      } else {
        console.log(`[task-service] submitEdits - Step 2: No URLs found in message on attempt ${attempt + 1}`);
      }

      // Extract MJ::iframe:: custom_id from the message
      iframeCustomId = discordInstance.extractIframeCustomId(message);
      
      if (iframeCustomId) {
        console.log(`[task-service] submitEdits - Step 2: SUCCESS - Extracted iframe custom_id: ${iframeCustomId} on attempt ${attempt + 1} (${elapsedSinceButtonClick}ms after button click)`);
        break;
      } else {
        console.log(`[task-service] submitEdits - Step 2: No iframe custom_id found on attempt ${attempt + 1}, will retry...`);
      }
    }

    // Step 3: Validate that we found the iframe custom_id
    if (!iframeCustomId) {
      console.error(`[task-service] submitEdits failed at Step 2 - Could not extract iframe custom_id after ${maxRetries} attempts`);
      
      // Dump full message JSON from last attempt (if verbose dumping is enabled)
      if (lastMessage && config.debug?.verboseMessageDump !== false) {
        console.error(`[task-service] submitEdits - Step 2 FAILURE: Dumping complete message JSON from last attempt:`);
        try {
          const messageJson = JSON.stringify(lastMessage, null, 2);
          // Truncate if too large (over 50000 chars)
          if (messageJson.length > 50000) {
            console.error(`[task-service] submitEdits - Message JSON (truncated, original length: ${messageJson.length}):`);
            console.error(messageJson.substring(0, 50000) + '\n... [TRUNCATED] ...');
          } else {
            console.error(messageJson);
          }
        } catch (e) {
          console.error(`[task-service] submitEdits - Failed to stringify message JSON: ${e}`);
        }
      } else if (lastMessage && config.debug?.verboseMessageDump === false) {
        console.error(`[task-service] submitEdits - Step 2 FAILURE: Verbose message dumping is disabled (set debug.verboseMessageDump: true to enable)`);
      }
      
      // Log all URLs found across all attempts
      if (allFoundUrls.length > 0) {
        console.error(`[task-service] submitEdits - Step 2 FAILURE: All URLs found across ${maxRetries} attempts (${allFoundUrls.length} total):`);
        const uniqueUrls = Array.from(new Set(allFoundUrls.map(u => u.url)));
        uniqueUrls.forEach((url, idx) => {
          const locations = allFoundUrls.filter(u => u.url === url).map(u => u.location).join(', ');
          const truncated = url.length > 200 ? url.substring(0, 200) + '...' : url;
          console.error(`[task-service] submitEdits -   URL[${idx}] (found in: ${locations}): ${truncated}`);
        });
      } else {
        console.error(`[task-service] submitEdits - Step 2 FAILURE: No URLs found in any of the ${maxRetries} attempts`);
      }
      
      return SubmitResultVO.fail(
        ReturnCode.VALIDATION_ERROR,
        'Failed to extract iframe custom_id from message. The Vary Region/Inpaint button may not have been clicked successfully, or Discord did not respond with an iframe URL.'
      );
    }

    // Step 4: Submit directly to inpaint API with the MJ::iframe:: custom_id
    console.log(`[task-service] submitEdits - Step 3: Submitting inpaint job with iframeCustomId: ${iframeCustomId}, maskBase64 length: ${maskBase64?.length || 0}, prompt: ${prompt ? prompt.substring(0, 50) : 'empty'}`);
    const inpaintResult = await discordInstance.submitInpaint(iframeCustomId, maskBase64, prompt);

    console.log(`[task-service] submitEdits - Step 3 result: code=${inpaintResult.getCode()}, description=${inpaintResult.getDescription()}`);

    if (inpaintResult.getCode() !== ReturnCode.SUCCESS) {
      console.error(`[task-service] submitEdits failed at Step 3 - submitInpaint failed: ${inpaintResult.getDescription()}`);
      return SubmitResultVO.fail(
        ReturnCode.FAILURE,
        `Failed to submit inpaint job: ${inpaintResult.getDescription()}`
      );
    }

    // Return success with task ID
    console.log(`[task-service] submitEdits - SUCCESS - Task ${task.id} submitted successfully`);
    return SubmitResultVO.of(ReturnCode.SUCCESS, 'Success', task.id!);
  }

  /**
   * Collect all URLs from a Discord message for debugging purposes
   * @param message Discord message object
   * @returns Array of all URLs found in the message
   */
  private collectUrlsFromMessage(message: any): string[] {
    const urls: string[] = [];
    
    // Check embeds
    if (message.embeds && Array.isArray(message.embeds)) {
      for (const embed of message.embeds) {
        if (embed.url && typeof embed.url === 'string') {
          urls.push(embed.url);
        }
        if (embed.fields && Array.isArray(embed.fields)) {
          for (const field of embed.fields) {
            if (field.value && typeof field.value === 'string') {
              // Try to extract URLs from field value
              const urlMatches = field.value.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi);
              if (urlMatches) {
                urls.push(...urlMatches);
              }
            }
          }
        }
      }
    }
    
    // Check components
    if (message.components && Array.isArray(message.components)) {
      for (const component of message.components) {
        if (component.components && Array.isArray(component.components)) {
          for (const subComponent of component.components) {
            if (subComponent.url && typeof subComponent.url === 'string') {
              urls.push(subComponent.url);
            }
          }
        }
      }
    }
    
    // Check message content
    if (message.content && typeof message.content === 'string') {
      const urlMatches = message.content.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi);
      if (urlMatches) {
        urls.push(...urlMatches);
      }
    }
    
    return urls;
  }
}

