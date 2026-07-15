/**
 * Campaign Governance — Google Apps Script backend (Web App).
 *
 * This runs inside Google, bound to your Sheet, and acts as the JSON API for the
 * static GitHub Pages frontend. It is the ONLY component with write access, so
 * conflict-prevention and the owner-permission check happen here and cannot be
 * bypassed from the browser.
 *
 * SETUP
 *   1. Open your Google Sheet → Extensions → Apps Script.
 *   2. Paste this file in, then fill in the SHEET config block below to match
 *      your real tabs and column headers.
 *   3. Deploy → New deployment → Web app:
 *        - Execute as: Me
 *        - Who has access: Anyone  (or "Anyone within <your org>")
 *      Copy the /exec URL into js/config.js → WEB_APP_URL.
 *
 * Columns are resolved BY HEADER NAME at runtime, so you only edit the strings
 * below — never hard-coded column letters.
 */

// ======================= EDIT THIS TO MATCH YOUR SHEET =======================
var SHEET = {
  SPREADSHEET_ID: "",                 // "" = use the bound spreadsheet (recommended)

  CAMPAIGNS_TAB: "Campaigns",         // one row per campaign; eligibility formulas live here
  ASSETS_TAB: "Assets",               // master list of assets
  BOOKINGS_TAB: "Bookings",           // one row per booking

  // --- Campaigns tab ---
  CAMPAIGN_KEY_COL: "Campaign ID",    // unique id column (auto-filled if blank on submit)
  // The header of each per-asset eligibility column equals the asset name and holds
  // TRUE/FALSE (or Yes/No / 1/0). List them here, OR leave empty to auto-detect any
  // column whose header matches an asset name from the Assets tab.
  ELIGIBILITY_COLS: [],

  // --- Assets tab ---
  ASSET_NAME_COL: "Asset",            // column holding the asset name

  // --- Bookings tab: map logical fields -> your real header names ---
  BOOKING_COLS: {
    id: "Booking ID",
    asset: "Asset",
    start: "Start",                   // date/datetime the booking starts
    end: "End",                       // date/datetime the booking ends
    owner: "Owner Email",
    status: "Status",                 // e.g. "Pending" / "Confirmed"
    campaignId: "Campaign ID",
  },
  DEFAULT_STATUS: "Pending",
};

// Set to your org domain to reject tokens/emails from outside it. "" disables the check.
var ALLOWED_DOMAIN = "shopee.com";
// =============================================================================

function doGet(e) {
  return route((e && e.parameter) || {}, null);
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json({ ok: false, error: "Invalid JSON body" });
  }
  return route(body, body);
}

