import { describe, it, expect } from 'vitest';
import { ProductScanner } from '../content/scanner/product-scanner.js';
import { AmazonAdapter } from '../content/adapters/amazon.adapter.js';
import { ZaraAdapter } from '../content/adapters/zara.adapter.js';
import { GenericAdapter } from '../content/adapters/generic.adapter.js';

describe('ProductScanner', () => {
  it('identifies and extracts a PDP (Product Detail Page) with high confidence', () => {
    document.body.innerHTML = `
      <div id="main-content">
        <h1 class="product-title">Silk Evening Gown</h1>
        <div class="product-gallery">
          <img src="https://example.com/gown-front.jpg" alt="Silk Evening Gown Front" width="800" height="1200" />
        </div>
        <div class="price-box">
          <span class="price">$280.00</span>
        </div>
        <button class="add-to-cart-btn">Add to Bag</button>
      </div>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": "Silk Evening Gown",
        "image": "https://example.com/gown-front.jpg",
        "offers": {
          "@type": "Offer",
          "price": "280.00",
          "priceCurrency": "USD"
        }
      }
      </script>
    `;

    const result = ProductScanner.scanDocument(document);
    expect(result.products.length).toBe(1);
    expect(result.pageType).toBe('PDP');
    expect(result.products[0].title).toBe('Silk Evening Gown');
    expect(result.products[0].price).toBe(280.00);
    expect(result.products[0].detectionConfidence).toBeGreaterThanOrEqual(0.85);
  });

  it('identifies and extracts a PLP (Product Listing Page) with multiple cards', () => {
    document.body.innerHTML = `
      <div class="catalog-grid">
        <div class="product-card">
          <a href="https://example.com/item/1">
            <img src="https://example.com/shirt1.jpg" alt="Linen Summer Shirt" width="400" height="500" />
            <h3 class="title">Linen Summer Shirt</h3>
          </a>
          <span class="price">$45.00</span>
        </div>
        <div class="product-card">
          <a href="https://example.com/item/2">
            <img src="https://example.com/shirt2.jpg" alt="Oxford Cotton Shirt" width="400" height="500" />
            <h3 class="title">Oxford Cotton Shirt</h3>
          </a>
          <span class="price">$55.00</span>
        </div>
        <div class="product-card">
          <a href="https://example.com/item/3">
            <img src="https://example.com/dress1.jpg" alt="Sundress Yellow" width="400" height="500" />
            <h3 class="title">Sundress Yellow</h3>
          </a>
          <span class="price">$65.00</span>
        </div>
      </div>
    `;

    const result = ProductScanner.scanDocument(document);
    expect(result.products.length).toBeGreaterThanOrEqual(2);
    expect(result.pageType).toBe('PLP');
  });

  it('safely handles non-shopping web pages with zero false-positive products', () => {
    document.body.innerHTML = `
      <header>
        <img src="https://blog.com/logo.svg" alt="Blog Logo" width="100" height="40" />
        <nav><a href="/">Home</a></nav>
      </header>
      <article>
        <h1>10 Tips for Writing Better Code</h1>
        <p>Software engineering is an iterative discipline...</p>
        <img src="https://blog.com/pixel.gif" width="1" height="1" />
      </article>
      <footer>
        <p>© 2026 Tech Blog</p>
      </footer>
    `;

    const result = ProductScanner.scanDocument(document);
    expect(result.products.length).toBe(0);
  });
});

describe('WebsiteAdapters', () => {
  it('GenericAdapter handles any URL as universal fallback', () => {
    const adapter = new GenericAdapter();
    expect(adapter.canHandle(new URL('https://randomboutique.com/product/123'))).toBe(true);
  });

  it('AmazonAdapter specifically matches amazon domains', () => {
    const adapter = new AmazonAdapter();
    expect(adapter.canHandle(new URL('https://www.amazon.com/dp/B08N5WRWNW'))).toBe(true);
    expect(adapter.canHandle(new URL('https://www.amazon.co.uk/gp/product/B08N5WRWNW'))).toBe(true);
    expect(adapter.canHandle(new URL('https://www.zara.com/us/en/dress-p0123.html'))).toBe(false);
  });

  it('ZaraAdapter specifically matches zara domains', () => {
    const adapter = new ZaraAdapter();
    expect(adapter.canHandle(new URL('https://www.zara.com/us/en/dress-p0123.html'))).toBe(true);
    expect(adapter.canHandle(new URL('https://www.amazon.com/dp/B08N5WRWNW'))).toBe(false);
  });
});
