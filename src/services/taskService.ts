import { SubmitResultVO } from '../models/SubmitResultVO';
import { Task } from '../models/Task';
import { BlendDimensions } from '../enums/BlendDimensions';
import { DataUrl, convertBase64Array } from '../utils/convertUtils';
import { DiscordLoadBalancer } from '../loadbalancer/discordLoadBalancer';
import { DiscordInstance } from '../loadbalancer/discordInstance';
import { TaskStoreService } from './store/taskStoreService';
import { ReturnCode, TASK_PROPERTY_DISCORD_INSTANCE_ID, TASK_PROPERTY_NONCE, TASK_PROPERTY_MESSAGE_ID, TASK_PROPERTY_FLAGS, TASK_PROPERTY_CUSTOM_ID, TASK_PROPERTY_FINAL_PROMPT, TASK_PROPERTY_REMIX_MODAL_MESSAGE_ID, TASK_PROPERTY_INTERACTION_METADATA_ID, TASK_PROPERTY_IFRAME_MODAL_CREATE_CUSTOM_ID } from '../constants';
import { Message } from '../result/Message';
import { guessFileSuffix } from '../utils/mimeTypeUtils';
import { TaskStatus } from '../enums/TaskStatus';

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

    // Handle modal operations (Custom Zoom and Inpaint)
    if (customId.startsWith('MJ::CustomZoom::') || customId.startsWith('MJ::Inpaint::')) {
      // If it's an inpaint action, set task status to MODAL
      if (customId.startsWith('MJ::Inpaint::')) {
        task.status = TaskStatus.MODAL;
        task.prompt = '';
        task.promptEn = '';
      }

      // Store message ID and flags
      task.setProperty(TASK_PROPERTY_MESSAGE_ID, targetMessageId);
      task.setProperty(TASK_PROPERTY_FLAGS, messageFlags);
      task.setProperty(TASK_PROPERTY_CUSTOM_ID, customId);

      // Save task state
      await this.taskStoreService.save(task);

      // Add task to instance's running tasks so it can be found by modal endpoint
      // This is necessary because the modal endpoint checks running tasks before Redis
      console.log(`[task-service] Adding task ${task.id} to instance ${instanceId} runningTasks for modal lookup`);
      discordInstance.addRunningTask(task);
      
      // Verify task was added
      const addedTask = discordInstance.getRunningTask(task.id!);
      if (addedTask) {
        console.log(`[task-service] Successfully added task ${task.id} to runningTasks`);
      } else {
        console.error(`[task-service] WARNING: Task ${task.id} was not found in runningTasks after addRunningTask call`);
      }

      // Return EXISTED (code 21) with "Waiting for window confirm"
      return SubmitResultVO.of(ReturnCode.EXISTED, 'Waiting for window confirm', task.id!)
        .setProperty(TASK_PROPERTY_FINAL_PROMPT, task.getProperty(TASK_PROPERTY_FINAL_PROMPT) || '')
        .setProperty('remix', true);
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

    // Get the customId from the original task (stored in task properties)
    const customId = task.getProperty(TASK_PROPERTY_CUSTOM_ID);
    const messageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
    const messageFlags = task.getProperty(TASK_PROPERTY_FLAGS) || 0;
    const nonce = task.getProperty(TASK_PROPERTY_NONCE) || '';

    // If this is an inpaint action, check if iframe custom_id is already available
    if (customId && customId.startsWith('MJ::Inpaint::')) {
      // First, check if the iframe custom_id is already set (from the original button click in /mj/submit/action)
      const modalTaskId = payload.modalTaskId;
      let modalTask = discordInstance.getRunningTask(modalTaskId);
      if (!modalTask) {
        modalTask = await this.taskStoreService.get(modalTaskId);
      }
      
      if (modalTask) {
        const existingIframeCustomId = modalTask.getProperty(TASK_PROPERTY_IFRAME_MODAL_CREATE_CUSTOM_ID);
        if (existingIframeCustomId) {
          console.log(`[task-service] submitModal - Found existing iframe custom ID for task ${modalTaskId}, skipping button click and proceeding directly`);
          
          // Wait additional 1.2 seconds as per C# implementation
          await this.sleep(1200);
          
          // Call submitInpaint with iframe custom ID
          const maskBase64 = payload.maskBase64 || '';
          const prompt = payload.prompt || modalTask.promptEn || modalTask.prompt || '';
          
          const inpaintResult = await discordInstance.submitInpaint(existingIframeCustomId, maskBase64, prompt);
          if (inpaintResult.getCode() !== ReturnCode.SUCCESS) {
            return SubmitResultVO.fail(
              ReturnCode.FAILURE,
              `Failed to submit inpaint job: ${inpaintResult.getDescription()}`
            );
          }

          return SubmitResultVO.of(ReturnCode.SUCCESS, 'Success', task.id!);
        }
      }
      
      // If iframe custom_id not found, click button and wait for it (fallback for edge cases)
      console.log(`[task-service] submitModal - No existing iframe custom ID found, clicking button and waiting for WebSocket events`);
      
      // Ensure task is in runningTasks before clicking button (for handler to find it)
      if (!modalTask) {
        modalTask = await this.taskStoreService.get(modalTaskId);
        if (modalTask) {
          console.log(`[task-service] submitModal - Adding task ${modalTaskId} to runningTasks before button click`);
          discordInstance.addRunningTask(modalTask);
        }
      }
      
      if (!modalTask) {
        console.error(`[task-service] submitModal - Task ${modalTaskId} not found in runningTasks or Redis`);
        return SubmitResultVO.fail(ReturnCode.NOT_FOUND, 'Task not found');
      }

      // Step 1: Register listener BEFORE clicking button (primary approach)
      const maxWaitTime = 30000; // 30 seconds in milliseconds
      const pollInterval = 1000; // 1 second
      
      console.log(`[task-service] submitModal - Registering waitForIframeCustomId listener for message ${messageId} (timeout: ${maxWaitTime}ms)`);
      const listenerPromise = discordInstance.waitForIframeCustomId(messageId, maxWaitTime)
        .then((iframeData) => {
          console.log(`[task-service] submitModal - Received iframe data via WebSocket listener: custom_id=${iframeData.custom_id.substring(0, 50)}...`);
          return iframeData;
        })
        .catch((error) => {
          console.warn(`[task-service] submitModal - WebSocket listener failed: ${error.message}`);
          throw error;
        });

      // Step 2: Click the button programmatically via Discord API (returns 204 No Content)
      const actionMessage = await discordInstance.customAction(messageId, messageFlags, customId, nonce);
      if (actionMessage.getCode() !== ReturnCode.SUCCESS) {
        // Cancel listener if button click failed
        const pending = (discordInstance as any).pendingIframeExtractions?.get(messageId);
        if (pending) {
          clearTimeout(pending.timeout);
          (discordInstance as any).pendingIframeExtractions.delete(messageId);
        }
        return SubmitResultVO.fail(actionMessage.getCode(), actionMessage.getDescription());
      }

      // Step 3: Polling fallback (runs in parallel with listener)
      const startTime = Date.now();
      const pollingPromise = new Promise<{ custom_id: string }>((resolve, reject) => {
        const poll = async () => {
          // Get fresh task state
          let taskToCheck = discordInstance.getRunningTask(modalTaskId);
          if (!taskToCheck) {
            taskToCheck = await this.taskStoreService.get(modalTaskId);
            if (!taskToCheck) {
              reject(new Error('Task not found'));
              return;
            }
          }
          
          // Check if iframe custom ID is now available
          const iframeCustomId = taskToCheck.getProperty(TASK_PROPERTY_IFRAME_MODAL_CREATE_CUSTOM_ID);
          if (iframeCustomId) {
            console.log(`[task-service] submitModal - Found iframe custom ID via polling for task ${modalTaskId}`);
            resolve({ custom_id: iframeCustomId });
            return;
          }

          // Check timeout
          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('Timeout: iframe custom ID not found within 30 seconds'));
            return;
          }

          // Wait before next poll
          await this.sleep(pollInterval);
          poll();
        };
        poll();
      });

      // Step 4: Use Promise.race to get result from either listener or polling (whichever completes first)
      let iframeData: { custom_id: string };
      try {
        iframeData = await Promise.race([listenerPromise, pollingPromise]);
        console.log(`[task-service] submitModal - Successfully obtained iframe custom ID for task ${modalTaskId}`);
      } catch (error: any) {
        // Cancel the other promise if one failed
        const pending = (discordInstance as any).pendingIframeExtractions?.get(messageId);
        if (pending) {
          clearTimeout(pending.timeout);
          (discordInstance as any).pendingIframeExtractions.delete(messageId);
        }
        return SubmitResultVO.fail(ReturnCode.NOT_FOUND, error.message || 'Timeout: iframe custom ID not found within 30 seconds');
      }

      // Step 5: Wait additional 1.2 seconds as per C# implementation
      await this.sleep(1200);
      
      // Step 6: Call submitInpaint with iframe custom ID
      const maskBase64 = payload.maskBase64 || '';
      const finalTask = discordInstance.getRunningTask(modalTaskId) || await this.taskStoreService.get(modalTaskId);
      const prompt = payload.prompt || (finalTask?.promptEn) || (finalTask?.prompt) || '';
      
      const inpaintResult = await discordInstance.submitInpaint(iframeData.custom_id, maskBase64, prompt);
      if (inpaintResult.getCode() !== ReturnCode.SUCCESS) {
        return SubmitResultVO.fail(
          ReturnCode.FAILURE,
          `Failed to submit inpaint job: ${inpaintResult.getDescription()}`
        );
      }

      return SubmitResultVO.of(ReturnCode.SUCCESS, 'Success', task.id!);
    }

    // For non-inpaint actions, use the original modal submit flow
    return discordInstance.submitTask(task, () =>
      (discordInstance as any).modalSubmit(payload.modalTaskId, { prompt: payload.prompt, maskBase64: payload.maskBase64 }, nonce || '')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

