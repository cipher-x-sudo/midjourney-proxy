import { DiscordInstance } from './discordInstance';
import { IRule } from './rules/iRule';
import { Task } from '../models/Task';

/**
 * Discord load balancer
 */
export class DiscordLoadBalancer {
  private rule: IRule;
  private instances: DiscordInstance[] = [];

  constructor(rule: IRule) {
    this.rule = rule;
  }

  /**
   * Get all instances
   */
  getAllInstances(): DiscordInstance[] {
    return [...this.instances];
  }

  /**
   * Get alive instances
   */
  getAliveInstances(): DiscordInstance[] {
    return this.instances.filter(instance => instance.isAlive());
  }

  /**
   * Choose instance using rule
   */
  chooseInstance(): DiscordInstance | null {
    return this.rule.choose(this.getAliveInstances());
  }

  /**
   * Get Discord instance by ID
   */
  getDiscordInstance(instanceId: string): DiscordInstance | null {
    if (!instanceId) {
      return null;
    }
    return this.instances.find(instance => instanceId === instance.getInstanceId()) || null;
  }

  /**
   * Get queue task IDs
   */
  getQueueTaskIds(): Set<string> {
    const taskIds = new Set<string>();
    for (const instance of this.getAliveInstances()) {
      for (const taskId of instance.getRunningFutures().keys()) {
        taskIds.add(taskId);
      }
    }
    return taskIds;
  }

  /**
   * Get queue tasks
   */
  getQueueTasks(): Task[] {
    const tasks: Task[] = [];
    for (const instance of this.getAliveInstances()) {
      tasks.push(...instance.getQueueTasks());
    }
    return tasks;
  }

  /**
   * Get running tasks from all instances
   */
  getRunningTasks(): Task[] {
    const tasks: Task[] = [];
    for (const instance of this.getAliveInstances()) {
      tasks.push(...instance.getRunningTasks());
    }
    return tasks;
  }

  /**
   * Get task by ID from all sources (queue, running, store)
   */
  async getTaskById(id: string, taskStoreService: any): Promise<Task | undefined> {
    // Check queue tasks first
    const queueTasks = this.getQueueTasks();
    let task = queueTasks.find(t => t.id === id);
    if (task) {
      return task;
    }

    // Check running tasks
    const runningTasks = this.getRunningTasks();
    task = runningTasks.find(t => t.id === id);
    if (task) {
      return task;
    }

    // Finally check stored tasks
    if (taskStoreService) {
      return await taskStoreService.get(id);
    }

    return undefined;
  }

  /**
   * Add instance
   */
  addInstance(instance: DiscordInstance): void {
    this.instances.push(instance);
  }

  /**
   * Remove instance
   */
  removeInstance(instance: DiscordInstance): void {
    const index = this.instances.indexOf(instance);
    if (index >= 0) {
      this.instances.splice(index, 1);
    }
  }
}

