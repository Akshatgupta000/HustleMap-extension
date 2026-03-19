// background.js - Capture + crop on SELECTION_COMPLETE, store pending screenshot for popup preview

const PENDING_KEY = "hustlemap_pending_screenshot";

chrome.runtime.onInstalled.addListener(() => {
  console.log("HustleMap extension installed.");
});

/**
 * Clear any pending screenshot so the next capture starts
 * from a clean state.
 */
const clearPendingScreenshot = async () => {
  try {
    await chrome.storage.local.remove(PENDING_KEY);
  } catch (err) {
    console.error("HustleMap – failed to clear pending screenshot:", err);
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SELECTION_COMPLETE") return;

  (async () => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const { left, top, width, height, devicePixelRatio } = message;

    try {
      const tab = await chrome.tabs.get(tabId);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

      const cropResponse = await chrome.tabs.sendMessage(tabId, {
        type: "CROP_SCREENSHOT",
        dataUrl,
        left,
        top,
        width,
        height,
        devicePixelRatio: devicePixelRatio ?? 1,
      });

      if (!cropResponse?.ok || !cropResponse.dataUrl) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "HustleMap",
          message: "Screenshot crop failed.",
        });
        return;
      }

      const timestamp = Date.now();
      const jobUrl = tab.url || "";
      const pageTitle = tab.title || "";

      await chrome.storage.local.set({
        [PENDING_KEY]: {
          screenshotBase64: cropResponse.dataUrl,
          jobUrl,
          pageTitle,
          timestamp,
        },
      });

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "HustleMap",
        message: "Screenshot captured! Click the extension to preview and save.",
      });
    } catch (err) {
      console.error("HustleMap background error:", err);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "HustleMap – Error",
        message: "Screenshot failed. Try again.",
      });
    }
  })();
  return true;
});

// Reset pending screenshot when the tab reloads or navigates.
// This uses tabs.onUpdated so it also catches most SPA navigations on supported sites.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo) return;

  const startedLoading = changeInfo.status === "loading";
  const urlChanged = typeof changeInfo.url === "string" && changeInfo.url.length > 0;

  if (startedLoading || urlChanged) {
    clearPendingScreenshot();
  }
});
