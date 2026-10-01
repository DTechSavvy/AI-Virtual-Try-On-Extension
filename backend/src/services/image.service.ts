import crypto from 'crypto';
import sharp from 'sharp';

export interface ProcessedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: 'image/webp';
  fileSizeBytes: number;
  checksumSha256: string;
}

export interface ImageProcessingOptions {
  maxDimension?: number;
  quality?: number;
  minDimension?: number;
}

const DEFAULT_MAX_DIMENSION = 1536; // Pristine resolution suitable for high-fidelity try-on models
const DEFAULT_MIN_DIMENSION = 128;
const DEFAULT_QUALITY = 90;

export class ImagePreprocessingError extends Error {
  constructor(message: string, public readonly code: string = 'IMAGE_PREPROCESSING_FAILED') {
    super(message);
    this.name = 'ImagePreprocessingError';
  }
}

export class ImageService {
  /**
   * Validate magic bytes and format of an incoming raw buffer.
   */
  async validateImage(buffer: Buffer): Promise<sharp.Metadata> {
    if (!buffer || buffer.length === 0) {
      throw new ImagePreprocessingError('Empty image buffer provided', 'EMPTY_IMAGE');
    }

    try {
      const metadata = await sharp(buffer).metadata();
      const validFormats = ['jpeg', 'png', 'webp'];
      if (!metadata.format || !validFormats.includes(metadata.format)) {
        throw new ImagePreprocessingError(
          `Unsupported image format: ${metadata.format || 'unknown'}. Allowed: JPEG, PNG, WebP.`,
          'UNSUPPORTED_FORMAT'
        );
      }

      if (!metadata.width || !metadata.height) {
        throw new ImagePreprocessingError('Unable to determine image dimensions', 'INVALID_DIMENSIONS');
      }

      return metadata;
    } catch (err) {
      if (err instanceof ImagePreprocessingError) throw err;
      throw new ImagePreprocessingError('Malformed or corrupt image binary', 'CORRUPT_IMAGE');
    }
  }

  /**
   * Normalize, orient, strip EXIF metadata, clamp dimensions and encode to WebP.
   */
  async preprocessImage(buffer: Buffer, options: ImageProcessingOptions = {}): Promise<ProcessedImageResult> {
    const metadata = await this.validateImage(buffer);

    const maxDim = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    const minDim = options.minDimension ?? DEFAULT_MIN_DIMENSION;
    const quality = options.quality ?? DEFAULT_QUALITY;

    const width = metadata.width!;
    const height = metadata.height!;

    if (width < minDim || height < minDim) {
      throw new ImagePreprocessingError(
        `Image dimensions (${width}x${height}) are too small. Minimum required: ${minDim}x${minDim}px.`,
        'DIMENSIONS_TOO_SMALL'
      );
    }

    // Auto-orient based on EXIF tag, then strip all metadata for privacy
    let pipeline = sharp(buffer).rotate();

    // Resize only if image exceeds max allowed dimension
    if (width > maxDim || height > maxDim) {
      pipeline = pipeline.resize({
        width: width > height ? maxDim : undefined,
        height: height >= width ? maxDim : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to high-quality WebP with stripped metadata
    const processedBuffer = await pipeline
      .webp({ quality, effort: 4 })
      .toBuffer();

    const outputMetadata = await sharp(processedBuffer).metadata();
    const finalWidth = outputMetadata.width || width;
    const finalHeight = outputMetadata.height || height;

    const checksumSha256 = crypto.createHash('sha256').update(processedBuffer).digest('hex');

    return {
      buffer: processedBuffer,
      width: finalWidth,
      height: finalHeight,
      mimeType: 'image/webp',
      fileSizeBytes: processedBuffer.length,
      checksumSha256,
    };
  }
}

export const imageService = new ImageService();
