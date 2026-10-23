# Steam Demo Cleaner Extension

A high-performance browser extension designed to scan, filter, and batch-clean Steam demos, playtests, beta trials, and unwanted free licenses from your account.

Built directly upon the proven architecture blueprint of the [**SteamDB Browser Extension**](https://steamdb.info) (`manifest.json` V3, background service worker, cross-browser compatibility layer, rate-limit protection, and MAIN-world session integration).

---

## 🌟 Key Features

- **Automated License Detection**: Instantly detects removable licenses on `https://store.steampowered.com/account/licenses/`.
- **Smart Classification**:
  - 🔵 **Demos** (e.g. titles containing `Demo`)
  - 🟣 **Playtests** (e.g. titles containing `Playtest`)
  - 🟡 **Prologues** (e.g. titles containing `Prologue`)
  - 🟢 **Betas & Trials** (e.g. titles containing `Beta`, `Trial`, `Teaser`, `Sneak Peek`)
  - ⚪ **Other Removable Licenses** (complimentary / free on demand)
- **1-Click Batch Cleaner**: Dedicated button to clean all detected demos and playtests in one go.
- **Multi-Page Scanning**: Scans across all paginated license pages without losing your place.
- **Interactive Controls**:
  - Filter pills with real-time counters.
  - Live search by title or Package SubID.
  - Checkboxes for selecting individual or multiple items.
  - Instant single-item removal button on each row.
- **Safety First**:
  - Automatic JSON backup export before deletion.
  - Confirmation modals with total item counts.
  - Audit history log recording removed packages.
- **Rate-Limiting Protection**:
  - Configurable delay (default 1000ms) between Steam API calls.
  - Automatic detection of Steam rate limiting (`HTTP 429` / Code `84`) with auto-pause and retry timers.
- **Smooth Animations**: Seamless row fade-outs, progress bar animations, and live modal activity log.

---

## 📦 How to Install

### For Google Chrome, Microsoft Edge, Brave, Opera (Chromium)

1. Open your browser and navigate to the Extensions page:
   - Chrome / Brave: `chrome://extensions/`
   - Edge: `edge://extensions/`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **Load unpacked** button.
4. Select the `steam-demo-cleaner` folder:

   ```text
   c:\Users\Tati\Documents\Projects\Steam Demo Cleaner Extension\steam-demo-cleaner
   ```

5. The **Steam Demo Cleaner** icon will appear in your browser toolbar!

---

### For Mozilla Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside `steam-demo-cleaner/`.

---

## 🚀 How to Use

1. Make sure you are logged into your Steam account in your browser.
2. Navigate to your Steam Account Licenses page:
   [https://store.steampowered.com/account/licenses/](https://store.steampowered.com/account/licenses/)
   *(Or click the extension toolbar icon and press **"🚀 Open Steam Licenses Page"**)*.
3. The **Steam Demo Cleaner** dashboard will appear directly above the licenses table:
   - Click **"⚡ 1-Click Clean Demos & Playtests"** to select and clean all demos immediately.
   - Use the category pills (`Demos`, `Playtests`, etc.) to filter what is shown.
   - Click **"🔍 Scan All Pages"** if you have more than 1 page of licenses.
   - Check specific items and click **"🗑️ Remove Selected"**.
4. During removal, watch the real-time progress modal. You can **Pause**, **Resume**, or **Cancel** at any time.

---

## ⚙️ Options & Custom Keywords

Right-click the extension icon and choose **Options** (or click the Options link in the popup):

- **Add Custom Keywords**: Add custom strings (e.g. `alpha`, `test server`, `stress test`) to match specific titles.
- **Adjust Request Delay**: Fine-tune the interval between removal calls (500ms to 3000ms).
- **Audit Log**: View or export the history of licenses removed using the cleaner.

---

## 📁 File Structure

```text
steam-demo-cleaner/
├── manifest.json        # Manifest V3 configuration & permission rules
├── icons/               # 16px, 32px, 48px, 128px PNG and SVG icons
├── scripts/
│   ├── common.js        # ExtensionApi wrapper, settings storage, classification helpers
│   ├── background.js    # Service worker: Steam session management, removal API proxy
│   ├── content.js       # Content script: Dashboard injection, table scanner, removal modal
│   └── injected.js      # Main-world script: Steam session verification & cache invalidation
├── styles/
│   └── content.css      # Dark theme UI, badges, modal, progress bars, animations
├── popup/
│   ├── popup.html       # Browser action popup
│   ├── popup.css        # Popup styles
│   └── popup.js         # Active tab status & navigation
├── options/
│   ├── options.html     # Settings UI
│   ├── options.css      # Settings styles
│   └── options.js       # Keyword manager & audit history
└── README.md
```

---

## 👏 Credits & Acknowledgments

- **[SteamDB](https://steamdb.info)** — Architectural inspiration, reference patterns, and community tools.
- **[Jazzverso](https://github.com/Jazzverso)** — Project development and contributions.
