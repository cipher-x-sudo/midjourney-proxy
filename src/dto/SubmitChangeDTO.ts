import { BaseSubmitDTO } from './BaseSubmitDTO';
import { TaskAction } from '../enums/TaskAction';

/**
 * Variation task submission parameters
 */
export class SubmitChangeDTO extends BaseSubmitDTO {
  /** Task ID */
  taskId?: string;

  /** UPSCALE(Enlarge); VARIATION(Variation); REROLL(Regenerate) */
  action?: TaskAction;

  /** Index (1~4), required when action is UPSCALE or VARIATION */
  index?: number;
}

