import { generateUUID } from '../utils/uuid.js';
import { WebsiteAdapter } from './adapter.interface.js';
import { RawCandidate, RawCandidateImage } from '../types.js';
import { JsonLdExtractor } from '../extractors/jsonld-extractor.js';
import { MetadataExtractor } from '../extractors/metadata-extractor.js';
import { ProductCardExtractor } from '../extractors/product-card-extractor.js';
import { ImageExtractor } from '../extractors/image-extractor.js';
import { DomContextExtractor } from '../extractors/dom-context-extractor.js';
import { CategoryClassifier } from '../classifier/category-classifier.js';

export class GenericAdapter implements WebsiteAdapter {
  readonly name = 'GenericAdapter';

  canHandle(_url?: URL): boolean {
    return true; // Default fallback for all websites
  }

  extractProducts(document: Document): RawCandidate[] {
    const candidates: RawCandidate[] = [];
    const sourceDomain = window.location.hostname;
    const sourceUrl = window.location.href;

    // 1. Harvest schema.org JSON-LD structured products
    const jsonLdProducts = JsonLdExtractor.extract(document);
    for (const p of jsonLdProducts) {
      if (!p.title && p.images.length === 0) continue;

      const title = p.title || document.title;
      const categoryResult = CategoryClassifier.classify(title, p.description);

      const candidateImages: RawCandidateImage[] = p.images.map((url, idx) => ({
        url: ImageExtractor.cleanImageUrl(url),
        viewAngle: idx === 0 ? 'FRONT' : 'UNKNOWN',
        score: idx === 0 ? 0.95 : 0.8,
      }));

      const hasAddToCart = !!document.querySelector(
        'button[class*="cart"], button[class*="bag"], [id*="cart"], [id*="bag"], [class*="add-to-cart"], .add-to-cart-btn, [data-action*="cart"], [data-action*="bag"]'
      );

      candidates.push({
        id: generateUUID(),
        sourceUrl: p.url || sourceUrl,
        sourceDomain,
        title,
        description: p.description,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        sku: p.sku,
        category: categoryResult.category,
        images: candidateImages,
        isPrimary: true,
        signals: {
          hasJsonLd: true,
          hasOg: false,
          hasPrice: p.price !== undefined,
          hasProductLink: true,
          hasAddToCart,
          hasFashionKeywords: categoryResult.confidence > 0.5,
          isCardStructure: false,
          isHeroImage: true,
          dimensionScore: 1.0,
          negativeSignalScore: 0,
        },
      });
    }

    // 2. Harvest OpenGraph meta tags (strong primary product indicator on PDPs)
    const meta = MetadataExtractor.extract(document);
    if (meta.ogImage && meta.title) {
      const cleanOgImg = ImageExtractor.cleanImageUrl(meta.ogImage);
      const categoryResult = CategoryClassifier.classify(meta.title, meta.description);

      candidates.push({
        id: generateUUID(),
        sourceUrl: meta.canonicalUrl || sourceUrl,
        sourceDomain,
        title: meta.title,
        description: meta.description,
        price: meta.price,
        currency: meta.currency,
        category: categoryResult.category,
        images: [
          {
            url: cleanOgImg,
            viewAngle: 'FRONT',
            score: 0.9,
          },
        ],
        isPrimary: true,
        signals: {
          hasJsonLd: false,
          hasOg: true,
          hasPrice: meta.price !== undefined,
          hasProductLink: true,
          hasAddToCart: false,
          hasFashionKeywords: categoryResult.confidence > 0.5,
          isCardStructure: false,
          isHeroImage: true,
          dimensionScore: 1.0,
          negativeSignalScore: 0,
        },
      });
    }

    // 3. Harvest multi-product listing cards (PLPs, search results)
    const cards = ProductCardExtractor.extractCards(document);
    for (const card of cards) {
      const categoryResult = CategoryClassifier.classify(card.title);
      card.category = categoryResult.category;
      card.signals.hasFashionKeywords = categoryResult.confidence > 0.5;
      candidates.push(card);
    }

    // 4. Discover hero images on product detail pages if no structured data was found
    if (candidates.length === 0) {
      const allImages = ImageExtractor.extractImages(document);
      // Sort by size descending
      let largeImages = allImages.filter((img) => (img.width || 0) >= 220 && (img.height || 0) >= 220);
      if (largeImages.length === 0) {
        largeImages = allImages.filter((img) => (img.width || 0) >= 150 && (img.height || 0) >= 150);
      }
      if (largeImages.length === 0) {
        largeImages = allImages;
      }

      // Check for primary H1 heading on product page
      const h1El = document.querySelector('h1');
      const h1Title = h1El?.textContent?.trim();

      const hasAddToCart = !!document.querySelector(
        'button[class*="cart"], button[class*="bag"], [id*="cart"], [id*="bag"], [class*="add-to-cart"], .add-to-cart-btn, [data-action*="cart"], [data-action*="bag"], button[type="submit"]'
      );

      for (const img of largeImages.slice(0, 4)) {
        const context = img.sourceElement
          ? DomContextExtractor.extractContext(img.sourceElement)
          : { title: undefined, price: undefined, currency: 'USD', hasAddToCartButton: hasAddToCart, productLink: undefined };
        const title = h1Title || context.title || img.altText || document.title;
        const categoryResult = CategoryClassifier.classify(title);

        candidates.push({
          id: generateUUID(),
          sourceUrl: context.productLink || sourceUrl,
          sourceDomain,
          title,
          price: context.price,
          currency: context.currency || 'USD',
          category: categoryResult.category,
          images: [img],
          isPrimary: true,
          signals: {
            hasJsonLd: false,
            hasOg: false,
            hasPrice: context.price !== undefined,
            hasProductLink: true,
            hasAddToCart: hasAddToCart || context.hasAddToCartButton,
            hasFashionKeywords: categoryResult.confidence > 0.4,
            isCardStructure: false,
            isHeroImage: true,
            dimensionScore: 1.0,
            negativeSignalScore: 0,
          },
        });
      }
    }

    return candidates;
  }
}
