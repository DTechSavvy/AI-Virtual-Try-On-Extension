import { ProductScanResultPayload } from '@vton/shared';
import { ProductScanner } from './product-scanner.js';

export type OnProductsChangedCallback = (result: ProductScanResultPayload) => void;

export class DynamicContentObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private readonly debounceMs = 600;
  private lastProductFingerprint = '';
  private callback: OnProductsChangedCallback | null = null;

  start(callback: OnProductsChangedCallback) {
    this.callback = callback;
    // Perform immediate initial scan on activation
    this.scheduleScan();

    if (this.observer || typeof MutationObserver === 'undefined') return;

    this.observer = new MutationObserver((mutations) => {
      let relevantChange = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node instanceof Element) {
              if (
                node.tagName === 'IMG' ||
                node.querySelector('img') ||
                node.className?.toString().toLowerCase().includes('product')
              ) {
                relevantChange = true;
                break;
              }
            }
          }
        }
        if (relevantChange) break;
      }

      if (relevantChange) {
        this.scheduleScan();
      }
    });

    if (document.body) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  stop() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.callback = null;
  }

  private scheduleScan() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      const result = ProductScanner.scanPage(document);
      const fingerprint = this.computeFingerprint(result);

      if (fingerprint !== this.lastProductFingerprint) {
        this.lastProductFingerprint = fingerprint;
        if (this.callback) {
          this.callback(result);
        }
      }
    }, this.debounceMs);
  }

  private computeFingerprint(result: ProductScanResultPayload): string {
    const ids = result.products.map((p) => `${p.sourceUrl}-${p.images[0]?.url || ''}`).join('|');
    return `${result.products.length}:${ids}`;
  }
}
