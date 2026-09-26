import { ExtensionMessage, ExtensionMessageType, ProductCategory } from '@vton/shared';

console.log('[VTON Content Script] Virtual Try-On content script active on:', window.location.href);

// Non-destructive page product detection stub
function scanCurrentPage() {
  const pageTitle = document.title;
  const canonicalUrl = window.location.href;
  const domain = window.location.hostname;

  // Basic harvest: JSON-LD structured data if available
  let structuredProduct: any = null;
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data['@type'] === 'Product' || (Array.isArray(data['@graph']) && data['@graph'].some((item: any) => item['@type'] === 'Product'))) {
        structuredProduct = data;
      }
    } catch {
      // Ignore JSON parse errors on malformed vendor scripts
    }
  });

  // Extract open graph image
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');

  return {
    sourceDomain: domain,
    sourceUrl: canonicalUrl,
    title: ogTitle || pageTitle,
    category: ProductCategory.TOPS,
    primaryImage: ogImage || null,
    hasStructuredData: structuredProduct !== null,
    scannedAt: new Date().toISOString(),
  };
}

// Listen for messages from the service worker or side panel
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === ExtensionMessageType.TRIGGER_PRODUCT_DETECTION) {
    const candidateData = scanCurrentPage();
    sendResponse({
      success: true,
      data: candidateData,
    });
  }
  return true;
});
