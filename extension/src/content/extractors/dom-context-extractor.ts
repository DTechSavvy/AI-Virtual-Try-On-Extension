export interface DomContext {
  title?: string;
  productLink?: string;
  price?: number;
  currency?: string;
  hasAddToCartButton: boolean;
  isCard: boolean;
}

const PRICE_REGEX = /(?:[$€£₹¥]|USD|EUR|GBP|INR)\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{2})?)|([0-9]{1,4}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:[$€£₹¥]|USD|EUR|GBP|INR)/i;
const CART_BUTTON_REGEX = /\b(add to (cart|bag|basket)|buy (now|it)|pre-order|order now)\b/i;

export class DomContextExtractor {
  /**
   * Traverse upwards from an element (bounded to 6 parents) to harvest nearby context signals.
   */
  static extractContext(element: Element): DomContext {
    let current: Element | null = element;
    let depth = 0;
    const maxDepth = 6;

    let title: string | undefined;
    let productLink: string | undefined;
    let price: number | undefined;
    let currency: string | undefined;
    let hasAddToCartButton = false;
    let isCard = false;

    while (current && depth < maxDepth) {
      // 1. Look for product link if not already found
      if (!productLink) {
        if (current.tagName === 'A' && current.getAttribute('href')) {
          productLink = (current as HTMLAnchorElement).href;
        } else {
          const anchor = current.querySelector('a[href]');
          if (anchor && this.isLikelyProductLink((anchor as HTMLAnchorElement).href)) {
            productLink = (anchor as HTMLAnchorElement).href;
          }
        }
      }

      // 2. Look for product title (headings or itemprop="name")
      if (!title) {
        const heading = current.querySelector('h1, h2, h3, [itemprop="name"]');
        if (heading) {
          const text = heading.textContent?.trim();
          if (text && text.length > 3 && text.length < 200) {
            title = text;
          }
        }
      }

      // 3. Look for price
      if (price === undefined) {
        const priceResult = this.findPriceInElement(current);
        if (priceResult) {
          price = priceResult.price;
          currency = priceResult.currency;
        }
      }

      // 4. Look for add to cart buttons
      if (!hasAddToCartButton) {
        const buttons = current.querySelectorAll('button, input[type="submit"], a.btn, [role="button"]');
        buttons.forEach((btn) => {
          if (CART_BUTTON_REGEX.test(btn.textContent || '')) {
            hasAddToCartButton = true;
          }
        });
      }

      // 5. Check if current container resembles a product card
      if (!isCard) {
        const className = (current.className || '').toLowerCase();
        if (
          className.includes('product') ||
          className.includes('item') ||
          className.includes('card') ||
          className.includes('tile') ||
          current.tagName === 'ARTICLE'
        ) {
          isCard = true;
        }
      }

      current = current.parentElement;
      depth++;
    }

    return {
      title,
      productLink,
      price,
      currency,
      hasAddToCartButton,
      isCard,
    };
  }

  static findPriceInElement(el: Element): { price: number; currency: string } | null {
    const text = el.textContent || '';
    const match = text.match(PRICE_REGEX);
    if (match) {
      const priceStr = match[1] || match[2];
      if (priceStr) {
        const cleanPrice = parseFloat(priceStr.replace(/,/g, ''));
        if (!isNaN(cleanPrice) && cleanPrice > 0 && cleanPrice < 100000) {
          const currency = this.detectCurrency(match[0]);
          return { price: cleanPrice, currency };
        }
      }
    }
    return null;
  }

  static detectCurrency(snippet: string): string {
    if (snippet.includes('$') || snippet.includes('USD')) return 'USD';
    if (snippet.includes('€') || snippet.includes('EUR')) return 'EUR';
    if (snippet.includes('£') || snippet.includes('GBP')) return 'GBP';
    if (snippet.includes('₹') || snippet.includes('INR')) return 'INR';
    if (snippet.includes('¥') || snippet.includes('JPY')) return 'JPY';
    return 'USD';
  }

  static isLikelyProductLink(href: string): boolean {
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return false;
    const lower = href.toLowerCase();
    // Exclude account, cart, terms, help links
    if (/\b(cart|checkout|account|login|help|contact|privacy|terms)\b/.test(lower)) {
      return false;
    }
    return /\b(product|item|dp|p|pd|goods|detail)\b/.test(lower) || /\/[a-z0-9-]+-p[0-9]+/i.test(lower);
  }
}