function route(params, body) {
  var action = params.action;
  try {
    switch (action) {
      case "submitCampaign":
        return json({ ok: true, data: submitCampaign(body.fields || {}) });
      case "getBookings":
        return json({ ok: true, data: getBookings() });
      case "createBooking":
        return json({ ok: true, data: createBooking(body.booking || {}, body.auth || {}) });
      case "updateBooking":
        return json({ ok: true, data: updateBooking(body.booking || {}, body.auth || {}) });
      default:
        return json({ ok: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return json({ ok: false, error: err.message, code: err.code || "ERROR" });
  }
}

// ------------------------------- Actions -----------------------------------

/**
 * Append a campaign row, let the sheet's own formulas recalc, then read back the
 * eligible assets from that row.
 */
function submitCampaign(fields) {
  var sh = tab(SHEET.CAMPAIGNS_TAB);
  var headers = headerRow(sh);
  var idIdx = headers.indexOf(SHEET.CAMPAIGN_KEY_COL);

  // Generate a Campaign ID if the caller didn't provide one.
  var campaignId = fields[SHEET.CAMPAIGN_KEY_COL];
  if (!campaignId) {
    campaignId = "CMP-" + new Date().getTime();
    fields[SHEET.CAMPAIGN_KEY_COL] = campaignId;
  }

  // Build the row in header order; unknown fields are ignored.
  var row = headers.map(function (h) {
    return fields.hasOwnProperty(h) ? fields[h] : "";
  });
  sh.appendRow(row);
  SpreadsheetApp.flush(); // force eligibility formulas to recalc

  var newRowNum = sh.getLastRow();
  var eligibleAssets = readEligibility(sh, headers, newRowNum);
  return { campaignId: campaignId, eligibleAssets: eligibleAssets };
}

/** Read TRUE-valued eligibility columns from a campaign row. */
function readEligibility(sh, headers, rowNum) {
  var values = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];

  var assetHeaders = SHEET.ELIGIBILITY_COLS;
  if (!assetHeaders || !assetHeaders.length) {
    // Auto-detect: any header that matches an asset name from the Assets tab.
    var assetNames = listAssetNames();
    assetHeaders = headers.filter(function (h) {
      return assetNames.indexOf(h) !== -1;
    });
  }

  var eligible = [];
  assetHeaders.forEach(function (h) {
    var idx = headers.indexOf(h);
    if (idx === -1) return;
    if (isTruthy(values[idx])) eligible.push(h);
  });
  return eligible;
}

function getBookings() {
  var sh = tab(SHEET.BOOKINGS_TAB);
  var headers = headerRow(sh);
  var col = resolveBookingCols(headers);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values
    .filter(function (r) {
      return r[col.asset] !== "" || r[col.id] !== "";
    })
    .map(function (r, i) {
      return {
        rowNum: i + 2,
        id: str(r[col.id]),
        asset: str(r[col.asset]),
        start: toIso(r[col.start]),
        end: toIso(r[col.end]),
        owner: str(r[col.owner]),
        status: str(r[col.status]) || SHEET.DEFAULT_STATUS,
        campaignId: col.campaignId != null ? str(r[col.campaignId]) : "",
      };
    });
}

function createBooking(booking, auth) {
  var email = verifyIdentity(auth);
  requireFields(booking, ["asset", "start", "end"]);

  var start = new Date(booking.start);
  var end = new Date(booking.end);
  if (!(start < end)) fail("End must be after start", "BAD_RANGE");

  // Conflict check against existing bookings for the same asset.
  var existing = getBookings();
  var clash = existing.some(function (b) {
    return (
      b.asset === booking.asset &&
      b.status !== "Cancelled" &&
      overlaps(start, end, new Date(b.start), new Date(b.end))
    );
  });
  if (clash) fail("That asset is already booked for the selected dates.", "CONFLICT");

  var sh = tab(SHEET.BOOKINGS_TAB);
  var headers = headerRow(sh);
  var col = resolveBookingCols(headers);
  var bookingId = "BKG-" + new Date().getTime();

  var row = new Array(headers.length).fill("");
  row[col.id] = bookingId;
  row[col.asset] = booking.asset;
  row[col.start] = start;
  row[col.end] = end;
  row[col.owner] = email;
  row[col.status] = SHEET.DEFAULT_STATUS;
  if (col.campaignId != null && booking.campaignId) row[col.campaignId] = booking.campaignId;
  sh.appendRow(row);

  return { id: bookingId, status: SHEET.DEFAULT_STATUS };
}

function updateBooking(booking, auth) {
  var email = verifyIdentity(auth);
  requireFields(booking, ["id"]);

  var sh = tab(SHEET.BOOKINGS_TAB);
  var headers = headerRow(sh);
  var col = resolveBookingCols(headers);
  var last = sh.getLastRow();
  var ids = sh.getRange(2, col.id + 1, Math.max(last - 1, 0), 1).getValues();

  var rowNum = -1;
  for (var i = 0; i < ids.length; i++) {
    if (str(ids[i][0]) === str(booking.id)) {
      rowNum = i + 2;
      break;
    }
  }
  if (rowNum === -1) fail("Booking not found", "NOT_FOUND");

  // OWNER CHECK — the security boundary. Only the owner may edit/cancel.
  var ownerCell = str(sh.getRange(rowNum, col.owner + 1).getValue());
  if (ownerCell.toLowerCase() !== email.toLowerCase()) {
    fail("You can only edit your own bookings.", "FORBIDDEN");
  }

  if (booking.cancel === true) {
    sh.getRange(rowNum, col.status + 1).setValue("Cancelled");
    return { id: booking.id, status: "Cancelled" };
  }

  // Editable fields: dates (re-run conflict check) and status is left to validators.
  if (booking.start && booking.end) {
    var start = new Date(booking.start);
    var end = new Date(booking.end);
    if (!(start < end)) fail("End must be after start", "BAD_RANGE");
    var asset = str(sh.getRange(rowNum, col.asset + 1).getValue());
    var clash = getBookings().some(function (b) {
      return (
        b.id !== booking.id &&
        b.asset === asset &&
        b.status !== "Cancelled" &&
        overlaps(start, end, new Date(b.start), new Date(b.end))
      );
    });
    if (clash) fail("That asset is already booked for the selected dates.", "CONFLICT");
    sh.getRange(rowNum, col.start + 1).setValue(start);
    sh.getRange(rowNum, col.end + 1).setValue(end);
  }
  return { id: booking.id, status: "updated" };
}

// ------------------------------- Identity ----------------------------------

/**
 * Returns the trusted email for a request, or throws.
 * - google mode: auth.idToken is a GIS JWT; verify with Google's tokeninfo endpoint.
 * - manual mode: auth.email is trusted as-is (documented as non-secure).
 */
function verifyIdentity(auth) {
  if (auth && auth.idToken) {
    return verifyGoogleToken(auth.idToken);
  }
  if (auth && auth.email) {
    var email = String(auth.email).trim();
    domainGuard(email);
    return email;
  }
  fail("Sign in required.", "UNAUTHENTICATED");
}

function verifyGoogleToken(idToken) {
  var url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) fail("Invalid sign-in token.", "UNAUTHENTICATED");
  var info = JSON.parse(res.getContentText());
  // exp is seconds since epoch.
  if (Number(info.exp) * 1000 < Date.now()) fail("Sign-in expired, please sign in again.", "UNAUTHENTICATED");
  if (info.email_verified !== "true" && info.email_verified !== true) {
    fail("Email not verified.", "UNAUTHENTICATED");
  }
  domainGuard(info.email);
  return info.email;
}

function domainGuard(email) {
  if (!ALLOWED_DOMAIN) return;
  if (String(email).toLowerCase().indexOf("@" + ALLOWED_DOMAIN.toLowerCase()) === -1) {
    fail("Only @" + ALLOWED_DOMAIN + " accounts are allowed.", "FORBIDDEN");
  }
}

// ------------------------------- Helpers -----------------------------------

function ss() {
  return SHEET.SPREADSHEET_ID
    ? SpreadsheetApp.openById(SHEET.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function tab(name) {
  var sh = ss().getSheetByName(name);
  if (!sh) fail('Tab not found: "' + name + '". Check SHEET config.', "CONFIG");
  return sh;
}

function headerRow(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim();
  });
}

function resolveBookingCols(headers) {
  var m = SHEET.BOOKING_COLS;
  var col = {};
  ["id", "asset", "start", "end", "owner", "status", "campaignId"].forEach(function (k) {
    var idx = headers.indexOf(m[k]);
    if (idx === -1 && k === "campaignId") {
      col[k] = null; // optional
    } else if (idx === -1) {
      fail('Bookings column not found: "' + m[k] + '" (field ' + k + ")", "CONFIG");
    } else {
      col[k] = idx;
    }
  });
  return col;
}

function listAssetNames() {
  var sh = tab(SHEET.ASSETS_TAB);
  var headers = headerRow(sh);
  var idx = headers.indexOf(SHEET.ASSET_NAME_COL);
  if (idx === -1) fail('Assets name column not found: "' + SHEET.ASSET_NAME_COL + '"', "CONFIG");
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh
    .getRange(2, idx + 1, last - 1, 1)
    .getValues()
    .map(function (r) {
      return String(r[0]).trim();
    })
    .filter(String);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd; // half-open intervals
}

function isTruthy(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "eligible";
}

function requireFields(obj, keys) {
  keys.forEach(function (k) {
    if (obj[k] === undefined || obj[k] === null || obj[k] === "") {
      fail("Missing field: " + k, "BAD_REQUEST");
    }
  });
}

function str(v) {
  return v == null ? "" : String(v);
}

function toIso(v) {
  if (v instanceof Date) return v.toISOString();
  if (!v) return "";
  var d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function fail(message, code) {
  var e = new Error(message);
  e.code = code || "ERROR";
  throw e;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ------------------------------- Self-tests --------------------------------
// Run these from the Apps Script editor (Run ▸ testXyz) to verify wiring.
function testGetBookings() {
  Logger.log(JSON.stringify(getBookings(), null, 2));
}
function testSubmitCampaign() {
  Logger.log(
    JSON.stringify(
      submitCampaign({ "Campaign Name": "TEST", "Owner Email": "test@" + ALLOWED_DOMAIN }),
      null,
      2
    )
  );
}
