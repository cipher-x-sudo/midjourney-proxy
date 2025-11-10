import { BaseSubmitDTO } from './BaseSubmitDTO';
import { BlendDimensions } from '../enums/BlendDimensions';

/**
 * Blend submission parameters
 */
export class SubmitBlendDTO extends BaseSubmitDTO {
  /** Base64 array of images */
  base64Array?: string[];

  /** Aspect ratio: PORTRAIT(2:3); SQUARE(1:1); LANDSCAPE(3:2) */
  dimensions: BlendDimensions = BlendDimensions.SQUARE;
}

