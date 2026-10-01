import { WebsiteAdapter } from './adapter.interface.js';
import { GenericAdapter } from './generic.adapter.js';
import { AmazonAdapter } from './amazon.adapter.js';
import { ZaraAdapter } from './zara.adapter.js';
import { RawCandidate } from '../types.js';

export class AdapterRegistry {
  private static adapters: WebsiteAdapter[] = [
    new AmazonAdapter(),
    new ZaraAdapter(),
  ];

  private static genericAdapter = new GenericAdapter();

  /**
   * Run matching website adapter or fall back to generic extraction.
   */
  static extractProducts(document: Document): RawCandidate[] {
    const url = new URL(window.location.href);

    for (const adapter of this.adapters) {
      if (adapter.canHandle(url)) {
        try {
          const results = adapter.extractProducts(document);
          if (results.length > 0) {
            return results;
          }
        } catch {
          // If specific adapter fails, continue to generic fallback
        }
      }
    }

    return this.genericAdapter.extractProducts(document);
  }
}
