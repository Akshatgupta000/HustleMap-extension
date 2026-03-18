# HustleMap – Smart Job Capture (Chrome Extension)

A Chrome extension that lets you save jobs from **LinkedIn**, **Indeed**, and **Glassdoor** into your [HustleMap](https://github.com/your-org/HustleMap) job tracker. You draw a rectangle around the job content, capture a screenshot, preview it in the popup, then save it to your account. Saved jobs appear in HustleMap with status **saved** and can be managed from the dashboard.

---

## 📖 Table of Contents

- [Beginner's Guide (Start Here!)](#beginners-guide-start-here)
  - [1. 🚀 Installation (Load Unpacked Extension)](#1--installation-load-unpacked-extension)
  - [2. ⚙️ Initial Setup (VERY IMPORTANT)](#2-️-initial-setup-very-important)
  - [3. 📸 How to Capture a Job](#3--how-to-capture-a-job)
  - [4. 💾 Preview & Save](#4--preview--save)
  - [5. ✅ Result](#5--result)
  - [6. ⚠️ Common Issues](#6-️-common-issues)
  - [7. 💡 Tips](#7--tips)
- [Technical Details & Reference](#technical-details--reference)
  - [Features](#features)
  - [Supported Sites](#supported-sites)
  - [Architecture](#architecture)
  - [File Structure](#file-structure)
  - [Permissions](#permissions)
  - [User Flow](#user-flow)
  - [Backend API](#backend-api)
  - [Technical Details](#technical-details)
  - [Installation & Setup](#installation--setup)
  - [Configuration](#configuration)
  - [Troubleshooting](#troubleshooting)

---

## Beginner's Guide (Start Here!)

### 1. 🚀 Installation (Load Unpacked Extension)
Follow these simple steps to install the extension manually in Chrome:

1. Open **Chrome**.
2. Go to your address bar, type `chrome://extensions`, and press **Enter**.
3. In the top right corner, turn on **Developer mode**.
4. Click the **Load unpacked** button that appears in the top left.
5. Select the `hustlemap-extension` folder on your computer.
6. The extension will now appear in your browser toolbar! (You may want to pin it for easy access).

### 2. ⚙️ Initial Setup (VERY IMPORTANT)
Before you can save jobs, you need to connect the extension to your HustleMap account.

1. Click the **HustleMap extension icon** in your Chrome toolbar.
2. Open the **Settings** section in the popup.
3. Enter your **HustleMap User ID**.
    - *What is this?* It's your unique identifier to make sure jobs are saved to *your* account.
    - *Where to find it?* You can find your User ID in your HustleMap app or profile settings.
4. Click **Save settings**.

### 3. 📸 How to Capture a Job
Whenever you find a job you like, here is how you save it:

1. Open a job page on one of our supported sites:
   - **LinkedIn**
   - **Indeed**
   - **Glassdoor**
2. Click the **HustleMap extension icon** in your toolbar.
3. Click the big **Save Job to HustleMap** button.
4. Draw a rectangle on the screen:
   - Click and drag your mouse to select the job details you want to capture.
   - *(Changed your mind? Press the **ESC** key to cancel).*
5. Your screenshot is captured automatically once you release the mouse!

### 4. 💾 Preview & Save
1. After making your selection, the screenshot is temporarily saved.
2. Reopen the extension popup by clicking the icon again.
3. The **Preview** section will show:
   - Your captured screenshot.
   - The original Job URL.
4. If everything looks good, click **Save to HustleMap**.

### 5. ✅ Result
- Your job is instantly saved in your HustleMap dashboard!
- Its status will be marked as **"saved"**.
- The screenshot you took will be attached so you can always read the original details.

### 6. ⚠️ Common Issues
- **"Nothing happens when clicking Save"**
  → Refresh the job page and try again.
- **"Selection not working"**
  → Reload the extension from the `chrome://extensions` page.
- **"User ID missing"**
  → Open the extension settings and add your User ID.

### 7. 💡 Tips
- **Select only the job description area** for better clarity and cleaner screenshots.
- **Avoid selecting too small of an area**, as it may fail to capture.
- **Use the extension only on supported sites** (LinkedIn, Indeed, and Glassdoor) for the best experience.

---

## Technical Details & Reference

*(The rest of this document contains technical details for developers.)*

### Features

- **Rectangle selection**: Draw a rectangle on the job page to capture only the area you want (job card, description, etc.).
- **Screenshot capture & crop**: Full visible tab is captured, then cropped to your selection (handles high-DPI displays).
- **Preview before save**: After selection, a preview and the job URL are shown in the popup; you confirm before sending to the server.
- **User ID in Settings**: Store your HustleMap User ID once in the popup; it’s used for all “Save to HustleMap” requests.
- **Pending screenshot**: If the popup closes after drawing the rectangle, the screenshot is stored locally; reopening the popup shows the preview so you can still save.
- **Chrome notifications**: Success and error messages are shown as system notifications.
- **Supported job boards**: LinkedIn, Indeed, Glassdoor (content script also includes job data extractors for future use).

---

### Supported Sites

| Site        | Content script runs | Selection/capture | Notes                                      |
|------------|--------------------|-------------------|--------------------------------------------|
| LinkedIn   | ✓                  | ✓                 | Waits for dynamic job panel (e.g. search)  |
| Indeed     | ✓                  | ✓                 | Standard job detail page                    |
| Glassdoor  | ✓                  | ✓                 | Standard job detail page                    |

The extension only enables “Save Job to HustleMap” when the active tab URL is from one of these hosts.

---

### Architecture

- **Manifest V3**: Uses a **service worker** (`background.js`) for background logic and **content scripts** for page interaction.
- **Popup** (`popup.html` + `popup.js`): Settings (User ID), “Save Job” button, preview, and confirm save. Talks to the active tab and to the backend API.
- **Background** (`background.js`): Listens for `SELECTION_COMPLETE` from the content script; captures visible tab, asks content script to crop the selection, then stores the result in `chrome.storage.local` for the popup.
- **Content script** (`content.js`): Injected on LinkedIn, Indeed, Glassdoor. Handles rectangle selection UI, crop-in-page (canvas), and (for future use) job data extraction.

---

### File Structure

```
hustlemap-extension/
├── manifest.json      # Extension manifest (MV3): permissions, scripts, icons
├── popup.html         # Popup UI: title, settings, Save button, preview section
├── popup.js           # Popup logic: settings, start selection, confirm save, API call
├── background.js      # Service worker: capture + crop orchestration, storage
├── content.js         # Injected on job sites: selection overlay, crop, extractors
├── styles.css         # Popup and shared styles
├── icons/
│   ├── icon16.png     # Toolbar / context menus
│   ├── icon32.png     # Optional
│   ├── icon48.png     # Notifications
│   └── icon128.png    # Chrome Web Store / management
└── README.md          # This file
```

### File roles

| File           | Role |
|----------------|------|
| **manifest.json** | Declares name, version, permissions, host permissions, `action` (popup), `background.service_worker`, `content_scripts` (matches + `content.js` + `styles.css`), and icons. |
| **popup.html** | Markup for: “Save to HustleMap” title/subtitle, Settings (User ID input + “Save settings”), “Save Job to HustleMap” button, Preview (image, URL, “Save to HustleMap” confirm), status message. |
| **popup.js**   | Loads/saves User ID from `chrome.storage.local`; checks active tab URL; sends `START_SELECTION_MODE` to content script; loads pending screenshot into preview; calls `POST /api/jobs/screenshot` with `userId`, `screenshotBase64`, `jobUrl`, `timestamp`; shows status and Chrome notifications. |
| **background.js** | On `SELECTION_COMPLETE`: gets tab, captures visible tab with `chrome.tabs.captureVisibleTab`, sends `CROP_SCREENSHOT` to content script with full image + rect + DPR, receives cropped data URL, stores in `hustlemap_pending_screenshot`, shows “Screenshot captured!” notification. |
| **content.js** | Listens for `START_SELECTION_MODE`, `CROP_SCREENSHOT`, and (legacy) `CAPTURE_JOB`. Selection: overlay + draggable box, sends `SELECTION_COMPLETE` (rect + DPR) or `SELECTION_CANCELLED`. Crop: draws full image on canvas, crops to rect, returns data URL. Also defines LinkedIn/Indeed/Glassdoor extractors (salary, title, company, etc.) for future use. |
| **styles.css** | Styles for popup (container, title, buttons, inputs, preview, status, hidden). |

---

### Permissions

| Permission      | Purpose |
|-----------------|--------|
| `activeTab`     | Access the active tab when user invokes the extension. |
| `scripting`     | Inject `content.js` if not already loaded (e.g. after install). |
| `storage`       | Store User ID and pending screenshot in `chrome.storage.local`. |
| `notifications` | Show success/error notifications. |
| `tabs`          | Query active tab, get tab URL, capture visible tab. |

#### Host permissions

- `*://*.linkedin.com/*`
- `*://*.indeed.com/*`
- `*://*.glassdoor.com/*`
- `http://localhost:5000/*` (local backend)
- `https://*/api/*` (production API if you host one)

---

### User Flow

1. **One-time**: Open popup → **Settings** → enter **HustleMap User ID** (e.g. from your profile) → **Save settings**.
2. **Capture**: On a job page (LinkedIn/Indeed/Glassdoor), open the popup → click **Save Job to HustleMap**.
3. **Select**: A semi-transparent overlay appears; click and drag to draw a rectangle around the job content → release. (Press **Escape** to cancel.)
4. **Background**: Extension captures the visible tab, crops to your rectangle, and stores the screenshot + job URL in local storage; a notification says “Screenshot captured! Click the extension to preview and save.”
5. **Preview & save**: Open the popup again (if it closed). The **Preview** section shows the cropped image and job URL. Click **Save to HustleMap** to send to the server.
6. **Result**: Job is created in HustleMap with status **saved**; you can move it through the pipeline from the dashboard.

---

### Backend API

The extension saves jobs by calling the HustleMap API **without** auth; it sends the **User ID** in the body.

#### Endpoint

- **URL**: `POST {API_BASE}/jobs/screenshot`  
  Example: `http://localhost:5000/api/jobs/screenshot`
- **Headers**: `Content-Type: application/json`
- **Body**:
  - `userId` (string, required): HustleMap user’s MongoDB ObjectId.
  - `screenshotBase64` (string, required): Data URL or base64 string of the cropped screenshot (e.g. `data:image/png;base64,...`).
  - `jobUrl` (string, optional): Page URL of the job.
  - `timestamp` (number, optional): Unix ms for `dateApplied`; defaults to server time if omitted.

#### Success response

- **Status**: `201`
- **Body**: `{ job: <formatted job>, message: "Screenshot saved." }`

#### Error responses

- **400** – Missing/invalid `userId`, invalid ObjectId, or missing `screenshotBase64`. Body: `{ error: "<message>" }`.
- **500** – Server error. Body: `{ error: "Internal server error", message?: "<dev message>" }`.

The created job has:

- `user`: provided `userId`
- `company`: `"Captured"`
- `position`: `"Job capture"`
- `status`: `"saved"`
- `jobUrl`, `dateApplied` (from `timestamp`), `applicationSource` (derived from `jobUrl`), and `screenshot` (stored base64).

---

### Technical Details

#### Storage keys (`chrome.storage.local`)

- **`hustlemap_user_id`**: User-entered HustleMap User ID (string).
- **`hustlemap_pending_screenshot`**: Object `{ screenshotBase64, jobUrl, timestamp }` after a selection, until the user confirms save or clears it.

#### Message types

| Message                | Direction           | Payload / purpose |
|------------------------|--------------------|-------------------|
| `START_SELECTION_MODE` | Popup → Content    | Start rectangle selection overlay. |
| `SELECTION_COMPLETE`   | Content → Background | `{ left, top, width, height, devicePixelRatio }` (viewport pixels). |
| `SELECTION_CANCELLED`  | Content → Popup/Background | User pressed Escape. |
| `CROP_SCREENSHOT`      | Background → Content | `{ dataUrl, left, top, width, height, devicePixelRatio }`; content responds with `{ ok, dataUrl }`. |
| `CAPTURE_JOB`          | (Optional) → Content | Legacy; content responds with extracted job data + optional token. |

#### Selection and crop

- Selection coordinates are in **CSS viewport pixels**. The content script draws the box in those coordinates.
- The background script captures the tab at **device pixel ratio**; the content script crops using `left * dpr`, etc., so the crop matches what the user selected on high-DPI screens.

#### Content script: job extractors

`content.js` includes extractors for LinkedIn, Indeed, and Glassdoor (title, company, location, description, salary, company logo, `jobUrl`, `source`). They are used when the popup/background sends `CAPTURE_JOB`. The current **screenshot flow** does not use these; jobs are saved with fixed “Captured” / “Job capture” and the screenshot. The extractors are available for a future “save as structured job” feature.

---

### Installation & Setup

#### Prerequisites

- Chrome (or Chromium-based browser supporting Manifest V3).
- HustleMap backend running (e.g. `http://localhost:5000`).
- Your HustleMap **User ID** (MongoDB ObjectId from your user document or profile).

#### Load unpacked

1. Start the HustleMap server (default: `http://localhost:5000`).
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `hustlemap-extension` folder.
5. Ensure the extension has the correct **API base URL** (see [Configuration](#configuration)).
6. Open the extension popup, go to **Settings**, enter your **HustleMap User ID**, and click **Save settings**.
7. Go to a job page on LinkedIn, Indeed, or Glassdoor, click the extension icon, and use **Save Job to HustleMap** → draw rectangle → confirm in preview.

#### Icons

Place PNG icons at:

- `icons/icon16.png`
- `icons/icon32.png`
- `icons/icon48.png`
- `icons/icon128.png`

Any square images work for local testing; use proper assets for distribution.

---

### Configuration

#### API base URL

In **popup.js**, set:

```js
const HUSTLEMAP_API_BASE = "http://localhost:5000/api";
```

For production, point this to your deployed API (e.g. `https://api.yourdomain.com/api`). Ensure the host is allowed in `manifest.json` `host_permissions` (e.g. `https://*/api/*` or your specific domain).

#### User ID

- Entered in the popup under **Settings** and stored in `chrome.storage.local`.
- Required when clicking **Save to HustleMap** in the preview; the confirm button is disabled until a non-empty User ID is saved.

---

### Troubleshooting

| Issue | What to try |
|-------|-------------|
| “Open a job posting on LinkedIn, Indeed, or Glassdoor first.” | Use the extension only when the active tab is a job page on one of these sites. |
| “Could not start selection. Try refreshing the page.” | Reload the job page and try again; ensures content script is loaded. |
| “Receiving end does not exist” / “Could not establish connection” | Popup injects `content.js` and retries the message once; if it still fails, reload the page. |
| Screenshot crop failed | Ensure the selection had width and height ≥ 5px; retry with a larger rectangle. |
| “User ID is required” / “Invalid user ID” | Set a valid MongoDB ObjectId in Settings and save. |
| “Network error” / “Failed to save.” | Check backend is running, `HUSTLEMAP_API_BASE` is correct, and CORS allows the extension origin if applicable. |
| Preview not showing after drawing rectangle | Reopen the popup; the pending screenshot is stored and should appear. If not, check that the background script ran (no errors in `chrome://extensions` → extension “Service worker”). |

---

### Version

- **Extension version**: `1.0.0` (in `manifest.json`).
- **Manifest**: 3.

---

### Summary

The HustleMap extension adds **screenshot-based job capture** from LinkedIn, Indeed, and Glassdoor: you select a region on the page, the extension crops and stores it, and you save it to HustleMap with your User ID. The backend creates a job with status **saved** and the screenshot attached, ready to manage in your dashboard.
