import { FastifyRequest, FastifyReply } from 'fastify';
import { Task } from '../models/Task';
import { TaskConditionDTO } from '../dto/TaskConditionDTO';
import { TaskStoreService } from '../services/store/taskStoreService';
import { DiscordLoadBalancer } from '../loadbalancer/discordLoadBalancer';
import { ReturnCode } from '../constants';
import { TASK_PROPERTY_SEED, TASK_PROPERTY_MESSAGE_ID, TASK_PROPERTY_DISCORD_INSTANCE_ID } from '../constants';
import { getSeedWaitMs } from '../config';

/**
 * Task controller
 */
export class TaskController {
  private taskStoreService: TaskStoreService;
  private discordLoadBalancer: DiscordLoadBalancer;

  constructor(taskStoreService: TaskStoreService, discordLoadBalancer: DiscordLoadBalancer) {
    this.taskStoreService = taskStoreService;
    this.discordLoadBalancer = discordLoadBalancer;
  }

  async fetch(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<Task | null> {
    const id = request.params.id;
    
    // Check queue tasks first
    const queueTasks = this.discordLoadBalancer.getQueueTasks();
    const queueTask = queueTasks.find(t => t.id === id);
    if (queueTask) {
      return queueTask;
    }

    // Then check stored tasks
    const task = await this.taskStoreService.get(id);
    return task || null;
  }

  async queue(request: FastifyRequest, reply: FastifyReply): Promise<Task[]> {
    const queueTasks = this.discordLoadBalancer.getQueueTasks();
    return queueTasks.sort((a, b) => (a.submitTime || 0) - (b.submitTime || 0));
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<Task[]> {
    const tasks = await this.taskStoreService.list();
    return tasks.sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0));
  }

  async listByIds(request: FastifyRequest<{ Body: TaskConditionDTO }>, reply: FastifyReply): Promise<Task[]> {
    const conditionDTO = request.body;
    if (!conditionDTO.ids || conditionDTO.ids.length === 0) {
      return [];
    }

    const result: Task[] = [];
    const notInQueueIds = new Set(conditionDTO.ids);

    // Add tasks from queue
    const queueTasks = this.discordLoadBalancer.getQueueTasks();
    for (const task of queueTasks) {
      if (conditionDTO.ids.includes(task.id!)) {
        result.push(task);
        notInQueueIds.delete(task.id!);
      }
    }

    // Add tasks from store
    for (const id of notInQueueIds) {
      const task = await this.taskStoreService.get(id);
      if (task) {
        result.push(task);
      }
    }

    return result;
  }

