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

    // Step 2: Wait for WebSocket MESSAGE_UPDATE event containing iframe data (custom_id, instance_id, frame_id)
    // The iframe modal appears via WebSocket events, not HTTP API calls
    const waitTimeoutMs = 10000; // 10 seconds timeout
    let iframeData = null;

    console.log(`[task-service] submitEdits - Step 2: Waiting for WebSocket event with iframe data for message ${messageId} (timeout: ${waitTimeoutMs}ms)`);
    const waitStartTime = Date.now();

    try {
      // Wait for WebSocket event that contains the iframe data
      iframeData = await discordInstance.waitForIframeCustomId(messageId, waitTimeoutMs);
      const waitElapsed = Date.now() - waitStartTime;
      const totalElapsed = waitElapsed + buttonClickElapsed;
      
      console.log(`[task-service] submitEdits - Step 2: SUCCESS - Received iframe data via WebSocket: custom_id=${iframeData.custom_id.substring(0, 50)}..., instance_id=${iframeData.instance_id ? 'present' : 'missing'}, frame_id=${iframeData.frame_id || 'missing'} (${waitElapsed}ms wait, ${totalElapsed}ms total since button click)`);
    } catch (error: any) {
      const waitElapsed = Date.now() - waitStartTime;
      const totalElapsed = waitElapsed + buttonClickElapsed;
      
      console.error(`[task-service] submitEdits failed at Step 2 - Could not get iframe data from WebSocket event (${waitElapsed}ms wait, ${totalElapsed}ms total): ${error.message}`);
      
      return SubmitResultVO.fail(
        ReturnCode.VALIDATION_ERROR,
        `Failed to receive iframe data from WebSocket event. The Vary Region/Inpaint button was clicked successfully, but Discord did not send a WebSocket event with iframe data within ${waitTimeoutMs}ms. Error: ${error.message}`
      );
    }

    // Step 3: Validate that we found the iframe data
    if (!iframeData || !iframeData.custom_id) {
      console.error(`[task-service] submitEdits failed at Step 2 - iframeData is null or missing custom_id after WebSocket wait`);
      return SubmitResultVO.fail(
        ReturnCode.VALIDATION_ERROR,
        'Failed to extract iframe data from WebSocket event. The iframe modal may not have appeared.'
      );
    }

    // Step 4: Submit directly to inpaint API with the MJ::iframe:: custom_id
    // Note: instance_id and frame_id are available in iframeData but may not be required for submitInpaint
    console.log(`[task-service] submitEdits - Step 3: Submitting inpaint job with iframeCustomId: ${iframeData.custom_id}, instance_id: ${iframeData.instance_id || 'N/A'}, frame_id: ${iframeData.frame_id || 'N/A'}, maskBase64 length: ${maskBase64?.length || 0}, prompt: ${prompt ? prompt.substring(0, 50) : 'empty'}`);
    const inpaintResult = await discordInstance.submitInpaint(iframeData.custom_id, maskBase64, prompt);

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

}

