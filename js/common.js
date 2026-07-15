/* Small shared helpers. */

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function showMsg(el, kind, text) {
  el.className = "msg show " + kind;
  el.textContent = text;
}

function hideMsg(el) {
  el.className = "msg";
  el.textContent = "";
}
