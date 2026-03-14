# Clean Room: Third-Party Risk Visualizer (Edge Extension)

A lightweight **Microsoft Edge (Chromium)** extension (Manifest V3) that helps you *see* third-party exposure on the current page and toggle **Quiet Mode** to block common tracker domains **per site**.

## Features

- **Third-party map (per tab)**
  - Counts third-party domains contacted by the current tab
  - Highlights domains that match a built-in tracker list
- **Clean Room score**
  - A simple 0–100 score based on third-party and tracker presence
- **Quiet Mode (per site)**
  - One toggle to block requests to known tracker domains
  - Settings persist per “site key” (registrable-domain-ish heuristic)
- **Blocked request counter**
  - Shows how many requests were blocked in the current tab (when available)

## How it works (high level)

- **Observation:** Uses `chrome.webRequest.onBeforeRequest` to count domains contacted by the active tab.
- **Blocking:** Uses `chrome.declarativeNetRequest` dynamic rules to block a small list of tracker domains when Quiet Mode is enabled.
- **Per-site key:** Uses a lightweight “registrable-domain-ish” heuristic (last two hostname labels) to scope Quiet Mode to a site (example: `news.example.com` → `example.com`).

## Install (Load Unpacked in Edge)

1. Create a folder, e.g. `clean-room-visualizer/`, containing:
   - `manifest.json`
   - `service_worker.js`
   - `popup.html`
   - `popup.css`
   - `popup.js`
   - `trackerlist.js`
2. Open Edge and go to:
   - `edge://extensions/`
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the `clean-room-visualizer/` folder.

## Usage

1. Visit any website.
2. Click the extension icon to open the popup.
3. Review:
   - **Score**
   - First-party / third-party / trackers counts
   - Third-party domain list
4. Toggle **Quiet Mode**:
   - **On**: blocks built-in tracker domains for that site
   - **Off**: removes those rules
5. For immediate effect after turning Quiet Mode on, **refresh the page** so new requests are subject to blocking rules.

## Permissions (what they’re for)

- `storage`
  - Save Quiet Mode per site key
- `tabs`
  - Identify active tab for popup
- `webRequest`
  - Observe requests to build the third-party map (counts)
- `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`
  - Apply Quiet Mode blocking via MV3 dynamic rules
- `declarativeNetRequestFeedback`
  - Enable blocked-request counting (`onRuleMatchedDebug`)
- Host permissions: `<all_urls>`
  - Required to observe and apply rules across sites

## Quiet Mode behavior

- Quiet Mode blocks only domains listed in `trackerlist.js`.
- Rules are scoped using `initiatorDomains: [siteKey]`, where `siteKey` is the last-two-label heuristic (example: `sub.domain.com` → `domain.com`).
- Blocking takes effect for subsequent network requests; a page refresh helps confirm changes quickly.

## Clean Room score (current formula)

Cookies are not counted in this MVP. Score is based on:
- `D` = number of unique third-party domains
- `T` = number of unique tracker domains (from the built-in list)

Formula:
- `score = max(0, 100 - min(60, 8*D) - min(30, 2*T))`

## Limitations / Known gaps

- **Site key heuristic is approximate** (not true eTLD+1 parsing). Some domains (e.g., `co.uk`) may be mis-grouped.
- **Request visibility varies** depending on browser/platform behaviors and MV3 constraints.
- **Cookie visibility is not implemented** in this MVP (it requires additional permissions and careful handling).
- Quiet Mode currently blocks only a **small static list** of tracker domains.

## Customizing the tracker list

Edit `trackerlist.js`:

- Add or remove domains in `TRACKER_DOMAINS`.
- Domains are matched as:
  - Exact domain (e.g., `doubleclick.net`)
  - Subdomain (e.g., `a.b.doubleclick.net`)

## Development tips

- After changes, go to `edge://extensions/` and click **Reload** on the extension card.
- If Quiet Mode appears enabled but you don’t see blocks:
  - Refresh the page
  - Confirm the site key in the popup is correct (top line shows hostname; site key is stored internally)

## Roadmap ideas (optional)

- Per-site **allowlist** (unbreak sites while keeping Quiet Mode on)
- “Block all third-party” advanced mode
- More accurate eTLD+1 detection
- Exportable privacy report (copy to clipboard)
- Optional cookie + storage summary (privacy-safe)

## License

Choose your preferred license (MIT/Apache-2.0/etc.) and add a `LICENSE` file.