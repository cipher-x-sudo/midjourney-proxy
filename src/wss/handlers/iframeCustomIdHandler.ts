import { MessageHandler } from './messageHandler';
import { DiscordInstance } from '../../loadbalancer/discordInstance';
import { MessageType } from '../../enums/MessageType';
import { DiscordHelper } from '../../support/discordHelper';
import { TaskStatus } from '../../enums/TaskStatus';
import { TaskStoreService } from '../../services/store/taskStoreService';
import { 
  TASK_PROPERTY_IFRAME_MODAL_CREATE_CUSTOM_ID,
  TASK_PROPERTY_REMIX_MODAL_MESSAGE_ID,
  TASK_PROPERTY_INTERACTION_METADATA_ID,
  TASK_PROPERTY_MESSAGE_ID,
  TASK_PROPERTY_CUSTOM_ID,
  TASK_PROPERTY_NONCE,
} from '../../constants';

/**
 * Handler for extracting iframe custom_id from WebSocket MESSAGE_UPDATE events
 * This handler listens for message updates that contain iframe modal data after clicking vary region button
 */
export class IframeCustomIdHandler extends MessageHandler {
  private taskStoreService: TaskStoreService;

  constructor(discordHelper: DiscordHelper, taskStoreService: TaskStoreService) {
    super(discordHelper);
    this.taskStoreService = taskStoreService;
  }

  /**
   * Handler order - run early to catch iframe events quickly
   */
  order(): number {
    return 10;
  }

  /**
   * Handle message update events and interaction events to extract iframe custom_id
   */
  handle(instance: DiscordInstance, messageType: MessageType, message: any, eventType?: string): void {
    const eventTypeStr = eventType || 'UNKNOWN';
    
    // Handle MESSAGE_CREATE and MESSAGE_UPDATE events
    if (messageType === MessageType.CREATE || messageType === MessageType.UPDATE) {
      // Check if message has an ID (required for matching)
      if (!message.id) {
        return;
      }

      const messageId = message.id;
      
      // Try to extract iframe data from the message
      const iframeData = instance.extractIframeCustomId(message);
      
      if (iframeData) {
        console.log(`[iframe-result-${instance.getInstanceId()}] Found iframe data in ${eventTypeStr} event for message ${messageId}: custom_id=${iframeData.custom_id.substring(0, 50)}..., instance_id=${iframeData.instance_id ? 'present' : 'missing'}, frame_id=${iframeData.frame_id || 'missing'}`);
        
        // Notify any pending listeners waiting for this message ID
        if (instance.notifyIframeCustomId) {
          console.log(`[iframe-notify-${instance.getInstanceId()}] Notifying pending listener for message ${messageId} with iframe data`);
          instance.notifyIframeCustomId(messageId, iframeData);
        }
      } else {
        // Log when we check a message but don't find iframe (for debugging)
        // Only log if message has components or embeds (might contain iframe)
        if (message.components || message.embeds) {
          console.debug(`[iframe-result-${instance.getInstanceId()}] Checked ${eventTypeStr} event for message ${messageId} - no iframe data found`);
        }
      }
      return;
    }

    // Handle INTERACTION_MODAL_CREATE or INTERACTION_IFRAME_MODAL_CREATE events
    if (eventTypeStr === 'INTERACTION_MODAL_CREATE' || eventTypeStr === 'INTERACTION_IFRAME_MODAL_CREATE') {
      console.log(`[iframe-custom-id-handler-${instance.getInstanceId()}] Received ${eventTypeStr} event`);
      
      // Debug: Search for URLs in the entire message object
      const allUrls: Array<{ path: string; url: string }> = [];
      const findUrlsInObject = (obj: any, path: string = ''): void => {
        if (!obj || typeof obj !== 'object') return;
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const currentPath = path ? `${path}.${key}` : key;
            if (typeof value === 'string' && value.includes('discordsays.com')) {
              allUrls.push({ path: currentPath, url: value });
            } else if (value && typeof value === 'object') {
              findUrlsInObject(value, currentPath);
            }
          }
        }
      };
      findUrlsInObject(message);
      
      if (allUrls.length > 0) {
        console.log(`[iframe-url-${instance.getInstanceId()}] Found ${allUrls.length} iframe URL(s) in interaction event:`);
        allUrls.forEach((item, idx) => {
          console.log(`[iframe-url-${instance.getInstanceId()}]   iframe-url[${idx}]: ${item.path} = ${item.url.substring(0, 200)}${item.url.length > 200 ? '...' : ''}`);
        });
      } else {
        console.log(`[iframe-url-${instance.getInstanceId()}] No iframe URLs found in interaction event structure`);
      }
      
