import { describe, it, expect } from 'vitest';
import { ImageExtractor } from '../content/extractors/image-extractor.js';

describe('ImageExtractor.cleanImageUrl', () => {
  it('strips Amazon thumbnail resizing tokens to yield high-res master image', () => {
    const original = 'https://m.media-amazon.com/images/I/71xyzAB12L._AC_UL320_.jpg';
    const cleaned = ImageExtractor.cleanImageUrl(original);
    expect(cleaned).toBe('https://m.media-amazon.com/images/I/71xyzAB12L.jpg');

    const originalCrop = 'https://m.media-amazon.com/images/I/81abcDEF._AC_SR250,250_.jpg';
    expect(ImageExtractor.cleanImageUrl(originalCrop)).toBe('https://m.media-amazon.com/images/I/81abcDEF.jpg');
  });

  it('strips Shopify image dimensions to get original high-res asset', () => {
    const shopifySmall = 'https://cdn.shopify.com/s/files/1/00/products/classic-tee_medium.jpg?v=1600000000';
    const cleaned = ImageExtractor.cleanImageUrl(shopifySmall);
    expect(cleaned).toBe('https://cdn.shopify.com/s/files/1/00/products/classic-tee.jpg');

    const shopifyDim = 'https://cdn.shopify.com/s/files/1/00/products/dress_480x480.png';
    expect(ImageExtractor.cleanImageUrl(shopifyDim)).toBe('https://cdn.shopify.com/s/files/1/00/products/dress.png');
  });

  it('strips tracking and analytics query parameters', () => {
    const trackedUrl = 'https://example.com/item.jpg?utm_source=google&utm_medium=cpc&fbclid=xyz&ref_=ps_1';
    const cleaned = ImageExtractor.cleanImageUrl(trackedUrl);
    expect(cleaned).toBe('https://example.com/item.jpg');
  });

  it('resolves protocol-relative URLs', () => {
    const protoRelative = '//cdn.example.com/products/item.jpg';
    const cleaned = ImageExtractor.cleanImageUrl(protoRelative);
    expect(cleaned).toBe('https://cdn.example.com/products/item.jpg');
  });
});

describe('ImageExtractor.isNonProductImage', () => {
  it('flags icons, logos, badges and tracking pixels as non-product images', () => {
    expect(ImageExtractor.isNonProductImage('https://shop.com/assets/logo.svg')).toBe(true);
    expect(ImageExtractor.isNonProductImage('https://shop.com/static/cart-icon.png')).toBe(true);
    expect(ImageExtractor.isNonProductImage('https://shop.com/pixel.gif', 1, 1)).toBe(true);
    expect(ImageExtractor.isNonProductImage('https://shop.com/avatar.jpg')).toBe(true);
    expect(ImageExtractor.isNonProductImage('https://shop.com/social-facebook.png')).toBe(true);
    expect(ImageExtractor.isNonProductImage('data:image/svg+xml;base64,PHN2Zy...')).toBe(true);
  });

  it('flags images smaller than 120px as non-product images', () => {
    expect(ImageExtractor.isNonProductImage('https://shop.com/img.jpg', 64, 64)).toBe(true);
    expect(ImageExtractor.isNonProductImage('https://shop.com/img.jpg', 119, 150)).toBe(true);
  });

  it('accepts legitimate full-size product photos', () => {
    expect(ImageExtractor.isNonProductImage('https://shop.com/products/summer-dress-model.jpg', 800, 1200)).toBe(false);
    expect(ImageExtractor.isNonProductImage('https://cdn.shop.com/p/tshirt-front.jpg', 600, 800)).toBe(false);
  });
});

describe('ImageExtractor.detectViewAngle', () => {
  it('correctly identifies FRONT views', () => {
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/dress_front.jpg')).toBe('FRONT');
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/dress.jpg', 'Model front view')).toBe('FRONT');
  });

  it('correctly identifies BACK views', () => {
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/jacket_back.jpg')).toBe('BACK');
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/jacket.jpg', 'Rear angle view')).toBe('BACK');
  });

  it('correctly identifies SIDE views', () => {
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/shoe_profile.jpg')).toBe('SIDE');
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/shoe.jpg', 'Lateral side view')).toBe('SIDE');
  });

  it('correctly identifies FLAT_LAY or DETAIL views', () => {
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/shirt_flatlay.jpg')).toBe('FLAT_LAY');
    expect(ImageExtractor.detectViewAngle('https://shop.com/p/fabric_macro_detail.jpg')).toBe('DETAIL');
  });
});

describe('ImageExtractor.resolveHighestResUrl', () => {
  it('extracts the highest resolution candidate from a responsive srcset', () => {
    const img = document.createElement('img');
    img.src = 'https://shop.com/img-300.jpg';
    img.setAttribute(
      'srcset',
      'https://shop.com/img-300.jpg 300w, https://shop.com/img-800.jpg 800w, https://shop.com/img-1600.jpg 1600w'
    );

    const highestRes = ImageExtractor.resolveHighestResUrl(img);
    expect(highestRes).toBe('https://shop.com/img-1600.jpg');
  });

  it('favors data-zoom-image or data-high-res attributes when available', () => {
    const img = document.createElement('img');
    img.src = 'https://shop.com/standard.jpg';
    img.setAttribute('data-zoom-image', 'https://shop.com/ultra-zoom.jpg');

    const highestRes = ImageExtractor.resolveHighestResUrl(img);
    expect(highestRes).toBe('https://shop.com/ultra-zoom.jpg');
  });
});
