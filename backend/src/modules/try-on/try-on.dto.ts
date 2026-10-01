import { z } from 'zod';
import { ProductCategory, GenerationMode } from '@vton/shared';

export const createTryOnJobSchema = z.object({
  profileId: z.string().uuid().optional(),
  productId: z.string().optional(),
  selectedImageUrl: z.string().min(1, 'Product image URL is required'),
  category: z.nativeEnum(ProductCategory),
  generationMode: z.nativeEnum(GenerationMode).default(GenerationMode.STANDARD),
  contextEnvironment: z.string().max(100).optional(),
  productTitle: z.string().max(300).optional(),
  sourceUrl: z.string().optional(),
  sourceDomain: z.string().max(200).optional(),
  price: z.number().optional(),
  currency: z.string().max(10).optional(),
  brand: z.string().max(100).optional(),
});

export type CreateTryOnJobInput = z.infer<typeof createTryOnJobSchema>;

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
