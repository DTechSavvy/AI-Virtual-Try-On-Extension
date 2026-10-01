import { Queue, QueueEvents } from 'bullmq';
import { redis } from '../../../config/redis.js';
import { env } from '../../../config/env.js';
import { ProductCategory, GenerationMode } from '@vton/shared';
import { logger } from '../../../utils/logger.js';

export interface TryOnJobPayload {
  jobId: string;
  userId: string;
  profileId: string;
  productId?: string;
  selectedImageUrl: string;
  category: ProductCategory;
  generationMode: GenerationMode;
  contextEnvironment?: string;
}

export type FallbackProcessor = (payload: TryOnJobPayload) => Promise<void>;

export class TryOnQueueService {
  private queue: Queue<TryOnJobPayload> | null = null;
  private queueEvents: QueueEvents | null = null;
  private fallbackProcessor: FallbackProcessor | null = null;
  private isRedisReady = false;

  public getIsRedisReady(): boolean {
    return this.isRedisReady;
  }

  constructor() {
    this.initQueue();
  }

  private initQueue(): void {
    try {
      this.queue = new Queue<TryOnJobPayload>(env.TRYON_QUEUE_NAME, {
        connection: redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      });

      this.queueEvents = new QueueEvents(env.TRYON_QUEUE_NAME, { connection: redis });

      this.queue.on('error', (err) => {
        logger.warn({ error: err.message }, '[TryOnQueue] BullMQ Redis connection warning');
        this.isRedisReady = false;
      });

      this.isRedisReady = true;
      logger.info({ queueName: env.TRYON_QUEUE_NAME }, '[TryOnQueue] BullMQ queue initialized');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redis unavailable';
      logger.warn({ error: msg }, '[TryOnQueue] Redis queue init failed; fallback dispatcher will be used');
      this.isRedisReady = false;
    }
  }

  /**
   * Register in-process fallback processor for offline testing or when Redis is absent.
   */
  public registerFallbackProcessor(processor: FallbackProcessor): void {
    this.fallbackProcessor = processor;
  }

  /**
   * Enqueue a new try-on synthesis job.
   */
  public async addJob(payload: TryOnJobPayload): Promise<void> {
    // If Redis is active and queue is healthy, push to BullMQ
    if (this.queue && (redis.status === 'ready' || redis.status === 'connecting')) {
      try {
        await this.queue.add('process-try-on', payload, {
          jobId: payload.jobId,
        });
        logger.info({ jobId: payload.jobId, queue: env.TRYON_QUEUE_NAME }, '[TryOnQueue] Job enqueued to BullMQ');
        return;
      } catch (err) {
        logger.warn({ err, jobId: payload.jobId }, '[TryOnQueue] Failed to add to BullMQ; switching to fallback processor');
      }
    }

    // Direct asynchronous execution fallback
    if (this.fallbackProcessor) {
      logger.info({ jobId: payload.jobId }, '[TryOnQueue] Processing job via asynchronous fallback dispatcher');
      setImmediate(() => {
        this.fallbackProcessor!(payload).catch((err) => {
          logger.error({ err, jobId: payload.jobId }, '[TryOnQueue] Fallback processing failed');
        });
      });
    } else {
      logger.error({ jobId: payload.jobId }, '[TryOnQueue] No queue or fallback processor available for job');
    }
  }

  public async close(): Promise<void> {
    if (this.queue) await this.queue.close();
    if (this.queueEvents) await this.queueEvents.close();
  }
}

export const tryOnQueue = new TryOnQueueService();
