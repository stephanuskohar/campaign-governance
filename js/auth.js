/**
 * Identity handling.
 *
 * Two modes (set in js/config.js → AUTH_MODE):
 *   - "google": Google Identity Services (GIS). The user signs in and we obtain a
 *     signed ID token (JWT). We send the token to the backend, which verifies it
 *     (signature, expiry, hosted domain) and trusts the email inside it.
 *   - "manual": the user types an email once; it's stored in localStorage. Not
 *     verified — anyone could type any address. Convenience fallback only.
 *
 * Public API:
 *   Auth.init(onChange)   -> initialize; onChange(email|null) fires on state change
 *   Auth.getEmail()       -> current signed-in email or null
 *   Auth.getAuth()        -> { idToken } (google) or { email } (manual) for API calls
 *   Auth.signOut()        -> clear session
 *   Auth.renderButton(el) -> render the Google button (google mode) into element
 */
const Auth = (() => {
  const LS_EMAIL = "cg_email";
  const LS_TOKEN = "cg_id_token";
  let currentEmail = null;
  let idToken = null;
  let changeCb = () => {};

  function decodeJwt(token) {
    try {
      const payload = token.split(".")[1];
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch (e) {
      return null;
    }
  }

  function domainOk(email) {
    return (
      typeof email === "string" &&
      email.toLowerCase().endsWith("@" + CONFIG.ALLOWED_DOMAIN.toLowerCase())
    );
  }

  // ---- Google mode -------------------------------------------------------
  function handleCredential(response) {
    const token = response.credential;
    const claims = decodeJwt(token);
    if (!claims || !domainOk(claims.email)) {
      alert("Please sign in with your @" + CONFIG.ALLOWED_DOMAIN + " account.");
      return;
    }
    idToken = token;
    currentEmail = claims.email;
    localStorage.setItem(LS_TOKEN, token);
    changeCb(currentEmail);
  }

  function initGoogle(onChange) {
    changeCb = onChange || changeCb;
    // Restore a still-valid token from a previous visit.
    const saved = localStorage.getItem(LS_TOKEN);
    if (saved) {
      const claims = decodeJwt(saved);
      if (claims && claims.exp * 1000 > Date.now() && domainOk(claims.email)) {
        idToken = saved;
        currentEmail = claims.email;
      } else {
        localStorage.removeItem(LS_TOKEN);
      }
    }
    // GIS library is loaded via <script> in the HTML head.
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleCredential,
        hd: CONFIG.ALLOWED_DOMAIN,
        auto_select: true,
      });
    }
    changeCb(currentEmail);
  }

  // ---- Manual mode -------------------------------------------------------
  function initManual(onChange) {
    changeCb = onChange || changeCb;
    const saved = localStorage.getItem(LS_EMAIL);
    if (saved && domainOk(saved)) currentEmail = saved;
    changeCb(currentEmail);
  }

  function promptManualEmail() {
    const input = window.prompt("Enter your @" + CONFIG.ALLOWED_DOMAIN + " email:");
    if (input == null) return null;
    const email = input.trim();
    if (!domainOk(email)) {
      alert("Email must be on the @" + CONFIG.ALLOWED_DOMAIN + " domain.");
      return null;
    }
    currentEmail = email;
    localStorage.setItem(LS_EMAIL, email);
    changeCb(currentEmail);
    return email;
  }

  // ---- Public ------------------------------------------------------------
  return {
    init(onChange) {
      if (CONFIG.AUTH_MODE === "google") initGoogle(onChange);
      else initManual(onChange);
    },
    getEmail() {
      return currentEmail;
    },
    /** Ensures the user is identified; may prompt (manual) or return null (google). */
    ensureIdentified() {
      if (currentEmail) return currentEmail;
      if (CONFIG.AUTH_MODE === "manual") return promptManualEmail();
      return null; // google: caller should ask the user to click the sign-in button
    },
    getAuth() {
      if (CONFIG.AUTH_MODE === "google") return { idToken };
      return { email: currentEmail };
    },
    signOut() {
      currentEmail = null;
      idToken = null;
      localStorage.removeItem(LS_EMAIL);
      localStorage.removeItem(LS_TOKEN);
      if (CONFIG.AUTH_MODE === "google" && window.google) {
        google.accounts.id.disableAutoSelect();
      }
      changeCb(null);
    },
    renderButton(el) {
      if (CONFIG.AUTH_MODE !== "google" || !window.google) return;
      google.accounts.id.renderButton(el, {
        theme: "outline",
        size: "medium",
        text: "signin_with",
      });
    },
    isManual: () => CONFIG.AUTH_MODE === "manual",
  };
})();
