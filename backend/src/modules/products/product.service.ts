import crypto from 'crypto';
import {
  ProductCategory,
  ProfilePhotoType,
  CATEGORY_METADATA_MAP,
  NormalizeProductResponse,
  NormalizedProduct,
  ProductImageCandidate,
} from '@vton/shared';
import { NormalizeProductInput } from './product.dto.js';
import { logger } from '../../utils/logger.js';

export class ProductService {
  /**
   * Refine and normalize a product candidate received from client discovery.
   */
  async normalizeProduct(input: NormalizeProductInput): Promise<NormalizeProductResponse> {
    const category = input.category || this.inferCategory(input.title, input.description);
    const categoryMeta = CATEGORY_METADATA_MAP[category] || CATEGORY_METADATA_MAP[ProductCategory.CUSTOM];
    const recommendedPhotoType: ProfilePhotoType = categoryMeta.requiredProfilePhoto;

    // Sanitize image URLs and rank them
    const sanitizedImages: ProductImageCandidate[] = input.images.map((img, idx) => {
      const cleanUrl = this.sanitizeImageUrl(img.url);
      const isPrimary = img.isPrimary || idx === 0;
      return {
        id: img.id || crypto.randomUUID(),
        url: cleanUrl,
        width: img.width,
        height: img.height,
        altText: img.altText,
        isPrimary,
        score: img.score ?? (isPrimary ? 0.95 : 0.8),
        viewAngle: img.viewAngle || 'UNKNOWN',
      };
    });

    // Ensure at least one image is primary
    const primaryImg = sanitizedImages.find((img) => img.isPrimary) || sanitizedImages[0];
    if (primaryImg) {
      primaryImg.isPrimary = true;
    }

    const productId = crypto.randomUUID();

    const sanitizedProduct: NormalizedProduct = {
      id: productId,
      sourceDomain: input.sourceDomain,
      sourceUrl: input.sourceUrl,
      title: input.title.trim(),
      description: input.description?.trim(),
      category,
      brand: input.brand?.trim(),
      price: input.price,
      currency: input.currency?.toUpperCase(),
      images: sanitizedImages,
      selectedImageId: primaryImg ? primaryImg.id : crypto.randomUUID(),
      variants: [],
      detectionConfidence: 0.95,
      metadata: {},
      extractedAt: new Date().toISOString(),
    };

    logger.info({ productId, category, domain: input.sourceDomain }, 'Product normalized successfully');

    return {
      productId,
      category,
      recommendedPhotoType,
      sanitizedProduct,
    };
  }

  /**
   * Infer clothing category based on textual clues in title or description.
   */
  inferCategory(title: string, description?: string): ProductCategory {
    const text = `${title} ${description || ''}`.toLowerCase();

    if (/\b(dress|dresses|sundress|sundresses|gown|gowns|frock|frocks|maxi|midi|jumpsuit|romper)\b/i.test(text)) {
      return ProductCategory.DRESSES;
    }
    if (/\b(jacket|blazer|coat|hoodie|cardigan|sweater|parka|outerwear|vest|windbreaker)\b/i.test(text)) {
      return ProductCategory.JACKETS;
    }
    if (/\b(shirt|button-down|oxford|flannel|blouse|polo)\b/i.test(text)) {
      return ProductCategory.SHIRTS;
    }
    if (/\b(t-shirt|tee|tank|crop top|camisole|top|tshirt)\b/i.test(text)) {
      return ProductCategory.TOPS;
    }
    if (/\b(pants|trousers|jeans|denim|chinos|shorts|leggings|joggers|sweatpants|tights)\b/i.test(text)) {
      return ProductCategory.PANTS;
    }
    if (/\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|loafer|sandals|flats|footwear)\b/i.test(text)) {
      return ProductCategory.SHOES;
    }
    if (/\b(necklace|pendant|choker|chain|locket)\b/i.test(text)) {
      return ProductCategory.NECKLACES;
    }
    if (/\b(jewellery|jewelry|earring|earrings|ring|bracelet|bangle)\b/i.test(text)) {
      return ProductCategory.JEWELLERY;
    }
    if (/\b(scarf|belt|hat|cap|beanie|bag|handbag|tote|purse|wallet|sunglasses|watch)\b/i.test(text)) {
      return ProductCategory.ACCESSORIES;
    }

    return ProductCategory.CUSTOM;
  }

  private sanitizeImageUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove noisy tracking parameters (e.g. utm_*, fbclid, gclid)
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
      trackingParams.forEach((param) => parsed.searchParams.delete(param));
      return parsed.toString();
    } catch {
      return url;
    }
  }
}

export const productService = new ProductService();
