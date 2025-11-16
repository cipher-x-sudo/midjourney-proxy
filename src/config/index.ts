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
  bodyLimit?: number; // Request body size limit in bytes (default: 25MB)
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: string;
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  verboseMessageDump?: boolean;
}

/**
 * Application configuration
 */
export interface AppConfig {
  server: ServerConfig;
  logging: LoggingConfig;
  debug?: DebugConfig;
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
 * Parse body limit string or number to bytes
 * Supports formats: "25mb", "25MB", "26214400", 26214400
 */
function parseBodyLimit(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+)([kmgKMG][bB]?)?$/);
    if (!match) {
      // Try parsing as plain number
      const numValue = parseInt(trimmed, 10);
      if (!isNaN(numValue)) {
        return numValue;
      }
      throw new Error(`Invalid body limit format: ${value}`);
    }
    
    const numValue = parseInt(match[1], 10);
    const unit = match[2]?.toLowerCase() || '';
    
    switch (unit) {
      case 'kb':
      case 'k':
        return numValue * 1024;
      case 'mb':
      case 'm':
        return numValue * 1024 * 1024;
      case 'gb':
      case 'g':
        return numValue * 1024 * 1024 * 1024;
      case '':
        return numValue;
      default:
        throw new Error(`Unknown body limit unit: ${unit}`);
    }
  }
  
  return undefined;
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
          bodyLimit: 25 * 1024 * 1024, // Default 25MB
        },
        logging: {
          level: 'info',
        },
        debug: {
          verboseMessageDump: true,
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

    // Ensure server object exists
    if (!config.server) {
      config.server = {
        port: 8080,
        contextPath: '/mj',
        bodyLimit: 25 * 1024 * 1024, // Default 25MB
      };
    } else {
      // Parse bodyLimit if present in YAML
      if ((config.server as any).bodyLimit !== undefined) {
        try {
          config.server.bodyLimit = parseBodyLimit((config.server as any).bodyLimit);
        } catch (e) {
          console.warn(`Failed to parse bodyLimit from config, using default: ${e}`);
          config.server.bodyLimit = 25 * 1024 * 1024; // Default 25MB
        }
      }
    }

    // Ensure debug object exists with defaults
    if (!config.debug) {
      config.debug = {
        verboseMessageDump: true,
      };
    } else {
      // Set default if not specified
      if (config.debug.verboseMessageDump === undefined) {
        config.debug.verboseMessageDump = true;
      }
    }

    // Ensure discord object exists with defaults if missing from YAML
    if (!config.mj.discord) {
      config.mj.discord = {
        userAgent: DEFAULT_DISCORD_USER_AGENT,
        enable: true,
        coreSize: 3,
        queueSize: 10,
        timeoutMinutes: 5,
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
  if (process.env.MJ_BODY_LIMIT) {
    try {
      const parsed = parseBodyLimit(process.env.MJ_BODY_LIMIT);
      if (parsed !== undefined) {
        config.server.bodyLimit = parsed;
      }
    } catch (e) {
      console.warn(`Failed to parse MJ_BODY_LIMIT environment variable, using default: ${e}`);
    }
  }
  
  // Set default bodyLimit if not specified
  if (config.server.bodyLimit === undefined) {
    config.server.bodyLimit = 25 * 1024 * 1024; // Default 25MB
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

  // Discord configuration from environment variables
  // (discord object is already ensured to exist above after YAML load)
  if (process.env.MJ_DISCORD_GUILD_ID) {
    config.mj.discord.guildId = process.env.MJ_DISCORD_GUILD_ID;
  }
  if (process.env.MJ_DISCORD_CHANNEL_ID) {
    config.mj.discord.channelId = process.env.MJ_DISCORD_CHANNEL_ID;
  }
  if (process.env.MJ_DISCORD_USER_TOKEN) {
    config.mj.discord.userToken = process.env.MJ_DISCORD_USER_TOKEN;
  }
  if (process.env.MJ_DISCORD_USER_AGENT) {
    config.mj.discord.userAgent = process.env.MJ_DISCORD_USER_AGENT;
  }
  if (process.env.MJ_DISCORD_ENABLE !== undefined) {
    config.mj.discord.enable = process.env.MJ_DISCORD_ENABLE.toLowerCase() === 'true' || process.env.MJ_DISCORD_ENABLE === '1';
  }
  if (process.env.MJ_DISCORD_CORE_SIZE) {
    const coreSize = parseInt(process.env.MJ_DISCORD_CORE_SIZE, 10);
    if (!isNaN(coreSize)) {
      config.mj.discord.coreSize = coreSize;
    }
  }
  if (process.env.MJ_DISCORD_QUEUE_SIZE) {
    const queueSize = parseInt(process.env.MJ_DISCORD_QUEUE_SIZE, 10);
    if (!isNaN(queueSize)) {
      config.mj.discord.queueSize = queueSize;
    }
  }
  if (process.env.MJ_DISCORD_TIMEOUT_MINUTES) {
    const timeoutMinutes = parseInt(process.env.MJ_DISCORD_TIMEOUT_MINUTES, 10);
    if (!isNaN(timeoutMinutes)) {
      config.mj.discord.timeoutMinutes = timeoutMinutes;
    }
  }

  // Apply defaults for Discord fields if not set by env vars or YAML
  if (!config.mj.discord.userAgent) {
    config.mj.discord.userAgent = DEFAULT_DISCORD_USER_AGENT;
  }
  if (config.mj.discord.enable === undefined) {
    config.mj.discord.enable = true;
  }
  if (config.mj.discord.coreSize === undefined) {
    config.mj.discord.coreSize = 3;
  }
  if (config.mj.discord.queueSize === undefined) {
    config.mj.discord.queueSize = 10;
  }
  if (config.mj.discord.timeoutMinutes === undefined) {
    config.mj.discord.timeoutMinutes = 5;
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

/**
 * Get seed wait timeout in milliseconds
 * Env: MJ_SEED_WAIT_MS (number, ms). Defaults to 15000ms.
 */
export function getSeedWaitMs(): number {
  const env = process.env.MJ_SEED_WAIT_MS;
  const parsed = env ? parseInt(env, 10) : NaN;
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  return 15000;
}

