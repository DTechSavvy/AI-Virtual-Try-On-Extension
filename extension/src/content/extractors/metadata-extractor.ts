export interface PageMetaTags {
  title?: string;
  description?: string;
  ogImage?: string;
  twitterImage?: string;
  price?: number;
  currency?: string;
  canonicalUrl?: string;
}

export class MetadataExtractor {
  static extract(document: Document): PageMetaTags {
    const getMeta = (names: string[]): string | undefined => {
      for (const name of names) {
        const el =
          document.querySelector(`meta[property="${name}"]`) ||
          document.querySelector(`meta[name="${name}"]`);
        const content = el?.getAttribute('content')?.trim();
        if (content) return content;
      }
      return undefined;
    };

    const ogTitle = getMeta(['og:title', 'twitter:title']);
    const pageTitle = document.title ? document.title.trim() : undefined;
    const title = ogTitle || pageTitle;

    const description = getMeta(['og:description', 'twitter:description', 'description']);
    const ogImage = getMeta(['og:image:secure_url', 'og:image']);
    const twitterImage = getMeta(['twitter:image', 'twitter:image:src']);

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonicalEl?.getAttribute('href') || undefined;

    // Price extraction from e-commerce metadata
    let price: number | undefined;
    const rawPrice = getMeta([
      'product:price:amount',
      'og:price:amount',
      'price',
      'twitter:data1',
    ]);
    if (rawPrice) {
      const parsed = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) price = parsed;
    }

    const currency = getMeta([
      'product:price:currency',
      'og:price:currency',
      'currency',
    ]);

    return {
      title,
      description,
      ogImage,
      twitterImage,
      price,
      currency,
      canonicalUrl,
    };
  }
}
