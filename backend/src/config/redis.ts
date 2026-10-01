import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    return Math.min(times * 150, 2000);
  },
});

redis.on('error', (err) => {
  // Only log if not just a routine reconnect attempt
  if (!err.message?.includes('ECONNREFUSED')) {
    logger.warn({ error: err.message }, 'Redis connection notice');
  }
});

export async function checkRedisHealth(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    if (redis.status === 'wait' || redis.status === 'close') {
      await redis.connect().catch(() => {});
    }
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return { status: 'up', latencyMs: Date.now() - start };
    }
    return { status: 'down', error: 'Did not receive PONG' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Redis error';
    return { status: 'down', error: message };
  }
}