      // Debug: Log interaction event structure
      console.log(`[iframe-structure-${instance.getInstanceId()}] Interaction event data structure:`, JSON.stringify(message).substring(0, 2000));
      
      // Extract iframe data from interaction data
      // The interaction might have custom_id directly, or in data.url, or in data.custom_id
      let iframeData = null;
      
      // Debug: Check common URL locations
      console.log(`[iframe-location-${instance.getInstanceId()}] Checking common URL locations in interaction event`);
      const urlLocations = [
        { name: 'message.url', value: message.url },
        { name: 'message.data.url', value: message.data?.url },
        { name: 'message.data.iframeUrl', value: message.data?.iframeUrl },
        { name: 'message.data.iframe_url', value: message.data?.iframe_url },
        { name: 'message.iframeUrl', value: message.iframeUrl },
        { name: 'message.iframe_url', value: message.iframe_url },
        { name: 'message.src', value: message.src },
        { name: 'message.href', value: message.href },
      ];
      
      for (const location of urlLocations) {
        if (location.value && typeof location.value === 'string' && location.value.includes('discordsays.com')) {
          console.log(`[iframe-location-${instance.getInstanceId()}] Found URL in ${location.name}: ${location.value.substring(0, 200)}`);
          iframeData = instance.extractIframeCustomId({ content: location.value });
          if (iframeData) {
            console.log(`[iframe-location-${instance.getInstanceId()}] Successfully extracted iframe data from ${location.name}`);
            break;
          }
        }
      }
      
      // If no URL found, try recursive extraction from the entire interaction object
      if (!iframeData) {
        console.log(`[iframe-recursive-${instance.getInstanceId()}] No URL found in common locations, attempting recursive extraction from interaction object`);
        iframeData = instance.extractIframeCustomId(message);
      }
      
