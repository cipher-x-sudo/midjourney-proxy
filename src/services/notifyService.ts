import { Task } from '../models/Task';
import { TASK_PROPERTY_NOTIFY_HOOK } from '../constants';
import { TaskStatus, getTaskStatusOrder } from '../enums/TaskStatus';
import axios from 'axios';

/**
 * Notification service interface
 */
export interface NotifyService {
  notifyTaskChange(task: Task): Promise<void>;
}

/**
 * Notification service implementation
 */
export class NotifyServiceImpl implements NotifyService {
  private taskStatusMap: Map<string, string> = new Map();
  private notifyPoolSize: number;

  constructor(notifyPoolSize: number = 10) {
    this.notifyPoolSize = notifyPoolSize;
    // Cleanup old entries every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  async notifyTaskChange(task: Task): Promise<void> {
    const notifyHook = task.getProperty(TASK_PROPERTY_NOTIFY_HOOK);
    if (!notifyHook) {
      return;
    }

    const taskId = task.id!;
    const statusStr = `${task.status}:${task.progress || ''}`;

    try {
      const paramsStr = JSON.stringify(task);
      // Execute notification asynchronously
      setImmediate(() => {
        this.executeNotify(taskId, statusStr, notifyHook, paramsStr).catch(err => {
          console.warn(`Notify task change error, task: ${taskId}(${statusStr}), hook: ${notifyHook}, msg: ${err.message}`);
        });
      });
    } catch (error: any) {
      console.error('Error serializing task for notification:', error);
    }
  }

  private async executeNotify(taskId: string, currentStatusStr: string, notifyHook: string, paramsStr: string): Promise<void> {
    // Check if this status change should be notified
    const existStatusStr = this.taskStatusMap.get(taskId) || currentStatusStr;
    const compare = this.compareStatusStr(currentStatusStr, existStatusStr);
    if (compare < 0) {
      console.debug(`Ignore this change, task: ${taskId}(${currentStatusStr})`);
      return;
    }
    this.taskStatusMap.set(taskId, currentStatusStr);

    console.debug(`Notify task change, task: ${taskId}(${currentStatusStr}), hook: ${notifyHook}`);
    
    try {
      const response = await axios.post(notifyHook, JSON.parse(paramsStr), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.status < 200 || response.status >= 300) {
        console.warn(`Notify task change fail, task: ${taskId}(${currentStatusStr}), hook: ${notifyHook}, code: ${response.status}, msg: ${response.statusText}`);
      }
    } catch (error: any) {
      console.warn(`Notify task change error, task: ${taskId}(${currentStatusStr}), hook: ${notifyHook}, msg: ${error.message}`);
    }
  }

  private compareStatusStr(statusStr1: string, statusStr2: string): number {
    if (statusStr1 === statusStr2) {
      return 0;
    }
    const o1 = this.convertOrder(statusStr1);
    const o2 = this.convertOrder(statusStr2);
    return o1 - o2;
  }

  private convertOrder(statusStr: string): number {
    const parts = statusStr.split(':');
    const status = parts[0] as TaskStatus;
    const statusOrder = getTaskStatusOrder(status);

    if (status !== TaskStatus.IN_PROGRESS || parts.length === 1) {
      return statusOrder;
    }

    const progress = parts[1];
    if (progress.endsWith('%')) {
      const progressValue = parseFloat(progress.substring(0, progress.length - 1));
      return statusOrder + progressValue / 100;
    }

    return statusOrder;
  }

  private cleanup(): void {
    // Keep only recent entries (last hour worth)
    // For simplicity, we'll just clear if map gets too large
    if (this.taskStatusMap.size > 1000) {
      this.taskStatusMap.clear();
    }
  }
}

