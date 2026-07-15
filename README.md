# Campaign Governance

A free, GitHub-hosted web app for submitting Shopee campaigns into a governed Google Sheet.
Campaign owners fill one form; the app validates it, stamps a unique ID and submission time, and
appends the row to the **"Web Ingestion"** tab of the central Sheet. The submitted campaign is
echoed back in a results panel (scoring / tier / asset eligibility read-back is a later phase).

- **Frontend:** vanilla HTML/CSS/JS — no build step. Hosted on **GitHub Pages** (free).
- **Backend:** a **Google Apps Script Web App** bound to the Sheet — the free "API" that appends rows.
- **Data:** everything lives in the Google Sheet, so logic stays transparent and auditable.
- **Theme:** light/dark toggle, persisted per browser.

```
Browser (GitHub Pages)  ──fetch JSON──►  Apps Script Web App  ──►  Google Sheet ("Web Ingestion")
```

## What the form captures

`User` (email), `Campaign Intent`, `Campaign Type`, `Name`, `Campaign Start Date`,
`Campaign End Date`, `GMV ($)`, `A1`, `Budget ($)`, `Seller Investment ($) - Cash`,
`Seller Investment ($) - Promissed PRM`, `Seller Investment ($) - Marketing Barter`.

Added automatically:
- **ID** — 10-character unique code (never starts with `0`), generated in the browser.
- **Date** — submission time in **Jakarta (Asia/Jakarta)** time, stamped by the backend.

Validation: valid email; End Date ≥ Start Date and span ≤ 365 days; all money/number fields must
be non-negative numbers.

---

## Setup & Deployment

### 1. Deploy the Apps Script backend
1. Open the Google Sheet → **Extensions → Apps Script**.
2. Replace the default file with [`apps-script/Code.gs`](apps-script/Code.gs). The `CONFIG` block
   is already pointed at the Sheet ID and the `Web Ingestion` tab — no edits needed unless names change.
3. **Deploy → New deployment → Web app:**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone** (so the static site can POST to it)
4. Copy the **`/exec` URL**.
5. (Optional) Run `testSubmit` once in the editor to approve permissions and confirm a row appends.

### 2. Configure the frontend
In [`js/config.js`](js/config.js), set `WEB_APP_URL` to the `/exec` URL from step 1.
The `CAMPAIGN_INTENTS` / `CAMPAIGN_TYPES` dropdown lists are also here — edit them to match the
exact values your eligibility formulas expect.

### 3. Publish on GitHub Pages
Push the repo, then **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**.
Live at `https://<user>.github.io/<repo>/`.

---

## Local development

No build step. On Windows (no Python/Node needed):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1
```

Then open `http://localhost:8000`. (With Python: `python -m http.server 8000`.)

---

## Files

```
index.html          Submit Campaign page (2-column: results left, form right)
css/styles.css      Shopee-branded theme (light/dark) + layout
js/config.js        ← your settings (Web App URL, dropdown options)
js/api.js           fetch wrapper for the Web App
js/theme.js         dark/light toggle
js/common.js        small shared helpers
js/submit.js        form validation, ID generation, submit, result render
apps-script/Code.gs Apps Script backend — appends to the "Web Ingestion" tab
tools/serve.ps1     local static server for Windows
```

## Notes
- All writes go through the Apps Script Web App; the browser never touches the Sheet directly.
- Columns are matched **by header name** and the header row is auto-detected, so column order or
  blank rows above the header don't matter.
- **Later phase:** read scoring/tier/asset eligibility back from the Sheet and show it in the
  results panel (currently a placeholder note).
