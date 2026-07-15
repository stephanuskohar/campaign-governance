# Campaign Governance

Internal web app for submitting Shopee campaigns into a governed Google Sheet. Campaign owners
fill one form; it validates the input, stamps a unique ID and Jakarta submission time, and appends
the row to the **"Web Ingestion"** tab. The submitted campaign is echoed in a results panel
(scoring / tier / asset eligibility read-back is a later phase).

## Architecture

The app is hosted **inside Google Apps Script** (not GitHub Pages). The Shopee deployment policy
only allows web apps that *execute as the accessing user* and are restricted to the Shopee domain —
those cannot be called cross-origin from a static site (`fetch` gets a login redirect + CORS block).
So the UI is served by the script and talks to the backend via `google.script.run` (same-origin,
runs as the signed-in user). This repo holds the source for version control.

```
User (browser, signed in to Shopee Google)
   → Apps Script web app  (Index.html served by doGet)
   → google.script.run → server functions → Google Sheet
```

## What the form captures

`Campaign Intent`, `Campaign Type` (both multi-select, loaded live from the "Director Note
Ingestion" tab — Intent = unique col B, Type = unique col A; stored comma-separated), `Name`,
`Campaign Start Date`, `Campaign End Date`, `GMV ($)`, `A1`, `Budget ($)`, and the three
`Seller Investment ($)` fields.

Added automatically: **User** (the signed-in email, authoritative server-side), **Date** (Jakarta
time to the second), **ID** (10-char code, never starts with `0`).

Validation: End − Start is 1–365 days; Start ≤ today (Jakarta); all money/number fields required
and non-negative.

## Deploy

1. In the target Sheet → **Extensions → Apps Script**, create two files:
   - `Code.gs` — from [apps-script/Code.gs](apps-script/Code.gs)
   - `Index.html` — from [apps-script/Index.html](apps-script/Index.html)
2. **Deploy → New deployment → Web app** (or **Manage deployments → New version** to update):
   - *Execute as:* **User accessing the web app**
   - *Who has access:* **Anyone within Shopee**
3. Open the `/exec` URL. (Run `testGetOptions` once to approve permissions and confirm the lists.)

**Important:** because it executes as the accessing user, each submitter needs **Edit** access to
the spreadsheet (share it with the Shopee domain as Editor), or the append will fail for them.

## Files

```
apps-script/Code.gs     doGet (serves UI) + getOptions + submitCampaign + helpers
apps-script/Index.html  the full UI (HTML + CSS + JS, uses google.script.run)
```
