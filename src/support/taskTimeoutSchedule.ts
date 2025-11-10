import { DiscordLoadBalancer } from '../loadbalancer/discordLoadBalancer';
import { TaskStatus } from '../enums/TaskStatus';
import * as cron from 'node-cron';

/**
 * Task timeout scheduler
 */
export class TaskTimeoutSchedule {
  private discordLoadBalancer: DiscordLoadBalancer;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(discordLoadBalancer: DiscordLoadBalancer) {
    this.discordLoadBalancer = discordLoadBalancer;
  }

  /**
   * Start task timeout checking
   */
  start(): void {
    // Check every 30 seconds
    this.cronJob = cron.schedule('*/30 * * * * *', () => {
      this.checkTasks();
    });
  }

  /**
   * Stop task timeout checking
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  /**
   * Check for timed out tasks
   */
  private checkTasks(): void {
    const instances = this.discordLoadBalancer.getAliveInstances();
    for (const instance of instances) {
      const timeout = (instance.account().timeoutMinutes || 5) * 60 * 1000;
      const tasks = instance.getRunningTasks().filter(t => {
        if (!t.startTime) {
          return false;
        }
        return Date.now() - t.startTime > timeout;
      });

      for (const task of tasks) {
        if ([TaskStatus.FAILURE, TaskStatus.SUCCESS].includes(task.status)) {
          console.warn(`[${instance.account().getDisplay()}] - task status is failure/success but is in the queue, end it. id: ${task.id}`);
        } else {
          console.debug(`[${instance.account().getDisplay()}] - task timeout, id: ${task.id}`);
          task.fail('Task timeout');
        }
        instance.exitTask(task);
      }
    }
  }
}

