# Campaign Governance

A free, GitHub-hosted web app for governing Shopee campaign asset allocation. Campaign owners
submit their campaign once, see which assets they qualify for (using eligibility logic that lives
in Google Sheets), and book available slots on a shared calendar that prevents double-booking.

- **Frontend:** vanilla HTML/CSS/JS — no build step. Hosted on **GitHub Pages** (free).
- **Backend:** a **Google Apps Script Web App** bound to your Google Sheet — the free "API" that
  reads/writes the sheet and enforces all rules server-side.
- **Data:** everything lives in your Google Sheet, so the logic is transparent and auditable.
- **Theme:** light/dark toggle, persisted per browser.

```
Browser (GitHub Pages)  ──fetch JSON──►  Apps Script Web App  ──►  Google Sheet
```

## Why this architecture

GitHub Pages only serves static files — there is no server. Rather than expose Google
credentials in the browser (insecure), the Apps Script Web App is the only thing that can write
to the sheet, so **conflict-prevention and the owner-only edit check cannot be bypassed** from
the browser.

---

## Setup & Deployment

### 1. Prepare your Google Sheet
You need three tabs (names are configurable):

- **Campaigns** — one row per campaign. Your existing **eligibility formulas** live here: one
  column per asset holding `TRUE`/`FALSE` (or `Yes`/`No`, `1`/`0`). A `Campaign ID` column is
  used as the key (auto-filled on submit if left blank).
- **Assets** — the master list of assets (a column with the asset name).
- **Bookings** — one row per booking, with columns for booking id, asset, start, end, owner
  email, status, and (optionally) campaign id.

### 2. Deploy the Apps Script backend
1. Open your Google Sheet → **Extensions → Apps Script**.
2. Replace the default file's contents with [`apps-script/Code.gs`](apps-script/Code.gs).
3. Edit the **`SHEET`** config block at the top so the tab names and column headers match your
   sheet exactly. Columns are matched **by header name**, so you never touch column letters.
4. **Deploy → New deployment → Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone** (or *Anyone within Shopee* if available)
5. Copy the resulting **`/exec` URL**.
6. (Optional) In the editor, run `testGetBookings` / `testSubmitCampaign` to confirm wiring.

### 3. Configure the frontend
Open [`js/config.js`](js/config.js) and set:
- `WEB_APP_URL` — the `/exec` URL from step 2.
- `AUTH_MODE` — `"manual"` (typed email) or `"google"` (Google Sign-In, recommended).
- `CAMPAIGN_FIELDS` — adjust to match the columns your Campaigns tab expects.

### 4. (Recommended) Enable Google Sign-In
Only if `AUTH_MODE: "google"`:
1. In **Google Cloud Console → APIs & Services → Credentials**, create an **OAuth client ID**
   (type: *Web application*).
2. Add your GitHub Pages origin (e.g. `https://<user>.github.io`) to **Authorized JavaScript
   origins**.
3. Put the client ID in `js/config.js → GOOGLE_CLIENT_ID`.

If your org doesn't allow creating an OAuth client, keep `AUTH_MODE: "manual"` — everything else
works; the owner email is just typed rather than verified.

### 5. Publish on GitHub Pages
1. Create a GitHub repo and push this folder to it.
2. **Settings → Pages → Build and deployment → Deploy from a branch**, branch = `main`, folder =
   `/ (root)`.
3. Your site is live at `https://<user>.github.io/<repo>/`.

---

## Local development

No build step. Serve the folder with any static server, then open `http://localhost:8000`.

- **Windows (no Python/Node needed):**
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1
  ```
- **With Python:**
  ```bash
  python -m http.server 8000
  ```

(Opening the HTML files directly via `file://` also works for the UI, but the Apps Script calls
need the site served over http/https, and Google Sign-In requires an authorized origin.)

---

## How it works

| Action | Frontend | Backend (`Code.gs`) |
|--------|----------|----------------------|
| Submit campaign | `submit.js` → `API.submitCampaign` | append row → `flush()` → read eligibility columns back → return eligible assets |
| View calendar | `calendar.js` → `API.getBookings` | read Bookings tab |
| Book a slot | booking modal → `API.createBooking` | verify identity → **overlap conflict check** → append `Pending` booking |
| Edit / cancel | booking modal → `API.updateBooking` | verify identity → **owner check (403 if not owner)** → update or mark `Cancelled` |

Booking colours: **yellow = Pending validation**, **teal = Confirmed**, grey = Cancelled.
Validators change the `Status` cell directly in the sheet; the calendar reflects it on reload.

---

## Files

```
index.html          Submit campaign + eligibility results
calendar.html       Booking calendar + book/edit
css/styles.css      Shopee-branded theme (light/dark)
js/config.js        ← your settings (URL, auth, fields)
js/api.js           fetch wrappers for the Web App
js/auth.js          Google Sign-In / manual email
js/theme.js         dark/light toggle
js/common.js        shared header + helpers
js/submit.js        submit-page logic
js/calendar.js      calendar-page logic
apps-script/Code.gs Apps Script backend (paste into the bound script)
```

## Security notes
- All writes go through the Apps Script Web App; the browser cannot edit the sheet directly.
- Conflict-prevention and the owner-only edit rule are enforced server-side.
- In `"google"` mode the owner email is a **verified** Google identity restricted to your domain.
  In `"manual"` mode the email is unverified — convenience only, not a security boundary.
