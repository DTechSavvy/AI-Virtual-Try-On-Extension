import sharp from 'sharp';
import { Client } from '@gradio/client';
import { TryOnProvider, TryOnInput, TryOnOutput, ProviderHealth } from './provider.interface.js';
import { logger } from '../../../utils/logger.js';

export class IdmVtonProvider implements TryOnProvider {
  public readonly name = 'IDM_VTON';
  private client: any = null;
  private readonly spaceId = 'yisol/IDM-VTON';

  private async getClient() {
    if (!this.client) {
      this.client = await Client.connect(this.spaceId);
    }
    return this.client;
  }

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.getClient();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'IDM-VTON space unreachable';
      return { status: 'down', error: msg };
    }
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnOutput> {
    const startTime = Date.now();
    logger.info(
      { jobId: input.jobId, category: input.category, mode: input.generationMode },
      '[IdmVtonProvider] Submitting virtual try-on inference to IDM-VTON neural diffusion model'
    );

    try {
      const app = await this.getClient();

      // Ensure proper image formats for Gradio Blob upload
      const userJpgBuffer = await sharp(input.profileImageBuffer)
        .jpeg({ quality: 95 })
        .toBuffer();

      const garmentJpgBuffer = await sharp(input.garmentImageBuffer)
        .jpeg({ quality: 95 })
        .toBuffer();

      const humanBlob = new Blob([userJpgBuffer], { type: 'image/jpeg' });
      const garmBlob = new Blob([garmentJpgBuffer], { type: 'image/jpeg' });

      const description = input.productTitle || `${input.category} apparel`;
      const denoiseSteps = input.generationMode === 'FAST' ? 20 : 30;

      const prediction = await app.predict('/tryon', [
        { background: humanBlob, layers: [], composite: null },
        garmBlob,
        description,
        true,  // auto masking
        false, // auto crop
        denoiseSteps,
        42     // seed
      ]);

      const resultItems = prediction?.data as any[];
      if (!resultItems || !resultItems[0]?.url) {
        throw new Error('IDM-VTON completed but returned no output image URL');
      }

      const generatedUrl = resultItems[0].url;
      logger.info({ jobId: input.jobId, generatedUrl }, '[IdmVtonProvider] Prediction successful, downloading output');

      const imgRes = await fetch(generatedUrl);
      if (!imgRes.ok) {
        throw new Error(`Failed to download result image from IDM-VTON (${imgRes.status})`);
      }

      const rawResultArray = await imgRes.arrayBuffer();
      const outputWebpBuffer = await sharp(Buffer.from(rawResultArray))
        .webp({ quality: 92 })
        .toBuffer();

      const outputMeta = await sharp(outputWebpBuffer).metadata();
      const latencyMs = Date.now() - startTime;

      logger.info({ jobId: input.jobId, latencyMs }, '[IdmVtonProvider] IDM-VTON neural synthesis complete');

      return {
        imageBuffer: outputWebpBuffer,
        width: outputMeta.width || 800,
        height: outputMeta.height || 1200,
        mimeType: 'image/webp',
        providerJobId: `idm_${Date.now()}_${input.jobId.slice(0, 8)}`,
        providerName: this.name,
        latencyMs,
        metadata: {
          model: 'IDM-VTON (Diffusion)',
          denoiseSteps,
          category: input.category,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: input.jobId, error: msg }, '[IdmVtonProvider] Neural generation failed');
      throw err;
    }
  }
}
