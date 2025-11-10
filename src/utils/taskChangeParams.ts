import { TaskAction } from '../enums/TaskAction';

/**
 * Task change parameters
 */
export interface TaskChangeParams {
  id: string;
  action?: TaskAction;
  index?: number;
}

