/* Submit Campaign page: validate, generate ID, submit to the sheet, show result. */
(function () {
  const form = document.getElementById("campaign-form");
  const submitBtn = document.getElementById("submit-btn");
  const msg = document.getElementById("form-msg");
  const intentSel = document.getElementById("f-intent");
  const typeSel = document.getElementById("f-type");
  const resultEmpty = document.getElementById("result-empty");
  const resultContent = document.getElementById("result-content");

  // ---- Populate dropdowns from config -----------------------------------
  fillSelect(intentSel, CONFIG.CAMPAIGN_INTENTS);
  fillSelect(typeSel, CONFIG.CAMPAIGN_TYPES);

  function fillSelect(sel, options) {
    sel.innerHTML = '<option value="" disabled selected>— select —</option>';
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
  }

  // ---- Helpers ----------------------------------------------------------
  const el = (id) => document.getElementById(id);

  /** 10-char unique-ish ID from [A-Z0-9], never starting with 0. */
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
    if (!v.intent) return "Select a Campaign Intent.";
    if (!v.type) return "Select a Campaign Type.";
    if (!v.name) return "Enter a Campaign Name.";
    if (!v.start) return "Choose a Campaign Start Date.";
    if (!v.end) return "Choose a Campaign End Date.";
    const days = daysBetween(v.start, v.end);
    if (days < 0) return "Campaign End Date must be on or after the Start Date.";
    if (days > CONFIG.MAX_DURATION_DAYS)
      return "Campaign cannot be longer than " + CONFIG.MAX_DURATION_DAYS + " days (currently " + days + ").";
    const numbers = {
      "GMV ($)": v.gmv, A1: v.a1, "Budget ($)": v.budget,
      "Seller Investment - Cash": v.cash, "Seller Investment - Promissed PRM": v.prm,
      "Seller Investment - Marketing Barter": v.barter,
    };
    for (const [label, val] of Object.entries(numbers)) {
      if (val === "" || val == null || isNaN(val)) return label + " must be a number.";
      if (val < 0) return label + " cannot be negative.";
    }
    return null;
  }

  // ---- Submit -----------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsg(msg);

    const v = {
      user: el("f-user").value.trim(),
      intent: intentSel.value,
      type: typeSel.value,
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
    // Column keys MUST match the "Web Ingestion" tab headers exactly.
    // "Date" is stamped by the server in Jakarta time.
    const fields = {
      "User": v.user,
      "Campaign Intent": v.intent,
      "Campaign Type": v.type,
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
      renderResult(v, res.id || id, res.date, daysBetween(v.start, v.end));
      form.reset();
      fillSelect(intentSel, CONFIG.CAMPAIGN_INTENTS);
      fillSelect(typeSel, CONFIG.CAMPAIGN_TYPES);
      showMsg(msg, "success", "Campaign submitted successfully (ID: " + (res.id || id) + ").");
    } catch (e2) {
      showMsg(msg, "error", e2.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit campaign";
    }
  });

  // ---- Result panel -----------------------------------------------------
  function renderResult(v, id, date, days) {
    resultEmpty.style.display = "none";
    resultContent.style.display = "block";
    resultContent.innerHTML =
      '<h2>Your Campaign</h2>' +
      '<div class="result-rows">' +
      row("ID", id) +
      row("User", v.user) +
      row("Date", date || "(recorded)") +
      row("Campaign Intent", v.intent) +
      row("Campaign Type", v.type) +
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
