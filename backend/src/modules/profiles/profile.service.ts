import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { storageService } from '../../services/storage.service.js';
import { imageService } from '../../services/image.service.js';
import {
  ProductCategory,
  ProfilePhotoType,
  CATEGORY_METADATA_MAP,
  CategoryMetadata,
} from '@vton/shared';
import {
  CreateProfileInput,
  UpdateProfileInput,
  UploadAssetBodyInput,
} from './profile.dto.js';
import { logger } from '../../utils/logger.js';

export class ProfileError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PROFILE_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}

export interface CategoryReadinessResult {
  category: ProductCategory;
  displayName: string;
  ready: boolean;
  activePhotoType: ProfilePhotoType | null;
  requiredPhotoType: ProfilePhotoType;
  fallbackPhotoType: ProfilePhotoType;
  missingAssets: ProfilePhotoType[];
  recommendedAssets: ProfilePhotoType[];
}

export interface ProfileCompletenessResult {
  overallPercentage: number;
  availablePhotoTypes: ProfilePhotoType[];
  supportedCategories: ProductCategory[];
  categoryReadiness: Record<ProductCategory, CategoryReadinessResult>;
}

export interface SanitizedProfileImage {
  id: string;
  profileId: string;
  photoType: ProfilePhotoType;
  presignedUrl: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  createdAt: string;
}

export interface SanitizedProfile {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  measurements: Record<string, number> | null;
  images: SanitizedProfileImage[];
  completeness: ProfileCompletenessResult;
  createdAt: string;
  updatedAt: string;
}

