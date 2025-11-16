import { TaskStoreService, TaskCondition } from './taskStoreService';
import { Task } from '../../models/Task';

/**
 * In-memory task store service
 */
export class InMemoryTaskStoreService implements TaskStoreService {
  private taskMap: Map<string, { task: Task; expiresAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(timeoutMs: number) {
    // Cleanup expired tasks every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Save task
   */
  save(task: Task): void {
    if (!task || !task.id) {
      console.error('[task-store-inmemory] Cannot save task: task or task.id is missing', { task: task ? { hasId: !!task.id } : 'null' });
      return;
    }
    
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // Default 30 days
    const wasUpdated = this.taskMap.has(task.id);
    this.taskMap.set(task.id, { task, expiresAt });
    
    const totalTasks = this.taskMap.size;
    const taskStatus = task.status || 'UNKNOWN';
    const submitTime = task.submitTime ? new Date(task.submitTime).toISOString() : 'N/A';
    const finishTime = task.finishTime ? new Date(task.finishTime).toISOString() : 'N/A';
    
    console.log(`[task-store-inmemory] ${wasUpdated ? 'Updated' : 'Saved'} task ${task.id}, Status: ${taskStatus}, Submit: ${submitTime}, Finish: ${finishTime}, Total tasks: ${totalTasks}, Expires: ${new Date(expiresAt).toISOString()}`);
  }

  /**
   * Delete task
   */
  delete(id: string): void {
    const existed = this.taskMap.has(id);
    this.taskMap.delete(id);
    const totalTasks = this.taskMap.size;
    if (existed) {
      console.log(`[task-store-inmemory] Deleted task ${id}, Total tasks: ${totalTasks}`);
    } else {
      console.log(`[task-store-inmemory] Attempted to delete task ${id} but it doesn't exist, Total tasks: ${totalTasks}`);
    }
  }

  /**
   * Get task by ID
   */
  get(id: string): Task | undefined {
    const entry = this.taskMap.get(id);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      this.taskMap.delete(id);
      return undefined;
    }
    return entry.task;
  }

  /**
   * List all tasks
   */
  list(): Task[];
  /**
   * List tasks matching condition
   */
  list(condition: TaskCondition): Task[];
  list(condition?: TaskCondition): Task[] {
    this.cleanup();
    const tasks = Array.from(this.taskMap.values())
      .filter(entry => entry.expiresAt >= Date.now())
      .map(entry => entry.task);
    
    if (condition) {
      return tasks.filter(condition);
    }
    return tasks;
  }

  /**
   * Find one task matching condition
   */
  findOne(condition: TaskCondition): Task | undefined {
    this.cleanup();
    return this.list(condition)[0];
  }

  /**
   * Cleanup expired tasks
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.taskMap.entries()) {
      if (entry.expiresAt < now) {
        this.taskMap.delete(id);
      }
    }
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.taskMap.clear();
  }
}

