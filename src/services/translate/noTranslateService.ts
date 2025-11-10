import { TranslateService, containsChinese } from './translateService';

/**
 * No translation service (passthrough)
 */
export class NoTranslateService implements TranslateService {
  translateToEnglish(prompt: string): string {
    return prompt;
  }

  containsChinese(prompt: string): boolean {
    return containsChinese(prompt);
  }
}

