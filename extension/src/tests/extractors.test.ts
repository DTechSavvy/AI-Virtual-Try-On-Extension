import { describe, it, expect } from 'vitest';
import { JsonLdExtractor } from '../content/extractors/jsonld-extractor.js';
import { MetadataExtractor } from '../content/extractors/metadata-extractor.js';
import { CandidateDeduplicator } from '../content/deduplicator/candidate-deduplicator.js';
import { ScoredCandidate } from '../content/types.js';
import { ProductCategory } from '@vton/shared';

describe('JsonLdExtractor', () => {
  it('extracts schema.org Product with images, price, and currency', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": "Cashmere Crewneck Sweater",
        "image": [
          "https://example.com/sweater-front.jpg",
          "https://example.com/sweater-back.jpg"
        ],
        "description": "Ultra-soft 100% Mongolian cashmere knit sweater.",
        "brand": {
          "@type": "Brand",
          "name": "Luxury Knitwear"
        },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "USD",
          "price": "149.00",
          "availability": "https://schema.org/InStock"
        }
      }
      </script>
    `;

    const products = JsonLdExtractor.extract(document);
    expect(products.length).toBe(1);
    expect(products[0].title).toBe('Cashmere Crewneck Sweater');
    expect(products[0].images.length).toBe(2);
    expect(products[0].price).toBe(149.00);
    expect(products[0].currency).toBe('USD');
    expect(products[0].brand).toBe('Luxury Knitwear');
  });

  it('handles nested @graph collections containing a Product', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "name": "Boutique Store"
          },
          {
            "@type": "Product",
            "name": "Pleated Midi Skirt",
            "image": "https://example.com/skirt.jpg",
            "offers": {
              "@type": "AggregateOffer",
              "lowPrice": "79.99",
              "priceCurrency": "EUR"
            }
          }
        ]
      }
      </script>
    `;

    const products = JsonLdExtractor.extract(document);
    expect(products.length).toBe(1);
    expect(products[0].title).toBe('Pleated Midi Skirt');
    expect(products[0].price).toBe(79.99);
    expect(products[0].currency).toBe('EUR');
  });

  it('safely ignores invalid or unrelated JSON-LD scripts', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        { "not": "valid json
      </script>
      <script type="application/ld+json">
        { "@type": "Organization", "name": "Google" }
      </script>
    `;

    const products = JsonLdExtractor.extract(document);
    expect(products.length).toBe(0);
  });
});

describe('MetadataExtractor', () => {
  it('extracts OpenGraph and Twitter card product metadata', () => {
    document.head.innerHTML = `
      <meta property="og:title" content="Oversized Denim Jacket" />
      <meta property="og:description" content="Classic vintage wash jacket." />
      <meta property="og:image" content="https://example.com/og-jacket.jpg" />
      <meta property="product:price:amount" content="89.50" />
      <meta property="product:price:currency" content="USD" />
      <link rel="canonical" href="https://example.com/products/denim-jacket" />
    `;

    const meta = MetadataExtractor.extract(document);
    expect(meta.title).toBe('Oversized Denim Jacket');
    expect(meta.ogImage).toBe('https://example.com/og-jacket.jpg');
    expect(meta.price).toBe(89.50);
    expect(meta.currency).toBe('USD');
    expect(meta.canonicalUrl).toBe('https://example.com/products/denim-jacket');
  });
});

describe('CandidateDeduplicator', () => {
  it('clusters duplicate candidates of the same product and aggregates alternate image angles', () => {
    const candidate1: ScoredCandidate = {
      id: 'c1',
      sourceUrl: 'https://shop.com/products/blazer?variant=1',
      sourceDomain: 'shop.com',
      title: 'Wool Tailored Blazer',
      price: 199.99,
      currency: 'USD',
      category: ProductCategory.JACKETS,
      confidence: 0.95,
      isPrimary: true,
      images: [
        {
          url: 'https://shop.com/blazer-front.jpg',
          viewAngle: 'FRONT',
          score: 0.95,
          width: 800,
          height: 1200,
        },
      ],
      signals: {
        hasJsonLd: true,
        hasOg: true,
        hasPrice: true,
        hasProductLink: true,
        hasAddToCart: true,
        hasFashionKeywords: true,
        isCardStructure: false,
        isHeroImage: true,
        dimensionScore: 1.0,
        negativeSignalScore: 0,
      },
    };

    const candidate2: ScoredCandidate = {
      id: 'c2',
      sourceUrl: 'https://shop.com/products/blazer?variant=2',
      sourceDomain: 'shop.com',
      title: 'Wool Tailored Blazer',
      price: 199.99,
      currency: 'USD',
      category: ProductCategory.JACKETS,
      confidence: 0.88,
      isPrimary: true,
      images: [
        {
          url: 'https://shop.com/blazer-back.jpg',
          viewAngle: 'BACK',
          score: 0.85,
          width: 800,
          height: 1200,
        },
      ],
      signals: {
        hasJsonLd: false,
        hasOg: true,
        hasPrice: true,
        hasProductLink: true,
        hasAddToCart: false,
        hasFashionKeywords: true,
        isCardStructure: false,
        isHeroImage: false,
        dimensionScore: 1.0,
        negativeSignalScore: 0,
      },
    };

    const deduplicated = CandidateDeduplicator.deduplicate([candidate1, candidate2]);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].title).toBe('Wool Tailored Blazer');
    // Both front and back images should be aggregated
    expect(deduplicated[0].images.length).toBe(2);
    // FRONT view image should be selected as primary
    const primaryImg = deduplicated[0].images.find((img) => img.id === deduplicated[0].selectedImageId);
    expect(primaryImg?.url).toBe('https://shop.com/blazer-front.jpg');
    expect(primaryImg?.viewAngle).toBe('FRONT');
  });
});
