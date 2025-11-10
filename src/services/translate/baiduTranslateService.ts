import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { TranslateService, containsChinese } from './translateService';
import { BaiduTranslateConfig } from '../../config';

/**
 * Baidu translate service
 */
export class BaiduTranslateService implements TranslateService {
  private static readonly TRANSLATE_API = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
  private appid: string;
  private appSecret: string;

  constructor(config: BaiduTranslateConfig) {
    if (!config.appid || !config.appSecret) {
      throw new Error('mj.baidu-translate.appid or mj.baidu-translate.app-secret not configured');
    }
    this.appid = config.appid;
    this.appSecret = config.appSecret;
  }

  translateToEnglish(prompt: string): Promise<string> {
    if (!this.containsChinese(prompt)) {
      return Promise.resolve(prompt);
    }

    const salt = Math.floor(Math.random() * 100000).toString();
    const sign = crypto
      .createHash('md5')
      .update(this.appid + prompt + salt + this.appSecret)
      .digest('hex');

    const params = new URLSearchParams();
    params.append('from', 'zh');
    params.append('to', 'en');
    params.append('appid', this.appid);
    params.append('salt', salt);
    params.append('q', prompt);
    params.append('sign', sign);

    return axios
      .post(BaiduTranslateService.TRANSLATE_API, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      .then(response => {
        const result = response.data;
        if (result.error_code) {
          throw new Error(`${result.error_code} - ${result.error_msg}`);
        }
        const transResult = result.trans_result || [];
        return transResult.map((item: any) => item.dst).join('\n');
      })
      .catch(error => {
        console.warn(`Baidu translation failed: ${error.message}`);
        return prompt;
      });
  }

  containsChinese(prompt: string): boolean {
    return containsChinese(prompt);
  }
}

