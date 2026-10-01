import { generateUUID } from '../utils/uuid.js';
import {
  NormalizedProduct,
  ProductImageCandidate,
  ProductCategory,
  ImageViewAngle,
} from '@vton/shared';
import { ScoredCandidate } from '../types.js';

export class CandidateDeduplicator {
  /**
   * Deduplicate candidates and aggregate alternate image views.
   */
  static deduplicate(candidates: ScoredCandidate[]): NormalizedProduct[] {
    const productGroups = new Map<string, ScoredCandidate[]>();

    for (const candidate of candidates) {
      const clusterKey = this.generateClusterKey(candidate);
      const existing = productGroups.get(clusterKey) || [];
      existing.push(candidate);
      productGroups.set(clusterKey, existing);
    }

    const normalizedProducts: NormalizedProduct[] = [];

    for (const [, group] of productGroups.entries()) {
      // Pick highest confidence candidate as the leader
      group.sort((a, b) => b.confidence - a.confidence);
      const leader = group[0];
      if (!leader) continue;

      // Aggregate all unique images across the group
      const aggregatedImages = this.aggregateAndRankImages(group);
      if (aggregatedImages.length === 0) continue;

      const primaryImage = aggregatedImages.find((img) => img.isPrimary) || aggregatedImages[0];
      if (!primaryImage) continue;
      primaryImage.isPrimary = true;

      normalizedProducts.push({
          id: generateUUID(),
        sourceDomain: leader.sourceDomain,
        sourceUrl: leader.sourceUrl,
        title: leader.title,
        description: leader.description,
        category: leader.category || ProductCategory.CUSTOM,
        brand: leader.brand,
        price: leader.price,
        currency: leader.currency,
        images: aggregatedImages,
        selectedImageId: primaryImage.id,
        variants: [],
        detectionConfidence: leader.confidence,
        metadata: {
          isPrimaryPageProduct: leader.isPrimary || false,
        },
        extractedAt: new Date().toISOString(),
      });
    }

    // Sort by confidence descending
    return normalizedProducts.sort((a, b) => b.detectionConfidence - a.detectionConfidence);
  }

  private static generateClusterKey(candidate: ScoredCandidate): string {
    // 1. If product has an explicit SKU, use it
    if (candidate.sku && candidate.sku.trim().length > 1) {
      return `sku:${candidate.sku.trim().toLowerCase()}`;
    }

    // 2. Primary deduplication key: normalized title
    // Different products on the same collection/catalog URL must never be merged
    const normalizedTitle = (candidate.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 35);

    if (normalizedTitle.length >= 3) {
      return `title:${normalizedTitle}`;
    }

    // 3. Fallback: specific distinct product URL
    try {
      const parsed = new URL(candidate.sourceUrl);
      const cleanPath = `${parsed.hostname}${parsed.pathname}`;
      if (cleanPath.length > 5 && !cleanPath.endsWith('/')) {
        return `url:${cleanPath.toLowerCase()}`;
      }
    } catch {
      // Ignore URL parse error
    }

    return `id:${candidate.id}`;
  }

  private static aggregateAndRankImages(group: ScoredCandidate[]): ProductImageCandidate[] {
    const seenUrls = new Set<string>();
    const images: ProductImageCandidate[] = [];

    for (const candidate of group) {
      for (const img of candidate.images) {
        if (!img.url || seenUrls.has(img.url)) continue;
        seenUrls.add(img.url);

        const score = this.calculateImageScore(img.url, img.viewAngle, img.width, img.height);
        images.push({
            id: generateUUID(),
          url: img.url,
          width: img.width,
          height: img.height,
          altText: img.altText,
          isPrimary: false,
          score,
          viewAngle: img.viewAngle || 'UNKNOWN',
        });
      }
    }

    // Sort images by score descending: front/model > high-res > detail
    images.sort((a, b) => b.score - a.score);

    if (images.length > 0 && images[0]) {
      images[0].isPrimary = true;
    }

    return images;
  }

  private static calculateImageScore(
    url: string,
    viewAngle?: ImageViewAngle,
    width?: number,
    height?: number
  ): number {
    let score = 0.5;

    // URL keywords preference
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('main') || lowerUrl.includes('hero') || lowerUrl.includes('front') || lowerUrl.includes('primary')) {
      score += 0.15;
    }

    // View angle preference
    if (viewAngle === 'FRONT') score += 0.35;
    else if (viewAngle === 'FLAT_LAY') score += 0.2;
    else if (viewAngle === 'SIDE') score += 0.1;
    else if (viewAngle === 'DETAIL') score -= 0.15;

    // Dimension preference
    if (width && height) {
      const minDim = Math.min(width, height);
      if (minDim >= 600) score += 0.2;
      else if (minDim >= 400) score += 0.1;
      else if (minDim < 200) score -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
  }
}
