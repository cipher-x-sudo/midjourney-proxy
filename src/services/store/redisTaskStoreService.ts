import Redis from 'ioredis';
import { TaskStoreService, TaskCondition } from './taskStoreService';
import { Task } from '../../models/Task';

/**
 * Redis task store service
 */
export class RedisTaskStoreService implements TaskStoreService {
  private static readonly KEY_PREFIX = 'mj-task-store::';
  private redis: Redis;
  private timeoutSeconds: number;

  constructor(timeoutMs: number, redisUrl?: string) {
    this.timeoutSeconds = Math.floor(timeoutMs / 1000);
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis();
  }

  /**
   * Get Redis key
   */
  private getRedisKey(id: string): string {
    return `${RedisTaskStoreService.KEY_PREFIX}${id}`;
  }

  /**
   * Save task
   */
  async save(task: Task): Promise<void> {
    if (!task || !task.id) {
      console.error('[task-store-redis] Cannot save task: task or task.id is missing', { task: task ? { hasId: !!task.id } : 'null' });
      return;
    }
    
    try {
      const key = this.getRedisKey(task.id);
      const taskJson = JSON.stringify(task);
      const taskStatus = task.status || 'UNKNOWN';
      const submitTime = task.submitTime ? new Date(task.submitTime).toISOString() : 'N/A';
      const finishTime = task.finishTime ? new Date(task.finishTime).toISOString() : 'N/A';
      
      console.log(`[task-store-redis] Saving task ${task.id} to Redis, Status: ${taskStatus}, Submit: ${submitTime}, Finish: ${finishTime}, TTL: ${this.timeoutSeconds}s`);
      
      await this.redis.setex(key, this.timeoutSeconds, taskJson);
      
      console.log(`[task-store-redis] Successfully saved task ${task.id} to Redis`);
    } catch (error: any) {
      console.error(`[task-store-redis] Failed to save task ${task?.id || 'unknown'} to Redis:`, error);
      throw error;
    }
  }

  /**
   * Delete task
   */
  async delete(id: string): Promise<void> {
    const key = this.getRedisKey(id);
    console.log(`[task-store-redis] Deleting task ${id} from Redis (key: ${key})`);
    try {
      const result = await this.redis.del(key);
      if (result > 0) {
        console.log(`[task-store-redis] Successfully deleted task ${id} from Redis`);
      } else {
        console.log(`[task-store-redis] Task ${id} not found in Redis (key: ${key}), nothing to delete`);
      }
    } catch (error: any) {
      console.error(`[task-store-redis] Failed to delete task ${id} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Get task by ID
   */
  get(id: string): Promise<Task | undefined> {
    const key = this.getRedisKey(id);
    return this.redis.get(key).then(data => {
      if (!data) {
        return undefined;
      }
      return JSON.parse(data) as Task;
    });
  }

  /**
   * List all tasks
   */
  list(): Promise<Task[]>;
  /**
   * List tasks matching condition
   */
  list(condition: TaskCondition): Promise<Task[]>;
  list(condition?: TaskCondition): Promise<Task[]> {
    return this.redis.keys(`${RedisTaskStoreService.KEY_PREFIX}*`).then(keys => {
      if (keys.length === 0) {
        return [];
      }
      return this.redis.mget(...keys).then(values => {
        const tasks = values
          .filter((v): v is string => v !== null)
          .map(v => JSON.parse(v) as Task);

        if (condition) {
          return tasks.filter(condition);
        }
        return tasks;
      });
    });
  }

  /**
   * Find one task matching condition
   */
  findOne(condition: TaskCondition): Promise<Task | undefined> {
    return this.list(condition).then(tasks => tasks[0]);
  }

  /**
   * Destroy service and close Redis connection
   */
  async destroy(): Promise<void> {
    await this.redis.quit();
  }
}

