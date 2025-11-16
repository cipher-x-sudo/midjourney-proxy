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
    const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
    const discordInstance = this.discordLoadBalancer.getDiscordInstance(instanceId);
    
    if (!discordInstance || !discordInstance.isAlive()) {
      return SubmitResultVO.fail(ReturnCode.NOT_FOUND, `Account unavailable: ${instanceId}`);
    }

    const nonce = task.getProperty(TASK_PROPERTY_NONCE);
    
    return discordInstance.submitTask(task, async () => {
      // Step 1: Click the Inpaint button on the existing message
      // This sends a POST to Discord interactions API (type 3 - message component interaction)
      const editsResult = await discordInstance.edits(messageId, customId, nonce || '');
      
      if (editsResult.getCode() !== ReturnCode.SUCCESS) {
        return editsResult;
      }

      // Step 2: Submit the inpaint job directly to the inpaint API
      // This sends a POST to https://936929561302675456.discordsays.com/.proxy/inpaint/api/submit-job
      const inpaintResult = await discordInstance.submitInpaint(customId, maskBase64, prompt);
      
      if (inpaintResult.getCode() !== ReturnCode.SUCCESS) {
        return inpaintResult;
      }

      return Message.success<void>();
    });
  }
}

