import { generateUUID } from '../utils/uuid.js';
import { WebsiteAdapter } from './adapter.interface.js';
import { RawCandidate, RawCandidateImage } from '../types.js';
import { CategoryClassifier } from '../classifier/category-classifier.js';
import { ImageExtractor } from '../extractors/image-extractor.js';

export class ZaraAdapter implements WebsiteAdapter {
  readonly name = 'ZaraAdapter';

  canHandle(url: URL): boolean {
    return url.hostname.includes('zara.');
  }

  extractProducts(document: Document): RawCandidate[] {
    const candidates: RawCandidate[] = [];
    const sourceDomain = window.location.hostname;
    const sourceUrl = window.location.href;

    // 1. Zara Product Detail Page (PDP)
    const titleEl = document.querySelector('h1.product-detail-info__header-name, h1[class*="product-detail"]');
    const imagesContainer = document.querySelectorAll(
      'picture.media-image img, ul[class*="product-detail-images"] img, .product-detail-view__main-content img'
    );

    if (titleEl && imagesContainer.length > 0) {
      const title = titleEl.textContent?.trim() || '';
      const images: RawCandidateImage[] = [];

      imagesContainer.forEach((imgEl, idx) => {
        const img = imgEl as HTMLImageElement;
        const rawUrl = ImageExtractor.resolveHighestResUrl(img);
        if (rawUrl) {
          images.push({
            url: ImageExtractor.cleanImageUrl(rawUrl),
            viewAngle: idx === 0 ? 'FRONT' : 'UNKNOWN',
            score: idx === 0 ? 0.98 : 0.85,
          });
        }
      });

      let price: number | undefined;
      const priceEl = document.querySelector('.money-amount__main, [class*="price"] .money-amount');
      if (priceEl && priceEl.textContent) {
        const num = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) price = num;
      }

      const categoryResult = CategoryClassifier.classify(title);

      candidates.push({
        id: generateUUID(),
        sourceUrl,
        sourceDomain,
        title,
        brand: 'Zara',
        price,
        currency: 'USD',
        category: categoryResult.category,
        images,
        isPrimary: true,
        signals: {
          hasJsonLd: false,
          hasOg: true,
          hasPrice: price !== undefined,
          hasProductLink: true,
          hasAddToCart: true,
          hasFashionKeywords: categoryResult.confidence > 0.5,
          isCardStructure: false,
          isHeroImage: true,
          dimensionScore: 1.0,
          negativeSignalScore: 0,
        },
      });

      return candidates;
    }

    // 2. Zara Grid Catalog (PLP)
    const gridItems = document.querySelectorAll(
      '.product-grid-product, [class*="product-grid-item"], [data-qa-qualifier="product-grid-product"]'
    );
    gridItems.forEach((item) => {
      const img = item.querySelector('img') as HTMLImageElement | null;
      const anchor = item.querySelector('a') as HTMLAnchorElement | null;
      if (!img) return;

      const title = img.alt?.trim() || anchor?.textContent?.trim() || 'Zara Apparel';
      const cleanUrl = ImageExtractor.cleanImageUrl(img.src);
      const link = anchor?.href || sourceUrl;

      const categoryResult = CategoryClassifier.classify(title);

      candidates.push({
        id: generateUUID(),
        sourceUrl: link,
        sourceDomain,
        title,
        brand: 'Zara',
        category: categoryResult.category,
        images: [
          {
            url: cleanUrl,
            viewAngle: 'FRONT',
            score: 0.9,
          },
        ],
        isPrimary: false,
        signals: {
          hasJsonLd: false,
          hasOg: false,
          hasPrice: false,
          hasProductLink: true,
          hasAddToCart: false,
          hasFashionKeywords: categoryResult.confidence > 0.5,
          isCardStructure: true,
          isHeroImage: false,
          dimensionScore: 0.9,
          negativeSignalScore: 0,
        },
      });
    });

    return candidates;
  }
}
