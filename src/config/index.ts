import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TranslateWay } from '../enums/TranslateWay';
import { DEFAULT_DISCORD_USER_AGENT } from '../constants';

/**
 * Discord account configuration
 */
export interface DiscordAccountConfig {
  guildId?: string;
  channelId?: string;
  userToken?: string;
  userAgent?: string;
  enable?: boolean;
  coreSize?: number;
  queueSize?: number;
  timeoutMinutes?: number;
}

/**
 * Task store configuration
 */
export interface TaskStoreConfig {
  type: 'redis' | 'in_memory';
  timeout: string; // e.g., '30d'
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  host?: string;
  port?: number;
}

/**
 * NgDiscord configuration
 */
export interface NgDiscordConfig {
  server?: string;
  cdn?: string;
  wss?: string;
  resumeWss?: string;
  uploadServer?: string;
}

/**
 * Baidu translate configuration
 */
export interface BaiduTranslateConfig {
  appid?: string;
  appSecret?: string;
}

/**
 * OpenAI configuration
 */
export interface OpenaiConfig {
  gptApiUrl?: string;
  gptApiKey?: string;
  timeout?: string; // e.g., '30s'
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Proxy properties configuration
 */
export interface ProxyProperties {
  taskStore: TaskStoreConfig;
  accountChooseRule: string;
  discord: DiscordAccountConfig;
  accounts: DiscordAccountConfig[];
  proxy: ProxyConfig;
  ngDiscord: NgDiscordConfig;
  baiduTranslate: BaiduTranslateConfig;
  openai: OpenaiConfig;
  translateWay: TranslateWay;
  apiSecret?: string;
  notifyHook?: string;
  notifyPoolSize: number;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  contextPath: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  server: ServerConfig;
  logging: LoggingConfig;
  mj: ProxyProperties;
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Load configuration from YAML file and environment variables
 */
function loadConfig(): AppConfig {
  // Load default config
  const configPath = path.join(__dirname, 'default.yaml');
  let config: AppConfig;

  try {
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      config = yaml.load(fileContents) as AppConfig;
      // Convert translateWay string/null to enum
      const translateWayValue = (config.mj as any).translateWay;
      if (translateWayValue === null || translateWayValue === 'null' || translateWayValue === undefined) {
        config.mj.translateWay = TranslateWay.NULL;
      } else if (typeof translateWayValue === 'string') {
        const way = translateWayValue.toUpperCase();
        if (way === 'BAIDU') {
          config.mj.translateWay = TranslateWay.BAIDU;
        } else if (way === 'GPT') {
          config.mj.translateWay = TranslateWay.GPT;
        } else {
          config.mj.translateWay = TranslateWay.NULL;
        }
      }
    } else {
      // Use default config
      config = {
        server: {
          port: 8080,
          contextPath: '/mj',
        },
        logging: {
          level: 'info',
        },
        mj: {
          taskStore: {
            type: 'in_memory',
            timeout: '30d',
          },
          accountChooseRule: 'BestWaitIdleRule',
          discord: {
            userAgent: DEFAULT_DISCORD_USER_AGENT,
            enable: true,
            coreSize: 3,
            queueSize: 10,
            timeoutMinutes: 5,
          },
          accounts: [],
          proxy: {},
          ngDiscord: {},
          baiduTranslate: {},
          openai: {
            timeout: '30s',
            model: 'gpt-3.5-turbo',
            maxTokens: 2048,
            temperature: 0,
          },
          translateWay: TranslateWay.NULL,
          notifyPoolSize: 10,
        },
      };
    }
  } catch (e) {
    console.error(`Failed to load config: ${e}`);
    throw e;
  }

  // Override with environment variables
  if (process.env.PORT) {
    config.server.port = parseInt(process.env.PORT, 10);
  }
  if (process.env.MJ_API_SECRET) {
    config.mj.apiSecret = process.env.MJ_API_SECRET;
  }
  if (process.env.MJ_NOTIFY_HOOK) {
    config.mj.notifyHook = process.env.MJ_NOTIFY_HOOK;
  }
  if (process.env.MJ_TASK_STORE_TYPE) {
    config.mj.taskStore.type = process.env.MJ_TASK_STORE_TYPE as 'redis' | 'in_memory';
  }
  if (process.env.MJ_TASK_STORE_TIMEOUT) {
    config.mj.taskStore.timeout = process.env.MJ_TASK_STORE_TIMEOUT;
  }
  if (process.env.MJ_ACCOUNT_CHOOSE_RULE) {
    config.mj.accountChooseRule = process.env.MJ_ACCOUNT_CHOOSE_RULE;
  }
  if (process.env.MJ_DISCORD_GUILD_ID) {
    config.mj.discord.guildId = process.env.MJ_DISCORD_GUILD_ID;
  }
  if (process.env.MJ_DISCORD_CHANNEL_ID) {
    config.mj.discord.channelId = process.env.MJ_DISCORD_CHANNEL_ID;
  }
  if (process.env.MJ_DISCORD_USER_TOKEN) {
    config.mj.discord.userToken = process.env.MJ_DISCORD_USER_TOKEN;
  }
  if (process.env.MJ_TRANSLATE_WAY) {
    const translateWay = process.env.MJ_TRANSLATE_WAY.toUpperCase();
    if (translateWay === 'BAIDU') {
      config.mj.translateWay = TranslateWay.BAIDU;
    } else if (translateWay === 'GPT') {
      config.mj.translateWay = TranslateWay.GPT;
    } else {
      config.mj.translateWay = TranslateWay.NULL;
    }
  }
  if (process.env.MJ_BAIDU_TRANSLATE_APPID) {
    config.mj.baiduTranslate.appid = process.env.MJ_BAIDU_TRANSLATE_APPID;
  }
  if (process.env.MJ_BAIDU_TRANSLATE_APP_SECRET) {
    config.mj.baiduTranslate.appSecret = process.env.MJ_BAIDU_TRANSLATE_APP_SECRET;
  }
  if (process.env.MJ_OPENAI_GPT_API_KEY) {
    config.mj.openai.gptApiKey = process.env.MJ_OPENAI_GPT_API_KEY;
  }
  if (process.env.MJ_OPENAI_GPT_API_URL) {
    config.mj.openai.gptApiUrl = process.env.MJ_OPENAI_GPT_API_URL;
  }

  // Parse durations
  if (typeof config.mj.taskStore.timeout === 'string') {
    // Store as string, parse when needed
  }

  return config;
}

/**
 * Configuration instance
 */
export const config = loadConfig();

/**
 * Get task store timeout in milliseconds
 */
export function getTaskStoreTimeoutMs(): number {
  return parseDuration(config.mj.taskStore.timeout);
}

