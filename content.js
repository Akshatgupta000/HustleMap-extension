// content.js - runs in the context of job board pages

const SUPPORTED_SITES = ["linkedin.com", "indeed.com", "glassdoor.com"];

const isSupportedHost = () => {
  const host = window.location.hostname || "";
  return SUPPORTED_SITES.some((domain) => host.includes(domain));
};

/** Wait for at least one of the selectors to appear in the DOM (e.g. for LinkedIn's dynamic content). */
const waitForElement = (selectors, timeoutMs = 6000) => {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];
  const find = () => {
    for (const sel of selectorList) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const existing = find();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const observer = new MutationObserver(() => {
      const el = find();
      if (el) {
        observer.disconnect();
        resolve(el);
        return;
      }
      if (Date.now() >= deadline) {
        observer.disconnect();
        resolve(find());
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const t = setTimeout(() => {
      observer.disconnect();
      resolve(find());
    }, timeoutMs);
    if (t.unref) t.unref();
  });
};

const extractSalaryFromText = (text) => {
  if (!text) return null;
  const patterns = [
    /(\$|£|€)\s?\d{1,3}(?:[,\d]{3})?(?:\s?(?:k|K))?(?:\s?-\s?(?:\$|£|€)?\s?\d{1,3}(?:[,\d]{3})?(?:\s?(?:k|K))?)?(?:\s*(?:per\s+year|per\s+hour|\/year|\/hr|annum))?/i,
    /\d{1,3}(?:[,\d]{3})?\s?(?:-\s?\d{1,3}(?:[,\d]{3})?)?\s?(?:LPA|lpa)/i,
  ];
  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) return match[0].trim();
  }
  return null;
};

/** LinkedIn: current and fallback selectors for jobs search / jobs view pages. */
const LINKEDIN_SELECTORS = {
  title: [
    ".job-details-jobs-unified-top-card__job-title",
    "h1",
    ".top-card-layout__title",
  ],
  company: [
    ".job-details-jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    ".topcard__flavor",
  ],
  location: [
    ".job-details-jobs-unified-top-card__bullet",
    ".topcard__flavor--bullet",
    ".jobs-unified-top-card__bullet",
  ],
  description: [
    ".jobs-description-content__text",
    ".description__text",
    ".jobs-description__content",
    "[data-test-description-section]",
  ],
};

const queryFirst = (selectors) => {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of list) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
};

const textOrNull = (el) => (el?.innerText?.trim() || null);

/** Extract job details from LinkedIn (jobs search / jobs view). Waits for dynamic content then returns partial data. */
const extractFromLinkedIn = () => {
  const titleEl = queryFirst(LINKEDIN_SELECTORS.title);
  const companyEl = queryFirst(LINKEDIN_SELECTORS.company);
  const locationEl = queryFirst(LINKEDIN_SELECTORS.location);
  const descriptionEl = queryFirst(LINKEDIN_SELECTORS.description);

  const jobTitle = textOrNull(titleEl) || textOrNull(document.querySelector("h1"));
  const company = textOrNull(companyEl);
  const location = textOrNull(locationEl);
  const description = descriptionEl ? descriptionEl.innerText?.trim() || null : null;

  const salaryText =
    document.querySelector("[data-test-salary]")?.innerText ||
    description ||
    document.body?.innerText;
  const salary = extractSalaryFromText(salaryText);

  const logoEl =
    document.querySelector(".topcard__flavor img") ||
    document.querySelector(".jobs-unified-top-card__company-logo img") ||
    document.querySelector(".job-details-jobs-unified-top-card__company-logo img");
  const companyLogo = logoEl?.src || null;

  return {
    jobTitle: jobTitle || null,
    company: company || null,
    location: location || null,
    description: description || null,
    jobUrl: window.location.href,
    salary: salary || null,
    companyLogo,
    source: "LinkedIn",
  };
};

/** Wait for LinkedIn job panel to appear, then extract. Supports /jobs/search and /jobs/view. */
const extractFromLinkedInAsync = async () => {
  const waitSelectors = [
    LINKEDIN_SELECTORS.title[0],
    LINKEDIN_SELECTORS.company[0],
    "h1",
    ".top-card-layout__title",
    ".topcard__org-name-link",
  ];
  await waitForElement(waitSelectors, 6000);
  return extractFromLinkedIn();
};

