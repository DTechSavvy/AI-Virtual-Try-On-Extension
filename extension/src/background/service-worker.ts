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

    case ExtensionMessageType.TRIGGER_PRODUCT_DETECTION:
    case ExtensionMessageType.RESCAN_PAGE: {
      const handleTab = (activeTab: chrome.tabs.Tab | undefined) => {
        if (!activeTab?.id) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        const tabId = activeTab.id;
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            // Attempt to inject content script on demand if missing
            if (chrome.scripting) {
              chrome.scripting
                .executeScript({
                  target: { tabId },
                  files: ['content-script.js'],
                })
                .then(() => {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, message, (retryRes) => {
                      sendResponse(retryRes || { success: false, error: 'Failed after auto-injection' });
                    });
                  }, 150);
                })
                .catch((err) => {
                  sendResponse({
                    success: false,
                    error: `Could not scan page: ${err.message || 'Please refresh the shopping webpage.'}`,
                  });
                });
              return;
            }

            sendResponse({ success: false, error: 'Please refresh the shopping webpage and click Re-scan.' });
            return;
          }
          sendResponse(response);
        });
      };

      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          handleTab(tabs[0]);
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
            handleTab(fallbackTabs[0]);
          });
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
  if (
    (changeInfo.status === 'complete' || changeInfo.url) &&
    tab.url &&
    !tab.url.startsWith('chrome://') &&
    !tab.url.startsWith('chrome-extension://')
  ) {
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

// Broadcast tab switches to active side panel
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      chrome.runtime.sendMessage({
        type: ExtensionMessageType.TAB_URL_CHANGED,
        payload: { tabId: tab.id, url: tab.url, title: tab.title },
        source: 'SERVICE_WORKER',
        timestamp: Date.now(),
      } as ExtensionMessage).catch(() => {
        // Ignore error when side panel is closed
      });
    }
  } catch {
    // Ignore
  }
});
