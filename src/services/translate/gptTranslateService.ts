import OpenAI from 'openai';
import { TranslateService, containsChinese } from './translateService';
import { OpenaiConfig, ProxyConfig } from '../../config';

/**
 * GPT translate service
 */
export class GPTTranslateService implements TranslateService {
  private openai: OpenAI;
  private config: OpenaiConfig;

  constructor(config: OpenaiConfig, proxyConfig?: ProxyConfig) {
    if (!config.gptApiKey) {
      throw new Error('mj.openai.gpt-api-key not configured');
    }
    this.config = config;

    const clientConfig: any = {
      apiKey: config.gptApiKey,
    };

    if (config.gptApiUrl) {
      clientConfig.baseURL = config.gptApiUrl;
    }

    // Configure proxy if provided
    if (proxyConfig && proxyConfig.host && proxyConfig.port) {
      // OpenAI client doesn't directly support proxy, need to use axios adapter
      // For now, we'll skip proxy support in OpenAI client
      // In production, you might want to use a custom HTTP agent
    }

    this.openai = new OpenAI(clientConfig);
  }

  async translateToEnglish(prompt: string): Promise<string> {
    if (!this.containsChinese(prompt)) {
      return prompt;
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Translate Chinese to English' },
          { role: 'user', content: prompt },
        ],
        temperature: this.config.temperature || 0,
        max_tokens: this.config.maxTokens || 2048,
      });

      const choices = completion.choices;
      if (choices && choices.length > 0) {
        return choices[0].message.content || prompt;
      }
    } catch (error: any) {
      console.warn(`GPT translation failed: ${error.message}`);
    }

    return prompt;
  }

  containsChinese(prompt: string): boolean {
    return containsChinese(prompt);
  }
}

