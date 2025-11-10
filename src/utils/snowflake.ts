import { SnowFlakeException } from '../exceptions/SnowFlakeException';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Snowflake ID generator
 */
export class SnowFlake {
  private workerId: number;
  private datacenterId: number;
  private sequence: number = 0;
  private readonly twepoch: number;
  private readonly sequenceMask: number;
  private readonly workerIdShift: number;
  private readonly datacenterIdShift: number;
  private readonly timestampLeftShift: number;
  private lastTimestamp: number = -1;
  private readonly randomSequence: boolean;
  private count: number = 0;
  private readonly timeOffset: number;

  public static readonly INSTANCE = new SnowFlake();

  private constructor() {
    this.randomSequence = false;
    this.timeOffset = 10;
    // 2012/12/12 23:59:59 GMT
    this.twepoch = 1355327999000;
    const workerIdBits = 5;
    const datacenterIdBits = 5;
    const sequenceBits = 12;

    const maxWorkerId = ~(-1 << workerIdBits);
    const maxDatacenterId = ~(-1 << datacenterIdBits);
    this.sequenceMask = ~(-1 << sequenceBits);
    this.workerIdShift = sequenceBits;
    this.datacenterIdShift = sequenceBits + workerIdBits;
    this.timestampLeftShift = sequenceBits + workerIdBits + datacenterIdBits;

    try {
      this.datacenterId = this.getDatacenterId(maxDatacenterId);
      this.workerId = this.getMaxWorkerId(this.datacenterId, maxWorkerId);
    } catch (e) {
      console.warn(`datacenterId or workerId generate error: ${e}, set default value`);
      this.datacenterId = 4;
      this.workerId = 1;
    }
  }

  public nextId(): string {
    let currentTimestamp = this.timeGen();
    if (currentTimestamp < this.lastTimestamp) {
      const offset = this.lastTimestamp - currentTimestamp;
      if (offset > this.timeOffset) {
        throw new SnowFlakeException(`Clock moved backwards, refusing to generate id for [${offset}ms]`);
      }
      // Wait for clock to catch up
      const waitTime = offset * 2;
      const start = Date.now();
      while (Date.now() - start < waitTime) {
        // Busy wait
      }
      currentTimestamp = this.timeGen();
      if (currentTimestamp < this.lastTimestamp) {
        throw new SnowFlakeException(`Clock moved backwards, refusing to generate id for [${offset}ms]`);
      }
    }

    if (this.lastTimestamp === currentTimestamp) {
      let tempSequence = this.sequence + 1;
      if (this.randomSequence) {
        this.sequence = tempSequence & this.sequenceMask;
        this.count = (this.count + 1) & this.sequenceMask;
        if (this.count === 0) {
          currentTimestamp = this.tillNextMillis(this.lastTimestamp);
        }
      } else {
        this.sequence = tempSequence & this.sequenceMask;
        if (this.sequence === 0) {
          currentTimestamp = this.tillNextMillis(this.lastTimestamp);
        }
      }
    } else {
      this.sequence = this.randomSequence ? Math.floor(Math.random() * (this.sequenceMask + 1)) : 0;
      this.count = 0;
    }

    this.lastTimestamp = currentTimestamp;
    const id = ((currentTimestamp - this.twepoch) << this.timestampLeftShift) |
      (this.datacenterId << this.datacenterIdShift) |
      (this.workerId << this.workerIdShift) |
      this.sequence;

    return String(id);
  }

  private getDatacenterId(maxDatacenterId: number): number {
    try {
      const networkInterfaces = os.networkInterfaces();
      const interfaces = Object.values(networkInterfaces).flat();
      if (interfaces.length === 0) {
        return 1;
      }
      const firstInterface = interfaces[0];
      if (!firstInterface || !firstInterface.mac) {
        return 1;
      }
      const mac = firstInterface.mac.replace(/:/g, '');
      const macBytes = Buffer.from(mac, 'hex');
      if (macBytes.length < 2) {
        return 1;
      }
      const id = ((macBytes[macBytes.length - 1] & 0xFF) | ((macBytes[macBytes.length - 2] & 0xFF) << 8)) >> 6;
      return id % (maxDatacenterId + 1);
    } catch (e) {
      throw new SnowFlakeException('Failed to get datacenter ID', e as Error);
    }
  }

  private getMaxWorkerId(datacenterId: number, maxWorkerId: number): number {
    try {
      let macIpPid = String(datacenterId);
      const processId = process.pid;
      macIpPid += processId;
      const hostname = os.hostname();
      const ip = hostname.replace(/\./g, '');
      macIpPid += ip;
      const hash = crypto.createHash('md5').update(macIpPid).digest('hex');
      const hashCode = parseInt(hash.substring(0, 8), 16) & 0xffff;
      return hashCode % (maxWorkerId + 1);
    } catch (e) {
      throw new SnowFlakeException('Failed to get worker ID', e as Error);
    }
  }

  private tillNextMillis(lastTimestamp: number): number {
    let timestamp = this.timeGen();
    while (timestamp <= lastTimestamp) {
      timestamp = this.timeGen();
    }
    return timestamp;
  }

  private timeGen(): number {
    return Date.now();
  }
}

