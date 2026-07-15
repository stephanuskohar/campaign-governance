/**
 * Campaign Governance — Frontend configuration.
 * The ONLY frontend file you edit to connect the app. See README.md for setup.
 */
const CONFIG = {
  // Paste the "/exec" URL you get after deploying apps-script/Code.gs as a Web App.
  WEB_APP_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",

  // Only emails on this domain are accepted for the User field.
  ALLOWED_DOMAIN: "shopee.com",

  // Campaign duration constraint (End - Start), in days (inclusive bounds).
  MIN_DURATION_DAYS: 1,
  MAX_DURATION_DAYS: 365,

  // Campaign Intent / Campaign Type options are loaded live from the
  // "Director Note Ingestion" tab via the backend (getOptions). No hardcoding.
};
