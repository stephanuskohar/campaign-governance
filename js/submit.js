/* Submit page: render the campaign form, submit it, show eligible assets. */
(function () {
  wireHeader(); // shared header/auth setup (defined at bottom)

  const fieldsWrap = document.getElementById("form-fields");
  const form = document.getElementById("campaign-form");
  const submitBtn = document.getElementById("submit-btn");
  const msg = document.getElementById("form-msg");
  const resultsCard = document.getElementById("results-card");
  const resultsSub = document.getElementById("results-sub");
  const grid = document.getElementById("assets-grid");

  // Build the form from CONFIG.CAMPAIGN_FIELDS.
  CONFIG.CAMPAIGN_FIELDS.forEach((f) => {
    const field = document.createElement("div");
    field.className = "field full";
    const id = "f-" + f.key.replace(/\s+/g, "-").toLowerCase();
    field.innerHTML =
      '<label for="' + id + '">' +
      escapeHtml(f.label) +
      (f.required ? ' <span class="req">*</span>' : "") +
      "</label>" +
      '<input id="' + id + '" name="' + escapeHtml(f.key) + '" type="' + f.type + '"' +
      (f.required ? " required" : "") + " />";
    fieldsWrap.appendChild(field);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsg(msg);
    const fields = {};
    CONFIG.CAMPAIGN_FIELDS.forEach((f) => {
      const el = form.querySelector('[name="' + cssEscape(f.key) + '"]');
      fields[f.key] = el ? el.value.trim() : "";
    });

    submitBtn.disabled = true;
    submitBtn.textContent = "Checking…";
    try {
      const res = await API.submitCampaign(fields);
      renderResults(res);
      showMsg(msg, "success", "Campaign submitted (ID: " + res.campaignId + ").");
    } catch (err) {
      showMsg(msg, "error", err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Check eligibility";
    }
  });

  function renderResults(res) {
    grid.innerHTML = "";
    const assets = res.eligibleAssets || [];
    resultsCard.style.display = "block";
    if (!assets.length) {
      resultsSub.textContent =
        "This campaign is not currently eligible for any assets. Adjust the details and try again.";
      grid.innerHTML = '<div class="empty">No eligible assets.</div>';
      return;
    }
    resultsSub.textContent =
      "You qualify for " + assets.length + " asset(s). Book them in the calendar.";
    assets.forEach((name) => {
      const card = document.createElement("div");
      card.className = "asset-card";
      const href =
        "calendar.html?asset=" +
        encodeURIComponent(name) +
        "&campaign=" +
        encodeURIComponent(res.campaignId);
      card.innerHTML =
        '<span class="tag">Eligible</span>' +
        '<span class="name">' + escapeHtml(name) + "</span>" +
        '<a class="btn btn-secondary" href="' + href + '">Book this asset</a>';
      grid.appendChild(card);
    });
    resultsCard.scrollIntoView({ behavior: "smooth" });
  }
})();
