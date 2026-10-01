import crypto from 'crypto';
import { Worker, Job } from 'bullmq';
import { redis } from '../../../config/redis.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/database.js';
import { storageService } from '../../../services/storage.service.js';
import { profileService } from '../../profiles/profile.service.js';
import { garmentFetcherService } from '../services/garment-fetcher.service.js';
import { providerRegistry } from '../providers/provider.registry.js';
import { tryOnQueue, TryOnJobPayload } from './try-on.queue.js';
import { ProfilePhotoType, CATEGORY_METADATA_MAP } from '@vton/shared';
import { logger } from '../../../utils/logger.js';

export class TryOnWorker {
  private worker: Worker<TryOnJobPayload> | null = null;

  constructor() {
    // Register as fallback processor for direct execution
    tryOnQueue.registerFallbackProcessor(this.processJob.bind(this));

    // Initialize BullMQ worker if Redis is reachable
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker<TryOnJobPayload>(
        env.TRYON_QUEUE_NAME,
        async (job: Job<TryOnJobPayload>) => {
          await this.processJob(job.data);
        },
        {
          connection: redis,
          concurrency: 3, // Controlled concurrency to protect memory and provider limits
        }
      );

      this.worker.on('completed', (job) => {
        logger.info({ jobId: job.data.jobId }, '[TryOnWorker] BullMQ job completed successfully');
      });

      this.worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.data.jobId, error: err.message }, '[TryOnWorker] BullMQ job failed');
      });

      logger.info({ queueName: env.TRYON_QUEUE_NAME }, '[TryOnWorker] BullMQ worker initialized and listening');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redis unavailable';
      logger.warn({ error: msg }, '[TryOnWorker] Worker initialization deferred (running in fallback mode)');
    }
  }

  /**
   * Main idempotent execution pipeline for a virtual try-on job.
   */
  public async processJob(payload: TryOnJobPayload): Promise<void> {
    const { jobId, userId, selectedImageUrl, category, generationMode, contextEnvironment } = payload;
    const startTime = Date.now();

    logger.info({ jobId, userId, category }, '[TryOnWorker] Beginning processing for try-on job');

    // 1. Load job from database
    const job = await prisma.tryOnJob.findUnique({
      where: { id: jobId },
      include: {
        profile: {
          include: {
            images: true,
          },
        },
        product: true,
      },
    });

    if (!job) {
      logger.error({ jobId }, '[TryOnWorker] Job record not found in database');
      return;
    }

    if (job.status === 'COMPLETED') {
      logger.warn({ jobId }, '[TryOnWorker] Job is already completed; skipping duplicate processing');
      return;
    }

    if (job.status === 'CANCELLED') {
      logger.warn({ jobId }, '[TryOnWorker] Job was cancelled; skipping processing');
      return;
    }

    try {
      // 2. Transition state to PROCESSING -> PREPARING_ASSETS
      await prisma.tryOnJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          currentStage: 'PREPARING_ASSETS',
          progressPercent: 20,
          startedAt: new Date(),
        },
      });

      // 3. Resolve suitable profile photo asset
      const availablePhotoTypes = job.profile.images.map((img) => img.photoType as ProfilePhotoType);
      const readiness = profileService.evaluateCategoryReadiness(availablePhotoTypes, category);

      if (!readiness.ready || !readiness.activePhotoType) {
        throw new Error(
          `Your digital profile is missing the required photo for ${readiness.displayName}. Please upload a ${readiness.requiredPhotoType.replace(/_/g, ' ')} photo in your profile.`
        );
      }

      const profileImageRecord = job.profile.images.find(
        (img) => img.photoType === readiness.activePhotoType
      );

      if (!profileImageRecord) {
        throw new Error('Associated profile photo asset could not be located in storage.');
      }

      // Download user's stored profile photo from private object storage (reusing existing asset!)
      const profileImageBuffer = await storageService.getObjectBuffer(profileImageRecord.storageKey);

      // 4. Fetch and prepare garment image safely (with SSRF protection & caching)
      const preparedGarment = await garmentFetcherService.prepareGarmentImage(selectedImageUrl);

      // 5. Transition state to AI_SYNTHESIS
      await prisma.tryOnJob.update({
        where: { id: jobId },
        data: {
          currentStage: 'AI_SYNTHESIS',
          progressPercent: 50,
        },
      });

      // 6. Invoke active AI Virtual Try-On Provider
      const activeProvider = providerRegistry.getActiveProvider();
      const categoryMeta = CATEGORY_METADATA_MAP[category];

      logger.info(
        { jobId, provider: activeProvider.name, category, targetRegion: categoryMeta.targetBodyRegion },
        '[TryOnWorker] Dispatching to AI provider'
      );

      const tryOnOutput = await activeProvider.generateTryOn({
        jobId,
        userId,
        profileImageBuffer,
        garmentImageBuffer: preparedGarment.buffer,
        garmentImageUrl: selectedImageUrl,
        category,
        generationMode,
        targetBodyRegion: categoryMeta.targetBodyRegion,
        contextEnvironment,
        productTitle: job.product?.title,
      });

      // 7. Validate generated result
      if (!tryOnOutput.imageBuffer || tryOnOutput.imageBuffer.length < 1024) {
        throw new Error('AI provider returned an empty or corrupt image output.');
      }

      // 8. Transition state to STORING_RESULT
      await prisma.tryOnJob.update({
        where: { id: jobId },
        data: {
          currentStage: 'STORING_RESULT',
          progressPercent: 85,
        },
      });

      // 9. Store generated output in private object storage
      const resultUniqueId = crypto.randomUUID();
      const resultStorageKey = `results/${userId}/${resultUniqueId}.webp`;

      await storageService.upload({
        key: resultStorageKey,
        body: tryOnOutput.imageBuffer,
        contentType: tryOnOutput.mimeType || 'image/webp',
        metadata: {
          userId,
          jobId,
          provider: tryOnOutput.providerName,
          category,
          generationMode,
        },
      });

      // 10. Persist TryOnResult record in database (strictly idempotent upsert)
      const resultMetadata = {
        provider: tryOnOutput.providerName,
        providerJobId: tryOnOutput.providerJobId,
        latencyMs: tryOnOutput.latencyMs,
        category,
        generationMode,
        garmentSourceUrl: selectedImageUrl,
        productTitle: job.product?.title || undefined,
        totalDurationMs: Date.now() - startTime,
        ...tryOnOutput.metadata,
      };

      const tryOnResult = await prisma.tryOnResult.upsert({
        where: { jobId },
        update: {
          storageKey: resultStorageKey,
          mimeType: tryOnOutput.mimeType || 'image/webp',
          width: tryOnOutput.width,
          height: tryOnOutput.height,
          metadata: resultMetadata,
        },
        create: {
          jobId,
          userId,
          storageKey: resultStorageKey,
          mimeType: tryOnOutput.mimeType || 'image/webp',
          width: tryOnOutput.width,
          height: tryOnOutput.height,
          metadata: resultMetadata,
        },
      });

      // 11. Mark job as COMPLETED
      await prisma.tryOnJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          currentStage: 'COMPLETED',
          progressPercent: 100,
          completedAt: new Date(),
          providerUsed: tryOnOutput.providerName,
        },
      });

      logger.info(
        {
          jobId,
          resultId: tryOnResult.id,
          provider: tryOnOutput.providerName,
          totalDurationMs: Date.now() - startTime,
        },
        '[TryOnWorker] Try-on job completed successfully'
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown generation failure';
      logger.error({ jobId, error: errorMsg }, '[TryOnWorker] Try-on job failed');

      let userFacingMessage = 'Virtual try-on could not be completed. Please try again with a clear, front-facing garment photo.';
      if (
        errorMsg.includes('missing the required photo') ||
        errorMsg.includes('not supported') ||
        errorMsg.includes('timed out') ||
        errorMsg.includes('dimensions') ||
        errorMsg.includes('corrupt') ||
        errorMsg.includes('SSRF') ||
        errorMsg.includes('unreachable')
      ) {
        userFacingMessage = errorMsg;
      }

      // Update database with safe user-facing error message
      await prisma.tryOnJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          currentStage: 'FAILED',
          errorCode: 'TRY_ON_FAILED',
          errorMessage: userFacingMessage,
        },
      });
    }
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

export const tryOnWorker = new TryOnWorker();
