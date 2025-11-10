import { ReturnCode } from '../constants';

/**
 * Message response model
 */
export class Message<T = any> {
  private code: number;
  private description: string;
  private result?: T;

  constructor(code: number, description: string, result?: T) {
    this.code = code;
    this.description = description;
    this.result = result;
  }

  getCode(): number {
    return this.code;
  }

  getDescription(): string {
    return this.description;
  }

  getResult(): T | undefined {
    return this.result;
  }

  /**
   * Create success message
   */
  static success<T>(): Message<T> {
    return new Message<T>(ReturnCode.SUCCESS, 'Success');
  }

  /**
   * Create success message with result
   */
  static successWithResult<T>(result: T): Message<T> {
    return new Message<T>(ReturnCode.SUCCESS, 'Success', result);
  }

  /**
   * Create success message with code, description, and result
   */
  static successWithDetails<T>(code: number, description: string, result: T): Message<T> {
    return new Message<T>(code, description, result);
  }

  /**
   * Create not found message
   */
  static notFound<T>(): Message<T> {
    return new Message<T>(ReturnCode.NOT_FOUND, 'Data not found');
  }

  /**
   * Create validation error message
   */
  static validationError<T>(): Message<T> {
    return new Message<T>(ReturnCode.VALIDATION_ERROR, 'Validation error');
  }

  /**
   * Create failure message
   */
  static failure<T>(): Message<T> {
    return new Message<T>(ReturnCode.FAILURE, 'System error');
  }

  /**
   * Create failure message with description
   */
  static failureWithDescription<T>(description: string): Message<T> {
    return new Message<T>(ReturnCode.FAILURE, description);
  }

  /**
   * Create message with code and description
   */
  static of<T>(code: number, description: string): Message<T> {
    return new Message<T>(code, description);
  }

  /**
   * Create message with code, description, and result
   */
  static ofWithResult<T>(code: number, description: string, result: T): Message<T> {
    return new Message<T>(code, description, result);
  }
}

