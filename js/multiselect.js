/**
 * MultiSelect — a lightweight checkbox dropdown.
 *
 * Usage:
 *   const ms = MultiSelect.create(document.getElementById("ms-intent"), {
 *     placeholder: "Select intent(s)",
 *   });
 *   ms.setOptions(["A", "B", "C"]);   // populate / repopulate (clears selection)
 *   ms.getValues();                    // -> ["A", "C"] in option order
 *
 * Renders a toggle button + a panel of checkboxes inside the given container.
 */
const MultiSelect = (() => {
  const instances = [];
  let globalListenerAttached = false;

  function create(container, opts) {
    opts = opts || {};
    const placeholder = opts.placeholder || "Select…";

    container.classList.add("ms");
    container.innerHTML =
      '<button type="button" class="ms-toggle" aria-haspopup="true" aria-expanded="false">' +
      '<span class="ms-label"></span><span class="ms-caret">▾</span></button>' +
      '<div class="ms-panel" role="listbox" hidden></div>';

    const toggle = container.querySelector(".ms-toggle");
    const label = container.querySelector(".ms-label");
    const panel = container.querySelector(".ms-panel");
    let options = [];

    function renderLabel() {
      const vals = getValues();
      if (vals.length === 0) {
        label.textContent = placeholder;
        label.classList.add("ms-placeholder");
      } else {
        label.classList.remove("ms-placeholder");
        label.textContent = vals.length <= 2 ? vals.join(", ") : vals.length + " selected";
      }
    }

    function setOptions(list) {
      options = Array.isArray(list) ? list.slice() : [];
      panel.innerHTML = "";
      if (options.length === 0) {
        panel.innerHTML = '<div class="ms-empty">No options available.</div>';
      } else {
        options.forEach((o, i) => {
          const id = container.id + "-opt-" + i;
          const row = document.createElement("label");
          row.className = "ms-option";
          row.innerHTML =
            '<input type="checkbox" id="' + id + '" value="' + escapeAttr(o) + '" />' +
            "<span>" + escapeText(o) + "</span>";
          row.querySelector("input").addEventListener("change", renderLabel);
          panel.appendChild(row);
        });
      }
      renderLabel();
    }

    function getValues() {
      return Array.from(panel.querySelectorAll("input:checked")).map((c) => c.value);
    }

    function clear() {
      panel.querySelectorAll("input:checked").forEach((c) => (c.checked = false));
      renderLabel();
    }

    function open() {
      closeAll();
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      container.classList.add("open");
    }
    function close() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      container.classList.remove("open");
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });
    panel.addEventListener("click", (e) => e.stopPropagation());

    const api = { setOptions, getValues, clear, element: container, _close: close };
    instances.push(api);
    renderLabel();
    return api;
  }

  function closeAll() {
    instances.forEach((i) => i._close());
  }

  // Close any open dropdown when clicking elsewhere.
  if (!globalListenerAttached) {
    document.addEventListener("click", closeAll);
    globalListenerAttached = true;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }
  function escapeText(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  return { create };
})();