const extractFromIndeed = () => {
  const jobTitle =
    document.querySelector("h1")?.innerText ||
    document.querySelector("h1.jobsearch-JobInfoHeader-title")?.innerText ||
    null;

  const company =
    document.querySelector(".jobsearch-InlineCompanyRating div:first-child")?.innerText ||
    document.querySelector("[data-company-name]")?.innerText ||
    null;

  const location =
    document.querySelector(".jobsearch-JobInfoHeader-subtitle div:last-child")?.innerText ||
    document.querySelector("[data-testid='inlineHeader-companyLocation']")?.innerText ||
    null;

  const descriptionEl =
    document.querySelector("#jobDescriptionText") ||
    document.querySelector("[data-testid='jobDescriptionText']") ||
    null;

  const description = descriptionEl?.innerText || null;

  const salaryText =
    document.querySelector("[data-testid='salText']")?.innerText ||
    description ||
    document.body.innerText;

  const salary = extractSalaryFromText(salaryText);

  const logoEl =
    document.querySelector("img[alt*='logo']") ||
    document.querySelector("meta[property='og:image']") ||
    null;

  const companyLogo = logoEl?.src || logoEl?.content || null;

  return {
    jobTitle: jobTitle?.trim() || null,
    company: company?.trim() || null,
    location: location?.trim() || null,
    salary,
    description,
    jobUrl: window.location.href,
    companyLogo,
    source: "indeed",
  };
};

const extractFromGlassdoor = () => {
  const jobTitle =
    document.querySelector("h1")?.innerText ||
    document.querySelector("[data-test='jobTitle']")?.innerText ||
    null;

  const company =
    document.querySelector("[data-test='employerName']")?.innerText ||
    document.querySelector(".css-16nw49e.e11nt52q1")?.innerText ||
    null;

  const location =
    document.querySelector("[data-test='location']")?.innerText ||
    null;

  const descriptionEl =
    document.querySelector("[data-test='jobDescriptionText']") ||
    document.querySelector(".jobDescriptionContent") ||
    null;

  const description = descriptionEl?.innerText || null;

  const salaryText =
    document.querySelector("[data-test='pay-period']")?.innerText ||
    description ||
    document.body.innerText;

  const salary = extractSalaryFromText(salaryText);

  const logoEl =
    document.querySelector("img[alt*='logo']") ||
    document.querySelector("meta[property='og:image']") ||
    null;

  const companyLogo = logoEl?.src || logoEl?.content || null;

  return {
    jobTitle: jobTitle?.trim() || null,
    company: company?.trim() || null,
    location: location?.trim() || null,
    salary,
    description,
    jobUrl: window.location.href,
    companyLogo,
    source: "glassdoor",
  };
};

const extractJobDataSync = () => {
  const host = window.location.hostname || "";
  if (!isSupportedHost()) return { error: "This page is not a supported job posting." };
  if (host.includes("indeed.com")) return extractFromIndeed();
  if (host.includes("glassdoor.com")) return extractFromGlassdoor();
  return null;
};

/** Returns Promise<data> for LinkedIn, data otherwise. Caller must support async. */
const extractJobData = async () => {
  const host = window.location.hostname || "";
  if (!isSupportedHost()) {
    return { error: "This page is not a supported job posting." };
  }

  let data;
  if (host.includes("linkedin.com")) {
    data = await extractFromLinkedInAsync();
  } else {
    data = extractJobDataSync();
  }
  if (!data) return { error: "Unsupported job site." };
  if (data.error) return data;

  // Allow partial data: need at least title or company
  const hasTitle = data.jobTitle && data.jobTitle.trim().length > 0;
  const hasCompany = data.company && data.company.trim().length > 0;
  if (!hasTitle && !hasCompany) {
    return { error: "Could not reliably extract job details from this page." };
  }

  return data;
};

// --- Rectangle screenshot selection (overlay + drag) ---
let selectionOverlay = null;
let selectionBox = null;
let selectionStart = null;
let selectionListeners = null;

const removeSelectionUI = () => {
  if (selectionListeners) {
    selectionListeners.cleanup();
    selectionListeners = null;
  }
  if (selectionBox?.parentNode) selectionBox.remove();
  selectionBox = null;
  if (selectionOverlay?.parentNode) selectionOverlay.remove();
  selectionOverlay = null;
  selectionStart = null;
};

