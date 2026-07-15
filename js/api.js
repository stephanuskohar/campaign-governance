/**
 * Thin fetch wrappers around the Apps Script Web App JSON API.
 *
 * IMPORTANT (CORS): Apps Script web apps cannot set arbitrary response headers,
 * so POSTs are sent as a "simple request" (Content-Type: text/plain) with a JSON
 * string body. This avoids the CORS preflight that would otherwise be rejected.
 */
const API = (() => {
  function ensureConfigured() {
    if (!CONFIG.WEB_APP_URL || CONFIG.WEB_APP_URL.startsWith("PASTE_")) {
      throw new Error(
        "App not configured yet: set CONFIG.WEB_APP_URL in js/config.js to your Apps Script Web App URL."
      );
    }
  }

  async function handle(res) {
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Unexpected response from server: " + text.slice(0, 200));
    }
    if (!data.ok) throw new Error(data.error || "Request failed");
    return data.data;
  }

  async function post(action, payload) {
    ensureConfigured();
    const res = await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
      redirect: "follow",
    });
    return handle(res);
  }

  async function get(action) {
    ensureConfigured();
    const url = new URL(CONFIG.WEB_APP_URL);
    url.searchParams.set("action", action);
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    return handle(res);
  }

  return {
    /** Load dropdown options: { intents:[...], types:[...] }. */
    getOptions: () => get("getOptions"),
    /** Append a campaign; returns { id, date, row }. */
    submitCampaign: (fields) => post("submitCampaign", { fields }),
  };
})();
