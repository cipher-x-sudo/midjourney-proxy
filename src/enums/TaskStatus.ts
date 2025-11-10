/**
 * Task status types
 */
export enum TaskStatus {
  /** Not started */
  NOT_START = 'NOT_START',
  /** Submitted */
  SUBMITTED = 'SUBMITTED',
  /** In progress */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Failed */
  FAILURE = 'FAILURE',
  /** Success */
  SUCCESS = 'SUCCESS',
}

/**
 * Get order value for task status (for sorting)
 */
export function getTaskStatusOrder(status: TaskStatus): number {
  switch (status) {
    case TaskStatus.NOT_START:
      return 0;
    case TaskStatus.SUBMITTED:
      return 1;
    case TaskStatus.IN_PROGRESS:
      return 3;
    case TaskStatus.FAILURE:
      return 4;
    case TaskStatus.SUCCESS:
      return 4;
    default:
      return 0;
  }
}

