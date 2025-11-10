import { IRule } from './iRule';
import { DiscordInstance } from '../discordInstance';

/**
 * Round-robin load balancing rule
 */
export class RoundRobinRule implements IRule {
  private position: number = 0;

  choose(instances: DiscordInstance[]): DiscordInstance | null {
    if (instances.length === 0) {
      return null;
    }
    const pos = this.incrementAndGet();
    return instances[pos % instances.length];
  }

  private incrementAndGet(): number {
    const current = this.position;
    const next = current === Number.MAX_SAFE_INTEGER ? 0 : current + 1;
    this.position = next;
    return next;
  }
}

