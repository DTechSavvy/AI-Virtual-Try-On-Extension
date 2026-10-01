import { generateUUID } from '../utils/uuid.js';
import { RawCandidate } from '../types.js';
import { ImageExtractor } from './image-extractor.js';
import { DomContextExtractor } from './dom-context-extractor.js';

export class ProductCardExtractor {
  private static readonly CARD_SELECTORS = [
    'article',
    'li[class*="product"]',
    'li[class*="item"]',
    'div[class*="product-card"]',
    'div[class*="product-item"]',
    'div[class*="product-grid"]',
    'div[class*="productCard"]',
    'div[class*="ProductCard"]',
    'div[class*="product_card"]',
    'div[class*="productTile"]',
    'div[class*="product-tile"]',
    'div[class*="item-card"]',
    'div[class*="itemCard"]',
    'div[class*="search-result"]',
    'div[data-component-type="s-search-result"]',
    '.grid-item',
    '.item-card',
    '.product-list-item',
  ];

  /**
   * Scan page for product listing cards.
   */
  static extractCards(document: Document): RawCandidate[] {
    const candidates: RawCandidate[] = [];
    const processedContainers = new Set<Element>();

    for (const selector of this.CARD_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (processedContainers.has(el)) return;

        const candidate = this.parseCardElement(el);
        if (candidate) {
          processedContainers.add(el);
          candidates.push(candidate);
        }
      });
    }

    return candidates;
  }

  private static parseCardElement(cardEl: Element): RawCandidate | null {
    // 1. Must contain at least one valid image
    const images = ImageExtractor.extractImages(cardEl);
    if (images.length === 0) return null;

    // 2. Extract context within this card
    const context = DomContextExtractor.extractContext(images[0]?.sourceElement || cardEl);

    // 3. Fallback: query title within card if context traversal didn't capture it
    let title = context.title;
    if (!title) {
      const headingOrAnchor = cardEl.querySelector('h2, h3, h4, a[title], [class*="title"], [class*="name"]');
      const text = headingOrAnchor?.getAttribute('title') || headingOrAnchor?.textContent?.trim();
      if (text && text.length > 3 && text.length < 200) {
        title = text;
      }
    }

    if (!title && images[0]?.altText && images[0].altText.length > 3) {
      title = images[0].altText;
    }

    // A card without a title or images is not a valid candidate
    if (!title) return null;

    const sourceUrl = context.productLink || window.location.href;
    const domain = window.location.hostname;

    return {
      id: generateUUID(),
      sourceUrl,
      sourceDomain: domain,
      title,
      price: context.price,
      currency: context.currency,
      images,
      domElement: cardEl,
      signals: {
        hasJsonLd: false,
        hasOg: false,
        hasPrice: context.price !== undefined,
        hasProductLink: context.productLink !== undefined,
        hasAddToCart: context.hasAddToCartButton,
        hasFashionKeywords: false,
        isCardStructure: true,
        isHeroImage: false,
        dimensionScore: images[0]?.width && images[0].width >= 250 ? 1.0 : 0.6,
        negativeSignalScore: 0,
      },
    };
  }
}
