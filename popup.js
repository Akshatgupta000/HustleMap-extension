// popup.js - Screenshot capture → preview → save with user ID from settings

const STORAGE_KEYS = {
  apiBase: 'hustlemap_api_base',
  userId: 'hustlemap_extension_id',
  pendingScreenshot: 'hustlemap_pending_screenshot',
};

const statusEl = document.getElementById('statusMessage');
const saveButton = document.getElementById('saveJobButton');
const userIdInput = document.getElementById('userIdInput');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const settingsStatus = document.getElementById('settingsStatus');
const captureSection = document.getElementById('captureSection');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const previewJobUrl = document.getElementById('previewJobUrl');
const previewUserIdHint = document.getElementById('previewUserIdHint');
const confirmSaveButton = document.getElementById('confirmSaveButton');
const resetPreviewButton = document.getElementById('resetPreviewButton');

const resetPreviewUI = () => {
  if (previewSection) {
    previewSection.classList.add('hidden');
    previewSection.removeAttribute('data-pending');
  }
  if (captureSection) captureSection.classList.remove('hidden');
  if (previewImage) previewImage.src = '';
  if (previewJobUrl) previewJobUrl.textContent = '';
};

const setStatus = (message, type = 'info') => {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-message status-${type}`;
};

const showNotification = (title, message) => {
  if (!chrome?.notifications) return;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
  });
};

const notifyWebAppTabs = async () => {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.url &&
        (tab.url.includes('localhost') || tab.url.includes('hustlemap'))
      ) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              window.dispatchEvent(new CustomEvent('hustlemap:job_saved'));
              window.postMessage({ type: 'HUSTLEMAP_JOB_SAVED' }, '*');
              try {
                localStorage.setItem(
                  'hustlemap_last_job_saved',
                  Date.now().toString(),
                );
              } catch (e) {}
            },
          });
        } catch (e) {
          // ignore tab scripting errors
        }
      }
    }
  } catch (e) {
    console.warn('HustleMap – failed to notify web app tabs:', e);
  }
};

const isSupportedTab = (url) => {
  if (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('chrome-extension://')
  )
    return false;
  return true;
};

const sendToContent = async (tabId, message) => {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    const noReceiver =
      err?.message?.includes('Receiving end does not exist') ||
      err?.message?.includes('Could not establish connection');
    if (!noReceiver || !chrome.scripting) throw err;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    return await chrome.tabs.sendMessage(tabId, message);
  }
};

// Load saved user ID and any pending screenshot
async function loadState() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.userId,
    STORAGE_KEYS.pendingScreenshot,
  ]);

  const savedUserId = stored[STORAGE_KEYS.userId] || '';
  if (userIdInput) userIdInput.value = savedUserId;

  const pending = stored[STORAGE_KEYS.pendingScreenshot];
  if (pending?.screenshotBase64) {
    if (previewSection) {
      previewSection.classList.remove('hidden');
      if (captureSection) captureSection.classList.add('hidden');
      previewSection.dataset.pending = JSON.stringify({
        screenshotBase64: pending.screenshotBase64,
        jobUrl: pending.jobUrl || '',
        pageTitle: pending.pageTitle || '',
        timestamp: pending.timestamp ?? Date.now(),
      });
    }
    if (previewImage) previewImage.src = pending.screenshotBase64;
    if (previewJobUrl) previewJobUrl.textContent = pending.jobUrl || '—';

    const needId = !savedUserId.trim();
    if (confirmSaveButton) {
      confirmSaveButton.disabled = needId;
      confirmSaveButton.title = needId
        ? 'Enter your User ID in Settings first'
        : '';
    }
    if (previewUserIdHint) {
      if (needId) previewUserIdHint.classList.remove('hidden');
      else previewUserIdHint.classList.add('hidden');
    }
  } else {
    resetPreviewUI();
  }
}

// Save user ID to storage
saveSettingsButton?.addEventListener('click', async () => {
  const id = (userIdInput?.value || '').trim();
  if (!id) {
    settingsStatus.textContent = 'Enter a user ID.';
    settingsStatus.style.color = '#b91c1c';
    return;
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.userId]: id,
  });
  settingsStatus.textContent = 'Saved.';
  settingsStatus.style.color = '#15803d';
  loadState(); // re-enable Save if there was a pending screenshot
});

// Start job capture (always trigger rectangle screenshot mode)
saveJobButton?.addEventListener('click', async () => {
  setStatus('Draw a rectangle to capture screenshot...', 'info');
  if (saveButton) saveButton.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      setStatus('Could not find the active tab.', 'error');
      if (saveButton) saveButton.disabled = false;
      return;
    }
    if (!isSupportedTab(tab.url)) {
      setStatus(
        'Open a job posting on LinkedIn, Indeed, or Glassdoor first.',
        'error',
      );
      if (saveButton) saveButton.disabled = false;
      return;
    }

    await sendToContent(tab.id, { type: 'START_SELECTION_MODE' });
    setTimeout(() => window.close(), 100);
  } catch (err) {
    setStatus('Could not start capture. Try refreshing the page.', 'error');
    if (saveButton) saveButton.disabled = false;
  }
});

// Confirm save (from preview)
confirmSaveButton?.addEventListener('click', async () => {
  const pendingJson = previewSection?.dataset?.pending;
  if (!pendingJson) return;
  let pending;
  try {
    pending = JSON.parse(pendingJson);
  } catch {
    setStatus('Invalid preview data.', 'error');
    return;
  }
  const userId = (userIdInput?.value || '').trim();
  if (!userId) {
    setStatus('Enter your HustleMap User ID in Settings first.', 'error');
    return;
  }

  confirmSaveButton.disabled = true;
  setStatus('Saving...', 'info');

  try {
    // Try to enrich with structured job data from the page
    let jobMeta = null;
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        const response = await sendToContent(tab.id, { type: 'CAPTURE_JOB' });
        if (response?.ok && response.data) {
          jobMeta = response.data;
        }
      }
    } catch (metaErr) {
      console.warn('HustleMap: failed to extract job meta from page', metaErr);
    }

    const source = (jobMeta?.source || '').toString().toLowerCase() || 'other';

    let genericTitle = pending.pageTitle || 'Captured Job';
    let genericCompany = 'Unknown Company';

    if (pending.pageTitle) {
      if (pending.pageTitle.includes(' at ')) {
        [genericTitle, genericCompany] = pending.pageTitle.split(' at ');
      } else if (pending.pageTitle.includes(' | ')) {
        [genericTitle, genericCompany] = pending.pageTitle.split(' | ');
      } else if (pending.pageTitle.includes(' - ')) {
        [genericTitle, genericCompany] = pending.pageTitle.split(' - ');
      }
    }

    const bodyPayload = {
      extensionId: userId,
      screenshot: pending.screenshotBase64,
      source,
      url: pending.jobUrl,
      jobTitle: (jobMeta?.jobTitle || genericTitle)?.trim().slice(0, 100),
      company: (jobMeta?.company || genericCompany)?.trim().slice(0, 100),
      location: jobMeta?.location || '',
      description: jobMeta?.description || '',
    };

    const endpoints = [
      'http://localhost:5001/api/jobs/save-from-extension',
      'https://hustlemap-2.onrender.com/api/jobs/save-from-extension',
    ];

    let res = null;
    let body = {};
    let lastErr = null;

    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });
        if (r.ok) {
          res = r;
          body = await r.json().catch(() => ({}));
          break;
        } else {
          res = r;
          body = await r.json().catch(() => ({}));
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!res || !res.ok) {
      console.error("Network or server error:", lastErr || body);
      setStatus(body?.error || 'Failed to save to server.', 'error');
      showNotification(
        'HustleMap – Error',
        body?.error || 'Failed to save job',
      );
      confirmSaveButton.disabled = false;
      return;
    }

    setStatus('Saved to HustleMap.', 'success');
    showNotification('HustleMap', 'Job saved successfully');
    notifyWebAppTabs();

    // Clear pending state so the next time the popup opens it starts clean.
    await chrome.storage.local.remove(STORAGE_KEYS.pendingScreenshot);
    resetPreviewUI();
  } catch (err) {
    console.error("Network error:", err);
    setStatus('Network error. Check console logs.', 'error');
    showNotification('HustleMap – Error', 'Network error.');
  } finally {
    confirmSaveButton.disabled = false;
  }
});

// Reset preview (clear pending screenshot and UI)
resetPreviewButton?.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.pendingScreenshot);
  } catch (err) {
    console.error(
      'HustleMap – failed to clear pending screenshot on reset:',
      err,
    );
  }
  resetPreviewUI();
  setStatus('Preview cleared. You can capture a new job.', 'info');
});

// Messages from content/background
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'SELECTION_CANCELLED') {
    setStatus('Selection cancelled. Click Save Job to try again.', 'info');
    if (saveButton) saveButton.disabled = false;
    return;
  }
  if (message?.type === 'SELECTION_COMPLETE') {
    setStatus(
      'Screenshot captured! Preview above. Open the extension again if the popup closed.',
      'success',
    );
    if (saveButton) saveButton.disabled = false;
  }
});

// Init
loadState();
