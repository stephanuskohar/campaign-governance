/**
 * Campaign Governance — Google Apps Script backend (Web App).
 *
 * Appends a submitted campaign to the "Web Ingestion" tab of the target Sheet.
 * This is the free "backend" for the static GitHub Pages frontend.
 *
 * SETUP
 *   1. Open the Sheet → Extensions → Apps Script.
 *   2. Paste this file in. Confirm the CONFIG block below matches your sheet.
 *   3. Deploy → New deployment → Web app:
 *        - Execute as: Me
 *        - Who has access: Anyone   (so the static site can POST to it)
 *      Copy the /exec URL into js/config.js → WEB_APP_URL.
 *   4. (Optional) Run testSubmit once from the editor and approve permissions.
 *
 * Columns are matched BY HEADER NAME, and the header row is auto-detected, so
 * the exact column order / any blank rows above the header don't matter.
 */

// ============================== CONFIG =======================================
var CONFIG = {
  SPREADSHEET_ID: "15MG67LYIhV5HCH7EUNxZvF3rFmlkgWvCY9k_O1d_A-0",
  INGEST_TAB: "Web Ingestion",

  // A column guaranteed to be in the header row — used to locate the header row.
  KEY_HEADER: "User",

  // The submission timestamp is written to this column, in Jakarta time.
  DATE_HEADER: "Date",
  TIMEZONE: "Asia/Jakarta",
  DATE_FORMAT: "yyyy-MM-dd HH:mm:ss",

  // Headers whose incoming "YYYY-MM-DD" string should be stored as a real Date.
  DATE_COLUMNS: ["Campaign Start Date", "Campaign End Date"],
};
// =============================================================================

function doGet() {
  return json({ ok: true, data: { status: "Campaign Governance backend is running." } });
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

function submitCampaign(fields) {
  var sh = getTab();
  var header = findHeader(sh);
  var headers = header.values;

  // Stamp the submission time in Jakarta time.
  var dateStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
  fields[CONFIG.DATE_HEADER] = dateStr;

  // Build the row in the sheet's own column order; unknown columns stay blank.
  var row = headers.map(function (h) {
    h = String(h).trim();
    if (!fields.hasOwnProperty(h)) return "";
    var val = fields[h];
    if (CONFIG.DATE_COLUMNS.indexOf(h) !== -1 && val) return parseDate(val);
    return val;
  });

  var targetRow = sh.getLastRow() + 1;
  sh.getRange(targetRow, 1, 1, headers.length).setValues([row]);

  return { id: fields.ID || "", date: dateStr, row: targetRow };
}

// ------------------------------- Helpers -----------------------------------

function getTab() {
  var ss = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.INGEST_TAB);
  if (!sh) throw new Error('Tab not found: "' + CONFIG.INGEST_TAB + '". Check CONFIG.INGEST_TAB.');
  return sh;
}

/** Find the header row by scanning the first 15 rows for CONFIG.KEY_HEADER. */
function findHeader(sh) {
  var scan = Math.min(15, sh.getLastRow() || 1);
  var lastCol = sh.getLastColumn();
  var block = sh.getRange(1, 1, scan, lastCol).getValues();
  for (var r = 0; r < block.length; r++) {
    for (var c = 0; c < block[r].length; c++) {
      if (String(block[r][c]).trim() === CONFIG.KEY_HEADER) {
        return { rowIndex: r + 1, values: block[r] };
      }
    }
  }
  throw new Error('Header row not found (no "' + CONFIG.KEY_HEADER + '" cell in first ' + scan + ' rows).');
}

/** Parse "YYYY-MM-DD" into a Date at local midnight (date-only, no TZ shift). */
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

// ------------------------------- Self-test ---------------------------------
function testSubmit() {
  var out = submitCampaign({
    "User": "test@shopee.com",
    "Campaign Intent": "Conversion",
    "Campaign Type": "Category",
    "Name": "TEST — delete me",
    "Campaign Start Date": "2026-08-01",
    "Campaign End Date": "2026-08-10",
    "GMV ($)": 1000, "A1": 0, "Budget ($)": 500,
    "Seller Investment ($) - Cash": 0,
    "Seller Investment ($) - Promissed PRM": 0,
    "Seller Investment ($) - Marketing Barter": 0,
    "ID": "TEST123456",
  });
  Logger.log(JSON.stringify(out));
}
