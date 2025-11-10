/**
 * Base domain object with common properties
 */
export abstract class DomainObject {
  /** ID */
  id?: string;

  /** Extended properties */
  properties?: Record<string, any>;

  /**
   * Set property
   */
  setProperty(name: string, value: any): this {
    if (!this.properties) {
      this.properties = {};
    }
    this.properties[name] = value;
    return this;
  }

  /**
   * Remove property
   */
  removeProperty(name: string): this {
    if (this.properties) {
      delete this.properties[name];
    }
    return this;
  }

  /**
   * Get property
   */
  getProperty(name: string): any {
    return this.properties?.[name];
  }

  /**
   * Get property with type
   */
  getPropertyGeneric<T>(name: string): T | undefined {
    return this.properties?.[name] as T;
  }

  /**
   * Get property with default value
   */
  getPropertyWithDefault<T>(name: string, defaultValue: T): T {
    return (this.properties?.[name] ?? defaultValue) as T;
  }
}

