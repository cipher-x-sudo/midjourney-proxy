import * as fs from 'fs';
import * as path from 'path';

/**
 * MIME type map
 */
let MIME_TYPE_MAP: Map<string, string[]> = new Map();

/**
 * Initialize MIME type map from file
 */
function initMimeTypeMap(): void {
  const mimeTypesFilePath = path.join(__dirname, '../../resources/mime.types');
  try {
    if (fs.existsSync(mimeTypesFilePath)) {
      const content = fs.readFileSync(mimeTypesFilePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          continue;
        }
        const parts = trimmed.split(':');
        if (parts.length === 2) {
          const mimeType = parts[0].trim();
          const extensions = parts[1].trim().split(' ').filter(e => e.length > 0);
          MIME_TYPE_MAP.set(mimeType, extensions);
        }
      }
    } else {
      console.warn(`MIME types file not found: ${mimeTypesFilePath}`);
      // Use mime-types package as fallback
      const mimeTypes = require('mime-types');
      // Initialize with common types
      MIME_TYPE_MAP.set('image/png', ['png']);
      MIME_TYPE_MAP.set('image/jpeg', ['jpg', 'jpeg']);
      MIME_TYPE_MAP.set('image/gif', ['gif']);
      MIME_TYPE_MAP.set('image/webp', ['webp']);
    }
  } catch (e) {
    console.error(`Failed to load MIME types: ${e}`);
    // Use fallback
    MIME_TYPE_MAP.set('image/png', ['png']);
    MIME_TYPE_MAP.set('image/jpeg', ['jpg', 'jpeg']);
    MIME_TYPE_MAP.set('image/gif', ['gif']);
    MIME_TYPE_MAP.set('image/webp', ['webp']);
  }
}

// Initialize on module load
initMimeTypeMap();

/**
 * Guess file suffix from MIME type
 */
export function guessFileSuffix(mimeType: string): string | null {
  if (!mimeType || mimeType.trim().length === 0) {
    return null;
  }

  // Try exact match
  if (MIME_TYPE_MAP.has(mimeType)) {
    const suffixes = MIME_TYPE_MAP.get(mimeType)!;
    return suffixes.length > 0 ? suffixes[0] : null;
  }

  // Try prefix match
  for (const [key, suffixes] of MIME_TYPE_MAP.entries()) {
    if (mimeType.toLowerCase().startsWith(key.toLowerCase())) {
      return suffixes.length > 0 ? suffixes[0] : null;
    }
  }

  // Fallback to mime-types package
  try {
    const mimeTypes = require('mime-types');
    const extension = mimeTypes.extension(mimeType);
    return extension || null;
  } catch (e) {
    return null;
  }
}

