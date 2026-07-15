/**
 * Campaign Governance — Frontend configuration.
 *
 * The ONLY frontend file you edit to connect the app. See README.md for setup.
 */
const CONFIG = {
  // Paste the "/exec" URL you get after deploying apps-script/Code.gs as a Web App.
  WEB_APP_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",

  // Dropdown options — edit these to match the exact values your eligibility
  // formulas expect. Derived from the existing "Web Ingestion" data.
  CAMPAIGN_INTENTS: ["Conversion", "Acquisition", "Traffic/Engagement", "Branding"],

  CAMPAIGN_TYPES: [
    "Platform Push",
    "MAU Initiatives",
    "Category",
    "Live & Video",
    "Mall",
    "Single Brand",
    "SBS",
    "ShopeeFood",
    "Monee",
    "Creator & Affiliates",
    "ShopeeVIP",
    "Instant",
    "Pilih Lokal",
    "Supermarket",
    "Gamification",
    "SPX",
  ],

  // Max campaign duration allowed (End - Start), in days.
  MAX_DURATION_DAYS: 365,
};
