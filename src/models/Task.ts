import { DomainObject } from './DomainObject';
import { TaskAction } from '../enums/TaskAction';
import { TaskStatus } from '../enums/TaskStatus';

/**
 * Task model
 */
export class Task extends DomainObject {
  /** Task type */
  action?: TaskAction;

  /** Task status */
  status: TaskStatus = TaskStatus.NOT_START;

  /** Prompt */
  prompt?: string;

  /** Prompt - English */
  promptEn?: string;

  /** Task description */
  description?: string;

  /** Custom parameters */
  state?: string;

  /** Submit time */
  submitTime?: number;

  /** Start execution time */
  startTime?: number;

  /** Finish time */
  finishTime?: number;

  /** Image URL */
  imageUrl?: string;

  /** Task progress */
  progress?: string;

  /** Failure reason */
  failReason?: string;

  /**
   * Mark task as started
   */
  start(): void {
    this.startTime = Date.now();
    this.status = TaskStatus.SUBMITTED;
    this.progress = '0%';
  }

  /**
   * Mark task as successful
   */
  success(): void {
    this.finishTime = Date.now();
    this.status = TaskStatus.SUCCESS;
    this.progress = '100%';
  }

  /**
   * Mark task as failed
   */
  fail(reason: string): void {
    this.finishTime = Date.now();
    this.status = TaskStatus.FAILURE;
    this.failReason = reason;
    this.progress = '';
  }
}

