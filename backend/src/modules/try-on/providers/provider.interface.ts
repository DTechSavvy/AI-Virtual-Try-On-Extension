import { ProductCategory, GenerationMode } from '@vton/shared';

export interface TryOnInput {
  jobId: string;
  userId: string;
  profileImageBuffer: Buffer;
  garmentImageBuffer: Buffer;
  garmentImageUrl?: string;
  category: ProductCategory;
  generationMode: GenerationMode;
  targetBodyRegion: string;
  contextEnvironment?: string;
  productTitle?: string;
}

export interface TryOnOutput {
  imageBuffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
  providerJobId?: string;
  providerName: string;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface TryOnProvider {
  readonly name: string;
  generateTryOn(input: TryOnInput): Promise<TryOnOutput>;
  checkHealth(): Promise<ProviderHealth>;
}
