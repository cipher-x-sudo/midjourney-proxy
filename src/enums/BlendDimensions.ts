/**
 * Blend dimensions for image blending
 */
export enum BlendDimensions {
  PORTRAIT = 'PORTRAIT',
  SQUARE = 'SQUARE',
  LANDSCAPE = 'LANDSCAPE',
}

/**
 * Get aspect ratio value for blend dimensions
 */
export function getBlendDimensionsValue(dimensions: BlendDimensions): string {
  switch (dimensions) {
    case BlendDimensions.PORTRAIT:
      return '2:3';
    case BlendDimensions.SQUARE:
      return '1:1';
    case BlendDimensions.LANDSCAPE:
      return '3:2';
    default:
      return '1:1';
  }
}

