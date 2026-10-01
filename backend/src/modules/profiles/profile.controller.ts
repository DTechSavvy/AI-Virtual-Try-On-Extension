import { Request, Response, NextFunction } from 'express';
import { profileService, ProfileError } from './profile.service.js';
import {
  CreateProfileInput,
  UpdateProfileInput,
  UploadAssetBodyInput,
} from './profile.dto.js';
import { ProductCategory } from '@vton/shared';

export class ProfileController {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await profileService.getProfile(userId);
      res.status(200).json({
        success: true,
        data: { profile },
      });
    } catch (err) {
      next(err);
    }
  }

  async createProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const input: CreateProfileInput = req.body;
      const profile = await profileService.createProfile(userId, input);
      res.status(201).json({
        success: true,
        data: { profile },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const input: UpdateProfileInput = req.body;
      const profile = await profileService.updateProfile(userId, input);
      res.status(200).json({
        success: true,
        data: { profile },
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await profileService.deleteProfile(userId);
      res.status(200).json({
        success: true,
        message: 'Digital profile and all associated assets deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  async uploadAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      if (!req.file || !req.file.buffer) {
        throw new ProfileError('No image file provided in multipart form-data (field "file").', 'MISSING_FILE', 400);
      }

      const input: UploadAssetBodyInput = req.body;
      const asset = await profileService.uploadProfileAsset(userId, req.file.buffer, input);

      res.status(201).json({
        success: true,
        data: { asset },
      });
    } catch (err) {
      next(err);
    }
  }

  async getAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const assets = await profileService.getProfileAssets(userId);
      res.status(200).json({
        success: true,
        data: { assets },
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const rawAssetId = req.params.id;
      const assetId = Array.isArray(rawAssetId) ? rawAssetId[0] : rawAssetId;
      if (!assetId) {
        throw new ProfileError('Asset ID parameter is required.', 'MISSING_PARAM', 400);
      }

      await profileService.deleteProfileAsset(userId, assetId);
      res.status(200).json({
        success: true,
        message: 'Profile asset deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  async getCategoryReadiness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const rawCategory = req.params.category;
      const categoryStr = (Array.isArray(rawCategory) ? rawCategory[0] : rawCategory)?.toUpperCase() as ProductCategory;
      if (!categoryStr || !Object.values(ProductCategory).includes(categoryStr)) {
        throw new ProfileError(`Invalid product category: ${rawCategory}`, 'INVALID_CATEGORY', 400);
      }

      const profile = await profileService.getProfile(userId);
      const availableTypes = profile.images.map((img) => img.photoType);
      const readiness = profileService.evaluateCategoryReadiness(availableTypes, categoryStr);

      res.status(200).json({
        success: true,
        data: { readiness },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const profileController = new ProfileController();
