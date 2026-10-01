import { z } from 'zod';
import { ProductCategory } from '@vton/shared';

export const productImageCandidateSchema = z.object({
  id: z.string().optional(),
  url: z.string().url('Invalid image URL'),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  altText: z.string().optional(),
  isPrimary: z.boolean().default(false),
  score: z.number().min(0).max(1).default(0.5),
  viewAngle: z.enum(['FRONT', 'BACK', 'SIDE', 'DETAIL', 'FLAT_LAY', 'UNKNOWN']).optional(),
});

export const normalizeProductSchema = z.object({
  sourceDomain: z.string().min(1, 'Source domain is required'),
  sourceUrl: z.string().url('Invalid source URL'),
  title: z.string().min(1, 'Product title is required'),
  category: z.nativeEnum(ProductCategory).optional(),
  brand: z.string().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  description: z.string().optional(),
  images: z.array(productImageCandidateSchema).min(1, 'At least one product image is required'),
});

export type NormalizeProductInput = z.infer<typeof normalizeProductSchema>;
