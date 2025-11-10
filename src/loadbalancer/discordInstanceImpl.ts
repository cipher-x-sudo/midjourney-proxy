import { DiscordInstance } from './discordInstance';
import { DiscordAccount } from '../models/DiscordAccount';
import { Task } from '../models/Task';
import { SubmitResultVO } from '../models/SubmitResultVO';
import { Message } from '../result/Message';
import { ReturnCode } from '../constants';
import { TaskStatus } from '../enums/TaskStatus';
import { BlendDimensions } from '../enums/BlendDimensions';
import { DataUrl } from '../utils/convertUtils';
import { TaskStoreService } from '../services/store/taskStoreService';
import { NotifyService } from '../services/notifyService';
import { DiscordService, DiscordServiceImpl } from '../services/discordService';
import { DiscordGateway, ResumeData } from '../wss/discordGateway';
import { UserMessageListener } from '../wss/userMessageListener';
import { DiscordHelper } from '../support/discordHelper';
import { TaskCondition } from '../support/taskCondition';
import { TASK_PROPERTY_DISCORD_INSTANCE_ID, TASK_PROPERTY_NONCE } from '../constants';
import PQueue from 'p-queue';
import * as crypto from 'crypto';

/**
 * Discord instance implementation
 */
export class DiscordInstanceImpl implements DiscordInstance {
  private accountData: DiscordAccount;
  private gateway: DiscordGateway | null = null;
  private service: DiscordService;
  private taskStoreService: TaskStoreService;
  private notifyService: NotifyService;
  private taskQueue: PQueue;
  private runningTasks: Task[] = [];
  private queueTasks: Task[] = [];
  private taskFutureMap: Map<string, Promise<any>> = new Map();
  private resumeData: ResumeData | null = null;

  constructor(
    account: DiscordAccount,
    taskStoreService: TaskStoreService,
    notifyService: NotifyService,
    discordService: DiscordService,
    gateway: DiscordGateway | null = null
  ) {
    this.accountData = account;
    this.service = discordService;
    this.taskStoreService = taskStoreService;
    this.notifyService = notifyService;
    this.gateway = gateway;

    // Create task queue with concurrency limit
    this.taskQueue = new PQueue({
      concurrency: account.coreSize || 3,
    });
  }

  getInstanceId(): string {
    return this.accountData.channelId || '';
  }

  account(): DiscordAccount {
    return this.accountData;
  }

  isAlive(): boolean {
    return this.accountData.enable === true;
  }

  async startWss(): Promise<void> {
    if (this.gateway) {
      if (this.resumeData) {
        this.gateway.setResumeData(this.resumeData);
        await this.gateway.start(true);
      } else {
        await this.gateway.start(false);
      }
      this.resumeData = this.gateway.getResumeData();
    }
  }

  getRunningTasks(): Task[] {
    return [...this.runningTasks];
  }

  getQueueTasks(): Task[] {
    return [...this.queueTasks];
  }

  exitTask(task: Task): void {
    try {
      const future = this.taskFutureMap.get(task.id!);
      if (future) {
        // Cancel is not directly supported, but we can track it
        this.taskFutureMap.delete(task.id!);
      }
      this.saveAndNotify(task);
    } finally {
      const taskIndex = this.runningTasks.findIndex(t => t.id === task.id);
      if (taskIndex >= 0) {
        this.runningTasks.splice(taskIndex, 1);
      }
      const queueIndex = this.queueTasks.findIndex(t => t.id === task.id);
      if (queueIndex >= 0) {
        this.queueTasks.splice(queueIndex, 1);
      }
      this.taskFutureMap.delete(task.id!);
    }
  }

  getRunningFutures(): Map<string, Promise<any>> {
    return new Map(this.taskFutureMap);
  }

