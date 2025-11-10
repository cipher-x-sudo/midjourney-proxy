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
}

