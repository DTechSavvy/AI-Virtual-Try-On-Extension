import crypto from 'crypto';
import { SSRFValidator } from './ssrf.validator.js';
import { imageService, ProcessedImageResult } from '../../../services/image.service.js';
import { storageService } from '../../../services/storage.service.js';
import { logger } from '../../../utils/logger.js';

export interface PreparedGarment {
  buffer: Buffer;
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
  checksumSha256: string;
  isCached: boolean;
}

export class GarmentFetcherError extends Error {
  constructor(message: string, public readonly code: string = 'GARMENT_FETCH_FAILED') {
    super(message);
    this.name = 'GarmentFetcherError';
  }
}

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB max
const FETCH_TIMEOUT_MS = 10000; // 10s timeout

export class GarmentFetcherService {
  /**
   * Safely obtain, validate, and prepare a garment image from a remote URL or storage key.
   * Utilizes SSRF protection and private object storage caching to prevent redundant downloads.
   */
  async prepareGarmentImage(imageUrlOrKey: string): Promise<PreparedGarment> {
    // 1. If imageUrlOrKey is already an internal S3 storage key
    if (imageUrlOrKey.startsWith('products/') || imageUrlOrKey.startsWith('cache/')) {
      if (await storageService.exists(imageUrlOrKey)) {
        const buffer = await storageService.getObjectBuffer(imageUrlOrKey);
        const meta = await imageService.validateImage(buffer);
        const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

        return {
          buffer,
          storageKey: imageUrlOrKey,
          width: meta.width || 800,
          height: meta.height || 1000,
          mimeType: 'image/webp',
          checksumSha256,
          isCached: true,
        };
      }
    }

    // 2. Validate URL against SSRF
    const validatedUrl = await SSRFValidator.validateUrl(imageUrlOrKey);

    // 3. Compute deterministic cache key from source URL
    const urlHash = crypto.createHash('sha256').update(validatedUrl.toString()).digest('hex');
    const cacheStorageKey = `cache/garments/${urlHash}.webp`;

    // 4. Check cache in private object storage
    try {
      if (await storageService.exists(cacheStorageKey)) {
        logger.debug({ url: imageUrlOrKey, cacheKey: cacheStorageKey }, 'Garment image cache hit in object storage');
        const buffer = await storageService.getObjectBuffer(cacheStorageKey);
        const meta = await imageService.validateImage(buffer);
        const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

        return {
          buffer,
          storageKey: cacheStorageKey,
          width: meta.width || 800,
          height: meta.height || 1000,
          mimeType: 'image/webp',
          checksumSha256,
          isCached: true,
        };
      }
    } catch (err) {
      logger.warn({ err, cacheStorageKey }, 'Error checking garment cache; falling back to fetch');
    }

    // 5. Safely fetch remote image
    logger.info({ url: validatedUrl.toString() }, 'Fetching remote garment image');

    let response: Response;
    try {
      response = await fetch(validatedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'VTON-VirtualTryOn-GarmentFetcher/1.0',
          Accept: 'image/webp,image/jpeg,image/png,image/avif,*/*',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      throw new GarmentFetcherError(`Failed to fetch product image: ${msg}`, 'FETCH_TIMEOUT_OR_NETWORK_ERROR');
    }

    if (!response.ok) {
      throw new GarmentFetcherError(
        `Remote server returned HTTP ${response.status} when fetching product image.`,
        'REMOTE_SERVER_ERROR'
      );
    }

    // 6. Content-Type and size validation
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new GarmentFetcherError(
        `Invalid content-type: '${contentType}'. Expected an image.`,
        'INVALID_CONTENT_TYPE'
      );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
      throw new GarmentFetcherError('Product image exceeds maximum allowed size (15MB).', 'IMAGE_TOO_LARGE');
    }

    const arrayBuffer = await response.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    if (rawBuffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new GarmentFetcherError('Product image exceeds maximum allowed size (15MB).', 'IMAGE_TOO_LARGE');
    }

    // 7. Preprocess image (validate magic bytes, strip metadata, convert to WebP)
    let processed: ProcessedImageResult;
    try {
      processed = await imageService.preprocessImage(rawBuffer, {
        maxDimension: 1536,
        quality: 90,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid image binary';
      throw new GarmentFetcherError(`Product image processing failed: ${msg}`, 'IMAGE_PROCESSING_FAILED');
    }

    // 8. Cache in private storage
    try {
      await storageService.upload({
        key: cacheStorageKey,
        body: processed.buffer,
        contentType: processed.mimeType,
        metadata: {
          sourceUrlHash: urlHash,
          checksumSha256: processed.checksumSha256,
        },
      });
      logger.info({ cacheStorageKey, sizeBytes: processed.fileSizeBytes }, 'Garment image cached successfully');
    } catch (err) {
      logger.warn({ err, cacheStorageKey }, 'Failed to cache garment image in object storage; proceeding with memory buffer');
    }

    return {
      buffer: processed.buffer,
      storageKey: cacheStorageKey,
      width: processed.width,
      height: processed.height,
      mimeType: processed.mimeType,
      checksumSha256: processed.checksumSha256,
      isCached: false,
    };
  }
}

export const garmentFetcherService = new GarmentFetcherService();
