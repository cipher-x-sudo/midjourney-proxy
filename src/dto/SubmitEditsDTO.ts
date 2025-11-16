import { BaseSubmitDTO } from './BaseSubmitDTO';

/**
 * Edits task submission parameters
 */
export class SubmitEditsDTO extends BaseSubmitDTO {
  /** Task ID of the existing message to edit (required) */
  taskId?: string;

  /** Edit prompt */
  prompt?: string;

  /** Base64-encoded mask image */
  maskBase64?: string;

  /** Image as data URL (e.g., "data:image/jpeg;base64,<b64>") - optional, for backward compatibility */
  image?: string;
}

