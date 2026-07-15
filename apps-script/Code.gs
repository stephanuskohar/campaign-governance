/**
 * Campaign Governance — Apps Script web app (UI + backend in one).
 *
 * Deployed as: Execute as "User accessing", Access "Anyone within Shopee".
 * The UI is served by doGet() and calls the server via google.script.run — so it
 * runs same-origin on script.google.com as the signed-in user (no CORS).
 *
 * DEPLOY
 *   1. In the Sheet → Extensions → Apps Script, create two files:
 *        - Code.gs   (this file)
 *        - Index.html (from apps-script/Index.html)
 *   2. Deploy → New deployment → Web app (or Manage deployments → New version).
 *   3. Open the /exec URL.
 *
 * NOTE: Because it executes as the accessing user, each submitter needs EDIT
 * access to this spreadsheet (share it with the Shopee domain as Editor).
 */

// ============================== CONFIG =======================================
var CONFIG = {
  SPREADSHEET_ID: "15MG67LYIhV5HCH7EUNxZvF3rFmlkgWvCY9k_O1d_A-0",

  INGEST_TAB: "Web Ingestion",
  KEY_HEADER: "User",
  DATE_HEADER: "Date",
  TIMEZONE: "Asia/Jakarta",
  DATE_FORMAT: "yyyy-MM-dd HH:mm:ss",
  DATE_COLUMNS: ["Campaign Start Date", "Campaign End Date"],

  DIRECTOR_TAB: "Director Note Ingestion",
  INTENT_COL_INDEX: 2, // column B → Campaign Intent
  TYPE_COL_INDEX: 1, // column A → Campaign Type

  // --- Results read-back (READ ONLY) ---
  READ_TAB: "Web Read",
  READ_ID_HEADER: "ID",
  // Basic assets: sheet header -> display label.
  BASIC_ASSETS: [
    { header: "Popup_Max", label: "Popup" },
    { header: "DD_Banner_Max", label: "DD Banner" },
    { header: "PN_Max", label: "PN" },
    { header: "Search_Prefill_Hours", label: "Prefill Hours" },
    { header: "Curated_Search", label: "Curated_Search" },
  ],
  // Identity/summary fields shown at the top, in order.
  READ_HEADER_FIELDS: [
    "ID", "User", "Date", "Campaign Intent", "Campaign Type", "Name",
    "Campaign Start Date", "Campaign End Date", "# Days", "Score",
  ],
  // Additional assets start at the column AFTER this header (Q..AQ).
  ADDITIONAL_AFTER_HEADER: "Curated_Search",

  ALLOWED_DOMAIN: "shopee.com",
};
// =============================================================================

function doGet() {
  var t = HtmlService.createTemplateFromFile("Index");
  t.userEmail = getActiveUserEmail();
  return t
    .evaluate()
    .setTitle("Submit Campaign — Campaign Governance")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

function getActiveUserEmail() {
  try {
    return Session.getActiveUser().getEmail() || "";
  } catch (e) {
    return "";
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
  var seen = {}, out = [];
  arr.forEach(function (v) {
    var s = String(v == null ? "" : v).trim();
    if (s && !seen[s]) { seen[s] = true; out.push(s); }
  });
  out.sort(function (a, b) { return a.localeCompare(b); });
  return out;
}

// ------------------------------- Submit ------------------------------------

function submitCampaign(fields) {
  fields = fields || {};

  // Authoritative identity: the signed-in user.
  var email = getActiveUserEmail();
  if (email) fields.User = email;
  if (CONFIG.ALLOWED_DOMAIN && String(fields.User || "").toLowerCase().indexOf("@" + CONFIG.ALLOWED_DOMAIN) === -1) {
    throw new Error("Only @" + CONFIG.ALLOWED_DOMAIN + " accounts can submit.");
  }

  var sh = getSheet(CONFIG.INGEST_TAB);
  var headers = findHeader(sh);
  fields[CONFIG.DATE_HEADER] = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);

  var cells = {}, maxCol = 0;
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

  var result = getResultById(fields.ID);
  return { id: fields.ID || "", date: fields[CONFIG.DATE_HEADER], user: fields.User, row: targetRow, result: result };
}

// ------------------------------ Read-back (READ ONLY) ----------------------
// Reads the "Web Read" tab, finds the row whose ID matches, and returns the
// computed result. NEVER writes to this sheet.
function getResultById(id) {
  if (!id) return { found: false };
  var sh = getSheet(CONFIG.READ_TAB);

  for (var attempt = 0; attempt < 5; attempt++) {
    SpreadsheetApp.flush(); // let Web Read formulas recompute for the new row
    var last = sh.getLastRow();
    if (last >= 2) {
      var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
      var idIdx = headers.indexOf(CONFIG.READ_ID_HEADER);
      if (idIdx === -1) return { found: false, error: 'ID header not found in "' + CONFIG.READ_TAB + '".' };
      var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
      for (var r = 0; r < values.length; r++) {
        if (String(values[r][idIdx]).trim() === String(id).trim()) {
          return buildResult(headers, values[r]);
        }
      }
    }
    Utilities.sleep(500);
  }
  return { found: false };
}

function buildResult(headers, row) {
  function at(header) {
    var i = headers.indexOf(header);
    return i === -1 ? "" : formatCell(header, row[i]);
  }

  var header = {};
  CONFIG.READ_HEADER_FIELDS.forEach(function (h) { header[h] = at(h); });

  var basic = CONFIG.BASIC_ASSETS.map(function (b) {
    return { label: b.label, value: at(b.header) };
  });

  var additional = [];
  var startAfter = headers.indexOf(CONFIG.ADDITIONAL_AFTER_HEADER);
  if (startAfter !== -1) {
    for (var i = startAfter + 1; i < headers.length; i++) {
      if (!headers[i]) continue;
      if (Number(row[i]) === 1) additional.push(headers[i]);
    }
  }

  return { found: true, header: header, basic: basic, additional: additional };
}

function formatCell(headerName, v) {
  if (v instanceof Date) {
    if (headerName === CONFIG.DATE_HEADER) return Utilities.formatDate(v, CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
    return Utilities.formatDate(v, CONFIG.TIMEZONE, "yyyy-MM-dd");
  }
  return v == null ? "" : v;
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

function parseDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return s;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// ------------------------------- Self-tests --------------------------------
function testGetOptions() { Logger.log(JSON.stringify(getOptions(), null, 2)); }
