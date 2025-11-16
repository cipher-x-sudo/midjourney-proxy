import { TaskAction } from '../enums/TaskAction';

/**
 * Parse customId to determine the correct TaskAction type
 * 
 * CustomId format examples:
 * - MJ::JOB::upsample_v7_2x_subtle::1::<hash>::SOLO → UPSCALE
 * - MJ::JOB::upsample_v7_2x_creative::1::<hash>::SOLO → UPSCALE
 * - MJ::JOB::high_variation::1::<hash>::SOLO → VARIATION
 * - MJ::JOB::low_variation::1::<hash>::SOLO → VARIATION
 * - MJ::JOB::variation::1::<hash>::SOLO → VARIATION
 * - MJ::JOB::pan_left::1::<hash>::SOLO → VARIATION (pan actions)
 * - MJ::Outpaint::50::1::<hash>::SOLO → VARIATION (zoom/outpaint actions)
 * - MJ::CustomZoom::<hash> → VARIATION (custom zoom)
 * - MJ::Inpaint::1::<hash>::SOLO → VARIATION (vary region)
 * - MJ::BOOKMARK::<hash> → VARIATION (bookmark/favorite)
 * 
 * @param customId The customId from the Discord button
 * @returns The determined TaskAction type, defaults to VARIATION for backward compatibility
 */
export function parseActionFromCustomId(customId: string): TaskAction {
  if (!customId || typeof customId !== 'string') {
    return TaskAction.VARIATION;
  }

  const normalizedCustomId = customId.toLowerCase().trim();

  // Check for upscale/upsample actions
  if (normalizedCustomId.includes('upsample') || normalizedCustomId.includes('upscale')) {
    return TaskAction.UPSCALE;
  }

  // Check for variation actions
  if (
    normalizedCustomId.includes('variation') ||
    normalizedCustomId.includes('high_variation') ||
    normalizedCustomId.includes('low_variation')
  ) {
    return TaskAction.VARIATION;
  }

  // Pan, zoom, outpaint, inpaint, and other actions are treated as VARIATION
  // This maintains backward compatibility and matches existing handler behavior
  // These actions don't have dedicated TaskAction types in the enum
  if (
    normalizedCustomId.includes('pan_') ||
    normalizedCustomId.includes('outpaint') ||
    normalizedCustomId.includes('customzoom') ||
    normalizedCustomId.includes('inpaint') ||
    normalizedCustomId.includes('bookmark') ||
    normalizedCustomId.includes('animate')
  ) {
    return TaskAction.VARIATION;
  }

  // Default fallback to VARIATION for backward compatibility
  return TaskAction.VARIATION;
}

