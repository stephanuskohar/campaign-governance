/**
 * Dark / light theme toggle, persisted in localStorage.
 *
 * NOTE: To avoid a flash of the wrong theme, the initial data-theme is set by a
 * tiny inline script in each HTML <head> BEFORE this file loads. This file only
 * wires up the toggle button and keeps the icon/label in sync.
 */
const Theme = (() => {
  const LS_KEY = "cg_theme";

  function current() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_KEY, theme);
    updateButton();
  }

  function toggle() {
    apply(current() === "dark" ? "light" : "dark");
  }

  function updateButton() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const dark = current() === "dark";
    btn.textContent = dark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }

  function init() {
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", toggle);
    updateButton();
  }

  return { init, toggle, apply, current };
})();

document.addEventListener("DOMContentLoaded", Theme.init);
