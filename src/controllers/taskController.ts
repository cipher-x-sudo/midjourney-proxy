import { FastifyRequest, FastifyReply } from 'fastify';
import { Task } from '../models/Task';
import { TaskConditionDTO } from '../dto/TaskConditionDTO';
import { TaskStoreService } from '../services/store/taskStoreService';
import { DiscordLoadBalancer } from '../loadbalancer/discordLoadBalancer';

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
}

