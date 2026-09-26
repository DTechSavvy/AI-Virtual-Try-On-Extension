import { ExtensionMessage, ExtensionMessageType } from '@vton/shared';

console.log('[VTON Service Worker] Initializing background service worker...');

// Configure side panel to open automatically when user clicks extension action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => console.log('[VTON Service Worker] Side panel behavior configured.'))
  .catch((err) => console.error('[VTON Service Worker] Failed to set side panel behavior:', err));

// Runtime message listener for communication between Content Scripts and Side Panel
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  console.log(`[VTON Service Worker] Message received from ${message.source}:`, message.type);

  switch (message.type) {
    case ExtensionMessageType.GET_EXTENSION_STATUS:
      sendResponse({ status: 'ACTIVE', version: '1.0.0' });
      break;

    case ExtensionMessageType.TRIGGER_PRODUCT_DETECTION: {
      // Forward detection request to the active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, message, (response) => {
            sendResponse(response);
          });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
      return true; // Keep message channel open for async response
    }

    default:
      sendResponse({ success: true, acknowledged: true });
      break;
  }
  return true;
});

// Broadcast tab changes to active side panel
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    chrome.runtime.sendMessage({
      type: ExtensionMessageType.TAB_URL_CHANGED,
      payload: { tabId, url: tab.url, title: tab.title },
      source: 'SERVICE_WORKER',
      timestamp: Date.now(),
    } as ExtensionMessage).catch(() => {
      // Ignore error when side panel is closed
    });
  }
});
