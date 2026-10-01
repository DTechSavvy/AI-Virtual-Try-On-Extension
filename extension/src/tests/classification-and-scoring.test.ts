import { describe, it, expect } from 'vitest';
import { ProductCategory } from '@vton/shared';
import { CategoryClassifier } from '../content/classifier/category-classifier.js';
import { CandidateScorer } from '../content/scorer/candidate-scorer.js';
import { RawCandidate } from '../content/types.js';

describe('CategoryClassifier', () => {
  it('correctly classifies TOPS and t-shirts', () => {
    const res1 = CategoryClassifier.classify('Classic Cotton Crewneck T-Shirt');
    expect(res1.category).toBe(ProductCategory.TOPS);
    expect(res1.confidence).toBeGreaterThan(0.7);

    const res2 = CategoryClassifier.classify('Knitted Crop Tank Top', 'Soft ribbed knit sleeveless top');
    expect(res2.category).toBe(ProductCategory.TOPS);
    expect(res2.confidence).toBeGreaterThan(0.7);
  });

  it('correctly classifies SHIRTS', () => {
    const res = CategoryClassifier.classify('Slim Fit Button-Down Oxford Shirt');
    expect(res.category).toBe(ProductCategory.SHIRTS);
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  it('correctly classifies DRESSES', () => {
    const res = CategoryClassifier.classify('Floral Print Maxi Summer Gown Dress');
    expect(res.category).toBe(ProductCategory.DRESSES);
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  it('correctly classifies JACKETS and outerwear', () => {
    const res = CategoryClassifier.classify('Vintage Leather Biker Jacket with Zipper');
    expect(res.category).toBe(ProductCategory.JACKETS);
    expect(res.confidence).toBeGreaterThan(0.7);

    const res2 = CategoryClassifier.classify('Wool Blend Overcoat Trench');
    expect(res2.category).toBe(ProductCategory.JACKETS);
  });

  it('correctly classifies PANTS and bottom wear', () => {
    const res1 = CategoryClassifier.classify('High-Rise Straight Leg Denim Jeans');
    expect(res1.category).toBe(ProductCategory.PANTS);

    const res2 = CategoryClassifier.classify('Tailored Pleated Trousers');
    expect(res2.category).toBe(ProductCategory.PANTS);
  });

  it('correctly classifies SHOES and footwear', () => {
    const res1 = CategoryClassifier.classify('Retro Running Sneakers White');
    expect(res1.category).toBe(ProductCategory.SHOES);

    const res2 = CategoryClassifier.classify('Leather Ankle Chelsea Boots');
    expect(res2.category).toBe(ProductCategory.SHOES);
  });

  it('correctly classifies JEWELLERY and accessories', () => {
    const res = CategoryClassifier.classify('14k Gold Plated Hoop Earrings');
    expect(res.category).toBe(ProductCategory.JEWELLERY);
  });

  it('correctly classifies NECKLACES specifically', () => {
    const res = CategoryClassifier.classify('Diamond Choker Pendant Necklace');
    expect(res.category).toBe(ProductCategory.NECKLACES);
  });

  it('correctly classifies ACCESSORIES', () => {
    const res1 = CategoryClassifier.classify('Full Grain Leather Dress Belt');
    expect(res1.category).toBe(ProductCategory.ACCESSORIES);

    const res2 = CategoryClassifier.classify('Cashmere Winter Scarf');
    expect(res2.category).toBe(ProductCategory.ACCESSORIES);
  });

  it('falls back to CUSTOM with low confidence on non-fashion items', () => {
    const res = CategoryClassifier.classify('Wireless Bluetooth Ergonomic Computer Mouse');
    expect(res.category).toBe(ProductCategory.CUSTOM);
    expect(res.confidence).toBeLessThanOrEqual(0.3);
  });
});

describe('CandidateScorer', () => {
  it('awards high confidence to candidates with rich product signals', () => {
    const candidate: RawCandidate = {
      id: 'test-rich',
      sourceUrl: 'https://shop.example.com/p/summer-dress',
      sourceDomain: 'shop.example.com',
      title: 'Floral Summer Dress',
      price: 49.99,
      currency: 'USD',
      category: ProductCategory.DRESSES,
      images: [
        {
          url: 'https://shop.example.com/images/dress-front.jpg',
          width: 800,
          height: 1200,
          viewAngle: 'FRONT',
        },
      ],
      isPrimary: true,
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

    const scored = CandidateScorer.scoreCandidate(candidate);
    expect(scored.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('heavily penalizes candidates with negative signals (e.g. logos or tiny dimensions)', () => {
    const candidate: RawCandidate = {
      id: 'test-logo',
      sourceUrl: 'https://shop.example.com/',
      sourceDomain: 'shop.example.com',
      title: 'Site Brand Logo',
      images: [
        {
          url: 'https://shop.example.com/static/brand-logo.png',
          width: 80,
          height: 30,
        },
      ],
      signals: {
        hasJsonLd: false,
        hasOg: false,
        hasPrice: false,
        hasProductLink: false,
        hasAddToCart: false,
        hasFashionKeywords: false,
        isCardStructure: false,
        isHeroImage: false,
        dimensionScore: 0.1,
        negativeSignalScore: 0.9,
      },
    };

    const scored = CandidateScorer.scoreCandidate(candidate);
    expect(scored.confidence).toBeLessThan(0.45);
  });

  it('filters out candidates below the minimum threshold', () => {
    const list: RawCandidate[] = [
      {
        id: 'valid-item',
        sourceUrl: 'https://shop.example.com/shirt',
        sourceDomain: 'shop.example.com',
        title: 'Linen Shirt',
        price: 29.99,
        images: [{ url: 'https://shop.example.com/shirt.jpg', width: 500, height: 600 }],
        signals: {
          hasJsonLd: true,
          hasOg: false,
          hasPrice: true,
          hasProductLink: true,
          hasAddToCart: true,
          hasFashionKeywords: true,
          isCardStructure: true,
          isHeroImage: false,
          dimensionScore: 1.0,
          negativeSignalScore: 0,
        },
      },
      {
        id: 'garbage-icon',
        sourceUrl: 'https://shop.example.com/icon',
        sourceDomain: 'shop.example.com',
        title: 'Shopping Cart Icon',
        images: [{ url: 'https://shop.example.com/cart.svg', width: 24, height: 24 }],
        signals: {
          hasJsonLd: false,
          hasOg: false,
          hasPrice: false,
          hasProductLink: false,
          hasAddToCart: false,
          hasFashionKeywords: false,
          isCardStructure: false,
          isHeroImage: false,
          dimensionScore: 0,
          negativeSignalScore: 1.0,
        },
      },
    ];

    const results = CandidateScorer.scoreCandidates(list);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('valid-item');
  });
});