  async submitTask(task: Task, discordSubmit: () => Promise<Message<void>>): Promise<SubmitResultVO> {
    // Save task
    await this.taskStoreService.save(task);

    const currentWaitNumbers = this.queueTasks.length;

    try {
      // Add to queue
      this.queueTasks.push(task);

      // Submit to queue
      const promise = this.taskQueue.add(() => this.executeTask(task, discordSubmit));
      this.taskFutureMap.set(task.id!, promise);

      if (currentWaitNumbers === 0) {
        return SubmitResultVO.of(ReturnCode.SUCCESS, 'Submission successful', task.id)
          .setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, this.getInstanceId());
      } else {
        return SubmitResultVO.of(ReturnCode.IN_QUEUE, `In queue, ${currentWaitNumbers} tasks ahead`, task.id)
          .setProperty('numberOfQueues', currentWaitNumbers)
          .setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, this.getInstanceId());
      }
    } catch (error: any) {
      await this.taskStoreService.delete(task.id!);
      if (error.message?.includes('queue')) {
        return SubmitResultVO.fail(ReturnCode.QUEUE_REJECTED, 'Queue is full, please try again later')
          .setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, this.getInstanceId());
      }
      console.error('submit task error:', error);
      return SubmitResultVO.fail(ReturnCode.FAILURE, 'Submission failed, system error')
        .setProperty(TASK_PROPERTY_DISCORD_INSTANCE_ID, this.getInstanceId());
    }
  }

  private async executeTask(task: Task, discordSubmit: () => Promise<Message<void>>): Promise<void> {
    this.runningTasks.push(task);
    try {
      const result = await discordSubmit();
      task.startTime = Date.now();

      if (result.getCode() !== ReturnCode.SUCCESS) {
        task.fail(result.getDescription());
        await this.saveAndNotify(task);
        console.debug(`[${this.accountData.getDisplay()}] task finished, id: ${task.id}, status: ${task.status}`);
        return;
      }

      task.status = TaskStatus.SUBMITTED;
      task.progress = '0%';
      await this.asyncSaveAndNotify(task);

      // Wait for task completion
      const waitingStatuses = new Set([TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]);
      while (waitingStatuses.has(task.status)) {
        await this.sleep(100);
        await this.asyncSaveAndNotify(task);
      }

      console.debug(`[${this.accountData.getDisplay()}] task finished, id: ${task.id}, status: ${task.status}`);
    } catch (error: any) {
      console.error(`[${this.accountData.getDisplay()}] task execute error, id: ${task.id}`, error);
      task.fail(`[Internal Server Error] ${error.message}`);
      await this.saveAndNotify(task);
    } finally {
      const taskIndex = this.runningTasks.findIndex(t => t.id === task.id);
      if (taskIndex >= 0) {
        this.runningTasks.splice(taskIndex, 1);
      }
      const queueIndex = this.queueTasks.findIndex(t => t.id === task.id);
      if (queueIndex >= 0) {
        this.queueTasks.splice(queueIndex, 1);
      }
      this.taskFutureMap.delete(task.id!);
    }
  }

  private async asyncSaveAndNotify(task: Task): Promise<void> {
    // Run asynchronously
    setImmediate(() => {
      this.saveAndNotify(task).catch(err => {
        console.error('Error saving/notifying task:', err);
      });
    });
  }

  private async saveAndNotify(task: Task): Promise<void> {
    await this.taskStoreService.save(task);
    await this.notifyService.notifyTaskChange(task);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  findRunningTask(condition: (task: Task) => boolean): Task[] {
    return this.runningTasks.filter(condition);
  }

  getRunningTask(id: string): Task | undefined {
    return this.runningTasks.find(t => t.id === id);
  }

  getRunningTaskByNonce(nonce: string): Task | undefined {
    if (!nonce) {
      return undefined;
    }
    const condition = new TaskCondition().setNonce(nonce);
    return this.runningTasks.find(t => condition.test(t));
  }

  // DiscordService methods
  async imagine(prompt: string, nonce: string): Promise<Message<void>> {
    return this.service.imagine(prompt, nonce);
  }

  async upscale(messageId: string, index: number, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>> {
    return this.service.upscale(messageId, index, messageHash, messageFlags, nonce);
  }

  async variation(messageId: string, index: number, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>> {
    return this.service.variation(messageId, index, messageHash, messageFlags, nonce);
  }

  async reroll(messageId: string, messageHash: string, messageFlags: number, nonce: string): Promise<Message<void>> {
    return this.service.reroll(messageId, messageHash, messageFlags, nonce);
  }

  async describe(finalFileName: string, nonce: string): Promise<Message<void>> {
    return this.service.describe(finalFileName, nonce);
  }

  async blend(finalFileNames: string[], dimensions: BlendDimensions, nonce: string): Promise<Message<void>> {
    return this.service.blend(finalFileNames, dimensions, nonce);
  }

  async upload(fileName: string, dataUrl: DataUrl): Promise<Message<string>> {
    return this.service.upload(fileName, dataUrl);
  }

  async sendImageMessage(content: string, finalFileName: string): Promise<Message<string>> {
    return this.service.sendImageMessage(content, finalFileName);
  }
}

