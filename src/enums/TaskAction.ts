/**
 * Task action types
 */
export enum TaskAction {
  /** Generate image */
  IMAGINE = 'IMAGINE',
  /** Upscale selected */
  UPSCALE = 'UPSCALE',
  /** Select one image and generate four similar variations */
  VARIATION = 'VARIATION',
  /** Reroll */
  REROLL = 'REROLL',
  /** Image to prompt */
  DESCRIBE = 'DESCRIBE',
  /** Blend multiple images */
  BLEND = 'BLEND',
}

