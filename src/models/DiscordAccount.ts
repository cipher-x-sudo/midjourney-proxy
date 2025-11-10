import { DomainObject } from './DomainObject';
import { DEFAULT_DISCORD_USER_AGENT } from '../constants';

/**
 * Discord account model
 */
export class DiscordAccount extends DomainObject {
  /** Guild ID */
  guildId?: string;

  /** Channel ID */
  channelId?: string;

  /** User Token */
  userToken?: string;

  /** User UserAgent */
  userAgent: string = DEFAULT_DISCORD_USER_AGENT;

  /** Is available */
  enable: boolean = true;

  /** Concurrency */
  coreSize: number = 3;

  /** Queue length */
  queueSize: number = 10;

  /** Task timeout (minutes) */
  timeoutMinutes: number = 5;

  /**
   * Get display name
   */
  getDisplay(): string {
    return this.channelId || '';
  }
}

