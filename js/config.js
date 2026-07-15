/**
 * Campaign Governance — Frontend configuration.
 *
 * This is the ONLY frontend file you need to edit to connect the app to your
 * own Google Apps Script Web App + Google Sign-In. Nothing else references raw
 * URLs, client IDs, or sheet-specific values.
 *
 * See README.md → "Setup & Deployment" for how to obtain each value.
 */
const CONFIG = {
  // Paste the "/exec" URL you get after deploying apps-script/Code.gs as a Web App.
  WEB_APP_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",

  // "google" = Google Sign-In (verified identity, recommended).
  // "manual" = user types their email (no verification) — use only if you cannot
  //            create an OAuth client ID internally.
  AUTH_MODE: "manual",

  // Required only when AUTH_MODE === "google". Create a Web OAuth client ID in
  // Google Cloud Console and authorize your GitHub Pages origin.
  GOOGLE_CLIENT_ID: "PASTE_YOUR_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com",

  // Only emails on this domain are accepted as owners (identity guard).
  ALLOWED_DOMAIN: "shopee.com",

  // Field definitions for the campaign submission form. Edit labels/keys to match
  // the columns your Campaigns tab expects. The "key" is sent to the backend and
  // must match a header in your Campaigns tab (mapping lives in Code.gs → SHEET).
  CAMPAIGN_FIELDS: [
    { key: "Campaign Name", label: "Campaign Name", type: "text", required: true },
    { key: "Owner Email", label: "Owner Email", type: "email", required: true },
    { key: "Category", label: "Category", type: "text", required: false },
    { key: "Budget", label: "Budget (SGD)", type: "number", required: false },
    { key: "Start Date", label: "Campaign Start", type: "date", required: false },
    { key: "End Date", label: "Campaign End", type: "date", required: false },
  ],
};
