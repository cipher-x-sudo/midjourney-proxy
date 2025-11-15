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
    let task = queueTasks.find(t => t.id === id);
    if (task) {
      return task;
    }

    // Check running tasks if not found in queue
    const runningTasks = this.discordLoadBalancer.getRunningTasks();
    task = runningTasks.find(t => t.id === id);
    if (task) {
      return task;
    }

    // Then check stored tasks
    task = await this.taskStoreService.get(id);
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
    
    // Check queue tasks first
    const queueTasks = this.discordLoadBalancer.getQueueTasks();
    let task = queueTasks.find(t => t.id === id);
    
    // Check running tasks if not found in queue
    if (!task) {
      const runningTasks = this.discordLoadBalancer.getRunningTasks();
      task = runningTasks.find(t => t.id === id);
    }
    
    // Then check stored tasks
    if (!task) {
      task = await this.taskStoreService.get(id);
    }

    // Task not found
    if (!task) {
      return {
        code: ReturnCode.NOT_FOUND,
        description: 'Task not found',
      };
    }

    // Get seed from task properties
    const seed = task.getProperty(TASK_PROPERTY_SEED);

    // Seed not available
    if (!seed) {
      return {
        code: ReturnCode.NOT_FOUND,
        description: 'Seed not available',
      };
    }

    // Success - return seed
    return {
      code: ReturnCode.SUCCESS,
      description: 'Success',
      seed: seed,
    };
  }
}

