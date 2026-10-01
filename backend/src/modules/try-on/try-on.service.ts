import { prisma } from '../../config/database.js';
import { storageService } from '../../services/storage.service.js';
import { profileService } from '../profiles/profile.service.js';
import { tryOnQueue } from './queue/try-on.queue.js';
import { CreateTryOnJobInput, HistoryQueryInput } from './try-on.dto.js';
import {
  TryOnJobStatus,
  GenerationMode,
  ProfilePhotoType,
  ProductCategory,
  CreateTryOnJobResponse,
} from '@vton/shared';
import { logger } from '../../utils/logger.js';

export class TryOnError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'TRY_ON_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'TryOnError';
  }
}

export interface SanitizedTryOnResult {
  id: string;
  jobId: string;
  userId: string;
  imageUrl: string;
  width: number;
  height: number;
  productTitle?: string;
  category?: ProductCategory;
  generationMode?: GenerationMode;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedResults {
  results: SanitizedTryOnResult[];
  total: number;
  page: number;
  totalPages: number;
}

export class TryOnService {
  /**
   * Submit and enqueue a new virtual try-on synthesis job.
   * Performs category-profile readiness verification, idempotency checks, and queue dispatch.
   */
  async createJob(userId: string, input: CreateTryOnJobInput): Promise<CreateTryOnJobResponse> {
    // 1. Resolve target digital profile (explicit or default)
    const profile = await prisma.digitalProfile.findFirst({
      where: input.profileId ? { id: input.profileId, userId } : { userId, isDefault: true },
      include: { images: true },
    });

    if (!profile) {
      throw new TryOnError(
        'Digital profile not found. Please create a profile before trying on clothing.',
        'PROFILE_NOT_FOUND',
        404
      );
    }

    // 2. Validate category readiness (ensure user has uploaded required body photo)
    const availablePhotoTypes = profile.images.map((img) => img.photoType as ProfilePhotoType);
    const readiness = profileService.evaluateCategoryReadiness(availablePhotoTypes, input.category);

    if (!readiness.ready) {
      throw new TryOnError(
        `Your digital profile requires a ${readiness.requiredPhotoType.replace(/_/g, ' ')} photo to try on ${readiness.displayName}. Please upload this photo under Digital Profile first.`,
        'PROFILE_INCOMPLETE_FOR_CATEGORY',
        400
      );
    }

    // 3. Idempotency Guard: prevent duplicate simultaneous jobs for the exact same garment & profile
    const recentWindow = new Date(Date.now() - 90 * 1000); // 90 seconds
    const existingActiveJob = await prisma.tryOnJob.findFirst({
      where: {
        userId,
        profileId: profile.id,
        status: { in: ['CREATED', 'QUEUED', 'PROCESSING'] },
        createdAt: { gte: recentWindow },
      },
      include: { product: true },
    });

    if (existingActiveJob) {
      logger.info(
        { existingJobId: existingActiveJob.id, userId },
        '[TryOnService] Reusing active job for idempotent request'
      );
      return {
        jobId: existingActiveJob.id,
        status: existingActiveJob.status as TryOnJobStatus,
        estimatedLatencySeconds: 15,
        statusUrl: `/api/v1/try-on/jobs/${existingActiveJob.id}`,
        createdAt: existingActiveJob.createdAt.toISOString(),
      };
    }

    // 3.5 Resolve or auto-create Product record to satisfy relational foreign key
    let finalProductId: string | null = null;

    if (input.productId) {
      try {
        const existingProduct = await prisma.product.findUnique({
          where: { id: input.productId },
        });
        if (existingProduct) {
          finalProductId = existingProduct.id;
        }
      } catch {
        // ID may not be a valid uuid or doesn't exist
      }
    }

    if (!finalProductId && input.sourceUrl) {
      try {
        const existingByUrl = await prisma.product.findFirst({
          where: { sourceUrl: input.sourceUrl },
        });
        if (existingByUrl) {
          finalProductId = existingByUrl.id;
        }
      } catch {
        // Continue to create
      }
    }

    if (!finalProductId) {
      try {
        let domain = input.sourceDomain;
        if (!domain && input.sourceUrl) {
          try {
            domain = new URL(input.sourceUrl).hostname;
          } catch {
            domain = 'unknown-store';
          }
        }
        domain = domain || 'unknown-store';

        const isUuid =
          input.productId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.productId);

        const createdProduct = await prisma.product.create({
          data: {
            id: isUuid ? input.productId : undefined,
            sourceDomain: domain,
            sourceUrl: input.sourceUrl || `https://${domain}/product/${Date.now()}`,
            title: (input.productTitle || 'Clothing Item').slice(0, 255),
            category: input.category as any,
            price: input.price ? Number(input.price) : undefined,
            currency: input.currency || 'USD',
            brand: input.brand?.slice(0, 100),
            images: {
              create: [
                {
                  imageUrl: input.selectedImageUrl,
                  isPrimary: true,
                  qualityScore: 1.0,
                },
              ],
            },
          },
        });
        finalProductId = createdProduct.id;
      } catch (err: unknown) {
        logger.warn(
          { error: err instanceof Error ? err.message : err, productId: input.productId },
          '[TryOnService] Auto-create Product record failed; falling back to null productId'
        );
        finalProductId = null;
      }
    }