const startSelectionMode = () => {
  if (selectionOverlay) return;

  const overlay = document.createElement("div");
  overlay.id = "hustlemap-selection-overlay";
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "background:rgba(0,0,0,0.35)",
    "cursor:crosshair",
    "user-select:none",
  ].join(";");

  const box = document.createElement("div");
  box.id = "hustlemap-selection-box";
  box.style.cssText = [
    "position:fixed",
    "border:2px solid #0a66c2",
    "background:rgba(10,102,194,0.1)",
    "pointer-events:none",
    "box-sizing:border-box",
  ].join(";");
  box.style.left = "0px";
  box.style.top = "0px";
  box.style.width = "0px";
  box.style.height = "0px";

  document.body.appendChild(overlay);
  overlay.appendChild(box);
  selectionOverlay = overlay;
  selectionBox = box;

  const onMouseDown = (e) => {
    e.preventDefault();
    selectionStart = { x: e.clientX, y: e.clientY };
    box.style.left = e.clientX + "px";
    box.style.top = e.clientY + "px";
    box.style.width = "0px";
    box.style.height = "0px";
  };

  const onMouseMove = (e) => {
    if (!selectionStart) return;
    const x = Math.min(selectionStart.x, e.clientX);
    const y = Math.min(selectionStart.y, e.clientY);
    const w = Math.abs(e.clientX - selectionStart.x);
    const h = Math.abs(e.clientY - selectionStart.y);
    box.style.left = x + "px";
    box.style.top = y + "px";
    box.style.width = w + "px";
    box.style.height = h + "px";
  };

  const onMouseUp = () => {
    if (!selectionStart || !selectionBox.parentNode) return;
    const rect = selectionBox.getBoundingClientRect();
    const left = Math.round(rect.left);
    const top = Math.round(rect.top);
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width < 5 || height < 5) {
      selectionStart = null;
      return;
    }
    removeSelectionUI();
    chrome.runtime.sendMessage({
      type: "SELECTION_COMPLETE",
      left,
      top,
      width,
      height,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      removeSelectionUI();
      chrome.runtime.sendMessage({ type: "SELECTION_CANCELLED" });
    }
  };

  overlay.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("keydown", onKeyDown);

  selectionListeners = {
    cleanup: () => {
      overlay.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
    },
  };
};

// Crop full screenshot (data URL) to rect; used by background (no canvas in service worker).
const handleCropScreenshot = (
  dataUrl,
  left,
  top,
  width,
  height,
  devicePixelRatio,
  sendResponse,
) => {
  const dpr = Math.max(0.5, Math.min(4, devicePixelRatio || 1));
  const img = new Image();
  img.onload = () => {
    const sx = left * dpr;
    const sy = top * dpr;
    const sw = width * dpr;
    const sh = height * dpr;

    // Optional optimization: resize to max width 1200px before converting to base64
    const maxWidth = 1200;
    let targetWidth = Math.max(1, Math.round(sw));
    let targetHeight = Math.max(1, Math.round(sh));
    if (targetWidth > maxWidth) {
      const scale = maxWidth / targetWidth;
      targetWidth = maxWidth;
      targetHeight = Math.max(1, Math.round(targetHeight * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    sendResponse({ ok: true, dataUrl: canvas.toDataURL("image/png") });
  };
  img.onerror = () => sendResponse({ ok: false });
  img.src = dataUrl;
};

// Listen for messages from the popup and background
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request && request.type === "START_SELECTION_MODE") {
    startSelectionMode();
    sendResponse({ ok: true });
    return;
  }
  if (request && request.type === "CROP_SCREENSHOT") {
    const { dataUrl, left, top, width, height, devicePixelRatio } = request;
    if (!dataUrl || width < 1 || height < 1) {
      sendResponse({ ok: false });
      return true;
    }
    handleCropScreenshot(dataUrl, left, top, width, height, devicePixelRatio, (r) => sendResponse(r));
    return true;
  }
  if (request && request.type === "CAPTURE_JOB") {
    console.log("Message received in content script:", request.type);
    (async () => {
      try {
        const jobData = await extractJobData();
        if (jobData.error) {
          sendResponse({ ok: false, error: jobData.error });
          return;
        }

        let token = null;
        try {
          token = window.localStorage.getItem("token");
        } catch (_err) {
          // ignore
        }

        sendResponse({
          ok: true,
          data: {
            title: jobData.jobTitle ?? null,
            company: jobData.company ?? null,
            location: jobData.location ?? null,
            jobUrl: jobData.jobUrl ?? window.location.href,
            source:
              (jobData.source || "").toString().toLowerCase() || "other",
          },
          token,
        });
      } catch (err) {
        console.error("HustleMap content script error:", err);
        sendResponse({
          ok: false,
          error: "Unexpected error while extracting job data.",
        });
      }
    })();
    return true; // keep channel open for async sendResponse
  }
});

