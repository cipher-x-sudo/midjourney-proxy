/**
 * Exception thrown when a prompt contains banned words
 */
export class BannedPromptException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BannedPromptException';
  }
}

