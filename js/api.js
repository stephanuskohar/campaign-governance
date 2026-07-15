/**
 * Thin fetch wrappers around the Apps Script Web App JSON API.
 *
 * IMPORTANT (CORS): Apps Script web apps cannot set arbitrary response headers,
 * so we send POSTs as a "simple request" (Content-Type: text/plain) with a JSON
 * string body. This avoids the CORS preflight that would otherwise be rejected.
 * Do not change the Content-Type or add custom headers here.
 */
const API = (() => {
  function ensureConfigured() {
    if (!CONFIG.WEB_APP_URL || CONFIG.WEB_APP_URL.startsWith("PASTE_")) {
      throw new Error(
        "App not configured yet: set CONFIG.WEB_APP_URL in js/config.js to your Apps Script Web App URL."
      );
    }
  }

  async function post(action, payload) {
    ensureConfigured();
    const res = await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      // text/plain keeps this a "simple" request → no preflight.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
      redirect: "follow",
    });
    return handle(res);
  }

  async function get(action, params = {}) {
    ensureConfigured();
    const url = new URL(CONFIG.WEB_APP_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    return handle(res);
  }

  async function handle(res) {
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Unexpected response from server: " + text.slice(0, 200));
    }
    if (!data.ok) {
      const err = new Error(data.error || "Request failed");
      err.code = data.code;
      throw err;
    }
    return data.data;
  }

  return {
    /** Submit a campaign; returns { campaignId, eligibleAssets: [...] }. */
    submitCampaign: (fields) => post("submitCampaign", { fields }),
    /** List all bookings for the calendar. */
    getBookings: () => get("getBookings"),
    /** Create a booking. auth = { idToken } or { email }. */
    createBooking: (booking, auth) => post("createBooking", { booking, auth }),
    /** Update/cancel a booking (owner-only, enforced server-side). */
    updateBooking: (booking, auth) => post("updateBooking", { booking, auth }),
  };
})();
