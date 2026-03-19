// popup.js - Screenshot capture → preview → save with user ID from settings

let HUSTLEMAP_API_BASE = 'https://hustlemap-2.onrender.com/api';
const screenshotEndpoint = () =>
  `${HUSTLEMAP_API_BASE.replace(/\/+$/, '')}/jobs/save-from-extension`;

const STORAGE_KEYS = {
  apiBase: 'hustlemap_api_base',
  userId: 'hustlemap_extension_id',
  pendingScreenshot: 'hustlemap_pending_screenshot',
};

const statusEl = document.getElementById('statusMessage');
const saveButton = document.getElementById('saveJobButton');
const apiBaseInput = document.getElementById('apiBaseInput');
const userIdInput = document.getElementById('userIdInput');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const settingsStatus = document.getElementById('settingsStatus');
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

const isSupportedTab = (url) => {
  if (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  )
    return false;
  try {
    const host = new URL(url).hostname || '';
    return ['linkedin.com', 'indeed.com', 'glassdoor.com'].some((d) =>
      host.includes(d),
    );
  } catch {
    return false;
  }
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
    STORAGE_KEYS.apiBase,
    STORAGE_KEYS.userId,
    STORAGE_KEYS.pendingScreenshot,
  ]);
  let savedApiBase =
    stored[STORAGE_KEYS.apiBase] || 'https://hustlemap-2.onrender.com/api';
    
  // Auto-correct previously hardcoded wrong ports from old versions
  if (savedApiBase === 'http://localhost:5009/api' || savedApiBase === 'http://localhost:5005/api' || savedApiBase === 'http://localhost:5000/api') {
    savedApiBase = 'https://hustlemap-2.onrender.com/api';
    chrome.storage.local.set({ [STORAGE_KEYS.apiBase]: savedApiBase });
  }

  HUSTLEMAP_API_BASE = savedApiBase;
  if (apiBaseInput) apiBaseInput.value = savedApiBase;

  const savedUserId = stored[STORAGE_KEYS.userId] || '';
  if (userIdInput) userIdInput.value = savedUserId;

  const pending = stored[STORAGE_KEYS.pendingScreenshot];
  if (pending?.screenshotBase64) {
    if (previewSection) {
      previewSection.classList.remove('hidden');
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
  const apiBase = (apiBaseInput?.value || '').trim();
  const id = (userIdInput?.value || '').trim();
  if (!apiBase) {
    settingsStatus.textContent = 'Enter an API base URL.';
    settingsStatus.style.color = '#b91c1c';
    return;
  }
  if (!id) {
    settingsStatus.textContent = 'Enter a user ID.';
    settingsStatus.style.color = '#b91c1c';
    return;
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiBase]: apiBase,
    [STORAGE_KEYS.userId]: id,
  });
  HUSTLEMAP_API_BASE = apiBase;
  settingsStatus.textContent = 'Saved.';
  settingsStatus.style.color = '#15803d';
  loadState(); // re-enable Save if there was a pending screenshot
});

// Start job capture (try DOM extraction first, fallback to screenshot)
saveJobButton?.addEventListener('click', async () => {
  setStatus('Extracting job details...', 'info');
  saveButton.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      setStatus('Could not find the active tab.', 'error');
      saveButton.disabled = false;
      return;
    }
    if (!isSupportedTab(tab.url)) {
      setStatus(
        'Open a job posting on LinkedIn, Indeed, or Glassdoor first.',
        'error',
      );
      saveButton.disabled = false;
      return;
    }

    // Try to extract job data from DOM
    let jobMeta = null;
    try {
      const response = await sendToContent(tab.id, { type: 'CAPTURE_JOB' });
      if (response?.ok && response.data && !response.data.error) {
        jobMeta = response.data;
      }
    } catch (metaErr) {
      console.warn('HustleMap: failed to extract job meta from page', metaErr);
    }

    if (jobMeta && (jobMeta.jobTitle || jobMeta.company)) {
      // Extraction successful, show preview with data
      if (previewSection) {
        previewSection.classList.remove('hidden');
        previewSection.dataset.pending = JSON.stringify({
          jobMeta,
          jobUrl: tab.url,
          timestamp: Date.now(),
        });
      }
      if (previewImage) previewImage.src = ''; // No image
      if (previewJobUrl) previewJobUrl.textContent = tab.url;

      const needId = !userIdInput?.value?.trim();
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
      setStatus('Job details extracted. Review and save.', 'success');
    } else {
      // Extraction failed, start screenshot mode
      setStatus(
        'Extraction failed. Draw a rectangle to capture screenshot...',
        'info',
      );
      await sendToContent(tab.id, { type: 'START_SELECTION_MODE' });
    }
  } catch (err) {
    setStatus('Could not start capture. Try refreshing the page.', 'error');
    saveButton.disabled = false;
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

    let bodyPayload;
    if (jobMeta?.jobTitle || jobMeta?.company) {
      // Send extracted data
      bodyPayload = {
        extensionId: userId,
        jobTitle: jobMeta.jobTitle,
        company: jobMeta.company,
        location: jobMeta.location,
        description: jobMeta.description,
        source,
        url: pending.jobUrl,
        screenshot: pending.screenshotBase64,
      };
    } else {
      // Fallback to screenshot and page title heuristic
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

      bodyPayload = {
        extensionId: userId,
        screenshot: pending.screenshotBase64,
        source,
        url: pending.jobUrl,
        jobTitle: genericTitle?.trim().slice(0, 100),
        company: genericCompany?.trim().slice(0, 100),
      };
    }

    const res = await fetch(screenshotEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Network error: Server responded with status", res.status, body);
      setStatus(body?.error || 'Failed to save.', 'error');
      showNotification(
        'HustleMap – Error',
        body?.error || 'Failed to save job',
      );
      confirmSaveButton.disabled = false;
      return;
    }
    setStatus('Saved to HustleMap.', 'success');
    showNotification('HustleMap', 'Job saved successfully');

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
    saveButton.disabled = false;
    return;
  }
  if (message?.type === 'SELECTION_COMPLETE') {
    setStatus(
      'Screenshot captured! Preview above. Open the extension again if the popup closed.',
      'success',
    );
    saveButton.disabled = false;
  }
});

// Init
loadState();
