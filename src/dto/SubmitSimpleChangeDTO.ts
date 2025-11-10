import { BaseSubmitDTO } from './BaseSubmitDTO';

/**
 * Variation task submission parameters - Simple
 */
export class SubmitSimpleChangeDTO extends BaseSubmitDTO {
  /** Variation description: ID $action$index */
  content?: string;
}

