import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV === 'development') {
  globalThis.prismaGlobal = prisma;
  // @ts-expect-error prisma query event listener
  prisma.$on('query', (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, durationMs: e.duration }, 'Database query executed');
  });
}

export async function checkDatabaseHealth(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    logger.error({ error: message }, 'Database health check failed');
    return { status: 'down', error: message };
  }
}
