import { IRule } from './iRule';
import { DiscordInstance } from '../discordInstance';

/**
 * Best wait idle rule
 * Selects the instance with the least waiting tasks. If all instances are idle, randomly selects one.
 */
export class BestWaitIdleRule implements IRule {
  choose(instances: DiscordInstance[]): DiscordInstance | null {
    if (instances.length === 0) {
      return null;
    }

    // Group instances by wait count
    const waitMap = new Map<number, DiscordInstance[]>();
    for (const instance of instances) {
      const runningCount = instance.getRunningFutures().size;
      const coreSize = instance.account().coreSize || 0;
      const wait = runningCount - coreSize;
      const waitKey = wait >= 0 ? wait : -1;

      if (!waitMap.has(waitKey)) {
        waitMap.set(waitKey, []);
      }
      waitMap.get(waitKey)!.push(instance);
    }

    // Find the minimum wait key
    const minWaitKey = Math.min(...Array.from(waitMap.keys()));
    const instanceList = waitMap.get(minWaitKey)!;

    // Randomly select from instances with minimum wait
    return instanceList[Math.floor(Math.random() * instanceList.length)];
  }
}