  async imageSeed(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<any> {
    const id = request.params.id;
    console.log(`[task-controller] ===== imageSeed request for task ${id} =====`);
    
    // Check queue tasks first
    const queueTasks = this.discordLoadBalancer.getQueueTasks();
    const queueTaskIds = queueTasks.map(t => t.id);
    console.log(`[task-controller] [1] Checking queue tasks (${queueTasks.length} total): ${queueTaskIds.length > 0 ? queueTaskIds.join(', ') : 'none'}`);
    let task = queueTasks.find(t => t.id === id);
    const foundInQueue = !!task;
    console.log(`[task-controller] [2] Task ${id} in queue tasks: ${foundInQueue ? 'FOUND' : 'NOT FOUND'}`);
    
    // Then check stored tasks
    if (!task) {
      console.log(`[task-controller] [3] Checking stored tasks for task ${id}...`);
      
      // Debug: List all stored tasks to help diagnose
      try {
        const allStoredTasks = await this.taskStoreService.list();
        console.log(`[task-controller] [3a] Total stored tasks: ${allStoredTasks.length}`);
        console.log(`[task-controller] [3a-check] TaskStoreService instance type: ${this.taskStoreService.constructor.name}`);
        
        if (allStoredTasks.length > 0) {
          // Sort by finish time (most recent first), or submit time if no finish time
          const sortedTasks = allStoredTasks.sort((a, b) => {
            const aTime = a.finishTime || a.submitTime || 0;
            const bTime = b.finishTime || b.submitTime || 0;
            return bTime - aTime;
          });
          
          // Check if requested task ID is in the list
          const requestedTaskInList = sortedTasks.find(t => t.id === id);
          console.log(`[task-controller] [3a-match] Requested task ${id} in stored tasks list: ${requestedTaskInList ? 'YES' : 'NO'}`);
          
          // Show all tasks with their details
          console.log(`[task-controller] [3b] All stored task IDs:`);
          sortedTasks.forEach((t, index) => {
            const submitTime = t.submitTime ? new Date(t.submitTime).toISOString() : 'N/A';
            const finishTime = t.finishTime ? new Date(t.finishTime).toISOString() : 'N/A';
            const status = t.status || 'UNKNOWN';
            const age = t.finishTime ? Math.round((Date.now() - t.finishTime) / 1000) : (t.submitTime ? Math.round((Date.now() - t.submitTime) / 1000) : 0);
            const isRequested = t.id === id ? ' <-- REQUESTED' : '';
            console.log(`[task-controller] [3b-${index + 1}] ID: ${t.id}, Status: ${status}, Submitted: ${submitTime}, Finished: ${finishTime}, Age: ${age}s${isRequested}`);
          });
        } else {
          console.log(`[task-controller] [3b] No stored tasks found`);
        }
      } catch (error) {
        console.error(`[task-controller] [3c] Error listing stored tasks for debugging:`, error);
      }
      
      console.log(`[task-controller] [3d] Getting task ${id} from store...`);
      const storedTask = await this.taskStoreService.get(id);
      task = storedTask;
      const foundInStore = !!task;
      console.log(`[task-controller] [4] Task ${id} in stored tasks: ${foundInStore ? 'FOUND' : 'NOT FOUND'}`);
      if (task) {
        console.log(`[task-controller] [4-details] Found task ${id}, Status: ${task.status}, FinishTime: ${task.finishTime ? new Date(task.finishTime).toISOString() : 'N/A'}`);
      }
    } else {
      console.log(`[task-controller] [3] Skipping stored tasks check (task already found in queue)`);
    }

    // Task not found
    if (!task) {
      console.log(`[task-controller] [5] Task ${id} not found in queue or stored tasks`);
      console.log(`[task-controller] ===== End imageSeed request for task ${id} =====`);
      return {
        code: ReturnCode.NOT_FOUND,
        description: 'Task not found',
      };
    }

    // Get seed from task properties
    const seed = task.getProperty(TASK_PROPERTY_SEED);
    console.log(`[task-controller] [6] Task ${id} seed property: ${seed || 'not set'}`);
    
    // Get task finish time for better error message
    const finishTime = task.finishTime;
    const taskAge = finishTime ? Date.now() - finishTime : null;

    // Seed not available
    if (!seed) {
      const ageMessage = taskAge !== null && taskAge < 120000 
        ? ` (task completed ${Math.round(taskAge / 1000)} seconds ago, DM may be delayed)` 
        : '';
      console.log(`[task-controller] [6a] Task ${id} has no seed yet${ageMessage}. Attempting on-demand reaction to fetch seed...`);

      // Determine message and channel to react to
      const messageId = task.getProperty(TASK_PROPERTY_MESSAGE_ID);
      const instanceId = task.getProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID);
      const instance = instanceId
        ? this.discordLoadBalancer.getDiscordInstance(instanceId)
        : (this.discordLoadBalancer.getAliveInstances()[0] || null);

      if (!messageId || !instance || !instance.account().channelId) {
        console.warn(`[task-controller] [6b] Cannot trigger seed reaction - messageId:${messageId || 'null'}, instance:${instance ? 'ok' : 'null'}, channelId:${instance && instance.account().channelId ? 'ok' : 'null'}`);
      } else {
        const channelId = instance.account().channelId!;
        const envelopeEmoji = '\u{2709}\u{FE0F}'; // ✉️
        try {
          const reactResult = await instance.reactWithEmoji(messageId, channelId, envelopeEmoji);
          if (reactResult.getCode() !== ReturnCode.SUCCESS) {
            console.warn(`[task-controller] [6c] Seed reaction returned non-success: ${reactResult.getDescription()}`);
          } else {
            console.log(`[task-controller] [6c] Seed reaction sent successfully for message ${messageId} in channel ${channelId}`);
          }
        } catch (e: any) {
          console.warn(`[task-controller] [6c] Failed to send seed reaction: ${e?.message || e}`);
        }

        // Wait for seed to be populated by seedDmHandler
        const waitMs = getSeedWaitMs();
        const deadline = Date.now() + waitMs;
        console.log(`[task-controller] [6d] Waiting up to ${waitMs}ms for seed to arrive via DM...`);
        while (Date.now() < deadline) {
          try {
            const refreshed = await this.taskStoreService.get(id);
            const refreshedSeed = refreshed?.getProperty(TASK_PROPERTY_SEED);
            if (refreshedSeed) {
              console.log(`[task-controller] [6e] Seed arrived during wait: ${refreshedSeed}`);
              console.log(`[task-controller] ===== End imageSeed request for task ${id} =====`);
              return {
                code: ReturnCode.SUCCESS,
                description: 'Success',
                seed: refreshedSeed,
              };
            }
          } catch (e) {
            // ignore transient store errors during polling
          }
          await this.sleep(1000);
        }
      }

      // Not available yet after waiting
      const retryAfterSeconds = 5;
      reply.header('Retry-After', String(retryAfterSeconds));
      reply.status(202);
      console.log(`[task-controller] [7] Seed not available after on-demand attempt; returning 202 for task ${id}`);
      console.log(`[task-controller] ===== End imageSeed request for task ${id} =====`);
      return {
        code: ReturnCode.IN_QUEUE,
        description: `Seed not ready, please retry shortly${ageMessage}`,
      };
    }

    // Success - return seed
    console.log(`[task-controller] [7] Task ${id} seed retrieved successfully: ${seed}`);
    console.log(`[task-controller] ===== End imageSeed request for task ${id} =====`);
    return {
      code: ReturnCode.SUCCESS,
      description: 'Success',
      seed: seed,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

