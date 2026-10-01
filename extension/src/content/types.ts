import { ProductCategory, ImageViewAngle } from '@vton/shared';

export interface RawCandidateImage {
  url: string;
  width?: number;
  height?: number;
  altText?: string;
  sourceElement?: Element;
  viewAngle?: ImageViewAngle;
  score?: number;
}

export interface RawCandidate {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  description?: string;
  brand?: string;
  price?: number;
  currency?: string;
  sku?: string;
  category?: ProductCategory;
  images: RawCandidateImage[];
  isPrimary?: boolean;
  domElement?: Element;
  signals: {
    hasJsonLd: boolean;
    hasOg: boolean;
    hasPrice: boolean;
    hasProductLink: boolean;
    hasAddToCart: boolean;
    hasFashionKeywords: boolean;
    isCardStructure: boolean;
    isHeroImage: boolean;
    dimensionScore: number;
    negativeSignalScore: number;
  };
}

export interface ScoredCandidate extends RawCandidate {
  confidence: number;
}

export interface PageScanOptions {
  forceRescan?: boolean;
  maxCandidates?: number;
}
