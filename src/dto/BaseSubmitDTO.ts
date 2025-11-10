/**
 * Base submission DTO
 */
export abstract class BaseSubmitDTO {
  /** Custom parameters */
  state?: string;

  /** Callback address, use global notifyHook when empty */
  notifyHook?: string;
}

