import {
  ExtensionMessage,
  ExtensionMessageType,
  ProductScanResultPayload,
} from '@vton/shared';
import { ProductScanner } from './scanner/product-scanner.js';
import { DynamicContentObserver } from './scanner/mutation-observer.js';

console.log('[VTON Content Script] Virtual Try-On discovery engine initialized on:', window.location.href);

const observer = new DynamicContentObserver();

// Broadcast dynamic changes to service worker / side panel
observer.start((result: ProductScanResultPayload) => {
  chrome.runtime
    .sendMessage({
      type: ExtensionMessageType.PRODUCT_DETECTION_RESULT,
      payload: result,
      source: 'CONTENT_SCRIPT',
      timestamp: Date.now(),
    } as ExtensionMessage<ProductScanResultPayload>)
    .catch(() => {
      // Side panel may be closed, ignore
    });
});

// Runtime message listener for scan requests from Side Panel or Service Worker
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (
    message.type === ExtensionMessageType.TRIGGER_PRODUCT_DETECTION ||
    message.type === ExtensionMessageType.RESCAN_PAGE
  ) {
    try {
      const scanResult: ProductScanResultPayload = ProductScanner.scanPage(document);
      sendResponse({
        success: true,
        data: scanResult,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown product scanning error';
      sendResponse({
        success: false,
        error: errorMsg,
      });
    }
    return false;
  }
  return false;
});

// Detect client-side SPA route changes on modern shopping stores
const onSpaNavigate = () => {
  setTimeout(() => {
    try {
      const scanResult: ProductScanResultPayload = ProductScanner.scanPage(document);
      chrome.runtime
        .sendMessage({
          type: ExtensionMessageType.PRODUCT_DETECTION_RESULT,
          payload: scanResult,
          source: 'CONTENT_SCRIPT',
          timestamp: Date.now(),
        } as ExtensionMessage<ProductScanResultPayload>)
        .catch(() => {});
    } catch {
      // Ignore
    }
  }, 400);
};

window.addEventListener('popstate', onSpaNavigate);
window.addEventListener('hashchange', onSpaNavigate);

try {
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    onSpaNavigate();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    onSpaNavigate();
    return result;
  };
} catch {
  // Ignore in sandboxed contexts
}
