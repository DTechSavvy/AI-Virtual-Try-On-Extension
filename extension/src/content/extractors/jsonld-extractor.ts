export interface JsonLdProductData {
  title?: string;
  description?: string;
  brand?: string;
  sku?: string;
  price?: number;
  currency?: string;
  images: string[];
  url?: string;
  availability?: string;
}

export class JsonLdExtractor {
  /**
   * Extract all schema.org Product items found in ld+json scripts.
   */
  static extract(document: Document): JsonLdProductData[] {
    const results: JsonLdProductData[] = [];
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    scripts.forEach((script) => {
      try {
        const content = script.textContent?.trim();
        if (!content) return;

        const parsed = JSON.parse(content);
        const products = this.findProductNodes(parsed);

        for (const node of products) {
          const product = this.parseProductNode(node);
          if (product && (product.title || product.images.length > 0)) {
            results.push(product);
          }
        }
      } catch {
        // Ignore JSON parse errors on malformed vendor scripts
      }
    });

    return results;
  }

  private static findProductNodes(obj: any): any[] {
    const nodes: any[] = [];
    if (!obj || typeof obj !== 'object') return nodes;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        nodes.push(...this.findProductNodes(item));
      }
      return nodes;
    }

    if (Array.isArray(obj['@graph'])) {
      nodes.push(...this.findProductNodes(obj['@graph']));
    }

    if (Array.isArray(obj['itemListElement'])) {
      nodes.push(...this.findProductNodes(obj['itemListElement']));
    }

    if (obj.item && typeof obj.item === 'object') {
      nodes.push(...this.findProductNodes(obj.item));
    }

    const type = obj['@type'];
    if (type === 'Product' || type === 'IndividualProduct' || type === 'ProductGroup') {
      nodes.push(obj);
    } else if (obj.itemOffered && typeof obj.itemOffered === 'object') {
      nodes.push(...this.findProductNodes(obj.itemOffered));
    }

    return nodes;
  }

  private static parseProductNode(node: any): JsonLdProductData | null {
    if (!node) return null;

    const title = typeof node.name === 'string' ? node.name.trim() : undefined;
    const description = typeof node.description === 'string' ? node.description.trim() : undefined;
    const sku = typeof node.sku === 'string' ? node.sku : typeof node.productID === 'string' ? node.productID : undefined;

    let brand: string | undefined;
    if (typeof node.brand === 'string') {
      brand = node.brand;
    } else if (node.brand && typeof node.brand.name === 'string') {
      brand = node.brand.name;
    }

    const images: string[] = [];
    if (typeof node.image === 'string') {
      images.push(node.image);
    } else if (Array.isArray(node.image)) {
      for (const img of node.image) {
        if (typeof img === 'string') {
          images.push(img);
        } else if (img && typeof img === 'object') {
          const url = img.url || img.contentUrl;
          if (typeof url === 'string') images.push(url);
        }
      }
    } else if (node.image && typeof node.image === 'object') {
      const url = node.image.url || node.image.contentUrl;
      if (typeof url === 'string') images.push(url);
    }

    let price: number | undefined;
    let currency: string | undefined;
    let availability: string | undefined;

    const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    if (offer && typeof offer === 'object') {
      const rawPrice = offer.price || offer.lowPrice;
      if (typeof rawPrice === 'number') {
        price = rawPrice;
      } else if (typeof rawPrice === 'string') {
        const cleaned = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
        if (!isNaN(cleaned)) price = cleaned;
      }

      if (typeof offer.priceCurrency === 'string') {
        currency = offer.priceCurrency;
      }

      if (typeof offer.availability === 'string') {
        availability = offer.availability;
      }
    }

    const url = typeof node.url === 'string' ? node.url : undefined;

    return {
      title,
      description,
      brand,
      sku,
      price,
      currency,
      images,
      url,
      availability,
    };
  }
}
