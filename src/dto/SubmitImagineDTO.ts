import { BaseSubmitDTO } from './BaseSubmitDTO';

/**
 * Imagine submission parameters
 */
export class SubmitImagineDTO extends BaseSubmitDTO {
  /** Prompt */
  prompt?: string;

  /** Base64 array of reference images */
  base64Array?: string[];

  /** Base64 (deprecated - use base64Array instead) */
  base64?: string;
}
