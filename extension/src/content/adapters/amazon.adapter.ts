import { generateUUID } from '../utils/uuid.js';
import { WebsiteAdapter } from './adapter.interface.js';
import { RawCandidate, RawCandidateImage } from '../types.js';
import { CategoryClassifier } from '../classifier/category-classifier.js';
import { ImageExtractor } from '../extractors/image-extractor.js';

export class AmazonAdapter implements WebsiteAdapter {
  readonly name = 'AmazonAdapter';

  canHandle(url: URL): boolean {
    return url.hostname.includes('amazon.');
  }

  extractProducts(document: Document): RawCandidate[] {
    const candidates: RawCandidate[] = [];
    const sourceDomain = window.location.hostname;
    const sourceUrl = window.location.href;

    // 1. Amazon Product Detail Page (PDP)
    const titleEl = document.querySelector('#productTitle');
    const heroImgEl = (document.querySelector('#landingImage') ||
      document.querySelector('#imgTagWrapperId img')) as HTMLImageElement | null;

    if (titleEl && heroImgEl) {
      const title = titleEl.textContent?.trim() || '';
      const images: RawCandidateImage[] = [];

      // Extract high-resolution images from Amazon dynamic image JSON
      const dynamicJson = heroImgEl.getAttribute('data-a-dynamic-image');
      if (dynamicJson) {
        try {
          const parsed = JSON.parse(dynamicJson);
          for (const url of Object.keys(parsed)) {
            const dims = parsed[url];
            images.push({
              url: ImageExtractor.cleanImageUrl(url),
              width: Array.isArray(dims) ? dims[0] : undefined,
              height: Array.isArray(dims) ? dims[1] : undefined,
              viewAngle: 'FRONT',
              score: 0.98,
            });
          }
        } catch {
          // Fallback if JSON parse fails
        }
      }

      if (images.length === 0 && heroImgEl.src) {
        images.push({
          url: ImageExtractor.cleanImageUrl(heroImgEl.src),
          viewAngle: 'FRONT',
          score: 0.95,
        });
      }

      // Price extraction
      let price: number | undefined;
      let currency: string | undefined = 'USD';
      const priceEl = document.querySelector(
        '#corePrice_feature_div .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price .a-offscreen'
      );
      if (priceEl && priceEl.textContent) {
        const text = priceEl.textContent.trim();
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) price = num;
        if (text.includes('$')) currency = 'USD';
        else if (text.includes('₹')) currency = 'INR';
        else if (text.includes('£')) currency = 'GBP';
        else if (text.includes('€')) currency = 'EUR';
      }

      const brandEl = document.querySelector('#bylineInfo');
      const brand = brandEl?.textContent?.replace(/^(Brand:|Visit the store for)\s*/i, '').trim();

      const categoryResult = CategoryClassifier.classify(title);

      candidates.push({
        id: generateUUID(),
        sourceUrl,
        sourceDomain,
        title,
        brand,
        price,
        currency,
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

    // 2. Amazon Search Result Grid / PLP
    const searchCards = document.querySelectorAll('div[data-component-type="s-search-result"]');
    searchCards.forEach((card) => {
      const img = card.querySelector('img.s-image') as HTMLImageElement | null;
      const titleLink = card.querySelector('h2 a') as HTMLAnchorElement | null;
      if (!img || !titleLink) return;

      const title = titleLink.textContent?.trim() || img.alt?.trim();
      if (!title) return;

      const cleanUrl = ImageExtractor.cleanImageUrl(img.src);
      const link = titleLink.href;

      let price: number | undefined;
      const priceEl = card.querySelector('.a-price .a-offscreen');
      if (priceEl && priceEl.textContent) {
        const num = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) price = num;
      }

      const categoryResult = CategoryClassifier.classify(title);

      candidates.push({
        id: generateUUID(),
        sourceUrl: link,
        sourceDomain,
        title,
        price,
        currency: 'USD',
        category: categoryResult.category,
        images: [
          {
            url: cleanUrl,
            width: img.naturalWidth || 300,
            height: img.naturalHeight || 400,
            viewAngle: 'FRONT',
            score: 0.9,
          },
        ],
        isPrimary: false,
        signals: {
          hasJsonLd: false,
          hasOg: false,
          hasPrice: price !== undefined,
          hasProductLink: true,
          hasAddToCart: false,
          hasFashionKeywords: categoryResult.confidence > 0.5,
          isCardStructure: true,
          isHeroImage: false,
          dimensionScore: 0.85,
          negativeSignalScore: 0,
        },
      });
    });

    return candidates;
  }
}
