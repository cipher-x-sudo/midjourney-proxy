import { DomainObject } from '../models/DomainObject';

/**
 * Lock object
 */
export class LockObject extends DomainObject {
  private resolveCallback: (() => void) | null = null;
  private resolved: boolean = false;

  constructor(id: string) {
    super();
    this.id = id;
  }

  /**
   * Awake lock (resolve the promise)
   */
  awake(): void {
    this.resolved = true;
    if (this.resolveCallback) {
      this.resolveCallback();
      this.resolveCallback = null;
    }
  }

  /**
   * Wait for lock to be released
   */
  async wait(): Promise<void> {
    if (this.resolved) {
      return;
    }
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
    });
  }
}

/**
 * Lock map
 */
const LOCK_MAP: Map<string, LockObject> = new Map();

/**
 * Get lock object
 */
export function getLock(key: string): LockObject | undefined {
  return LOCK_MAP.get(key);
}

/**
 * Wait for lock with timeout
 */
export async function waitForLock(key: string, durationMs: number): Promise<LockObject> {
  let lockObject: LockObject;
  
  // Get or create lock
  if (LOCK_MAP.has(key)) {
    lockObject = LOCK_MAP.get(key)!;
  } else {
    lockObject = new LockObject(key);
    LOCK_MAP.set(key, lockObject);
  }

  // Wait for lock to be released with timeout
  const timeoutPromise = new Promise<LockObject>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Wait Timeout'));
    }, durationMs);
  });

  const waitPromise = lockObject.wait().then(() => lockObject);

  try {
    await Promise.race([waitPromise, timeoutPromise]);
    // Remove lock after wait
    if (LOCK_MAP.get(key) === lockObject) {
      LOCK_MAP.delete(key);
    }
    return lockObject;
  } catch (error) {
    // Remove lock on timeout
    if (LOCK_MAP.get(key) === lockObject) {
      LOCK_MAP.delete(key);
    }
    throw error;
  }
}

