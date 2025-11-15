import { FastifyRequest, FastifyReply } from 'fastify';
import { Task } from '../models/Task';
import { TaskConditionDTO } from '../dto/TaskConditionDTO';
import { TaskStoreService } from '../services/store/taskStoreService';
import { DiscordLoadBalancer } from '../loadbalancer/discordLoadBalancer';
import { ReturnCode } from '../constants';
import { TASK_PROPERTY_SEED } from '../constants';

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
    console.log(`[task-controller] imageSeed request for task ${id}`);
    
    // Check queue tasks first
    const queueTasks = this.discordLoadBalancer.getQueueTasks();
    let task = queueTasks.find(t => t.id === id);
    
    // Then check stored tasks
    if (!task) {
      task = await this.taskStoreService.get(id);
      if (task) {
        console.log(`[task-controller] Task ${id} found in stored tasks`);
      }
    } else {
      console.log(`[task-controller] Task ${id} found in queue tasks`);
    }

    // Task not found
    if (!task) {
      console.log(`[task-controller] Task ${id} not found in queue or stored tasks`);
      return {
        code: ReturnCode.NOT_FOUND,
        description: 'Task not found',
      };
    }

    // Get seed from task properties
    const seed = task.getProperty(TASK_PROPERTY_SEED);
    console.log(`[task-controller] Task ${id} seed property: ${seed || 'not set'}`);
    
    // Get task finish time for better error message
    const finishTime = task.finishTime;
    const taskAge = finishTime ? Date.now() - finishTime : null;

    // Seed not available
    if (!seed) {
      const ageMessage = taskAge !== null && taskAge < 120000 
        ? ` (task completed ${Math.round(taskAge / 1000)} seconds ago, DM may be delayed)` 
        : '';
      console.log(`[task-controller] Task ${id} found but seed not available${ageMessage}`);
      return {
        code: ReturnCode.NOT_FOUND,
        description: `Seed not yet received from MidJourney (DM may be delayed)${ageMessage}`,
      };
    }

    // Success - return seed
    console.log(`[task-controller] Task ${id} seed retrieved successfully: ${seed}`);
    return {
      code: ReturnCode.SUCCESS,
      description: 'Success',
      seed: seed,
    };
  }
}

