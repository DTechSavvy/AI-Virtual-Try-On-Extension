import { ProductScanResultPayload, NormalizedProduct } from '@vton/shared';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import { CandidateScorer } from '../scorer/candidate-scorer.js';
import { CandidateDeduplicator } from '../deduplicator/candidate-deduplicator.js';

export class ProductScanner {
  /**
   * Scan a document and extract normalized product candidates.
   */
  static scanDocument(document: Document = window.document): ProductScanResultPayload {
    return this.scanPage(document);
  }

  /**
   * Scan the active webpage and extract normalized product candidates.
   */
  static scanPage(document: Document = window.document): ProductScanResultPayload {
    const rawCandidates = AdapterRegistry.extractProducts(document);
    const scoredCandidates = CandidateScorer.filterAndSort(rawCandidates);
    const normalizedProducts: NormalizedProduct[] = CandidateDeduplicator.deduplicate(scoredCandidates);

    // Determine page layout type
    let pageType: 'PDP' | 'PLP' | 'UNKNOWN' = 'UNKNOWN';
    let primaryProduct: NormalizedProduct | undefined = undefined;

    if (normalizedProducts.length === 1) {
      pageType = 'PDP';
      primaryProduct = normalizedProducts[0];
      if (primaryProduct) {
        primaryProduct.isPrimary = true;
        primaryProduct.pageType = 'PDP';
      }
    } else if (normalizedProducts.length > 1) {
      // Check if there is an obvious primary hero product (e.g. from JSON-LD / OG)
      const heroProduct = normalizedProducts.find((p) => p.metadata?.isPrimaryPageProduct);
      if (heroProduct && heroProduct.detectionConfidence >= 0.8) {
        pageType = 'PDP';
        primaryProduct = heroProduct;
        primaryProduct.isPrimary = true;
        primaryProduct.pageType = 'PDP';
      } else {
        pageType = 'PLP';
        primaryProduct = normalizedProducts[0];
        normalizedProducts.forEach((p) => {
          p.pageType = 'PLP';
        });
      }
    }

    return {
      pageType,
      pageTitle: document.title,
      sourceUrl: window.location.href,
      sourceDomain: window.location.hostname,
      primaryProduct,
      products: normalizedProducts,
      scannedAt: new Date().toISOString(),
    };
  }
}
