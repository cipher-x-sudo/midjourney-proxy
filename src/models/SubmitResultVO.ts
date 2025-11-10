/**
 * Submission result model
 */
export class SubmitResultVO {
  /** Status code: 1(Success), 21(Already exists), 22(Queued), other(Error) */
  code: number;

  /** Description */
  description: string;

  /** Task ID */
  result?: string;

  /** Extended fields */
  properties: Record<string, any> = {};

  constructor(code: number, description: string, result?: string) {
    this.code = code;
    this.description = description;
    this.result = result;
  }

  /**
   * Set property
   */
  setProperty(name: string, value: any): this {
    this.properties[name] = value;
    return this;
  }

  /**
   * Remove property
   */
  removeProperty(name: string): this {
    delete this.properties[name];
    return this;
  }

  /**
   * Get property
   */
  getProperty(name: string): any {
    return this.properties[name];
  }

  /**
   * Create success result
   */
  static of(code: number, description: string, result?: string): SubmitResultVO {
    return new SubmitResultVO(code, description, result);
  }

  /**
   * Create fail result
   */
  static fail(code: number, description: string): SubmitResultVO {
    return new SubmitResultVO(code, description);
  }
}

