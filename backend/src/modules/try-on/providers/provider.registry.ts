import { TryOnProvider, ProviderHealth } from './provider.interface.js';
import { MockTryOnProvider } from './mock.provider.js';
import { FashnProvider } from './fashn.provider.js';
import { ReplicateProvider } from './replicate.provider.js';
import { IdmVtonProvider } from './idm-vton.provider.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export class ProviderRegistry {
  private providers: Map<string, TryOnProvider> = new Map();
  private activeProviderName: string;

  constructor() {
    const mock = new MockTryOnProvider();
    const fashn = new FashnProvider();
    const replicate = new ReplicateProvider();
    const idmVton = new IdmVtonProvider();

    this.register(mock);
    this.register(fashn);
    this.register(replicate);
    this.register(idmVton);

    this.activeProviderName = env.AI_PROVIDER;

    // Strict Production Safeguards:
    // In production, do NOT silently fall back to MOCK. Misconfiguration must fail visibly.
    const isProduction = env.NODE_ENV === 'production';

    if (isProduction) {
      if (this.activeProviderName === 'MOCK') {
        logger.error('[ProviderRegistry] Critical error: AI_PROVIDER cannot be set to MOCK in production.');
        throw new Error('Production misconfiguration: AI_PROVIDER cannot be set to MOCK in production. Set AI_PROVIDER=FASHN with valid FASHN_API_KEY.');
      }
      if (this.activeProviderName === 'FASHN' && !env.FASHN_API_KEY) {
        logger.error('[ProviderRegistry] Critical error: FASHN selected in production but FASHN_API_KEY is missing.');
        throw new Error('Production misconfiguration: FASHN_API_KEY is required when AI_PROVIDER is set to FASHN.');
      }
      if (this.activeProviderName === 'REPLICATE' && !env.REPLICATE_API_TOKEN) {
        logger.error('[ProviderRegistry] Critical error: REPLICATE selected in production but REPLICATE_API_TOKEN is missing.');
        throw new Error('Production misconfiguration: REPLICATE_API_TOKEN is required when AI_PROVIDER is set to REPLICATE.');
      }
    } else {
      // In development / test: Allow MOCK fallback with clear warning if external keys are missing
      if (this.activeProviderName === 'FASHN' && !env.FASHN_API_KEY) {
        logger.warn('[ProviderRegistry] Development notice: FASHN selected but FASHN_API_KEY is not set. Defaulting to MOCK provider for local testing.');
        this.activeProviderName = 'MOCK';
      } else if (this.activeProviderName === 'REPLICATE' && !env.REPLICATE_API_TOKEN) {
        logger.warn('[ProviderRegistry] Development notice: REPLICATE selected but REPLICATE_API_TOKEN is not set. Defaulting to MOCK provider for local testing.');
        this.activeProviderName = 'MOCK';
      }
    }

    logger.info({ activeProvider: this.activeProviderName, isProduction }, '[ProviderRegistry] Active AI Provider initialized');
  }

  public register(provider: TryOnProvider): void {
    this.providers.set(provider.name.toUpperCase(), provider);
  }

  public getActiveProvider(): TryOnProvider {
    const provider = this.providers.get(this.activeProviderName.toUpperCase());
    if (!provider) {
      if (env.NODE_ENV === 'production') {
        throw new Error(`Production error: Configured AI provider '${this.activeProviderName}' is not registered.`);
      }
      logger.warn(
        { requested: this.activeProviderName },
        '[ProviderRegistry] Provider not found, falling back to MOCK in development'
      );
      return this.providers.get('MOCK')!;
    }
    return provider;
  }

  public getProvider(name: string): TryOnProvider | undefined {
    return this.providers.get(name.toUpperCase());
  }

  public async checkActiveProviderHealth(): Promise<ProviderHealth & { provider: string }> {
    const provider = this.getActiveProvider();
    const health = await provider.checkHealth();
    return {
      provider: provider.name,
      ...health,
    };
  }
}

export const providerRegistry = new ProviderRegistry();
