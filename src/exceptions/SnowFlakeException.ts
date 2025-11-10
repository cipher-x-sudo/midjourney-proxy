/**
 * Exception thrown when Snowflake ID generation fails
 */
export class SnowFlakeException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'SnowFlakeException';
    if (cause) {
      this.cause = cause;
    }
  }
}

