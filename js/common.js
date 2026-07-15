/* Shared helpers used by both pages (header/auth wiring + small utilities). */

function wireHeader() {
  const chip = document.getElementById("user-chip");
  const signoutBtn = document.getElementById("signout-btn");
  const slot = document.getElementById("signin-slot");

  function onChange(email) {
    if (email) {
      chip.textContent = email;
      signoutBtn.style.display = "";
      if (slot) slot.innerHTML = "";
    } else {
      chip.textContent = "";
      signoutBtn.style.display = "none";
      if (CONFIG.AUTH_MODE === "google" && slot) {
        slot.innerHTML = "";
        Auth.renderButton(slot);
      } else if (CONFIG.AUTH_MODE === "manual" && slot) {
        slot.innerHTML = '<button class="link-btn" id="signin-manual">Set email</button>';
        const b = document.getElementById("signin-manual");
        if (b) b.addEventListener("click", () => Auth.ensureIdentified());
      }
    }
  }

  signoutBtn.addEventListener("click", () => Auth.signOut());
  Auth.init(onChange);
  // GIS may finish loading after this script; retry init briefly for google mode.
  if (CONFIG.AUTH_MODE === "google") {
    let tries = 0;
    const t = setInterval(() => {
      if (window.google || tries++ > 20) {
        clearInterval(t);
        Auth.init(onChange);
      }
    }, 150);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function cssEscape(s) {
  return String(s).replace(/"/g, '\\"');
}
function showMsg(el, kind, text) {
  el.className = "msg show " + kind;
  el.textContent = text;
}
function hideMsg(el) {
  el.className = "msg";
  el.textContent = "";
}
