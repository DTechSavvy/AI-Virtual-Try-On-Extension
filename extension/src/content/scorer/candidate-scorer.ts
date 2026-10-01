import { RawCandidate, ScoredCandidate } from '../types.js';

export interface ScoringWeights {
  jsonLd: number;
  openGraph: number;
  heroImage: number;
  cardStructure: number;
  fashionKeywords: number;
  price: number;
  addToCart: number;
  dimensions: number;
  productLink: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  jsonLd: 0.45,
  openGraph: 0.25,
  heroImage: 0.25,
  cardStructure: 0.15,
  fashionKeywords: 0.15,
  price: 0.1,
  addToCart: 0.1,
  dimensions: 0.1,
  productLink: 0.1,
};

export const MIN_CONFIDENCE_THRESHOLD = 0.4;

export class CandidateScorer {
  /**
   * Score an individual candidate based on accumulated evidence.
   */
  static scoreCandidate(
    candidate: RawCandidate,
    weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
  ): ScoredCandidate {
    let score = 0;

    if (candidate.signals.hasJsonLd) score += weights.jsonLd;
    if (candidate.signals.hasOg) score += weights.openGraph;
    if (candidate.signals.isHeroImage) score += weights.heroImage;
    if (candidate.signals.isCardStructure) score += weights.cardStructure;
    if (candidate.signals.hasFashionKeywords) score += weights.fashionKeywords;
    if (candidate.signals.hasPrice) score += weights.price;
    if (candidate.signals.hasAddToCart) score += weights.addToCart;
    if (candidate.signals.hasProductLink) score += weights.productLink;
    score += (candidate.signals.dimensionScore || 0.8) * weights.dimensions;

    // Apply negative penalties
    if (candidate.signals.negativeSignalScore > 0) {
      score -= candidate.signals.negativeSignalScore;
    }

    // Clamp score between 0.0 and 1.0
    const confidence = Math.max(0.0, Math.min(1.0, parseFloat(score.toFixed(2))));

    return {
      ...candidate,
      confidence,
    };
  }

  /**
   * Score candidates, filter by threshold, and sort descending.
   */
  static scoreCandidates(
    candidates: RawCandidate[],
    threshold: number = MIN_CONFIDENCE_THRESHOLD
  ): ScoredCandidate[] {
    return this.filterAndSort(candidates, threshold);
  }

  /**
   * Filter and sort candidates by confidence.
   */
  static filterAndSort(
    candidates: RawCandidate[],
    threshold: number = MIN_CONFIDENCE_THRESHOLD
  ): ScoredCandidate[] {
    const scored = candidates.map((c) => this.scoreCandidate(c));
    let passed = scored.filter((c) => c.confidence >= threshold);
    // Relax threshold if page has candidate products but sparse metadata
    if (passed.length === 0 && scored.length > 0) {
      passed = scored.filter((c) => c.confidence >= 0.25);
    }
    return passed.sort((a, b) => b.confidence - a.confidence);
  }
}
