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
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // Default 30 days
    this.taskMap.set(task.id!, { task, expiresAt });
  }

  /**
   * Delete task
   */
  delete(id: string): void {
    this.taskMap.delete(id);
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

