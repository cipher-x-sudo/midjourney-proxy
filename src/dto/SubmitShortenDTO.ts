import { BaseSubmitDTO } from './BaseSubmitDTO';

/**
 * Shorten submission parameters
 */
export class SubmitShortenDTO extends BaseSubmitDTO {
  /** Prompt */
  prompt?: string;
}

