import sharp from 'sharp';
import { TryOnProvider, TryOnInput, TryOnOutput, ProviderHealth } from './provider.interface.js';
import { ProductCategory, GenerationMode } from '@vton/shared';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export class FashnProvider implements TryOnProvider {
  public readonly name = 'FASHN';

  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = env.FASHN_API_KEY || '';
    this.apiUrl = env.FASHN_API_URL || 'https://api.fashn.ai/v1';
  }

  async checkHealth(): Promise<ProviderHealth> {
    if (!this.apiKey) {
      return { status: 'down', error: 'FASHN_API_KEY is not configured.' };
    }
    const start = Date.now();
    try {
      // Light check to api.fashn.ai
      const res = await fetch(`${this.apiUrl}/status/health-probe`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      // 404 or 200 confirms server and auth reachability
      return { status: res.status !== 401 ? 'up' : 'down', latencyMs: Date.now() - start };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fashn API unreachable';
      return { status: 'down', error: msg };
    }
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnOutput> {
    if (!this.apiKey) {
      throw new Error('FASHN_API_KEY is not configured on the server.');
    }

    const startTime = Date.now();
    logger.info(
      { jobId: input.jobId, category: input.category, mode: input.generationMode, model: env.FASHN_MODEL },
      '[FashnProvider] Submitting try-on prediction request to FASHN.ai'
    );

    // 1. Category validation & routing
    // FASHN Try-On models are specialized apparel models (tops, bottoms, one-pieces).
    // Accessories, shoes, and jewellery are not supported by the garment inpainting engine.
    let fashnCategory: 'tops' | 'bottoms' | 'one-pieces';
    switch (input.category) {
      case ProductCategory.TOPS:
      case ProductCategory.SHIRTS:
      case ProductCategory.JACKETS:
        fashnCategory = 'tops';
        break;
      case ProductCategory.PANTS:
        fashnCategory = 'bottoms';
        break;
      case ProductCategory.DRESSES:
        fashnCategory = 'one-pieces';
        break;
      default:
        throw new Error(
          `Virtual try-on for category '${input.category}' is not supported by the FASHN AI engine. Supported categories: Tops, Shirts, Jackets, Pants, and Dresses.`
        );
    }

    // 2. Map internal generation mode to FASHN mode
    // FAST -> 'performance' (~7s inference)
    // STANDARD -> 'balanced' (~15s inference)
    // HIGH_QUALITY / CONTEXT_AWARE -> 'quality' (~30s+ maximum fidelity)
    let fashnMode: 'performance' | 'balanced' | 'quality' = 'balanced';
    if (input.generationMode === GenerationMode.FAST) {
      fashnMode = 'performance';
    } else if (
      input.generationMode === GenerationMode.HIGH_QUALITY ||
      input.generationMode === GenerationMode.CONTEXT_AWARE
    ) {
      fashnMode = 'quality';
    }

    // 3. Format inputs as Base64 Data URIs
    const modelDataUri = `data:image/webp;base64,${input.profileImageBuffer.toString('base64')}`;
    const garmentDataUri = `data:image/webp;base64,${input.garmentImageBuffer.toString('base64')}`;

    // 4. Construct payload according to official FASHN API specs (supporting tryon-max)
    const requestPayload = {
      model_name: env.FASHN_MODEL || 'tryon-max',
      inputs: {
        model_image: modelDataUri,
        garment_image: garmentDataUri,
        category: fashnCategory,
        mode: fashnMode,
        nsfw_filter: true,
        cover_feet: false,
        adjust_hands: true,
        restore_background: true,
      },
      // Top-level fallbacks for universal v1 endpoint compatibility
      model_image: modelDataUri,
      garment_image: garmentDataUri,
      category: fashnCategory,
      mode: fashnMode,
      nsfw_filter: true,
      cover_feet: false,
      adjust_hands: true,
      restore_background: true,
    };

    const runResponse = await fetch(`${this.apiUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(30000),
    });

    if (!runResponse.ok) {
      const errText = await runResponse.text().catch(() => '');
      logger.error({ status: runResponse.status, errText }, '[FashnProvider] API run submission failed');
      throw new Error(`FASHN API error (${runResponse.status}): ${errText.slice(0, 200)}`);
    }

    const runData = (await runResponse.json()) as { id: string; status: string; error?: string };
    const fashnJobId = runData.id;

    logger.info({ jobId: input.jobId, fashnJobId }, '[FashnProvider] Job queued on FASHN. Polling status...');

    // 5. Poll for completion with bounded timeout and adaptive backoff
    let status = runData.status;
    let outputUrl: string | null = null;
    const maxPollSeconds = env.FASHN_TIMEOUT_SECONDS || 90;
    const pollStart = Date.now();
    let pollIntervalMs = 2000;

    while ((Date.now() - pollStart) / 1000 < maxPollSeconds) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      pollIntervalMs = Math.min(5000, pollIntervalMs + 500); // Adaptive backoff

      const statusRes = await fetch(`${this.apiUrl}/status/${fashnJobId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!statusRes.ok) {
        continue;
      }

      const statusData = (await statusRes.json()) as {
        status: string;
        output?: string[];
        error?: string;
      };

      status = statusData.status;

      if (status === 'completed' && statusData.output && statusData.output.length > 0) {
        outputUrl = statusData.output[0] ?? null;
        break;
      }

      if (status === 'failed') {
        throw new Error(`FASHN virtual try-on failed: ${statusData.error || 'Generation error'}`);
      }
    }

    if (!outputUrl) {
      throw new Error(`FASHN virtual try-on timed out after ${maxPollSeconds}s waiting for provider output.`);
    }

    // 6. Download the generated result image
    const imageResponse = await fetch(outputUrl, {
      signal: AbortSignal.timeout(20000),
    });

    if (!imageResponse.ok) {
      throw new Error(`Failed to download output image from FASHN (HTTP ${imageResponse.status})`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const rawOutputBuffer = Buffer.from(arrayBuffer);

    // Normalize to WebP ($1024\times 1024$ quality 90)
    const webpBuffer = await sharp(rawOutputBuffer).webp({ quality: 90 }).toBuffer();
    const meta = await sharp(webpBuffer).metadata();

    const latencyMs = Date.now() - startTime;
    return {
      imageBuffer: webpBuffer,
      width: meta.width || 1024,
      height: meta.height || 1024,
      mimeType: 'image/webp',
      providerJobId: fashnJobId,
      providerName: this.name,
      latencyMs,
      metadata: {
        category: fashnCategory,
        mode: fashnMode,
        model: env.FASHN_MODEL || 'tryon-max',
      },
    };
  }
}
