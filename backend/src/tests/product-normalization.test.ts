import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../main.js';
import { productService } from '../modules/products/product.service.js';
import { ProductCategory } from '@vton/shared';

describe('ProductService Unit Tests', () => {
  it('normalizes candidates and infers category accurately', async () => {
    const rawCandidate = {
      sourceUrl: 'https://shop.example.com/item/101?utm_source=google&ref=search',
      sourceDomain: 'shop.example.com',
      title: 'Vintage Leather Moto Biker Jacket',
      price: 189.99,
      currency: 'USD',
      images: [
        {
          url: 'https://cdn.example.com/images/jacket_front.jpg?utm_medium=cpc',
          viewAngle: 'FRONT' as const,
        },
        {
          url: 'https://cdn.example.com/images/jacket_back.jpg',
          viewAngle: 'BACK' as const,
        },
      ],
      detectionConfidence: 0.95,
      isPrimary: true,
    };

    const result = await productService.normalizeProduct(rawCandidate);
    expect(result.productId).toBeDefined();
    expect(result.category).toBe(ProductCategory.JACKETS);
    expect(result.recommendedPhotoType).toBe('UPPER_BODY');

    const product = result.sanitizedProduct;
    expect(product.title).toBe('Vintage Leather Moto Biker Jacket');
    expect(product.category).toBe(ProductCategory.JACKETS);
    expect(product.price).toBe(189.99);
    expect(product.currency).toBe('USD');
    expect(product.images.length).toBe(2);
    expect(product.selectedImageId).toBe(product.images[0].id);
    expect(product.images[0].isPrimary).toBe(true);
    expect(product.images[0].url).toBe('https://cdn.example.com/images/jacket_front.jpg');
  });

  it('respects explicitly provided ProductCategory without overriding', async () => {
    const rawCandidate = {
      sourceUrl: 'https://shop.example.com/item/102',
      sourceDomain: 'shop.example.com',
      title: 'Multipurpose Athletic Wrap',
      category: ProductCategory.ACCESSORIES,
      images: [
        {
          url: 'https://cdn.example.com/images/wrap.jpg',
        },
      ],
      detectionConfidence: 0.8,
    };

    const result = await productService.normalizeProduct(rawCandidate);
    expect(result.category).toBe(ProductCategory.ACCESSORIES);
  });
});

describe('POST /api/v1/products/normalize Integration Test', () => {
  it('rejects invalid normalization requests with missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/products/normalize')
      .send({
        sourceUrl: 'https://shop.com/shirt',
        // Missing title and images
      });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Validation Error');
  });

  it('validates and normalizes candidate payload successfully', async () => {
    const res = await request(app)
      .post('/api/v1/products/normalize')
      .send({
        sourceUrl: 'https://shop.example.com/item/205?ref=ad',
        sourceDomain: 'shop.example.com',
        title: 'Floral Silk Summer Sundress',
        price: 79.5,
        currency: 'USD',
        images: [
          {
            url: 'https://cdn.shop.com/images/dress_front.jpg',
            viewAngle: 'FRONT',
          },
        ],
        detectionConfidence: 0.92,
        isPrimary: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sanitizedProduct).toBeDefined();
    expect(res.body.data.sanitizedProduct.title).toBe('Floral Silk Summer Sundress');
    expect(res.body.data.category).toBe(ProductCategory.DRESSES);
    expect(res.body.data.recommendedPhotoType).toBe('FRONT_FULL_BODY');
    expect(res.body.data.sanitizedProduct.price).toBe(79.5);
  });
});
