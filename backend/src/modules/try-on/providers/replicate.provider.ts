import sharp from 'sharp';
import { TryOnProvider, TryOnInput, TryOnOutput, ProviderHealth } from './provider.interface.js';
import { ProductCategory } from '@vton/shared';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export class ReplicateProvider implements TryOnProvider {
  public readonly name = 'REPLICATE';

  private readonly apiToken: string;
  private readonly modelVersion = 'c871d2c9f35959972b20fec382a98343de0409e233477380f96e40f92a4365c7'; // IDM-VTON

  constructor() {
    this.apiToken = env.REPLICATE_API_TOKEN || '';
  }

  async checkHealth(): Promise<ProviderHealth> {
    if (!this.apiToken) {
      return { status: 'down', error: 'REPLICATE_API_TOKEN is not configured.' };
    }
    const start = Date.now();
    try {
      const res = await fetch('https://api.replicate.com/v1/models/yisol/idm-vton', {
        headers: { Authorization: `Token ${this.apiToken}` },
        signal: AbortSignal.timeout(5000),
      });
      return { status: res.ok ? 'up' : 'down', latencyMs: Date.now() - start };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Replicate API error';
      return { status: 'down', error: msg };
    }
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnOutput> {
    if (!this.apiToken) {
      throw new Error('REPLICATE_API_TOKEN is not configured on the server.');
    }

    const startTime = Date.now();
    logger.info(
      { jobId: input.jobId, category: input.category },
      '[ReplicateProvider] Submitting prediction to Replicate IDM-VTON'
    );

    // 1. Map internal category to IDM-VTON category (upper_body, lower_body, dresses)
    let replicateCategory: 'upper_body' | 'lower_body' | 'dresses';
    switch (input.category) {
      case ProductCategory.TOPS:
      case ProductCategory.SHIRTS:
      case ProductCategory.JACKETS:
        replicateCategory = 'upper_body';
        break;
      case ProductCategory.PANTS:
        replicateCategory = 'lower_body';
        break;
      case ProductCategory.DRESSES:
        replicateCategory = 'dresses';
        break;
      default:
        throw new Error(
          `Virtual try-on for category '${input.category}' is not supported by the Replicate IDM-VTON model. Supported categories: Tops, Shirts, Jackets, Pants, and Dresses.`
        );
    }

    // 2. Prepare Data URIs
    const humanImg = `data:image/webp;base64,${input.profileImageBuffer.toString('base64')}`;
    const garmImg = `data:image/webp;base64,${input.garmentImageBuffer.toString('base64')}`;

    // 3. Create prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.apiToken}`,
      },
      body: JSON.stringify({
        version: this.modelVersion,
        input: {
          human_img: humanImg,
          garm_img: garmImg,
          garment_des: input.productTitle || input.category,
          category: replicateCategory,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      throw new Error(`Replicate API error (${createRes.status}): ${errText.slice(0, 200)}`);
    }

    const prediction = (await createRes.json()) as { id: string; status: string; urls?: { get: string } };
    const predictionId = prediction.id;

    // 4. Poll prediction
    const maxPollAttempts = 45;
    let finalOutputUrl: string | null = null;

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${this.apiToken}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!pollRes.ok) continue;

      const pollData = (await pollRes.json()) as {
        status: string;
        output?: string | string[];
        error?: string;
      };

      if (pollData.status === 'succeeded' && pollData.output) {
        finalOutputUrl = (Array.isArray(pollData.output) ? pollData.output[0] : pollData.output) ?? null;
        break;
      }

      if (pollData.status === 'failed' || pollData.status === 'canceled') {
        throw new Error(`Replicate generation failed: ${pollData.error || pollData.status}`);
      }
    }

    if (!finalOutputUrl) {
      throw new Error('Replicate virtual try-on timed out waiting for prediction output.');
    }

    // 5. Download image
    const imgRes = await fetch(finalOutputUrl, { signal: AbortSignal.timeout(20000) });
    if (!imgRes.ok) {
      throw new Error(`Failed to download output image from Replicate (${imgRes.status})`);
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const webpBuffer = await sharp(Buffer.from(arrayBuffer)).webp({ quality: 90 }).toBuffer();
    const meta = await sharp(webpBuffer).metadata();

    const latencyMs = Date.now() - startTime;
    return {
      imageBuffer: webpBuffer,
      width: meta.width || 800,
      height: meta.height || 1200,
      mimeType: 'image/webp',
      providerJobId: predictionId,
      providerName: this.name,
      latencyMs,
      metadata: {
        category: replicateCategory,
      },
    };
  }
}
