import { tryOnWorker } from './modules/try-on/queue/try-on.worker.js';
import { storageService } from './services/storage.service.js';
import { checkDatabaseHealth } from './config/database.js';
import { checkRedisHealth } from './config/redis.js';
import { logger } from './utils/logger.js';

async function bootstrapWorker() {
  logger.info('[VTON Standalone Worker] Initializing services...');

  const [db, redis] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    storageService.ensureBucketExists(),
  ]);

  logger.info(
    { database: db.status, redis: redis.status },
    '[VTON Standalone Worker] Worker process ready and listening for virtual try-on jobs'
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, '[VTON Standalone Worker] Gracefully shutting down worker...');
    await tryOnWorker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrapWorker().catch((err) => {
  logger.error({ err }, '[VTON Standalone Worker] Fatal error starting worker process');
  process.exit(1);
});
