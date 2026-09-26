import { ProductCategory } from './category.js';

export enum TryOnJobStatus {
  CREATED = 'CREATED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum GenerationMode {
  FAST = 'FAST',
  STANDARD = 'STANDARD',
  HIGH_QUALITY = 'HIGH_QUALITY',
  CONTEXT_AWARE = 'CONTEXT_AWARE',
}

export interface TryOnJob {
  id: string;
  userId: string;
  profileId: string;
  productId: string;
  category: ProductCategory;
  status: TryOnJobStatus;
  generationMode: GenerationMode;
  providerUsed?: string;
  progressPercent: number;
  currentStage?: string;
  errorCode?: string;
  errorMessage?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface TryOnResult {
  id: string;
  jobId: string;
  userId: string;
  imageUrl: string;
  width: number;
  height: number;
  latencyMs: number;
  productTitle?: string;
  category?: ProductCategory;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