      if (iframeData) {
        console.log(`[iframe-result-${instance.getInstanceId()}] Found iframe data in ${eventTypeStr} event: custom_id=${iframeData.custom_id.substring(0, 50)}..., instance_id=${iframeData.instance_id ? 'present' : 'missing'}, frame_id=${iframeData.frame_id || 'missing'}`);
        
        // For interaction events, we need to match by message_id from the interaction
        // The interaction should have a message_id (the original message where button was clicked)
        const messageId = message.message?.id || message.message_id || message.data?.message_id;
        
        // Notify pending listeners (for waitForIframeCustomId)
        if (messageId && instance.notifyIframeCustomId) {
          console.log(`[iframe-notify-${instance.getInstanceId()}] Notifying pending listener for message ${messageId} with iframe data`);
          instance.notifyIframeCustomId(messageId, iframeData);
        } else {
          // If no message_id, try to notify all pending listeners (fallback)
          console.warn(`[iframe-notify-${instance.getInstanceId()}] Found iframe data in ${eventTypeStr} but no message_id to match. Custom_id: ${iframeData.custom_id.substring(0, 50)}...`);
          console.warn(`[iframe-notify-${instance.getInstanceId()}] Interaction structure - message: ${message.message?.id}, message_id: ${message.message_id}, data.message_id: ${message.data?.message_id}`);
        }
        
        // For INTERACTION_IFRAME_MODAL_CREATE, also save to task properties (for polling fallback)
        if (eventTypeStr === 'INTERACTION_IFRAME_MODAL_CREATE') {
          const nonce = message.nonce || message.data?.nonce;
          let tasks: any[] = [];
          
          // Strategy 1: Match by messageId (primary)
          if (messageId) {
            tasks = instance.findRunningTask((task) => {
              if (task.status === TaskStatus.MODAL) {
                const storedMessageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
                return storedMessageId === messageId;
              }
              const taskCustomId = task.getProperty(TASK_PROPERTY_CUSTOM_ID);
              if (taskCustomId && taskCustomId.startsWith('MJ::Inpaint::')) {
                const storedMessageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
                return storedMessageId === messageId;
              }
              return false;
            });
          }
          
          // Strategy 2: Match by nonce (fallback, like C# implementation)
          if (tasks.length === 0 && nonce) {
            const taskByNonce = instance.getRunningTaskByNonce(nonce);
            if (taskByNonce) {
              const taskCustomId = taskByNonce.getProperty(TASK_PROPERTY_CUSTOM_ID);
              if (taskCustomId && taskCustomId.startsWith('MJ::Inpaint::')) {
                tasks = [taskByNonce];
                console.log(`[iframe-handler-${instance.getInstanceId()}] Matched task ${taskByNonce.id} by nonce ${nonce} (fallback from messageId matching)`);
              }
            }
          }

          if (tasks.length > 0) {
            // Store iframe modal custom ID for all matching tasks and save to store
            for (const task of tasks) {
              task.setProperty(TASK_PROPERTY_IFRAME_MODAL_CREATE_CUSTOM_ID, iframeData.custom_id);
              console.log(`[iframe-handler-${instance.getInstanceId()}] Set iframe_modal_custom_id for task ${task.id}: ${iframeData.custom_id.substring(0, 50)}...`);
              
              // Save task to store so submitModal can find it (fire-and-forget to avoid blocking handler)
              this.saveTaskWithIframeCustomId(instance.getInstanceId(), task).catch((error: any) => {
                console.error(`[iframe-handler-${instance.getInstanceId()}] Failed to save task ${task.id} with iframe custom_id:`, error);
              });
            }
          } else {
            console.warn(`[iframe-handler-${instance.getInstanceId()}] Found iframe custom_id ${iframeData.custom_id.substring(0, 50)}... but could not match task by messageId (${messageId}) or nonce (${nonce})`);
          }
        }
      } else {
        console.debug(`[iframe-result-${instance.getInstanceId()}] Checked ${eventTypeStr} event - no iframe data found`);
      }
      return;
    }

    // Handle INTERACTION_SUCCESS events (modal interaction success)
    if (eventTypeStr === 'INTERACTION_SUCCESS') {
      const interactionId = message.id || message.interaction?.id;
      if (!interactionId) {
        console.warn(`[iframe-handler-${instance.getInstanceId()}] INTERACTION_SUCCESS event missing interactionId`);
        return;
      }

      // Find tasks that are waiting for modal data (MODAL status or inpaint actions)
      const messageId = message.message?.id || message.message_id || message.data?.message_id;
      console.log(`[iframe-handler-${instance.getInstanceId()}] INTERACTION_SUCCESS: interactionId=${interactionId}, messageId=${messageId || 'none'}`);
      const tasks = instance.findRunningTask((task) => {
        // Find tasks with MODAL status or with customId starting with MJ::Inpaint::
        if (task.status === TaskStatus.MODAL) {
          // Match by stored message ID
          const storedMessageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
          return storedMessageId === messageId;
        }
        const customId = task.getProperty(TASK_PROPERTY_CUSTOM_ID);
        if (customId && customId.startsWith('MJ::Inpaint::')) {
          const storedMessageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
          return storedMessageId === messageId;
        }
        return false;
      });

      if (tasks.length > 0) {
        // Set interactionMetadataId and remixModalMessageId for all matching tasks
        console.log(`[iframe-handler-${instance.getInstanceId()}] INTERACTION_SUCCESS: Found ${tasks.length} matching task(s)`);
        for (const task of tasks) {
          task.setProperty(TASK_PROPERTY_INTERACTION_METADATA_ID, interactionId);
          task.setProperty(TASK_PROPERTY_REMIX_MODAL_MESSAGE_ID, interactionId);
          console.log(`[iframe-handler-${instance.getInstanceId()}] ✓ Set interactionMetadataId for task ${task.id}: ${interactionId}`);
          
          // Save to Redis immediately so submitModal can retrieve the latest interactionMetadataId
          // This is critical for inpaint task matching
          Promise.resolve(this.taskStoreService.save(task)).catch((error: any) => {
            console.error(`[iframe-handler-${instance.getInstanceId()}] Failed to save task ${task.id} with interactionMetadataId:`, error);
          });
        }
      } else {
        console.warn(`[iframe-handler-${instance.getInstanceId()}] INTERACTION_SUCCESS: No matching tasks found for messageId=${messageId || 'none'}`);
      }
      return;
    }


    // Handle INTERACTION_CREATE events (button clicks)
    if (eventTypeStr === 'INTERACTION_CREATE') {
      // This is when the button is clicked - the iframe modal will be created after this
      // We can log this for debugging but don't extract custom_id here yet
      if (message.data?.custom_id && message.data.custom_id.includes('MJ::Inpaint::')) {
        console.log(`[iframe-click-${instance.getInstanceId()}] Detected Inpaint button click via INTERACTION_CREATE - waiting for modal creation event`);
      }
      return;
    }
  }

  /**
   * Save task with iframe custom_id to store
   */
  private async saveTaskWithIframeCustomId(instanceId: string, task: any): Promise<void> {
    try {
      await this.taskStoreService.save(task);
      console.log(`[iframe-handler-${instanceId}] Saved task ${task.id} to store with iframe custom_id`);
    } catch (error: any) {
      console.error(`[iframe-handler-${instanceId}] Failed to save task ${task.id} with iframe custom_id:`, error);
      throw error;
    }
  }
}

