/**
 * Campaign Governance — Google Apps Script backend (Web App).
 *
 * - getOptions  : returns Campaign Intent / Type options from "Director Note Ingestion".
 * - submitCampaign : appends a validated campaign to the "Web Ingestion" tab.
 *
 * SETUP
 *   1. Open the Sheet → Extensions → Apps Script. Paste this file in.
 *   2. Deploy → New deployment → Web app:
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Copy the /exec URL into js/config.js → WEB_APP_URL.
 *   3. (Optional) Run testGetOptions / testSubmit once to approve permissions.
 *
 * Columns are matched BY HEADER NAME, header row is auto-detected, and only the
 * matched input columns are written — computed columns are never overwritten.
 */

// ============================== CONFIG =======================================
var CONFIG = {
  SPREADSHEET_ID: "15MG67LYIhV5HCH7EUNxZvF3rFmlkgWvCY9k_O1d_A-0",

  // --- Append target ---
  INGEST_TAB: "Web Ingestion",
  KEY_HEADER: "User", // used to locate the header row
  DATE_HEADER: "Date",
  TIMEZONE: "Asia/Jakarta",
  DATE_FORMAT: "yyyy-MM-dd HH:mm:ss",
  DATE_COLUMNS: ["Campaign Start Date", "Campaign End Date"], // stored as real Dates

  // --- Dropdown option source ---
  DIRECTOR_TAB: "Director Note Ingestion",
  INTENT_COL_INDEX: 2, // column B → Campaign Intent
  TYPE_COL_INDEX: 1, // column A → Campaign Type
};
// =============================================================================

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "";
    if (action === "getOptions") return json({ ok: true, data: getOptions() });
    return json({ ok: true, data: { status: "Campaign Governance backend is running." } });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action === "submitCampaign") {
      return json({ ok: true, data: submitCampaign(body.fields || {}) });
    }
    return json({ ok: false, error: "Unknown action: " + body.action });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ------------------------------- Options -----------------------------------

function getOptions() {
  var sh = getSheet(CONFIG.DIRECTOR_TAB);
  var last = sh.getLastRow();
  if (last < 2) return { intents: [], types: [] };
  var lastCol = Math.max(CONFIG.INTENT_COL_INDEX, CONFIG.TYPE_COL_INDEX);
  var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
  return {
    intents: uniqueNonEmpty(vals.map(function (r) { return r[CONFIG.INTENT_COL_INDEX - 1]; })),
    types: uniqueNonEmpty(vals.map(function (r) { return r[CONFIG.TYPE_COL_INDEX - 1]; })),
  };
}

function uniqueNonEmpty(arr) {
  var seen = {};
  var out = [];
  arr.forEach(function (v) {
    var s = String(v == null ? "" : v).trim();
    if (s && !seen[s]) {
      seen[s] = true;
      out.push(s);
    }
  });
  out.sort(function (a, b) { return a.localeCompare(b); });
  return out;
}

// ------------------------------- Submit ------------------------------------

function submitCampaign(fields) {
  var sh = getSheet(CONFIG.INGEST_TAB);
  var headers = findHeader(sh);

  // Stamp submission time in Jakarta time.
  fields[CONFIG.DATE_HEADER] = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);

  // Map only matched input columns; never touch computed columns to the right.
  var cells = {};
  var maxCol = 0;
  headers.forEach(function (h, i) {
    h = String(h).trim();
    if (fields.hasOwnProperty(h)) {
      var v = fields[h];
      if (CONFIG.DATE_COLUMNS.indexOf(h) !== -1 && v) v = parseDate(v);
      cells[i] = v;
      if (i + 1 > maxCol) maxCol = i + 1;
    }
  });
  if (maxCol === 0) throw new Error("No matching column headers found in the header row.");

  var targetRow = sh.getLastRow() + 1;
  var row = new Array(maxCol).fill("");
  Object.keys(cells).forEach(function (i) { row[Number(i)] = cells[i]; });
  sh.getRange(targetRow, 1, 1, maxCol).setValues([row]);

  return { id: fields.ID || "", date: fields[CONFIG.DATE_HEADER], row: targetRow };
}

// ------------------------------- Helpers -----------------------------------

function getSheet(name) {
  var ss = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Tab not found: "' + name + '".');
  return sh;
}

/** Find and return the header row values by scanning first 15 rows for KEY_HEADER. */
function findHeader(sh) {
  var scan = Math.min(15, sh.getLastRow() || 1);
  var block = sh.getRange(1, 1, scan, sh.getLastColumn()).getValues();
  for (var r = 0; r < block.length; r++) {
    for (var c = 0; c < block[r].length; c++) {
      if (String(block[r][c]).trim() === CONFIG.KEY_HEADER) return block[r];
    }
  }
  throw new Error('Header row not found (no "' + CONFIG.KEY_HEADER + '" cell in first ' + scan + " rows).");
}

/** Parse "YYYY-MM-DD" into a local-midnight Date (date-only, no TZ shift). */
function parseDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return s;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ------------------------------- Self-tests --------------------------------
function testGetOptions() {
  Logger.log(JSON.stringify(getOptions(), null, 2));
}

function testSubmit() {
  var out = submitCampaign({
    "User": "test@shopee.com",
    "Campaign Intent": "Conversion",
    "Campaign Type": "Category",
    "Name": "TEST — delete me",
    "Campaign Start Date": "2026-07-01",
    "Campaign End Date": "2026-07-10",
    "GMV ($)": 1000, "A1": 0, "Budget ($)": 500,
    "Seller Investment ($) - Cash": 0,
    "Seller Investment ($) - Promissed PRM": 0,
    "Seller Investment ($) - Marketing Barter": 0,
    "ID": "TEST123456",
  });
  Logger.log(JSON.stringify(out));
}