export class ProfileService {
  /**
   * Get default or specified digital profile for a user with pre-signed photo access URLs.
   */
  async getProfile(userId: string, profileId?: string): Promise<SanitizedProfile> {
    const profile = await prisma.digitalProfile.findFirst({
      where: profileId ? { id: profileId, userId } : { userId, isDefault: true },
      include: {
        images: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new ProfileError('Digital profile not found.', 'PROFILE_NOT_FOUND', 404);
    }

    return await this.sanitizeProfile(profile);
  }

  /**
   * Create a new digital profile for a user.
   */
  async createProfile(userId: string, input: CreateProfileInput): Promise<SanitizedProfile> {
    if (input.isDefault) {
      await prisma.digitalProfile.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.digitalProfile.create({
      data: {
        userId,
        name: input.name,
        isDefault: input.isDefault,
        measurements: input.measurements ? JSON.parse(JSON.stringify(input.measurements)) : undefined,
      },
      include: { images: true },
    });

    logger.info({ userId, profileId: profile.id }, 'Digital profile created');
    return await this.sanitizeProfile(profile);
  }

  /**
   * Update profile metadata (name, measurements, default status).
   */
  async updateProfile(userId: string, input: UpdateProfileInput, profileId?: string): Promise<SanitizedProfile> {
    const existing = await prisma.digitalProfile.findFirst({
      where: profileId ? { id: profileId, userId } : { userId, isDefault: true },
    });

    if (!existing) {
      throw new ProfileError('Digital profile not found.', 'PROFILE_NOT_FOUND', 404);
    }

    if (input.isDefault) {
      await prisma.digitalProfile.updateMany({
        where: { userId, isDefault: true, id: { not: existing.id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.digitalProfile.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? existing.name,
        isDefault: input.isDefault ?? existing.isDefault,
        measurements: input.measurements ? JSON.parse(JSON.stringify(input.measurements)) : existing.measurements,
      },
      include: { images: true },
    });

    logger.info({ userId, profileId: updated.id }, 'Digital profile updated');
    return await this.sanitizeProfile(updated);
  }

  /**
   * Upload and process a profile image asset.
   */
  async uploadProfileAsset(
    userId: string,
    fileBuffer: Buffer,
    input: UploadAssetBodyInput
  ): Promise<SanitizedProfileImage> {
    // 1. Verify profile ownership
    const profile = await prisma.digitalProfile.findFirst({
      where: input.profileId ? { id: input.profileId, userId } : { userId, isDefault: true },
    });

    if (!profile) {
      throw new ProfileError('Target digital profile not found.', 'PROFILE_NOT_FOUND', 404);
    }

    // 2. Preprocess image with Sharp (rotate, clamp dimension, convert to WebP, compute SHA256)
    const processed = await imageService.preprocessImage(fileBuffer);

    // 3. Generate safe, non-traversable object storage key
    const uniqueId = crypto.randomUUID();
    const storageKey = `profiles/${userId}/${profile.id}/${input.photoType}_${uniqueId}.webp`;

    // 4. Upload to private object storage
    await storageService.upload({
      key: storageKey,
      body: processed.buffer,
      contentType: processed.mimeType,
      metadata: {
        userId,
        profileId: profile.id,
        photoType: input.photoType,
        checksumSha256: processed.checksumSha256,
      },
    });

    // 5. Persist record in database
    const profileImage = await prisma.profileImage.create({
      data: {
        profileId: profile.id,
        photoType: input.photoType as any,
        storageKey,
        mimeType: processed.mimeType,
        width: processed.width,
        height: processed.height,
        fileSizeBytes: processed.fileSizeBytes,
        checksumSha256: processed.checksumSha256,
      },
    });

    logger.info(
      { userId, profileId: profile.id, imageId: profileImage.id, photoType: input.photoType },
      'Profile asset uploaded and processed successfully'
    );

    // 6. Generate time-limited pre-signed URL for immediate frontend preview
    const presignedUrl = await storageService.generatePrivateAccessUrl(storageKey, 900);

    return {
      id: profileImage.id,
      profileId: profileImage.profileId,
      photoType: profileImage.photoType as ProfilePhotoType,
      presignedUrl,
      width: profileImage.width,
      height: profileImage.height,
      fileSizeBytes: profileImage.fileSizeBytes,
      createdAt: profileImage.createdAt.toISOString(),
    };
  }

  /**
   * Get all assets for user's profile with pre-signed URLs.
   */
  async getProfileAssets(userId: string, profileId?: string): Promise<SanitizedProfileImage[]> {
    const profile = await prisma.digitalProfile.findFirst({
      where: profileId ? { id: profileId, userId } : { userId, isDefault: true },
      include: { images: { orderBy: { createdAt: 'desc' } } },
    });

    if (!profile) {
      throw new ProfileError('Digital profile not found.', 'PROFILE_NOT_FOUND', 404);
    }

    return await Promise.all(
      profile.images.map(async (img) => ({
        id: img.id,
        profileId: img.profileId,
        photoType: img.photoType as ProfilePhotoType,
        presignedUrl: await storageService.generatePrivateAccessUrl(img.storageKey, 900),
        width: img.width,
        height: img.height,
        fileSizeBytes: img.fileSizeBytes,
        createdAt: img.createdAt.toISOString(),
      }))
    );
  }

  /**
   * Delete an individual profile asset from both database and private storage.
   */
  async deleteProfileAsset(userId: string, assetId: string): Promise<void> {
    const image = await prisma.profileImage.findUnique({
      where: { id: assetId },
      include: { profile: true },
    });

    if (!image || image.profile.userId !== userId) {
      throw new ProfileError('Profile asset not found.', 'ASSET_NOT_FOUND', 404);
    }

    // 1. Delete from private storage
    try {
      await storageService.delete(image.storageKey);
    } catch (err) {
      logger.error({ err, storageKey: image.storageKey }, 'Failed to delete S3 object; continuing DB removal');
    }

    // 2. Delete from database
    await prisma.profileImage.delete({ where: { id: assetId } });
    logger.info({ userId, assetId }, 'Profile asset deleted successfully');
  }

  /**
   * Delete entire profile, cascading DB records and purging all S3 objects under the profile prefix.
   */
  async deleteProfile(userId: string, profileId?: string): Promise<void> {
    const profile = await prisma.digitalProfile.findFirst({
      where: profileId ? { id: profileId, userId } : { userId, isDefault: true },
      include: { images: true },
    });

    if (!profile) {
      throw new ProfileError('Digital profile not found.', 'PROFILE_NOT_FOUND', 404);
    }

    // 1. Purge all images in S3 under this profile's folder prefix
    const prefix = `profiles/${userId}/${profile.id}/`;
    try {
      const purged = await storageService.deletePrefix(prefix);
      logger.info({ userId, profileId: profile.id, purgedCount: purged }, 'Purged S3 profile assets prefix');
    } catch (err) {
      logger.error({ err, prefix }, 'Error purging S3 prefix during profile deletion');
    }

    // 2. Delete profile from database (Prisma onDelete: Cascade removes profile images)
    await prisma.digitalProfile.delete({ where: { id: profile.id } });
    logger.info({ userId, profileId: profile.id }, 'Digital profile deleted from database');
  }

  /**
   * Check category readiness for a specific product category.
   */
  evaluateCategoryReadiness(
    availablePhotoTypes: ProfilePhotoType[],
    category: ProductCategory
  ): CategoryReadinessResult {
    const metadata: CategoryMetadata = CATEGORY_METADATA_MAP[category];
    const hasRequired = availablePhotoTypes.includes(metadata.requiredProfilePhoto);
    const hasFallback = availablePhotoTypes.includes(metadata.fallbackProfilePhoto);

    if (hasRequired) {
      return {
        category,
        displayName: metadata.displayName,
        ready: true,
        activePhotoType: metadata.requiredProfilePhoto,
        requiredPhotoType: metadata.requiredProfilePhoto,
        fallbackPhotoType: metadata.fallbackProfilePhoto,
        missingAssets: [],
        recommendedAssets: [],
      };
    }

    if (hasFallback) {
      return {
        category,
        displayName: metadata.displayName,
        ready: true,
        activePhotoType: metadata.fallbackProfilePhoto,
        requiredPhotoType: metadata.requiredProfilePhoto,
        fallbackPhotoType: metadata.fallbackProfilePhoto,
        missingAssets: [],
        recommendedAssets: [metadata.requiredProfilePhoto],
      };
    }

    return {
      category,
      displayName: metadata.displayName,
      ready: false,
      activePhotoType: null,
      requiredPhotoType: metadata.requiredProfilePhoto,
      fallbackPhotoType: metadata.fallbackProfilePhoto,
      missingAssets: [metadata.requiredProfilePhoto],
      recommendedAssets:
        metadata.fallbackProfilePhoto !== metadata.requiredProfilePhoto
          ? [metadata.fallbackProfilePhoto]
          : [],
    };
  }

  /**
   * Calculate overall profile completeness and readiness across all categories.
   */
  evaluateProfileCompleteness(availablePhotoTypes: ProfilePhotoType[]): ProfileCompletenessResult {
    const categoryReadiness = {} as Record<ProductCategory, CategoryReadinessResult>;
    const supportedCategories: ProductCategory[] = [];

    const allCategories = Object.values(ProductCategory);
    for (const cat of allCategories) {
      const readiness = this.evaluateCategoryReadiness(availablePhotoTypes, cat);
      categoryReadiness[cat] = readiness;
      if (readiness.ready) {
        supportedCategories.push(cat);
      }
    }

    // Completeness percentage based on distinct photo types uploaded (5 core photo types)
    const corePhotoTypes: ProfilePhotoType[] = [
      'FRONT_FULL_BODY',
      'UPPER_BODY',
      'LOWER_BODY',
      'FEET',
      'FACE',
    ];

    const presentCore = corePhotoTypes.filter((t) => availablePhotoTypes.includes(t)).length;
    const overallPercentage = Math.round((presentCore / corePhotoTypes.length) * 100);

    return {
      overallPercentage,
      availablePhotoTypes,
      supportedCategories,
      categoryReadiness,
    };
  }

  private async sanitizeProfile(
    profile: {
      id: string;
      userId: string;
      name: string;
      isDefault: boolean;
      measurements: any;
      images: Array<{
        id: string;
        profileId: string;
        photoType: string;
        storageKey: string;
        width: number;
        height: number;
        fileSizeBytes: number;
        createdAt: Date;
      }>;
      createdAt: Date;
      updatedAt: Date;
    }
  ): Promise<SanitizedProfile> {
    const availablePhotoTypes = profile.images.map((img) => img.photoType as ProfilePhotoType);
    const completeness = this.evaluateProfileCompleteness(availablePhotoTypes);

    const images: SanitizedProfileImage[] = await Promise.all(
      profile.images.map(async (img) => ({
        id: img.id,
        profileId: img.profileId,
        photoType: img.photoType as ProfilePhotoType,
        presignedUrl: await storageService.generatePrivateAccessUrl(img.storageKey, 900),
        width: img.width,
        height: img.height,
        fileSizeBytes: img.fileSizeBytes,
        createdAt: img.createdAt.toISOString(),
      }))
    );

    return {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      isDefault: profile.isDefault,
      measurements: profile.measurements,
      images,
      completeness,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}

export const profileService = new ProfileService();
