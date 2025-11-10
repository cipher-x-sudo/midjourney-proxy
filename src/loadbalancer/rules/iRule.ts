import { DiscordInstance } from '../discordInstance';

/**
 * Load balancing rule interface
 */
export interface IRule {
  choose(instances: DiscordInstance[]): DiscordInstance | null;
}

