import { TaskAction } from '../enums/TaskAction';
import { TaskChangeParams } from './taskChangeParams';

/**
 * Content parse data
 */
export interface ContentParseData {
  prompt: string;
  status: string;
}

/**
 * Content regex for matching prompt and progress
 */
export const CONTENT_REGEX = '.*?\\*\\*(.*)\\*\\*.+<@\\d+> \\((.*?)\\)';

/**
 * Parse content to extract prompt and status
 */
export function parseContent(content: string): ContentParseData | null {
  return parseContentWithRegex(content, CONTENT_REGEX);
}

/**
 * Parse content with custom regex
 */
export function parseContentWithRegex(content: string, regex: string): ContentParseData | null {
  if (!content || content.trim().length === 0) {
    return null;
  }
  try {
    const pattern = new RegExp(regex);
    const match = pattern.exec(content);
    if (!match || match.length < 3) {
      return null;
    }
    return {
      prompt: match[1] || '',
      status: match[2] || '',
    };
  } catch (error) {
    return null;
  }
}

/**
 * Data URL interface
 */
export interface DataUrl {
  mimeType: string;
  charset?: string;
  base64: boolean;
  data: Buffer;
}

/**
 * Parse data URL
 */
function parseDataUrl(dataUrl: string): DataUrl {
  const match = dataUrl.match(/^data:([^;]+)(;charset=([^;]+))?(;(base64))?,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  const mimeType = match[1];
  const charset = match[3];
  const isBase64 = match[5] === 'base64';
  const data = match[6];
  
  return {
    mimeType,
    charset,
    base64: isBase64,
    data: isBase64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data)),
  };
}

/**
 * Convert base64 array to DataUrl array
 */
export function convertBase64Array(base64Array: string[]): DataUrl[] {
  if (!base64Array || base64Array.length === 0) {
    return [];
  }
  return base64Array.map(base64 => {
    try {
      return parseDataUrl(base64);
    } catch (e) {
      throw new Error(`Invalid base64 data URL: ${e}`);
    }
  });
}

/**
 * Get primary prompt (remove parameters and URLs)
 */
export function getPrimaryPrompt(prompt: string): string {
  if (!prompt) {
    return '';
  }
  // Remove parameters (--param format)
  let result = prompt.replace(/\s+--[a-z]+.*$/i, '');
  // Replace URLs with <link>
  const urlRegex = /https?:\/\/[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]/g;
  result = result.replace(urlRegex, '<link>');
  // Replace duplicate <<link>> with <link>
  result = result.replace(/<<link>>/g, '<link>');
  return result;
}

/**
 * Convert change params from content string
 */
export function convertChangeParams(content: string): TaskChangeParams | null {
  const parts = content.split(' ').filter(p => p.length > 0);
  if (parts.length !== 2) {
    return null;
  }
  const action = parts[1].toLowerCase();
  const changeParams: TaskChangeParams = {
    id: parts[0],
  };

  if (action.charAt(0) === 'u') {
    changeParams.action = TaskAction.UPSCALE;
  } else if (action.charAt(0) === 'v') {
    changeParams.action = TaskAction.VARIATION;
  } else if (action === 'r') {
    changeParams.action = TaskAction.REROLL;
    return changeParams;
  } else {
    return null;
  }

  try {
    const index = parseInt(action.substring(1, 2), 10);
    if (index < 1 || index > 4) {
      return null;
    }
    changeParams.index = index;
  } catch (e) {
    return null;
  }

  return changeParams;
}