    // 4. Create database job record
    const job = await prisma.tryOnJob.create({
      data: {
        userId,
        profileId: profile.id,
        productId: finalProductId,
        status: 'QUEUED',
        generationMode: input.generationMode as any,
        progressPercent: 5,
        currentStage: 'QUEUED',
        queuedAt: new Date(),
      },
    });

    logger.info({ jobId: job.id, userId, category: input.category, finalProductId }, '[TryOnService] Try-on job created');

    // 5. Dispatch job to asynchronous queue
    await tryOnQueue.addJob({
      jobId: job.id,
      userId,
      profileId: profile.id,
      productId: finalProductId || undefined,
      selectedImageUrl: input.selectedImageUrl,
      category: input.category,
      generationMode: input.generationMode,
      contextEnvironment: input.contextEnvironment,
    });

    return {
      jobId: job.id,
      status: TryOnJobStatus.QUEUED,
      estimatedLatencySeconds: 15,
      statusUrl: `/api/v1/try-on/jobs/${job.id}`,
      createdAt: job.createdAt.toISOString(),
    };
  }

  /**
   * Poll try-on job status. Verifies ownership and returns secure access URL upon completion.
   */
  async getJobStatus(userId: string, jobId: string) {
    const job = await prisma.tryOnJob.findUnique({
      where: { id: jobId },
      include: {
        result: true,
        product: true,
      },
    });

    if (!job || job.userId !== userId) {
      throw new TryOnError('Job not found or access unauthorized.', 'JOB_NOT_FOUND', 404);
    }

    let resultData: SanitizedTryOnResult | null = null;
    if (job.result) {
      const presignedUrl = await storageService.generatePrivateAccessUrl(job.result.storageKey, 900);
      const meta = (job.result.metadata as Record<string, any>) || {};

      resultData = {
        id: job.result.id,
        jobId: job.result.jobId,
        userId: job.result.userId,
        imageUrl: presignedUrl,
        width: job.result.width,
        height: job.result.height,
        productTitle: meta.productTitle || job.product?.title || undefined,
        category: meta.category,
        generationMode: meta.generationMode,
        metadata: meta,
        createdAt: job.result.createdAt.toISOString(),
      };
    }

    return {
      id: job.id,
      userId: job.userId,
      status: job.status as TryOnJobStatus,
      generationMode: job.generationMode as GenerationMode,
      progressPercent: job.progressPercent,
      currentStage: job.currentStage,
      providerUsed: job.providerUsed,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      result: resultData,
      queuedAt: job.queuedAt?.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      createdAt: job.createdAt.toISOString(),
    };
  }

  /**
   * Retrieve paginated history of completed try-on visualizations for the authenticated user.
   */
  async getHistory(userId: string, query: HistoryQueryInput): Promise<PaginatedResults> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query?.limit) || 12));
    const skip = (page - 1) * limit;

    const [total, results] = await Promise.all([
      prisma.tryOnResult.count({ where: { userId } }),
      prisma.tryOnResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          job: {
            include: { product: true },
          },
        },
      }),
    ]);

    const sanitized: SanitizedTryOnResult[] = await Promise.all(
      results.map(async (r) => {
        const presignedUrl = await storageService.generatePrivateAccessUrl(r.storageKey, 900);
        const meta = (r.metadata as Record<string, any>) || {};

        return {
          id: r.id,
          jobId: r.jobId,
          userId: r.userId,
          imageUrl: presignedUrl,
          width: r.width,
          height: r.height,
          productTitle: meta.productTitle || r.job.product?.title || undefined,
          category: meta.category,
          generationMode: meta.generationMode,
          metadata: meta,
          createdAt: r.createdAt.toISOString(),
        };
      })
    );

    return {
      results: sanitized,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieve a single generated result by ID.
   */
  async getResult(userId: string, resultId: string): Promise<SanitizedTryOnResult> {
    const result = await prisma.tryOnResult.findUnique({
      where: { id: resultId },
      include: {
        job: {
          include: { product: true },
        },
      },
    });

    if (!result || result.userId !== userId) {
      throw new TryOnError('Result not found or access unauthorized.', 'RESULT_NOT_FOUND', 404);
    }

    const presignedUrl = await storageService.generatePrivateAccessUrl(result.storageKey, 900);
    const meta = (result.metadata as Record<string, any>) || {};

    return {
      id: result.id,
      jobId: result.jobId,
      userId: result.userId,
      imageUrl: presignedUrl,
      width: result.width,
      height: result.height,
      productTitle: meta.productTitle || result.job.product?.title || undefined,
      category: meta.category,
      generationMode: meta.generationMode,
      metadata: meta,
      createdAt: result.createdAt.toISOString(),
    };
  }

  /**
   * Delete an individual generated try-on result from both private storage and database.
   */
  async deleteResult(userId: string, resultId: string): Promise<void> {
    const result = await prisma.tryOnResult.findUnique({
      where: { id: resultId },
    });

    if (!result || result.userId !== userId) {
      throw new TryOnError('Result not found or access unauthorized.', 'RESULT_NOT_FOUND', 404);
    }

    // 1. Delete object from private storage
    try {
      await storageService.delete(result.storageKey);
    } catch (err) {
      logger.error({ err, storageKey: result.storageKey }, 'Failed to delete S3 result object; continuing DB removal');
    }

    // 2. Delete database record
    await prisma.tryOnResult.delete({
      where: { id: resultId },
    });

    logger.info({ userId, resultId }, '[TryOnService] Generated result deleted successfully');
  }
}

export const tryOnService = new TryOnService();
