import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import { API_SECRET_HEADER_NAME } from '../constants';

/**
 * API authentication middleware
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!config.mj.apiSecret) {
    return;
  }

  const apiSecret = request.headers[API_SECRET_HEADER_NAME.toLowerCase()] as string;
  const authorized = apiSecret === config.mj.apiSecret;

  if (!authorized) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
}

