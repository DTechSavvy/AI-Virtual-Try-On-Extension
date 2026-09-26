import { ProductCategory } from './category.js';

export type ImageViewAngle = 'FRONT' | 'BACK' | 'SIDE' | 'DETAIL' | 'FLAT_LAY' | 'UNKNOWN';

export interface ProductImageCandidate {
  id: string;
  url: string;
  width?: number;
  height?: number;
  altText?: string;
  isPrimary: boolean;
  score: number;
  viewAngle?: ImageViewAngle;
}

export interface ProductVariant {
  id: string;
  name: string;
  color?: string;
  size?: string;
  sku?: string;
  price?: number;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface NormalizedProduct {
  id: string;
  sourceDomain: string;
  sourceUrl: string;
  title: string;
  description?: string;
  category: ProductCategory;
  userOverriddenCategory?: ProductCategory;
  brand?: string;
  price?: number;
  currency?: string;
  images: ProductImageCandidate[];
  selectedImageId: string;
  variants: ProductVariant[];
  selectedVariantId?: string;
  detectionConfidence: number;
  metadata: Record<string, unknown>;
  extractedAt: string;
}
