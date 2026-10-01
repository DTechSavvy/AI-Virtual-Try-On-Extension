import sharp from 'sharp';
import { TryOnProvider, TryOnInput, TryOnOutput, ProviderHealth } from './provider.interface.js';
import { ProductCategory } from '@vton/shared';
import { logger } from '../../../utils/logger.js';

export class MockTryOnProvider implements TryOnProvider {
  public readonly name = 'MOCK';

  async checkHealth(): Promise<ProviderHealth> {
    return { status: 'up', latencyMs: 1 };
  }

  async generateTryOn(input: TryOnInput): Promise<TryOnOutput> {
    const startTime = Date.now();
    logger.info(
      { jobId: input.jobId, category: input.category, mode: input.generationMode },
      '[MockTryOnProvider] Simulating virtual try-on image composition'
    );

    // 1. Inspect profile image dimensions
    const profileMeta = await sharp(input.profileImageBuffer).metadata();
    const mW = profileMeta.width || 800;
    const mH = profileMeta.height || 1200;

    // 2. Calculate category-specific anatomical placement & scaling
    let garmentScaleWidthRatio = 0.70;
    let garmentScaleHeightRatio = 0.40;
    let topPositionRatio = 0.22;

    switch (input.category) {
      case ProductCategory.TOPS:
      case ProductCategory.SHIRTS:
      case ProductCategory.JACKETS:
        garmentScaleWidthRatio = 0.70;
        garmentScaleHeightRatio = 0.38;
        topPositionRatio = 0.22;
        break;

      case ProductCategory.PANTS:
        garmentScaleWidthRatio = 0.58;
        garmentScaleHeightRatio = 0.45;
        topPositionRatio = 0.52;
        break;

      case ProductCategory.DRESSES:
        garmentScaleWidthRatio = 0.72;
        garmentScaleHeightRatio = 0.65;
        topPositionRatio = 0.22;
        break;

      case ProductCategory.SHOES:
        garmentScaleWidthRatio = 0.50;
        garmentScaleHeightRatio = 0.18;
        topPositionRatio = 0.80;
        break;

      case ProductCategory.NECKLACES:
      case ProductCategory.JEWELLERY:
      case ProductCategory.ACCESSORIES:
        garmentScaleWidthRatio = 0.35;
        garmentScaleHeightRatio = 0.18;
        topPositionRatio = 0.18;
        break;

      default:
        garmentScaleWidthRatio = 0.65;
        garmentScaleHeightRatio = 0.45;
        topPositionRatio = 0.30;
    }

    const targetGarmentW = Math.max(64, Math.round(mW * garmentScaleWidthRatio));
    const targetGarmentH = Math.max(64, Math.round(mH * garmentScaleHeightRatio));

    // 2.5 Extract garment and filter out background, model skin, head, and foreign apparel
    let garmentToComposite = input.garmentImageBuffer;

    try {
      const rawImg = await sharp(input.garmentImageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const data = rawImg.data;
      const gw = rawImg.info.width;
      const gh = rawImg.info.height;

      // Detect if the product image is an on-model photograph (contains human skin in upper region)
      let skinCount = 0;
      const scanH = Math.round(gh * 0.35);
      const scanWStart = Math.round(gw * 0.15);
      const scanWEnd = Math.round(gw * 0.85);

      for (let y = 0; y < scanH; y += 2) {
        for (let x = scanWStart; x < scanWEnd; x += 2) {
          const idx = (y * gw + x) * 4;
          const r = data[idx] ?? 0;
          const g = data[idx + 1] ?? 0;
          const b = data[idx + 2] ?? 0;
          if (r > 95 && g > 40 && b > 20 && (r - g) > 10 && (r - b) > 15 && r > g && g > b) {
            skinCount++;
          }
        }
      }

      const isOnModel = skinCount > 250;
      logger.info({ jobId: input.jobId, isOnModel, skinCount }, '[MockTryOnProvider] Garment model analysis complete');

      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const idx = (y * gw + x) * 4;
          const r = data[idx] ?? 0;
          const g = data[idx + 1] ?? 0;
          const b = data[idx + 2] ?? 0;

          // 1. Studio background removal (white, off-white, light grey)
          const isLightBg = (r > 192 && g > 192 && b > 192) ||
            (r > 175 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14);

          if (isLightBg) {
            data[idx + 3] = 0;
            continue;
          }

          // 2. If photograph contains a model, remove model's face, neck skin, and lower body
          if (isOnModel) {
            // Cut model head/hair (top 24% of image)
            if (y < gh * 0.24) {
              data[idx + 3] = 0;
              continue;
            }

            // Remove model skin (face/neck/arms)
            const isSkin = (r > 95 && g > 40 && b > 20 && (r - g) > 10 && (r - b) > 15 && r > g && g > b);
            if (isSkin && (y < gh * 0.40 || x < gw * 0.22 || x > gw * 0.78)) {
              data[idx + 3] = 0;
              continue;
            }

            // For Tops/Shirts/Jackets, cut model pants/legs below torso
            if (
              (input.category === ProductCategory.TOPS ||
                input.category === ProductCategory.SHIRTS ||
                input.category === ProductCategory.JACKETS) &&
              y > gh * 0.68
            ) {
              data[idx + 3] = 0;
              continue;
            }
          }
        }
      }

      const isolatedBuffer = await sharp(data, {
        raw: { width: gw, height: gh, channels: 4 },
      })
        .png()
        .toBuffer();

      // Trim transparency around the isolated garment
      garmentToComposite = await sharp(isolatedBuffer)
        .trim()
        .toBuffer();
    } catch (bgErr) {
      logger.warn({ error: bgErr }, '[MockTryOnProvider] Background/model extraction failed, falling back to raw');
      garmentToComposite = input.garmentImageBuffer;
    }

    // 3. Resize garment image to fit the target anatomical bounding box
    const resizedGarmentBuffer = await sharp(garmentToComposite)
      .resize({
        width: targetGarmentW,
        height: targetGarmentH,
        fit: 'inside',
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    const resizedGarmentMeta = await sharp(resizedGarmentBuffer).metadata();
    const gW = resizedGarmentMeta.width || targetGarmentW;
    const gH = resizedGarmentMeta.height || targetGarmentH;

    // Center horizontally on user body, align vertically by anatomical position
    const left = Math.max(0, Math.round((mW - gW) / 2));
    const top = Math.min(mH - gH, Math.max(0, Math.round(mH * topPositionRatio)));

    // 4. Composite the garment onto the profile image with soft blending
    const compositeBuffer = await sharp(input.profileImageBuffer)
      .composite([
        {
          input: resizedGarmentBuffer,
          top,
          left,
          blend: 'over',
        },
      ])
      .webp({ quality: 92, effort: 4 })
      .toBuffer();

    const outputMeta = await sharp(compositeBuffer).metadata();

    // Simulate realistic generation latency (150ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    const latencyMs = Date.now() - startTime;
    logger.info({ jobId: input.jobId, latencyMs }, '[MockTryOnProvider] Virtual try-on composite complete');

    return {
      imageBuffer: compositeBuffer,
      width: outputMeta.width || mW,
      height: outputMeta.height || mH,
      mimeType: 'image/webp',
      providerJobId: `mock_${Date.now()}_${input.jobId.slice(0, 8)}`,
      providerName: this.name,
      latencyMs,
      metadata: {
        anatomicalRegion: input.targetBodyRegion,
        scaleRatio: garmentScaleWidthRatio,
        simulated: true,
      },
    };
  }
}
