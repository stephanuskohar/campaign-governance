/* Calendar page: render bookings, book eligible assets, edit/cancel own bookings. */
(function () {
  wireHeader();

  const STATUS_COLORS = {
    Pending: "#ffbb00",
    Confirmed: "#26aa99",
    Cancelled: "#b3b9c2",
  };

  const calMsg = document.getElementById("cal-msg");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalSub = document.getElementById("modal-sub");
  const modalMsg = document.getElementById("modal-msg");
  const bForm = document.getElementById("booking-form");
  const bAsset = document.getElementById("b-asset");
  const bStart = document.getElementById("b-start");
  const bEnd = document.getElementById("b-end");
  const bCampaign = document.getElementById("b-campaign");
  const saveBtn = document.getElementById("modal-save");
  const deleteBtn = document.getElementById("modal-delete");
  const closeBtn = document.getElementById("modal-cancel");

  let calendar;
  let editing = null; // the booking being edited, or null when creating

  // Preselected asset/campaign passed from the eligibility page.
  const params = new URLSearchParams(location.search);
  const preAsset = params.get("asset") || "";
  const preCampaign = params.get("campaign") || "";

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  let started = false;
  function init() {
    if (started) return;
    started = true;
    calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek",
      },
      height: "auto",
      selectable: true,
      events: fetchEvents,
      eventClick: onEventClick,
      dateClick: (info) => openCreate(info.dateStr),
    });
    calendar.render();
    wireModal();
  }

  async function fetchEvents(_info, success, failure) {
    try {
      const bookings = await API.getBookings();
      success(
        bookings
          .filter((b) => b.status !== "Cancelled")
          .map((b) => ({
            id: b.id,
            title: b.asset + " — " + b.status,
            start: b.start,
            end: b.end,
            backgroundColor: STATUS_COLORS[b.status] || STATUS_COLORS.Pending,
            borderColor: STATUS_COLORS[b.status] || STATUS_COLORS.Pending,
            textColor: b.status === "Pending" ? "#3a2f00" : "#ffffff",
            extendedProps: b,
          }))
      );
      hideMsg(calMsg);
    } catch (err) {
      showMsg(calMsg, "error", "Could not load bookings: " + err.message);
      failure(err);
    }
  }

  // -------- Asset dropdown: eligible assets from the last submission -------
  function loadAssetOptions(selected) {
    bAsset.innerHTML = "";
    // Assets the user just became eligible for are cached by submit flow via URL.
    const options = new Set();
    if (preAsset) options.add(preAsset);
    // Also allow any asset already present on the calendar (so edits work).
    (calendar.getEvents() || []).forEach((e) => {
      if (e.extendedProps && e.extendedProps.asset) options.add(e.extendedProps.asset);
    });
    if (selected) options.add(selected);
    if (options.size === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— submit a campaign first to unlock assets —";
      bAsset.appendChild(opt);
      return;
    }
    Array.from(options).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === selected) opt.selected = true;
      bAsset.appendChild(opt);
    });
  }

  // ----------------------------- Modal flows ------------------------------
  function openCreate(dateStr) {
    editing = null;
    modalTitle.textContent = "Book an asset";
    modalSub.textContent = "Reserve an eligible asset for the selected dates.";
    loadAssetOptions(preAsset);
    bAsset.disabled = false;
    bStart.value = dateStr || "";
    bEnd.value = dateStr || "";
    bCampaign.value = preCampaign;
    setReadonly(false);
    saveBtn.style.display = "";
    saveBtn.textContent = "Book";
    deleteBtn.style.display = "none";
    hideMsg(modalMsg);
    open();
  }

  function onEventClick(info) {
    const b = info.event.extendedProps;
    const me = (Auth.getEmail() || "").toLowerCase();
    const mine = me && b.owner && b.owner.toLowerCase() === me;

    editing = b;
    loadAssetOptions(b.asset);
    bAsset.disabled = true; // asset isn't editable on an existing booking
    bStart.value = (b.start || "").slice(0, 10);
    bEnd.value = (b.end || "").slice(0, 10);
    bCampaign.value = b.campaignId || "";
    hideMsg(modalMsg);

    if (mine) {
      modalTitle.textContent = "Edit your booking";
      modalSub.textContent = "Change the dates or cancel this booking.";
      setReadonly(false);
      saveBtn.style.display = "";
      saveBtn.textContent = "Save changes";
      deleteBtn.style.display = "";
    } else {
      modalTitle.textContent = "Booking details";
      modalSub.textContent =
        "Booked by " + (b.owner || "unknown") + " · " + b.status + ". Only the owner can edit.";
      setReadonly(true);
      saveBtn.style.display = "none";
      deleteBtn.style.display = "none";
    }
    open();
  }

  function setReadonly(ro) {
    [bStart, bEnd, bCampaign].forEach((el) => (el.readOnly = ro));
  }

  bForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsg(modalMsg);

    const email = Auth.ensureIdentified();
    if (!email) {
      showMsg(modalMsg, "info", "Please sign in first (top-right) to book.");
      return;
    }
    const auth = Auth.getAuth();

    saveBtn.disabled = true;
    const original = saveBtn.textContent;
    saveBtn.textContent = "Saving…";
    try {
      if (editing) {
        await API.updateBooking(
          { id: editing.id, start: bStart.value, end: bEnd.value },
          auth
        );
      } else {
        if (!bAsset.value) throw new Error("Choose an asset to book.");
        await API.createBooking(
          {
            asset: bAsset.value,
            start: bStart.value,
            end: bEnd.value,
            campaignId: bCampaign.value,
          },
          auth
        );
      }
      close();
      calendar.refetchEvents();
      showMsg(calMsg, "success", "Booking saved.");
    } catch (err) {
      showMsg(modalMsg, "error", err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!editing) return;
    const email = Auth.ensureIdentified();
    if (!email) return;
    if (!confirm("Cancel this booking?")) return;
    deleteBtn.disabled = true;
    try {
      await API.updateBooking({ id: editing.id, cancel: true }, Auth.getAuth());
      close();
      calendar.refetchEvents();
      showMsg(calMsg, "success", "Booking cancelled.");
    } catch (err) {
      showMsg(modalMsg, "error", err.message);
    } finally {
      deleteBtn.disabled = false;
    }
  });

  function wireModal() {
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
  }
  function open() {
    modal.classList.add("open");
  }
  function close() {
    modal.classList.remove("open");
  }
})();
