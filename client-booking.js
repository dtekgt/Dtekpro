/* D-TEK v30.3.3 · Agenda interna para Garage D-TEK */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const services = window.DTEK_SERVICES || [];
  const groups = window.DTEK_SERVICE_GROUPS || [];
  const symptoms = window.DTEK_SYMPTOM_GROUPS || [];
  let booking = { step: 1, vehicle: null, service: null, date: "", slot: null, busy: {} };

  function serviceById(id) { return services.find(service => service.id === id); }
  function estimatedPoints(service) {
    const match = String(service?.price || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    const price = match ? Number(match[1]) : 0;
    return Math.max(10, Math.floor(price / 10));
  }
  function formatMinutes(total) {
    const hour24 = Math.floor(total / 60);
    const minute = total % 60;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  }
  function dateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function dateFromValue(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  function buildIso(value, minutes) {
    const date = dateFromValue(value);
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return date.toISOString();
  }
  function workWindow(value) {
    const date = dateFromValue(value);
    const day = date.getDay();
    if (day === 0) return null;
    return day === 6 ? { start: 8 * 60, end: 14 * 60 } : { start: 8 * 60, end: 18 * 60 };
  }
  function blockMinutes(block, value) {
    const start = new Date(block.block_start || block.blockStart || block.start_time || block.start);
    const end = new Date(block.block_end || block.blockEnd || block.end_time || block.end);
    const day = dateFromValue(value); day.setHours(0,0,0,0);
    const next = new Date(day); next.setDate(next.getDate() + 1);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= day || start >= next) return null;
    return { start: Math.max(0, (start < day ? day : start).getHours() * 60 + (start < day ? day : start).getMinutes()), end: Math.min(1440, (end > next ? next : end).getHours() * 60 + (end > next ? next : end).getMinutes()) };
  }
  function overlap(a1, a2, b1, b2) { return a1 < b2 && a2 > b1; }

  function renderInternalList(useSymptoms = false) {
    const holder = $("#clientBookingServices");
    if (!holder) return;
    const source = useSymptoms ? symptoms.map(item => ({ title: item.label, hint: item.chapin, services: item.recommended })) : groups;
    holder.innerHTML = source.map((group, index) => {
      const choices = group.services.map(serviceById).filter(Boolean);
      return `<section class="selector-group ${index === 0 ? "open" : ""}">
        <button type="button" class="selector-group-toggle" aria-expanded="${index === 0}"><span><strong>${esc(group.title || group.label)}</strong></span><b>${choices.length}</b><i>${index === 0 ? "−" : "＋"}</i></button>
        <div class="selector-group-content" ${index === 0 ? "" : "hidden"}>${choices.map(service => `<button type="button" class="client-booking-service ${booking.service?.id === service.id ? "selected" : ""}" data-client-service="${esc(service.id)}"><span><strong>${esc(service.name)}</strong></span><span><b>${esc(service.price)}</b><small>+${estimatedPoints(service)} pts</small></span></button>`).join("")}</div>
      </section>`;
    }).join("");
  }

  function setStep(step) {
    booking.step = Math.max(1, Math.min(3, step));
    $$("[data-client-booking-step]").forEach(panel => panel.classList.toggle("active", Number(panel.dataset.clientBookingStep) === booking.step));
    $$("[data-client-booking-progress]").forEach(item => {
      const number = Number(item.dataset.clientBookingProgress);
      item.classList.toggle("active", number === booking.step);
      item.classList.toggle("done", number < booking.step);
      item.classList.toggle("pending", number > booking.step);
      item.setAttribute("aria-current", number === booking.step ? "step" : "false");
    });
    if (booking.step === 2) renderDates();
    if (booking.step === 3) renderSummary();
    const panel = $("#clientBookingModal .client-modal-panel");
    if (panel) panel.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadBusy(value) {
    if (booking.busy[value]) return booking.busy[value];
    const day = dateFromValue(value); day.setHours(0,0,0,0);
    const next = new Date(day); next.setDate(next.getDate() + 1);
    try { booking.busy[value] = await DtekBackend.getBusyBlocks(day.toISOString(), next.toISOString()) || []; }
    catch (error) { console.warn(error); booking.busy[value] = []; }
    return booking.busy[value];
  }

  function slotsFor(value) {
    if (!booking.service) return [];
    const window = workWindow(value); if (!window) return [];
    const blocks = (booking.busy[value] || []).map(item => blockMinutes(item, value)).filter(Boolean);
    const result = [];
    const duration = booking.service.durationMinutes || 60;
    const before = booking.service.bufferBefore || 0;
    const after = booking.service.bufferAfter || 0;
    for (let start = window.start + before; start <= window.end - duration - after; start += 30) {
      const end = start + duration;
      const blockStart = start - before;
      const blockEnd = end + after;
      if (!blocks.some(block => overlap(blockStart, blockEnd, block.start, block.end))) result.push({ start, end, blockStart, blockEnd, label: formatMinutes(start) });
    }
    return result;
  }

  async function renderDates() {
    const holder = $("#clientBookingDates");
    if (!holder) return;
    const dates = [];
    const today = new Date();
    for (let index = 0; index < 10; index++) { const date = new Date(today); date.setDate(today.getDate() + index); if (workWindow(dateValue(date))) dates.push(date); }
    booking.date = booking.date || dateValue(dates[0]);
    holder.innerHTML = dates.map(date => {
      const value = dateValue(date);
      return `<button type="button" class="${booking.date === value ? "selected" : ""}" data-client-date="${value}"><small>${date.toLocaleDateString("es-GT", { weekday: "short" })}</small><strong>${date.toLocaleDateString("es-GT", { day: "numeric", month: "short" })}</strong></button>`;
    }).join("");
    await renderTimes();
  }

  async function renderTimes() {
    const holder = $("#clientBookingTimes");
    if (!holder) return;
    holder.innerHTML = `<p>Cargando horarios...</p>`;
    await loadBusy(booking.date);
    const slots = slotsFor(booking.date);
    if (!slots.length) { booking.slot = null; holder.innerHTML = `<p>No hay espacios ese día. Probá otro.</p>`; return; }
    if (!booking.slot || !slots.some(item => item.start === booking.slot.start)) booking.slot = slots[0];
    holder.innerHTML = slots.map(slot => `<button type="button" class="${booking.slot?.start === slot.start ? "selected" : ""}" data-client-time="${slot.start}">${slot.label}<small>${formatMinutes(slot.end)}</small></button>`).join("");
  }

  function renderSummary() {
    const holder = $("#clientBookingSummary");
    if (!holder || !booking.vehicle || !booking.service || !booking.slot) return;
    const date = dateFromValue(booking.date);
    holder.innerHTML = `<span class="card-label">Solicitud</span><strong>${esc(booking.vehicle.nickname || `${booking.vehicle.brand} ${booking.vehicle.line}`)}</strong><p>${esc(booking.service.name)} · ${date.toLocaleDateString("es-GT", { day: "numeric", month: "short" })} · ${esc(booking.slot.label)} · +${estimatedPoints(booking.service)} pts</p>`;
    $("#clientBookingPhone").value ||= clientPortalState.profile?.phone || "";
    $("#clientBookingCity").value ||= clientPortalState.profile?.default_city || "";
    $("#clientBookingAddress").value ||= clientPortalState.profile?.default_location || "";
  }

  function openBooking(trigger) {
    const id = trigger?.dataset.vehicleId || clientPortalState.activeVehicleId;
    booking.vehicle = (clientPortalState.vehicles || []).find(vehicle => String(vehicle.id) === String(id)) || (clientPortalState.vehicles || [])[0] || null;
    if (!booking.vehicle) { openVehicleModal(); return; }
    booking.service = null; booking.slot = null; booking.date = ""; booking.busy = {};
    const modal = $("#clientBookingModal");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("client-modal-open");
    $("#clientBookingVehicleLabel").textContent = booking.vehicle.nickname || `${booking.vehicle.brand} ${booking.vehicle.line} ${booking.vehicle.year || ""}`;
    renderInternalList(trigger?.dataset.bookingSymptoms === "true");
    setStep(1);
  }
  function closeBooking() {
    $("#clientBookingModal")?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("client-modal-open");
    $("#clientBookingStatus").textContent = "";
  }

  function updateClientVehicleCascade() {
    const brand = $("#vehicleBrandClient")?.value || "";
    const line = $("#vehicleLineClient")?.value || "";
    const year = $("#vehicleYearClient")?.value || "";
    const states = { line: Boolean(brand), year: Boolean(brand && line), engine: Boolean(brand && line && year) };
    Object.entries(states).forEach(([level, visible]) => {
      const label = $(`[data-client-cascade="${level}"]`);
      if (label) label.classList.toggle("client-cascade-hidden", !visible);
    });
  }

  function setupVehicleSelectors() {
    const catalog = window.DTEK_VEHICLE_CATALOG || {};
    const brand = $("#vehicleBrandClient"), line = $("#vehicleLineClient"), year = $("#vehicleYearClient"), engine = $("#vehicleEngineClient");
    if (!brand || !line) return;
    brand.innerHTML = `<option value="">Elegir marca</option>` + Object.keys(catalog).sort((a,b) => a.localeCompare(b,"es")).map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join("");
    const current = new Date().getFullYear() + 1;
    if (year) year.innerHTML = `<option value="">Elegir año</option>` + Array.from({length: current - 1979}, (_,i) => current - i).map(item => `<option value="${item}">${item}</option>`).join("");
    if (engine) engine.innerHTML = `<option value="">Elegir motor</option>` + (window.DTEK_ENGINE_OPTIONS || []).map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join("");
    brand.addEventListener("change", () => {
      const lines = catalog[brand.value] || [];
      line.disabled = !brand.value;
      line.innerHTML = brand.value ? `<option value="">Elegir línea</option>` + lines.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join("") : `<option value="">Primero elegí marca</option>`;
      window.setTimeout(updateClientVehicleCascade, 0);
    });
    line.addEventListener("change", updateClientVehicleCascade);
    year?.addEventListener("change", updateClientVehicleCascade);
    updateClientVehicleCascade();
  }



  function optionalContactEmail(profile, session) {
    const candidates = [profile?.contact_email, profile?.email, session?.user?.email];
    return candidates.find(value => {
      const email = String(value || "").trim().toLowerCase();
      return email.includes("@") && !email.endsWith("@login.dtekgt.com");
    }) || "";
  }

  function friendlyBookingError(error) {
    const message = String(error?.message || error?.details || error || "").toLowerCase();
    if (message.includes("schedule_conflict") || message.includes("horario") && message.includes("ocupado")) {
      return "Ese horario acaba de ocuparse. Elegí otro espacio y enviá de nuevo.";
    }
    if (message.includes("servicio inválido") || message.includes("service") && message.includes("inactive")) {
      return "Ese servicio todavía no estaba habilitado en la agenda. Actualizá la página e intentá otra vez.";
    }
    if (message.includes("auth_required") || message.includes("jwt") || message.includes("session")) {
      return "Tu sesión venció. Volvé a entrar a tu perfil y enviá la solicitud nuevamente.";
    }
    if (message.includes("vehicle_not_found") || message.includes("not_owner")) {
      return "No pudimos vincular ese carro con tu perfil. Actualizá la página y probá otra vez.";
    }
    if (message.includes("correo requerido") || message.includes("email")) {
      return "La agenda todavía está pidiendo correo para este perfil. Ejecutá la actualización v30.3.3 en Supabase.";
    }
    return "No pudimos guardar la solicitud. Revisá tu conexión e intentá de nuevo.";
  }

  async function submitBooking(event) {
    event.preventDefault();
    const status = $("#clientBookingStatus");
    const form = event.currentTarget;
    if (!booking.vehicle || !booking.service || !booking.slot || !booking.date) { status.textContent = "Falta elegir servicio u horario."; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const profile = clientPortalState.profile || {};
    const session = await DtekBackend.getSession();
    const payload = {
      vehicle_id: booking.vehicle.id,
      service_id: booking.service.backendServiceId || booking.service.id,
      client_name: profile.full_name || session?.user?.user_metadata?.full_name || "Cliente D-TEK",
      client_email: optionalContactEmail(profile, session),
      client_phone: $("#clientBookingPhone").value.trim() || profile.phone || "",
      vehicle_moves: $("#clientBookingMoves").value,
      location: $("#clientBookingAddress").value.trim(),
      city: $("#clientBookingCity").value.trim(),
      symptom: $("#clientBookingComment").value.trim(),
      scheduled_start: buildIso(booking.date, booking.slot.start),
      scheduled_end: buildIso(booking.date, booking.slot.end),
      block_start: buildIso(booking.date, booking.slot.blockStart),
      block_end: buildIso(booking.date, booking.slot.blockEnd),
      source: "client-portal-internal"
    };
    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = submitButton?.textContent || "Enviar solicitud";
    try {
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Guardando..."; }
      status.textContent = "Guardando solicitud...";
      const saved = await DtekBackend.createAppointmentForVehicle(payload);
      if (!saved?.id) throw new Error("No se recibió confirmación");
      status.textContent = "Listo. Tu solicitud quedó guardada y la confirmamos por WhatsApp.";
      await loadClientAppointments();
      window.setTimeout(closeBooking, 1700);
    } catch (error) {
      console.warn("D-TEK booking error", error);
      status.textContent = friendlyBookingError(error);
    } finally {
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalLabel; }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupVehicleSelectors();
    $("#clientBookingForm")?.addEventListener("submit", submitBooking);
    document.addEventListener("click", async event => {
      const open = event.target.closest("[data-open-client-booking]"); if (open) openBooking(open);
      if (event.target.closest("[data-close-client-booking]")) closeBooking();
      const groupToggle = event.target.closest("#clientBookingServices .selector-group-toggle");
      if (groupToggle) {
        const group = groupToggle.closest(".selector-group"); const content = $(".selector-group-content", group); const opening = !group.classList.contains("open");
        group.classList.toggle("open", opening); content.hidden = !opening; groupToggle.setAttribute("aria-expanded", String(opening)); $("i", groupToggle).textContent = opening ? "−" : "＋";
      }
      const service = event.target.closest("[data-client-service]");
      if (service) {
        booking.service = serviceById(service.dataset.clientService);
        $$("[data-client-service]").forEach(item => item.classList.toggle("selected", item === service));
        $("#clientBookingStatus").textContent = "";
        window.setTimeout(() => setStep(2), 90);
      }
      const date = event.target.closest("[data-client-date]");
      if (date) { booking.date = date.dataset.clientDate; booking.slot = null; await renderDates(); }
      const time = event.target.closest("[data-client-time]");
      if (time) { const slots = slotsFor(booking.date); booking.slot = slots.find(item => item.start === Number(time.dataset.clientTime)) || null; await renderTimes(); }
      if (event.target.closest("[data-client-booking-next]")) {
        if (booking.step === 1 && !booking.service) { $("#clientBookingStatus").textContent = "Elegí un servicio para continuar."; return; }
        if (booking.step === 2 && !booking.slot) { $("#clientBookingStatus").textContent = "Elegí un horario para continuar."; return; }
        $("#clientBookingStatus").textContent = ""; setStep(booking.step + 1);
      }
      if (event.target.closest("[data-client-booking-back]")) setStep(booking.step - 1);
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeBooking(); });
  });
})();
