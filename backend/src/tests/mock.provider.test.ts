import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { MockTryOnProvider } from '../modules/try-on/providers/mock.provider.js';
import { ProductCategory, GenerationMode } from '@vton/shared';

describe('MockTryOnProvider', () => {
  const provider = new MockTryOnProvider();

  it('should have provider name MOCK and healthy status', async () => {
    expect(provider.name).toBe('MOCK');
    const health = await provider.checkHealth();
    expect(health.status).toBe('up');
  });

  it('should composite garment onto model image and return valid WebP output', async () => {
    // Generate synthetic model image (800x1200 white background)
    const modelBuffer = await sharp({
      create: {
        width: 800,
        height: 1200,
        channels: 4,
        background: { r: 240, g: 240, b: 240, alpha: 1 },
      },
    })
      .webp()
      .toBuffer();

    // Generate synthetic garment image (400x500 blue rectangle)
    const garmentBuffer = await sharp({
      create: {
        width: 400,
        height: 500,
        channels: 4,
        background: { r: 59, g: 130, b: 246, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const output = await provider.generateTryOn({
      jobId: 'test-job-123',
      userId: 'test-user-456',
      profileImageBuffer: modelBuffer,
      garmentImageBuffer: garmentBuffer,
      category: ProductCategory.TOPS,
      generationMode: GenerationMode.STANDARD,
      targetBodyRegion: 'UPPER_BODY',
      productTitle: 'Classic Oxford Cotton Shirt',
    });

    expect(output).toBeDefined();
    expect(output.providerName).toBe('MOCK');
    expect(output.mimeType).toBe('image/webp');
    expect(output.width).toBe(800);
    expect(output.height).toBe(1200);
    expect(output.imageBuffer.length).toBeGreaterThan(1000);

    // Verify valid image binary
    const meta = await sharp(output.imageBuffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(1200);
  });
});
