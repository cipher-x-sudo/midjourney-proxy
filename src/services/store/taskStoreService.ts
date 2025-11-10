import { Task } from '../../models/Task';

/**
 * Task condition function type
 */
export type TaskCondition = (task: Task) => boolean;

/**
 * Task store service interface
 */
export interface TaskStoreService {
  save(task: Task): Promise<void> | void;
  delete(id: string): Promise<void> | void;
  get(id: string): Promise<Task | undefined> | Task | undefined;
  list(): Promise<Task[]> | Task[];
  list(condition: TaskCondition): Promise<Task[]> | Task[];
  findOne(condition: TaskCondition): Promise<Task | undefined> | Task | undefined;
}

