import { ProductCategory, ProfilePhotoType } from './category.js';
import { GenerationMode, TryOnJobStatus } from './job.js';
import { NormalizedProduct, ProductImageCandidate } from './product.js';

export interface UserSummary {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  consentTraining: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: UserSummary;
  tokens: AuthTokens;
}

export interface CreateTryOnJobRequest {
  profileId: string;
  productId?: string;
  selectedImageUrl: string;
  category: ProductCategory;
  generationMode: GenerationMode;
  contextEnvironment?: string;
}

export interface CreateTryOnJobResponse {
  jobId: string;
  status: TryOnJobStatus;
  estimatedLatencySeconds: number;
  statusUrl: string;
  createdAt: string;
}

export interface NormalizeProductRequest {
  sourceDomain: string;
  sourceUrl: string;
  title: string;
  category?: ProductCategory;
  brand?: string;
  price?: number;
  currency?: string;
  images: ProductImageCandidate[];
}

export interface NormalizeProductResponse {
  productId: string;
  category: ProductCategory;
  recommendedPhotoType: ProfilePhotoType;
  sanitizedProduct: NormalizedProduct;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
