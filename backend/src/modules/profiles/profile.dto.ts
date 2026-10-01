import { z } from 'zod';
import { ProductCategory } from '@vton/shared';

export const photoTypeEnum = z.enum([
  'FRONT_FULL_BODY',
  'UPPER_BODY',
  'LOWER_BODY',
  'FEET',
  'FACE',
  'ADDITIONAL',
]);

export const productCategoryEnum = z.nativeEnum(ProductCategory);

export const measurementsSchema = z.object({
  heightCm: z.number().min(50).max(250).optional(),
  chestCm: z.number().min(30).max(200).optional(),
  waistCm: z.number().min(30).max(200).optional(),
  hipsCm: z.number().min(30).max(200).optional(),
});

export const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).default('Default Profile'),
  isDefault: z.boolean().default(true),
  measurements: measurementsSchema.optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  measurements: measurementsSchema.optional(),
});

export const uploadAssetBodySchema = z.object({
  photoType: photoTypeEnum,
  profileId: z.string().uuid().optional(),
});

export const categoryReadinessParamsSchema = z.object({
  category: productCategoryEnum,
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UploadAssetBodyInput = z.infer<typeof uploadAssetBodySchema>;
export type CategoryReadinessParams = z.infer<typeof categoryReadinessParamsSchema>;
