import { FastifyRequest, FastifyReply } from 'fastify';
import { DiscordAccount } from '../models/DiscordAccount';
import { DiscordLoadBalancer } from '../loadbalancer/discordLoadBalancer';

/**
 * Account controller
 */
export class AccountController {
  private loadBalancer: DiscordLoadBalancer;

  constructor(loadBalancer: DiscordLoadBalancer) {
    this.loadBalancer = loadBalancer;
  }

  async fetch(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<DiscordAccount | null> {
    const id = request.params.id;
    const instance = this.loadBalancer.getDiscordInstance(id);
    return instance ? instance.account() : null;
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<DiscordAccount[]> {
    return this.loadBalancer.getAllInstances().map(instance => instance.account());
  }

  async getStatus(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<{
    account: DiscordAccount | null;
    connection: {
      connected: boolean;
      running: boolean;
      sessionId: string | null;
      sequence: number | null;
      websocketState: string;
      hasSession: boolean;
    };
    status: string;
  }> {
    const id = request.params.id;
    const instance = this.loadBalancer.getDiscordInstance(id);
    
    if (!instance) {
      return {
        account: null,
        connection: {
          connected: false,
          running: false,
          sessionId: null,
          sequence: null,
          websocketState: 'NOT_FOUND',
          hasSession: false,
        },
        status: 'NOT_FOUND',
      };
    }

    const account = instance.account();
    const connectionStatus = instance.getConnectionStatus();
    
    let status = 'DISCONNECTED';
    if (!account.enable) {
      status = 'DISABLED';
    } else if (connectionStatus.connected) {
      status = 'CONNECTED';
    } else if (connectionStatus.running) {
      status = 'CONNECTING';
    } else if (connectionStatus.websocketState === 'OPEN') {
      status = 'OPEN_BUT_NOT_RUNNING';
    } else {
      status = 'DISCONNECTED';
    }

    return {
      account,
      connection: connectionStatus,
      status,
    };
  }

  async getAllStatus(request: FastifyRequest, reply: FastifyReply): Promise<Array<{
    accountId: string;
    account: DiscordAccount;
    connection: {
      connected: boolean;
      running: boolean;
      sessionId: string | null;
      sequence: number | null;
      websocketState: string;
      hasSession: boolean;
    };
    status: string;
  }>> {
    const instances = this.loadBalancer.getAllInstances();
    
    return instances.map(instance => {
      const account = instance.account();
      const connectionStatus = instance.getConnectionStatus();
      
      let status = 'DISCONNECTED';
      if (!account.enable) {
        status = 'DISABLED';
      } else if (connectionStatus.connected) {
        status = 'CONNECTED';
      } else if (connectionStatus.running) {
        status = 'CONNECTING';
      } else if (connectionStatus.websocketState === 'OPEN') {
        status = 'OPEN_BUT_NOT_RUNNING';
      } else {
        status = 'DISCONNECTED';
      }

      return {
        accountId: instance.getInstanceId(),
        account,
        connection: connectionStatus,
        status,
      };
    });
  }
}

