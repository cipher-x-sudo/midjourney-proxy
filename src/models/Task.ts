import { DomainObject } from './DomainObject';
import { TaskAction } from '../enums/TaskAction';
import { TaskStatus } from '../enums/TaskStatus';
import { TASK_PROPERTY_BUTTONS } from '../constants';

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

  /**
   * Custom JSON serialization to include buttons at top level
   * This method is automatically called by JSON.stringify()
   */
  toJSON(): any {
    const json: any = {
      id: this.id,
      properties: this.properties,
      action: this.action,
      status: this.status,
      prompt: this.prompt,
      promptEn: this.promptEn,
      description: this.description,
      submitTime: this.submitTime,
      startTime: this.startTime,
      finishTime: this.finishTime,
      imageUrl: this.imageUrl,
      progress: this.progress,
    };

    // Include buttons at top level if they exist in properties
    const buttons = this.getProperty(TASK_PROPERTY_BUTTONS);
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      json.buttons = buttons;
    }

    // Include optional fields if they exist
    if (this.state !== undefined) {
      json.state = this.state;
    }
    if (this.failReason !== undefined) {
      json.failReason = this.failReason;
    }

    return json;
  }
}

