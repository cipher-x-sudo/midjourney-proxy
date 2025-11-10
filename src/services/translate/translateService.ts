/**
 * Translation service interface
 */
export interface TranslateService {
  translateToEnglish(prompt: string): Promise<string> | string;
  containsChinese(prompt: string): boolean;
}

/**
 * Check if prompt contains Chinese characters
 */
export function containsChinese(prompt: string): boolean {
  return /[\u4e00-\u9fa5]/.test(prompt);
}

