/* Submit Campaign page: load options, validate, generate ID, submit, show result. */
(function () {
  const form = document.getElementById("campaign-form");
  const submitBtn = document.getElementById("submit-btn");
  const msg = document.getElementById("form-msg");
  const resultEmpty = document.getElementById("result-empty");
  const resultContent = document.getElementById("result-content");

  const intentMS = MultiSelect.create(document.getElementById("ms-intent"), {
    placeholder: "Select intent(s)…",
  });
  const typeMS = MultiSelect.create(document.getElementById("ms-type"), {
    placeholder: "Select type(s)…",
  });

  const el = (id) => document.getElementById(id);

  // ---- Load Intent / Type options live from the sheet -------------------
  (async function loadOptions() {
    try {
      const { intents, types } = await API.getOptions();
      intentMS.setOptions(intents || []);
      typeMS.setOptions(types || []);
    } catch (e) {
      intentMS.setOptions([]);
      typeMS.setOptions([]);
      showMsg(msg, "info", "Could not load Intent/Type options: " + e.message);
    }
  })();

  // ---- Constrain Start date to today (Jakarta) --------------------------
  const jakartaToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  el("f-start").max = jakartaToday;

  // ---- Helpers ----------------------------------------------------------
  function generateId() {
    const alnum = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const firstSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"; // no leading 0
    let id = firstSet[Math.floor(Math.random() * firstSet.length)];
    for (let i = 1; i < 10; i++) id += alnum[Math.floor(Math.random() * alnum.length)];
    return id;
  }

  function daysBetween(startStr, endStr) {
    const MS = 24 * 60 * 60 * 1000;
    return Math.round((new Date(endStr) - new Date(startStr)) / MS);
  }

  function validEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function num(id) {
    return parseFloat(el(id).value);
  }

  function validate(v) {
    if (!validEmail(v.user)) return "Enter a valid email address for User.";
    if (!v.user.toLowerCase().endsWith("@" + CONFIG.ALLOWED_DOMAIN.toLowerCase()))
      return "Email must be on the @" + CONFIG.ALLOWED_DOMAIN + " domain.";
    if (v.intents.length === 0) return "Select at least one Campaign Intent.";
    if (v.types.length === 0) return "Select at least one Campaign Type.";
    if (!v.name) return "Enter a Campaign Name.";
    if (!v.start) return "Choose a Campaign Start Date.";
    if (!v.end) return "Choose a Campaign End Date.";
    if (v.start > jakartaToday) return "Campaign Start Date must be on or before today (" + jakartaToday + ").";
    const days = daysBetween(v.start, v.end);
    if (days < CONFIG.MIN_DURATION_DAYS)
      return "Campaign End Date must be at least " + CONFIG.MIN_DURATION_DAYS + " day after the Start Date.";
    if (days > CONFIG.MAX_DURATION_DAYS)
      return "Campaign cannot be longer than " + CONFIG.MAX_DURATION_DAYS + " days (currently " + days + ").";
    const numbers = {
      "GMV ($)": v.gmv, A1: v.a1, "Budget ($)": v.budget,
      "Seller Investment - Cash": v.cash, "Seller Investment - Promissed PRM": v.prm,
      "Seller Investment - Marketing Barter": v.barter,
    };
    for (const [name, val] of Object.entries(numbers)) {
      if (el(fieldIdFor(name)).value === "" || isNaN(val)) return name + " must be a number.";
      if (val < 0) return name + " cannot be negative.";
    }
    return null;
  }

  function fieldIdFor(name) {
    return {
      "GMV ($)": "f-gmv", A1: "f-a1", "Budget ($)": "f-budget",
      "Seller Investment - Cash": "f-cash", "Seller Investment - Promissed PRM": "f-prm",
      "Seller Investment - Marketing Barter": "f-barter",
    }[name];
  }

  // ---- Submit -----------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsg(msg);

    const v = {
      user: el("f-user").value.trim(),
      intents: intentMS.getValues(),
      types: typeMS.getValues(),
      name: el("f-name").value.trim(),
      start: el("f-start").value,
      end: el("f-end").value,
      gmv: num("f-gmv"), a1: num("f-a1"), budget: num("f-budget"),
      cash: num("f-cash"), prm: num("f-prm"), barter: num("f-barter"),
    };

    const err = validate(v);
    if (err) {
      showMsg(msg, "error", err);
      return;
    }

    const id = generateId();
    const intentStr = v.intents.join(", ");
    const typeStr = v.types.join(", ");
    // Column keys MUST match the "Web Ingestion" tab headers. "Date" is stamped
    // server-side in Jakarta time.
    const fields = {
      "User": v.user,
      "Campaign Intent": intentStr,
      "Campaign Type": typeStr,
      "Name": v.name,
      "Campaign Start Date": v.start,
      "Campaign End Date": v.end,
      "GMV ($)": v.gmv,
      "A1": v.a1,
      "Budget ($)": v.budget,
      "Seller Investment ($) - Cash": v.cash,
      "Seller Investment ($) - Promissed PRM": v.prm,
      "Seller Investment ($) - Marketing Barter": v.barter,
      "ID": id,
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    try {
      const res = await API.submitCampaign(fields);
      renderResult(v, intentStr, typeStr, res.id || id, res.date, daysBetween(v.start, v.end));
      form.reset();
      intentMS.clear();
      typeMS.clear();
      showMsg(msg, "success", "Campaign submitted successfully (ID: " + (res.id || id) + ").");
    } catch (e2) {
      showMsg(msg, "error", e2.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit campaign";
    }
  });

  // ---- Result panel -----------------------------------------------------
  function renderResult(v, intentStr, typeStr, id, date, days) {
    resultEmpty.style.display = "none";
    resultContent.style.display = "block";
    resultContent.innerHTML =
      "<h2>Your Campaign</h2>" +
      '<div class="result-rows">' +
      row("ID", id) +
      row("User", v.user) +
      row("Date", date || "(recorded)") +
      row("Campaign Intent", intentStr) +
      row("Campaign Type", typeStr) +
      row("Name", v.name) +
      row("Campaign Start Date", v.start) +
      row("Campaign End Date", v.end) +
      row("# Days", String(days)) +
      "</div>" +
      '<div class="result-note">' +
      "Score, Tier, Duration Tier and asset eligibility (Basic &amp; Additional) " +
      "will appear here once the results read-back is wired up." +
      "</div>";
    resultContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function row(label, value) {
    return (
      '<div class="result-row"><span class="rl">' +
      escapeHtml(label) +
      '</span><span class="rv">' +
      escapeHtml(value) +
      "</span></div>"
    );
  }
})();
