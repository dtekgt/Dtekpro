/*
  D-TEK GT Web OS v39 — Portal cliente
  Arquitectura: Inicio · Garage · Agenda · Cuenta
  Propiedad de D-TEK GT / Dominic Morales.
*/

const clientQs = (selector) => document.querySelector(selector);
const clientQsa = (selector) => [...document.querySelectorAll(selector)];

let clientPortalState = {
  profile: null,
  vehicles: [],
  appointments: [],
  workOrders: [],
  referrals: [],
  loyalty: {
    points_balance: 0,
    points_earned: 0,
    points_used: 0,
    service_points: 0,
    referral_points: 0,
    referrals_total: 0,
    referrals_converted: 0,
    referrals_pending: 0
  },
  rewards: [],
  redemptions: [],
  pointsActivity: [],
  activeSection: "overview",
  activeVehicleId: null,
  activeVehicleHistory: [],
  vehicleHistoryMap: {},
  vehicleHealthMap: {},
  loadingHistoryMap: {},
  loading: true
};

const DEFAULT_REWARDS = [
  { id: "battery-check", name: "Batería y carga", points_cost: 30, icon: "⚡", can_redeem: false },
  { id: "brake-check", name: "Revisión de frenos", points_cost: 40, icon: "◉", can_redeem: false },
  { id: "suspension-check", name: "Revisión de suspensión", points_cost: 40, icon: "⌁", can_redeem: false },
  { id: "ac-check", name: "Revisión de A/C", points_cost: 50, icon: "❄", can_redeem: false },
  { id: "scanner-check", name: "Escaneo gratis", points_cost: 60, icon: "⌁", can_redeem: false },
  { id: "credit-q100", name: "Q100 de crédito", points_cost: 100, icon: "Q", can_redeem: false }
];

const CLIENT_PREFS_KEY = "dtek_client_preferences_v1";
const VEHICLE_PREFS_KEY = "dtek_vehicle_care_v1";

function loadClientPrefs() {
  try { return JSON.parse(localStorage.getItem(CLIENT_PREFS_KEY) || "{}"); }
  catch { return {}; }
}

function saveClientPrefs(prefs = {}) {
  localStorage.setItem(CLIENT_PREFS_KEY, JSON.stringify(prefs));
}

function loadVehicleCarePrefs() {
  try { return JSON.parse(localStorage.getItem(VEHICLE_PREFS_KEY) || "{}"); }
  catch { return {}; }
}

function saveVehicleCarePrefs(vehicleId, prefs = {}) {
  if (!vehicleId) return;
  const all = loadVehicleCarePrefs();
  all[vehicleId] = { ...(all[vehicleId] || {}), ...prefs };
  localStorage.setItem(VEHICLE_PREFS_KEY, JSON.stringify(all));
}

function mergeVehiclePrefs(vehicle = {}) {
  const local = loadVehicleCarePrefs()[vehicle.id] || {};
  return {
    ...vehicle,
    nickname: vehicle.nickname || local.nickname || "",
    mileage: vehicle.mileage || local.mileage || null,
    engine: vehicle.engine || local.engine || "",
    transmission: vehicle.transmission || local.transmission || "",
    use_type: vehicle.use_type || local.use_type || "",
    notes: vehicle.notes || local.notes || ""
  };
}

function mergeVehicleList(vehicles = []) {
  return vehicles.map(mergeVehiclePrefs);
}

function mergeProfilePrefs(profile = {}) {
  const local = loadClientPrefs();
  return {
    ...profile,
    default_location: profile?.default_location || local.default_location || "",
    default_city: profile?.default_city || local.default_city || "",
    preferred_time_window: profile?.preferred_time_window || local.preferred_time_window || "",
    contact_preference: profile?.contact_preference || local.contact_preference || "WhatsApp"
  };
}

function clientSafe(value) {
  return String(value ?? "").replace(/[<>&"]/g, (char) => ({"<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;"}[char]));
}

function clientStatus(message, type = "info") {
  const box = clientQs("#clientAuthStatus");
  if (box) box.innerHTML = `<p class="status-${type}">${clientSafe(message)}</p>`;
}

function panelStatus(selector, message, type = "info") {
  const box = clientQs(selector);
  if (box) box.innerHTML = `<p class="status-${type}">${clientSafe(message)}</p>`;
}

function friendlyError() {
  return "No pudimos cargar esta parte de tu cuenta. Intentá de nuevo en un momento.";
}

function statusLabel(status) {
  const labels = {
    pending: "Esperando confirmación",
    requested: "Esperando confirmación",
    submitted: "Esperando confirmación",
    scheduled: "Confirmada",
    confirmed: "Confirmada",
    in_progress: "Servicio en proceso",
    completed: "Terminado",
    cancelled: "Cancelada",
    canceled: "Cancelada",
    open: "Revisión pendiente",
    quoted: "Cotizada",
    approved: "Aprobada"
  };
  return labels[status] || status || "—";
}

function statusTone(status) {
  if (["confirmed", "completed", "converted", "approved"].includes(status)) return "positive";
  if (["pending", "requested", "submitted", "contacted", "scheduled", "quoted", "in_progress"].includes(status)) return "waiting";
  if (["cancelled", "discarded"].includes(status)) return "negative";
  return "neutral";
}

function fmtDate(value) {
  if (!value) return "Fecha pendiente";
  try {
    return new Date(value).toLocaleString("es-GT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return String(value);
  }
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `Q${amount.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPoints(value) {
  return `${Number(value || 0).toLocaleString("es-GT")} pts`;
}

function normalizeGtPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 8 ? `502${digits}` : digits;
}


function isInternalLoginEmail(value) {
  return typeof DtekBackend?.isLocalLoginEmail === "function"
    ? DtekBackend.isLocalLoginEmail(value)
    : String(value || "").toLowerCase().endsWith("@login.dtekgt.com");
}

function profileContactEmail(profile = {}, session = null) {
  const contact = String(profile.contact_email || "").trim();
  if (contact) return contact;
  const authEmail = String(profile.email || session?.user?.email || "").trim();
  return isInternalLoginEmail(authEmail) ? "" : authEmail;
}

function suggestedUsername(value) {
  const base = String(value || "").includes("@") ? String(value).split("@")[0] : String(value || "");
  const normalized = typeof DtekBackend?.normalizeUsername === "function"
    ? DtekBackend.normalizeUsername(base)
    : base.toLowerCase().replace(/[^a-z0-9._]+/g, "");
  return normalized.length >= 3 ? normalized.slice(0, 30) : "";
}

function signupStatus(message, type = "info") {
  panelStatus("#clientSignupStatus", message, type);
}

function openSignupPanel(identifier = "") {
  const panel = clientQs("#clientSignupPanel");
  const offer = clientQs("#clientSignupOffer");
  panel?.classList.remove("hidden-field");
  offer?.classList.add("hidden-field");
  const clean = String(identifier || clientQs("#clientIdentifier")?.value || "").trim();
  if (clean.includes("@")) {
    const email = clientQs("#clientSignupEmail");
    if (email && !email.value) email.value = clean.toLowerCase();
  }
  const username = clientQs("#clientSignupUsername");
  if (username && !username.value) username.value = suggestedUsername(clean);
  window.setTimeout(() => (username?.value ? clientQs("#clientSignupPassword") : username)?.focus(), 30);
}

function closeSignupPanel() {
  clientQs("#clientSignupPanel")?.classList.add("hidden-field");
  signupStatus("", "info");
}

function showSignupOffer(identifier = "") {
  const offer = clientQs("#clientSignupOffer");
  if (!offer) return;
  const clean = String(identifier || "").trim();
  const isEmail = clean.includes("@");
  setText("#clientSignupOfferTitle", isEmail ? "¿Es tu primera vez con ese correo?" : "¿Todavía no tenés ese usuario?");
  setText("#clientSignupOfferText", isEmail ? "Podés crear la cuenta y elegir también un usuario para entrar." : "Podés crear el acceso sin agregar correo.");
  offer.classList.remove("hidden-field");
}

function accessErrorMessage(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || error || "").toLowerCase();
  if (code === "USERNAME_TAKEN" || message.includes("username_taken") || message.includes("occupied") || message.includes("ocupado")) return "Ese usuario ya está ocupado. Probá una variación.";
  if (code === "EMAIL_ALREADY_REGISTERED" || message.includes("ese correo ya tiene")) return "Ese correo ya tiene una cuenta. Probá entrar con ese correo.";
  if (code === "USERNAME_INVALID" || message.includes("username_invalid")) return "Usá de 3 a 30 caracteres: letras, números, punto o guion bajo.";
  if (code === "USERNAME_LOCAL_ONLY" || message.includes("username_local_only")) return "Esta cuenta entra con correo o Google. Los usuarios personalizados aplican a las cuentas D-TEK nuevas.";
  if (code === "USERNAME_LOGIN_NOT_READY") return "El acceso por usuario todavía necesita activar la actualización de base de datos.";
  if (message.includes("email rate limit")) return "Hay demasiados intentos seguidos. Probá nuevamente más tarde.";
  if (message.includes("invalid login credentials")) return "La contraseña no coincide con ese correo o usuario.";
  return error?.message || "No pudimos completar el acceso.";
}

function referralStatusLabel(status) {
  const labels = {
    submitted: "Registrado",
    contacted: "Contactado",
    scheduled: "Cita agendada",
    converted: "Saldo acreditado",
    discarded: "No convertido"
  };
  return labels[status] || status || "Registrado";
}

function vehicleTitle(vehicle) {
  const base = `${vehicle?.brand || "Vehículo"} ${vehicle?.line || ""} ${vehicle?.year || ""}`.trim();
  return vehicle?.nickname ? `${vehicle.nickname} · ${base}` : base;
}

function vehicleBaseTitle(vehicle) {
  return `${vehicle?.brand || "Vehículo"} ${vehicle?.line || ""} ${vehicle?.year || ""}`.trim();
}

function formatKm(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${amount.toLocaleString("es-GT")} km` : "Kilometraje pendiente";
}

function formatKmCompact(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${amount.toLocaleString("es-GT")} km` : "Km no registrado";
}

function formatDateShort(value) {
  if (!value) return "Fecha pendiente";
  try {
    return new Date(value).toLocaleDateString("es-GT", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return String(value);
  }
}

function addMonths(baseDate, months) {
  const copy = new Date(baseDate);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function daysBetween(a, b) {
  const start = new Date(a);
  const end = new Date(b);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

function humanElapsedFromDays(totalDays = 0) {
  if (!totalDays) return "hoy";
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const weeks = Math.floor((totalDays % 30) / 7);
  if (years >= 1) return years === 1 ? "1 año" : `${years} años`;
  if (months >= 1) return months === 1 ? "1 mes" : `${months} meses`;
  if (weeks >= 1) return weeks === 1 ? "1 semana" : `${weeks} semanas`;
  return totalDays === 1 ? "1 día" : `${totalDays} días`;
}

function inferMaintenancePlan(sourceText = "") {
  const text = String(sourceText || "").toLowerCase();
  if (/(aceite|oil|lubric|mantenimiento|service express|mantenimiento express)/.test(text)) {
    return { label: "Cambio de aceite", kmInterval: 5000, monthInterval: 6 };
  }
  if (/(freno|brake)/.test(text)) {
    return { label: "Revisión de frenos", kmInterval: 10000, monthInterval: 12 };
  }
  if (/(aire|a\/c|acondicionado)/.test(text)) {
    return { label: "Servicio de A/C", kmInterval: 10000, monthInterval: 12 };
  }
  if (/(bater[ií]a)/.test(text)) {
    return { label: "Batería", kmInterval: 15000, monthInterval: 18 };
  }
  return { label: "Mantenimiento", kmInterval: 8000, monthInterval: 10 };
}

function chooseMaintenanceAnchor(vehicle, history = []) {
  const byRecent = (a, b) => new Date(b.scheduled_start || b.created_at || 0) - new Date(a.scheduled_start || a.created_at || 0);
  const items = [...(history || [])].sort(byRecent);
  const doneStatuses = ["completed", "approved", "completado", "completada", "realizado", "realizada", "finalizado", "finalizada"];
  const isDone = (item) => doneStatuses.includes(String(item.work_order_status || item.appointment_status || item.status || "").toLowerCase());

  const completed = items.find(isDone);
  if (completed) return completed;
  if (items[0]) return items[0];

  const orders = [...vehicleOrders(vehicle)].sort(byRecent);
  const completedOrder = orders.find(isDone);
  if (completedOrder) return completedOrder;
  if (orders[0]) return orders[0];

  const appts = [...vehicleAppointments(vehicle)].sort(byRecent);
  return appts.find(isDone) || appts[0] || null;
}

function setGarageTimelineExpanded(expanded) {
  const panel = clientQs("#garageTimelinePanel");
  const toggle = clientQs("#garageTimelineToggle");
  const chevron = clientQs("#garageTimelineChevron");
  if (!panel || !toggle) return;
  panel.hidden = !expanded;
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (chevron) chevron.textContent = expanded ? "⌃" : "⌄";
}

function updateGarageTimelineDock(vehicle, compactSummary, tone = "neutral") {
  const dock = clientQs("#garageTimelineDock");
  if (!dock || !vehicle) return;
  dock.classList.remove("hidden-field");
  dock.dataset.tone = tone;
  setText("#garageTimelineVehicle", vehicle.nickname || vehicleBaseTitle(vehicle));
  setText("#garageTimelineSummary", compactSummary || "Historial de servicio");
  renderGarageVehicleQuickSwitch();
}

function renderGarageVehicleQuickSwitch() {
  const holder = clientQs("#garageVehicleQuickSwitch");
  if (!holder) return;
  const vehicles = clientPortalState.vehicles || [];
  if (vehicles.length < 2) {
    holder.innerHTML = `<button type="button" class="garage-quick-car add" data-open-vehicle-modal>＋ Carro</button>`;
    return;
  }
  holder.innerHTML = vehicles.map((vehicle) => {
    const active = String(vehicle.id) === String(clientPortalState.activeVehicleId);
    return `<button type="button" class="garage-quick-car ${active ? "active" : ""}" data-quick-vehicle="${clientSafe(vehicle.id)}" aria-pressed="${active}">
      ${clientSafe(vehicle.nickname || vehicleBaseTitle(vehicle))}
    </button>`;
  }).join("");
}

function renderGarageToolsDrawer() {
  const holder = clientQs("#clientToolsVehicles");
  const vehicles = clientPortalState.vehicles || [];
  const active = preferredVehicle();
  const activeName = active ? (active.nickname || vehicleBaseTitle(active)) : "Sin carro seleccionado";
  setText("#clientActiveCarName", activeName);
  setText("#clientRailVehicleName", activeName);
  setText("#clientToolsVehicleName", activeName);
  setText("#clientMaintenanceVehicleName", activeName);
  setText("#clientToolsVehicleMeta", active
    ? [active.plate ? `Placa ${active.plate}` : "", active.mileage ? formatKm(active.mileage) : "Falta agregar kilometraje"].filter(Boolean).join(" · ")
    : "Agregá un carro para ver su información");
  setText("#clientToolsPoints", `${Number(clientPortalState.loyalty?.points_balance || 0).toLocaleString("es-GT")} puntos disponibles`);
  if (!holder) return;
  holder.innerHTML = vehicles.length
    ? vehicles.map((vehicle) => {
      const isActive = String(vehicle.id) === String(active?.id);
      const insight = getVehicleInsight(vehicle);
      return `<button type="button" class="client-tools-vehicle ${isActive ? "active" : ""}" data-quick-vehicle="${clientSafe(vehicle.id)}" aria-pressed="${isActive}">
        <span aria-hidden="true">◆</span>
        <span><strong>${clientSafe(vehicle.nickname || vehicleBaseTitle(vehicle))}</strong><small>${clientSafe(vehicle.plate || (vehicle.mileage ? formatKm(vehicle.mileage) : "Falta kilometraje"))}</small></span>
        <em>${clientSafe(insight.active ? statusLabel(insight.active.status) : "Ver")}</em>
      </button>`;
    }).join("")
    : `<div class="client-tools-empty"><p>Todavía no tenés carros guardados.</p><button class="client-btn client-btn-primary" type="button" data-open-vehicle-modal>Agregar mi primer carro</button></div>`;
}

function renderSpineCars(activeVehicle) {
  const holder = clientQs("#spineCars");
  if (!holder) return;
  const vehicles = clientPortalState.vehicles || [];
  holder.innerHTML = `${vehicles.map((item) => {
    const active = String(item.id) === String(activeVehicle.id);
    return `<button type="button" class="spine-car ${active ? "active" : ""}" data-select-overview-vehicle="${clientSafe(item.id)}" aria-pressed="${active ? "true" : "false"}">
      <span>${clientSafe(item.nickname || vehicleBaseTitle(item))}</span>
      <small>${clientSafe(item.plate || item.year || "Guardado")}</small>
    </button>`;
  }).join("")}<button type="button" class="spine-car spine-car-add" data-open-vehicle-modal aria-label="Agregar otro carro"><span>＋</span><small>Agregar</small></button>`;
}

/* Nodo "HOY": la cabeza de la línea. Reúne la cita activa y el próximo
   mantenimiento sugerido, para que lo accionable quede siempre arriba. */
function spineTodayNode(vehicle, { summary = "", upcoming = "", tone = "" } = {}) {
  const appointment = getVehicleInsight(vehicle).active;
  let headline = "Sin cita agendada";
  let copy = summary || `Cuando querás, pedí servicio para tu ${vehicleBaseTitle(vehicle)}.`;
  let action = `<button class="client-btn client-btn-primary" type="button" data-open-client-booking data-vehicle-id="${clientSafe(vehicle.id)}">Solicitar servicio</button>`;

  if (appointment) {
    headline = appointment.service_name || "Servicio D-TEK";
    copy = `${fmtDate(appointment.scheduled_start)}${appointment.location ? ` · ${appointment.location}` : ""}`;
    action = `<button class="client-btn client-btn-primary" type="button" data-client-section="appointments">Ver mi cita</button>`;
  }

  return `<article class="spine-event spine-today ${clientSafe(tone)}" data-spine-event>
    <span class="spine-node today" aria-hidden="true"></span>
    <div class="spine-event-card">
      <div class="spine-event-top"><small>Hoy</small>${appointment ? `<span class="client-status-badge ${statusTone(appointment.status)}">${clientSafe(statusLabel(appointment.status))}</span>` : ""}</div>
      <strong>${clientSafe(headline)}</strong>
      <p>${clientSafe(copy)}</p>
      ${upcoming ? `<div class="spine-upcoming proximo-v318">
        <span class="proximo-rotulo-v318">Próximo servicio</span>
        <p>${clientSafe(upcoming)}</p>
        <button class="client-btn client-btn-secondary proximo-btn-v318" type="button" data-open-client-booking data-vehicle-id="${clientSafe(vehicle.id)}">Solicitar servicio</button>
      </div>` : ""}
      <div class="spine-event-actions">${action}</div>
    </div>
  </article>`;
}

function spineEventNode(item) {
  const isReport = item.kind === "work_order";
  const title = item.service_name || (isReport ? "Trabajo realizado" : "Cita D-TEK");
  const badge = isReport ? (item.work_order_status || "open") : (item.appointment_status || item.status || "requested");
  const detail = item.diagnosis || item.symptom || item.recommendations || "";
  const meta = [
    item.mileage ? `${Number(item.mileage).toLocaleString("es-GT")} km` : "",
    item.grand_total ? formatMoney(item.grand_total) : ""
  ].filter(Boolean);

  const idServicio = item.appointment_id || item.id || "";

  return `<article class="spine-event" data-spine-event>
    <span class="spine-node" aria-hidden="true"></span>
    <div class="spine-event-card${idServicio ? " abrible" : ""}"${idServicio ? ` data-open-expediente="${clientSafe(idServicio)}" role="button" tabindex="0" aria-label="Abrir detalle de ${clientSafe(title)}"` : ""}>
      <div class="spine-event-top"><small>${clientSafe(formatDateShort(item.scheduled_start || item.created_at))}</small><span class="client-status-badge ${statusTone(badge)}">${clientSafe(statusLabel(badge))}</span></div>
      <strong>${clientSafe(title)}</strong>
      ${detail ? `<p>${clientSafe(detail)}</p>` : ""}
      ${meta.length ? `<div class="spine-event-meta">${meta.map((value) => `<span>${clientSafe(value)}</span>`).join("")}</div>` : ""}
    </div>
  </article>`;
}

function paintSpine(mount, innerHtml) {
  mount.innerHTML = innerHtml;
  window.DtekGarageMotion?.refresh?.();
}

function buildOverviewServiceTimeline(vehicle, history = []) {
  const mount = clientQs("#overviewServiceTimeline");
  if (!mount || !vehicle) return;

  renderSpineCars(vehicle);

  const loadingHistory = Boolean(clientPortalState.loadingHistoryMap?.[vehicle.id]) && !(history || []).length;
  if (loadingHistory) {
    updateGarageTimelineDock(vehicle, "Cargando historial...", "loading");
    paintSpine(mount, `${spineTodayNode(vehicle)}<article class="spine-event"><span class="spine-node" aria-hidden="true"></span><div class="spine-event-card loading"><p>Cargando historial...</p></div></article>`);
    return;
  }

  const anchor = chooseMaintenanceAnchor(vehicle, history);
  if (!anchor) {
    updateGarageTimelineDock(vehicle, "Sin historial todavía", "empty");
    paintSpine(mount, `${spineTodayNode(vehicle)}<article class="spine-event spine-origin" data-spine-event><span class="spine-node origin" aria-hidden="true"></span><div class="spine-event-card"><strong>Aquí empezará el historial.</strong><p>El primer servicio guardará la fecha, el kilometraje y lo que se realizó.</p></div></article>`);
    return;
  }

  const serviceName = anchor.service_name || anchor.title || "Servicio D-TEK";
  const plan = inferMaintenancePlan(`${serviceName} ${anchor.recommendations || ""}`);
  const lastDate = new Date(anchor.scheduled_start || anchor.created_at || Date.now());
  const nextDate = addMonths(lastDate, plan.monthInterval);
  const currentMileage = Number(vehicle.mileage || 0);
  const daysElapsed = daysBetween(lastDate, new Date());
  const daysLeft = Math.round((nextDate - new Date()) / 86400000);
  let tone = "ok";
  let summary = `Han pasado ${humanElapsedFromDays(daysElapsed)} desde tu ${plan.label.toLowerCase()}.`;
  if (daysLeft < 0) {
    tone = "overdue";
    summary = `Ya pasó ${humanElapsedFromDays(Math.abs(daysLeft))} de la fecha sugerida para tu ${plan.label.toLowerCase()}.`;
  } else if (daysLeft <= 30) {
    tone = "soon";
    summary = `Ya casi toca: faltan ${humanElapsedFromDays(daysLeft)} o antes si el uso del carro ha sido pesado.`;
  } else if (currentMileage > 0) {
    summary = `Llevás ${formatKmCompact(currentMileage)} registrados. La referencia sugerida es cada ${plan.kmInterval.toLocaleString("es-GT")} km o ${plan.monthInterval} meses.`;
  }

  updateGarageTimelineDock(
    vehicle,
    `${plan.label} · ${formatDateShort(lastDate)} → ${formatDateShort(nextDate)}`,
    tone
  );

  const upcoming = `${plan.label} sugerido para ${formatDateShort(nextDate)} · cada ${plan.kmInterval.toLocaleString("es-GT")} km o ${plan.monthInterval} meses.`;
  const todayNode = spineTodayNode(vehicle, { summary, upcoming, tone });
  const pastNodes = (history || []).length
    ? history.slice(0, 1).map(spineEventNode).join("")
    : spineEventNode(anchor);
  const originNode = (history || []).length ? "" : `<article class="spine-event spine-origin" data-spine-event>
    <span class="spine-node origin" aria-hidden="true"></span>
    <div class="spine-event-card"><strong>Aquí empieza el historial de tu ${clientSafe(vehicleBaseTitle(vehicle))}.</strong><p>Cada trabajo queda registrado con su fecha y kilometraje.</p></div>
  </article>`;

  paintSpine(mount, `${todayNode}${pastNodes}${originNode}`);
}

function normalizeVehicleToken(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sameVehicleText(vehicle, text = "", record = null) {
  if (record && vehicle?.id != null && (record.vehicle_id != null || record.car_id != null)) {
    return String(record.vehicle_id ?? record.car_id) === String(vehicle.id);
  }
  const haystack = normalizeVehicleToken(text);
  if (!haystack) return false;
  return [vehicle?.brand, vehicle?.line, vehicle?.year]
    .filter(Boolean)
    .every((part) => haystack.includes(normalizeVehicleToken(part)));
}

function vehicleAppointments(vehicle) {
  return (clientPortalState.appointments || []).filter((appointment) =>
    sameVehicleText(vehicle, appointment.vehicle_summary || `${appointment.vehicle_brand || ""} ${appointment.vehicle_line || ""} ${appointment.vehicle_year || ""}`, appointment)
  );
}

function vehicleOrders(vehicle) {
  return (clientPortalState.workOrders || []).filter((order) => sameVehicleText(vehicle, order.vehicle_summary, order));
}

function getVehicleInsight(vehicle) {
  const appointments = vehicleAppointments(vehicle);
  const orders = vehicleOrders(vehicle);
  const active = appointments.find((item) => ["pending", "requested", "submitted", "scheduled", "confirmed", "in_progress"].includes(item.status));
  const lastOrder = orders[0] || null;
  const recommendation = orders.find((item) => item.recommendations)?.recommendations || "";
  return {
    active,
    lastOrder,
    recommendation,
    status: active ? statusLabel(active.status) : recommendation ? "Revisión pendiente" : "Sin alertas confirmadas"
  };
}

function isDashboardReady() {
  return Boolean(window.DtekBackend?.isConfigured?.());
}

async function getSessionOrNull() {
  if (!isDashboardReady()) return null;
  return DtekBackend.getSession();
}

function showAuthGate(show) {
  clientQs("#clientAuthGate")?.classList.toggle("hidden-field", !show);
  clientQs("#clientDashboard")?.classList.toggle("hidden-field", show);
  clientQs("#clientPublicHeader")?.classList.toggle("hidden-field", !show);
}

let sidePanelReturnFocus = null;

function syncSidePanelState() {
  const toolsOpen = clientQs("#clientToolsDrawer")?.getAttribute("aria-hidden") === "false";
  const maintenanceOpen = clientQs("#clientMaintenanceDrawer")?.getAttribute("aria-hidden") === "false";
  document.body.classList.toggle("client-tools-open", toolsOpen);
  document.body.classList.toggle("client-maintenance-open", maintenanceOpen);
  document.body.classList.toggle("client-side-panel-open", Boolean(toolsOpen || maintenanceOpen));
}

function openToolsDrawer(trigger = document.activeElement) {
  const drawer = clientQs("#clientToolsDrawer");
  const backdrop = clientQs("#clientToolsBackdrop");
  if (!drawer || !backdrop) return;
  closeMaintenanceDrawer();
  sidePanelReturnFocus = trigger instanceof HTMLElement ? trigger : null;
  renderGarageToolsDrawer();
  drawer.setAttribute("aria-hidden", "false");
  drawer.removeAttribute("inert");
  backdrop.hidden = false;
  syncSidePanelState();
  ["#clientToolsTrigger", "#clientActiveCarTrigger", "#clientCarsRailTrigger"].forEach((selector) => clientQs(selector)?.setAttribute("aria-expanded", "true"));
  window.setTimeout(() => drawer.querySelector("[data-quick-vehicle], [data-open-vehicle-modal], button")?.focus(), 40);
}

function closeToolsDrawer({ restoreFocus = false } = {}) {
  const drawer = clientQs("#clientToolsDrawer");
  const backdrop = clientQs("#clientToolsBackdrop");
  if (!drawer || !backdrop) return;
  drawer.setAttribute("aria-hidden", "true");
  drawer.setAttribute("inert", "");
  backdrop.hidden = true;
  ["#clientToolsTrigger", "#clientActiveCarTrigger", "#clientCarsRailTrigger"].forEach((selector) => clientQs(selector)?.setAttribute("aria-expanded", "false"));
  syncSidePanelState();
  if (restoreFocus) (sidePanelReturnFocus || clientQs("#clientToolsTrigger"))?.focus();
}

function openMaintenanceDrawer(trigger = document.activeElement) {
  const drawer = clientQs("#clientMaintenanceDrawer");
  const backdrop = clientQs("#clientMaintenanceBackdrop");
  if (!drawer || !backdrop) return;
  closeToolsDrawer();
  sidePanelReturnFocus = trigger instanceof HTMLElement ? trigger : null;
  renderGarageToolsDrawer();
  drawer.setAttribute("aria-hidden", "false");
  drawer.removeAttribute("inert");
  backdrop.hidden = false;
  clientQsa("[data-open-maintenance-drawer], #clientMaintenanceTrigger").forEach((button) => button.setAttribute("aria-expanded", "true"));
  syncSidePanelState();
  window.setTimeout(() => drawer.querySelector("[data-radar-component], [data-open-client-booking], button")?.focus(), 40);
}

function closeMaintenanceDrawer({ restoreFocus = false } = {}) {
  const drawer = clientQs("#clientMaintenanceDrawer");
  const backdrop = clientQs("#clientMaintenanceBackdrop");
  if (!drawer || !backdrop) return;
  drawer.setAttribute("aria-hidden", "true");
  drawer.setAttribute("inert", "");
  backdrop.hidden = true;
  clientQsa("[data-open-maintenance-drawer], #clientMaintenanceTrigger").forEach((button) => button.setAttribute("aria-expanded", "false"));
  syncSidePanelState();
  if (restoreFocus) (sidePanelReturnFocus || clientQs("#clientMaintenanceTrigger"))?.focus();
}

function installSideDrawerGestures() {
  [
    { drawer: clientQs("#clientToolsDrawer"), close: closeToolsDrawer, direction: "left" },
    { drawer: clientQs("#clientMaintenanceDrawer"), close: closeMaintenanceDrawer, direction: "right" }
  ].forEach(({ drawer, close, direction }) => {
    if (!drawer) return;
    let startX = null;
    drawer.addEventListener("touchstart", (event) => {
      startX = event.touches[0]?.clientX ?? null;
    }, { passive: true });
    drawer.addEventListener("touchend", (event) => {
      if (startX == null) return;
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const delta = endX - startX;
      if ((direction === "left" && delta < -58) || (direction === "right" && delta > 58)) close();
      startX = null;
    }, { passive: true });
  });
}

function setActiveSection(section) {
  const normalized = ({ garage: "vehicles", vehicle: "vehicles", history: "appointments" })[section] || section;
  clientPortalState.activeSection = normalized;
  document.body.dataset.clientSectionActive = normalized;
  const titles = {
    overview: "Inicio",
    vehicles: "Garage",
    appointments: "Agenda",
    benefits: "Puntos",
    profile: "Cuenta"
  };
  const navigationSection = normalized === "benefits" ? "profile" : normalized;

  clientQsa("[data-client-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.clientSection === navigationSection);
    if (button.tagName === "BUTTON") button.setAttribute("aria-current", button.dataset.clientSection === navigationSection ? "page" : "false");
  });
  clientQsa("[data-section-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.sectionPanel === normalized));
  const title = clientQs("#dashboardTitle");
  if (title) title.textContent = titles[normalized] || "Garage D-TEK";
  closeAccountMenu();
  closeToolsDrawer();
  closeMaintenanceDrawer();
  if (normalized === "vehicles" && clientPortalState.activeVehicleId) {
    openVehicleProfile(clientPortalState.activeVehicleId, { navigate: false, refreshHistory: true });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function vehicleServiceUrl(vehicleId) {
  return `agenda.html?vehicle_id=${encodeURIComponent(vehicleId)}&from=garage`;
}

function setGlobalServiceLinks(vehicleId = null) {
  // Sin carros guardados el botón sigue vivo: manda a la agenda pública, que sí permite
  // escribir el vehículo a mano. Nadie tiene que armar su Garage para poder agendar.
  ["#globalServiceCta", "#mobileServiceCta"].forEach((selector) => {
    const trigger = clientQs(selector);
    if (!trigger) return;
    trigger.dataset.vehicleId = vehicleId || "";
    trigger.disabled = false;
  });
}

function setText(selector, value) {
  const element = clientQs(selector);
  if (element) element.textContent = value;
}

function setHtml(selector, value) {
  const element = clientQs(selector);
  if (element) element.innerHTML = value;
}

function renderRetry(message, action) {
  return `<div class="client-inline-error"><p>${clientSafe(message)} Revisá tu conexión e intentá de nuevo.</p><button class="client-text-link" type="button" data-retry-load="${clientSafe(action)}">Volver a intentar</button></div>`;
}

function renderAppointmentCard(appointment, { compact = false } = {}) {
  const tone = statusTone(appointment.status);
  const vehicle = appointment.vehicle_summary || `${appointment.vehicle_brand || ""} ${appointment.vehicle_line || ""} ${appointment.vehicle_year || ""}`.trim() || "Vehículo pendiente";
  return `<article class="client-list-item appointment-item ${tone}">
    <div class="client-list-item-main">
      <div>
        <span class="client-status-badge ${tone}">${clientSafe(statusLabel(appointment.status))}</span>
        <h3>${clientSafe(appointment.service_name || "Servicio D-TEK")}</h3>
        <p>${clientSafe(fmtDate(appointment.scheduled_start))}</p>
        <small>${clientSafe(vehicle)}${compact ? "" : ` · ${clientSafe(appointment.location || "Ubicación pendiente")}`}</small>
      </div>
    </div>
  </article>`;
}

function renderWorkOrderLineas(lineas) {
  if (!Array.isArray(lineas) || !lineas.length) return "";
  const filas = lineas.map((linea) => `
    <tr>
      <td>${clientSafe(linea.descripcion || "")}</td>
      <td>${clientSafe(linea.cantidad ?? "")}</td>
      <td>${clientSafe(formatMoney(linea.precio))}</td>
      <td>${clientSafe(formatMoney(linea.subtotal))}</td>
    </tr>`).join("");
  return `<table class="report-lineas">
    <thead><tr><th>Descripción</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>`;
}

function renderWorkOrder(order) {
  return `<article class="client-list-item report-item">
    <div class="client-list-item-main">
      <div>
        <span class="client-status-badge ${statusTone(order.status)}">${clientSafe(statusLabel(order.status || "open"))}</span>
        <h3>${clientSafe(order.service_name || "Trabajo realizado")}</h3>
        <p>${clientSafe(order.vehicle_summary || "Vehículo")}</p>
        <small>${clientSafe(fmtDate(order.service_date || order.scheduled_start || order.created_at))}${order.mileage_at_service ? ` · ${clientSafe(formatKm(order.mileage_at_service))}` : ""}</small>
      </div>
    </div>
    <div class="report-summary">
      ${order.diagnosis ? `<p><strong>Diagnóstico:</strong> ${clientSafe(order.diagnosis)}</p>` : ""}
      ${order.recommendations ? `<p><strong>Recomendación:</strong> ${clientSafe(order.recommendations)}</p>` : ""}
      ${renderWorkOrderLineas(order.lineas)}
      ${order.grand_total ? `<p><strong>Total:</strong> ${clientSafe(formatMoney(order.grand_total))}</p>` : ""}
    </div>
  </article>`;
}

function renderReferral(referral) {
  const status = referral.status || "submitted";
  return `<article class="points-list-item">
    <span class="points-list-icon">＋100</span>
    <div><strong>${clientSafe(referral.referred_name || "Contacto recomendado")}</strong><small>${clientSafe(referralStatusLabel(status))}</small></div>
    <b>${status === "converted" ? "+100" : "…"}</b>
  </article>`;
}

function renderVehiclePickerCard(vehicle) {
  const insight = getVehicleInsight(vehicle);
  const active = String(vehicle.id) === String(clientPortalState.activeVehicleId);
  return `<button class="vehicle-picker-card ${active ? "active" : ""}" type="button" data-open-vehicle="${clientSafe(vehicle.id)}">
    <span class="vehicle-picker-icon" aria-hidden="true">◆</span>
    <span class="vehicle-picker-copy">
      <strong>${clientSafe(vehicleTitle(vehicle))}</strong>
      <small>${clientSafe(vehicle.plate || formatKm(vehicle.mileage))}</small>
    </span>
    <span class="vehicle-picker-state ${statusTone(insight.active?.status)}">${clientSafe(insight.active ? statusLabel(insight.active.status) : "Ver")}</span>
  </button>`;
}

function buildSmartRecommendations(vehicle, history = []) {
  const orders = vehicleOrders(vehicle);
  const fromReports = orders
    .filter((order) => order.recommendations)
    .slice(0, 3)
    .map((order) => ({ title: "Recomendación del último trabajo", body: order.recommendations, priority: "Revisión pendiente", urgent: true }));
  if (fromReports.length) return fromReports;

  const recommendations = [];
  if (!vehicle.mileage) recommendations.push({ title: "Actualizá el kilometraje", body: "Nos ayuda a recomendar el próximo mantenimiento con más precisión.", priority: "Dato pendiente" });
  if (!history.length) recommendations.push({ title: "Empezá el historial del carro", body: "El primer servicio registra la fecha, el kilometraje y lo que revisamos.", priority: "Primer servicio" });
  if (vehicle.mileage && Number(vehicle.mileage) >= 70000) recommendations.push({ title: "Mantenimiento preventivo", body: "Conviene revisar candelas, fluidos, frenos y suspensión según el uso real del carro.", priority: "Preventivo" });
  if (!recommendations.length) recommendations.push({ title: "Sin recomendaciones pendientes", body: "Cuando un servicio deje algo por revisar, aparecerá acá.", priority: "Al día" });
  return recommendations.slice(0, 3);
}

function renderRecommendationCard(recommendation) {
  return `<article class="vehicle-reco-card ${recommendation.urgent ? "urgent" : ""}">
    <span>${clientSafe(recommendation.priority || "Pendiente")}</span>
    <strong>${clientSafe(recommendation.title)}</strong>
    <small>${clientSafe(recommendation.body)}</small>
  </article>`;
}

function renderTimeline(history = []) {
  if (!history.length) {
    return `<div class="client-empty-copy"><strong>Todavía no hay servicios registrados.</strong><p>Cuando hagamos el primero, aquí aparecerán la fecha, el kilometraje y lo que se realizó.</p><button class="client-btn client-btn-primary" type="button" data-open-client-booking>Solicitar primer servicio</button></div>`;
  }
  return history.map((item) => {
    const isReport = item.kind === "work_order";
    const title = item.service_name || (isReport ? "Trabajo realizado" : "Cita D-TEK");
    const badge = isReport ? (item.work_order_status || "open") : (item.appointment_status || "requested");
    const detail = item.diagnosis || item.symptom || item.recommendations || "Sin detalle adicional.";
    const eventType = isReport ? "Trabajo realizado" : "Cita";
    const mileage = item.mileage ? `${Number(item.mileage).toLocaleString("es-GT")} km` : "Kilometraje no registrado";
    const idServicio = item.appointment_id || item.id || "";
    return `<article class="timeline-item ${isReport ? "report" : "appointment"}">
      <div class="timeline-dot"></div>
      <div class="timeline-card${idServicio ? " abrible" : ""}"${idServicio ? ` data-open-expediente="${clientSafe(idServicio)}" role="button" tabindex="0" aria-label="Abrir detalle de ${clientSafe(title)}"` : ""}>
        <div class="timeline-head"><strong>${clientSafe(title)}</strong><span class="client-status-badge ${statusTone(badge)}">${clientSafe(statusLabel(badge))}</span></div>
        <small>${clientSafe(fmtDate(item.scheduled_start || item.created_at))}</small>
        <p>${clientSafe(detail)}</p>
        <div class="timeline-event-meta"><span>${clientSafe(eventType)}</span><span>${clientSafe(mileage)}</span>${item.grand_total ? `<span>${clientSafe(formatMoney(item.grand_total))}</span>` : ""}</div>
      </div>
    </article>`;
  }).join("");
}


// V-01 · Lo invertido en el carro existia dato por dato y nunca se sumaba.
// Es lo que convierte el Garage de lista en expediente economico del vehiculo.
function totalInvertido(history = []) {
  const vistos = new Set();
  let suma = 0;
  (history || []).forEach((item) => {
    const monto = Number(item.grand_total || 0);
    if (!monto) return;
    // el historial trae la cita y su reporte: el monto se cuenta una sola vez
    const clave = String(item.appointment_id ?? item.id);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    suma += monto;
  });
  return { total: suma, servicios: vistos.size };
}

function invertidoTexto(history = []) {
  const t = totalInvertido(history);
  if (!t.total) return "Todavía sin montos cerrados";
  return `${formatMoney(t.total)} en ${t.servicios} servicio${t.servicios === 1 ? "" : "s"}`;
}
function renderQuickFacts(vehicle, history = []) {
  const orders = vehicleOrders(vehicle);
  const appointments = vehicleAppointments(vehicle);
  const last = history[0];
  const lines = [
    ["Marca y línea", vehicleBaseTitle(vehicle)],
    ["Motor", vehicle.engine || "Pendiente"],
    ["Transmisión", vehicle.transmission || "Pendiente"],
    ["Uso", vehicle.use_type || "Pendiente"],
    ["Placa", vehicle.plate || "Pendiente"],
    ["Registros", `${appointments.length} cita(s) · ${orders.length} trabajo(s)`],
    ["Última actividad", last ? fmtDate(last.scheduled_start || last.created_at) : "Sin historial"],
    ["Invertido en este carro", invertidoTexto(history)]
  ];
  return lines.map(([label, value]) => `<div class="profile-data-row"><span>${clientSafe(label)}</span><strong>${clientSafe(value)}</strong></div>`).join("");
}

function preferredVehicle() {
  const vehicles = clientPortalState.vehicles || [];
  if (!vehicles.length) return null;
  const current = vehicles.find((vehicle) => String(vehicle.id) === String(clientPortalState.activeVehicleId));
  if (current) return current;
  const withActiveAppointment = vehicles.find((vehicle) => getVehicleInsight(vehicle).active);
  return withActiveAppointment || vehicles[0];
}

async function ensureVehicleHistory(vehicleId, { refresh = false } = {}) {
  if (!vehicleId || !isDashboardReady()) return [];
  clientPortalState.vehicleHistoryMap = clientPortalState.vehicleHistoryMap || {};
  clientPortalState.loadingHistoryMap = clientPortalState.loadingHistoryMap || {};
  if (!refresh && clientPortalState.vehicleHistoryMap[vehicleId]) return clientPortalState.vehicleHistoryMap[vehicleId];
  if (clientPortalState.loadingHistoryMap[vehicleId]) return clientPortalState.vehicleHistoryMap[vehicleId] || [];

  clientPortalState.loadingHistoryMap[vehicleId] = true;
  renderOverview();
  try {
    const history = await DtekBackend.listMyVehicleHistory(vehicleId);
    clientPortalState.vehicleHistoryMap[vehicleId] = history || [];
    if (String(clientPortalState.activeVehicleId) === String(vehicleId)) {
      clientPortalState.activeVehicleHistory = history || [];
    }
  } catch (error) {
    console.warn(error);
    clientPortalState.vehicleHistoryMap[vehicleId] = clientPortalState.vehicleHistoryMap[vehicleId] || [];
  } finally {
    clientPortalState.loadingHistoryMap[vehicleId] = false;
    renderOverview();
  }
  return clientPortalState.vehicleHistoryMap[vehicleId] || [];
}

function renderOverview() {
  const loading = clientQs("#overviewLoading");
  const empty = clientQs("#overviewEmptyVehicles");
  const content = clientQs("#overviewContent");

  if (clientPortalState.loading) {
    loading?.classList.remove("hidden-field");
    empty?.classList.add("hidden-field");
    content?.classList.add("hidden-field");
    return;
  }

  loading?.classList.add("hidden-field");
  const vehicles = clientPortalState.vehicles || [];
  const profile = clientPortalState.profile || {};
  const firstName = (profile.full_name || profile.username || profileContactEmail(profile) || "Cliente").split(" ")[0] || "Cliente";

  if (!vehicles.length) {
    empty?.classList.remove("hidden-field");
    content?.classList.add("hidden-field");
    clientQs("#garageTimelineDock")?.classList.add("hidden-field");
    setGarageTimelineExpanded(false);
    setText("#emptyVehicleGreeting", `Hola, ${firstName}. Empecemos guardando tu carro.`);
    setGlobalServiceLinks(null);
    renderGarageToolsDrawer();
    return;
  }

  empty?.classList.add("hidden-field");
  content?.classList.remove("hidden-field");
  const activeVehicle = preferredVehicle();
  clientPortalState.activeVehicleId = activeVehicle.id;
  setGlobalServiceLinks(activeVehicle.id);
  renderGarageToolsDrawer();

  setText("#clientGreeting", `Hola, ${firstName}.`);
  setText("#clientNextStep", `Así está tu ${vehicleBaseTitle(activeVehicle)} hoy.`);

  const vehicleInsight = getVehicleInsight(activeVehicle);
  const allActiveAppointments = (clientPortalState.appointments || []).filter((item) => ["pending", "requested", "submitted", "scheduled", "confirmed", "in_progress"].includes(item.status));
  const appointment = vehicleInsight.active || allActiveAppointments[0] || null;
  const status = clientQs("#nextActionStatus");
  const nextCard = clientQs("#nextActionCard");

  if (appointment) {
    const tone = statusTone(appointment.status);
    status.className = `client-status-badge ${tone}`;
    status.textContent = statusLabel(appointment.status);
    nextCard.dataset.state = appointment.status;
    setText("#nextActionTitle", appointment.service_name || "Servicio D-TEK");
    setText("#nextActionDescription", `${fmtDate(appointment.scheduled_start)}${appointment.location ? ` · ${appointment.location}` : ""}. ${appointment.status === "requested" ? "Te confirmamos por WhatsApp antes de llegar." : "Tu cita ya está confirmada."}`);
    setHtml("#nextActionActions", `<button class="client-btn client-btn-primary" type="button" data-client-section="appointments">Ver mi cita</button><a class="client-text-link" href="https://wa.me/${clientSafe(window.DTEK_WHATSAPP_NUMBER || window.DTEK_CONFIG?.whatsappNumber || "50247082329")}" target="_blank" rel="noopener">Escribir por WhatsApp</a>`);
  } else if (vehicleInsight.recommendation) {
    status.className = "client-status-badge waiting";
    status.textContent = "Revisión pendiente";
    nextCard.dataset.state = "recommendation";
    setText("#nextActionTitle", "Hay algo que conviene revisar.");
    setText("#nextActionDescription", vehicleInsight.recommendation);
    setHtml("#nextActionActions", `<button class="client-btn client-btn-primary" type="button" data-open-client-booking data-vehicle-id="${clientSafe(activeVehicle.id)}">Solicitar servicio</button><button class="client-text-link" type="button" data-open-vehicle="${clientSafe(activeVehicle.id)}">Ver recomendación</button>`);
  } else {
    status.className = "client-status-badge neutral";
    status.textContent = "Sin cita";
    nextCard.dataset.state = "empty";
    setText("#nextActionTitle", "No tenés ninguna cita agendada.");
    setText("#nextActionDescription", `Cuando querás, pedí servicio para tu ${vehicleBaseTitle(activeVehicle)}.`);
    setHtml("#nextActionActions", `<button class="client-btn client-btn-primary" type="button" data-open-client-booking data-vehicle-id="${clientSafe(activeVehicle.id)}">Solicitar servicio</button><button class="client-text-link" type="button" data-open-client-booking data-vehicle-id="${clientSafe(activeVehicle.id)}" data-booking-symptoms="true">No sé qué tiene</button>`);
  }

  setText("#overviewVehicleTitle", activeVehicle.nickname || `${activeVehicle.brand || "Vehículo"} ${activeVehicle.line || ""}`.trim());
  setText("#overviewVehicleYear", activeVehicle.year || "—");
  setText("#overviewVehicleMeta", [activeVehicle.plate || "Placa pendiente", formatKm(activeVehicle.mileage), activeVehicle.transmission || "Caja pendiente"].join(" · "));
  const health = clientQs("#overviewVehicleHealth");
  if (health) health.className = `vehicle-health-dot ${vehicleInsight.recommendation ? "warning" : appointment?.status === "confirmed" ? "positive" : "neutral"}`;

  const recommendation = clientQs("#overviewRecommendation");
  if (vehicleInsight.recommendation) {
    recommendation?.classList.remove("hidden-field");
    if (recommendation) recommendation.innerHTML = `<strong>Conviene revisar:</strong> ${clientSafe(vehicleInsight.recommendation)}`;
  } else {
    recommendation?.classList.add("hidden-field");
    if (recommendation) recommendation.innerHTML = "";
  }

  const cachedHistory = clientPortalState.vehicleHistoryMap?.[activeVehicle.id] || [];
  buildOverviewServiceTimeline(activeVehicle, cachedHistory);
  if (!cachedHistory.length && !clientPortalState.loadingHistoryMap?.[activeVehicle.id]) {
    ensureVehicleHistory(activeVehicle.id);
  }

  const openButton = clientQs("#overviewOpenVehicle");
  if (openButton) openButton.dataset.openVehicle = activeVehicle.id;
  const agendaLink = clientQs("#overviewAgendaVehicle");
  if (agendaLink) agendaLink.dataset.vehicleId = activeVehicle.id;

  const loyalty = clientPortalState.loyalty || {};
  const benefitContent = clientQs("#overviewBenefitContent");
  if (benefitContent) {
    benefitContent.innerHTML = `<h3>${clientSafe(formatPoints(loyalty.points_balance || 0))}</h3><p>Usalos en premios D-TEK</p>`;
  }

  const others = vehicles.filter((vehicle) => String(vehicle.id) !== String(activeVehicle.id));
  const otherCard = clientQs("#otherVehiclesCard");
  if (others.length) {
    otherCard?.classList.remove("hidden-field");
    setHtml("#otherVehiclesList", others.slice(0, 3).map((vehicle) => `<button type="button" data-select-overview-vehicle="${clientSafe(vehicle.id)}"><span>${clientSafe(vehicle.nickname || vehicleBaseTitle(vehicle))}</span><small>${clientSafe(vehicle.plate || formatKm(vehicle.mileage))}</small></button>`).join(""));
  } else {
    otherCard?.classList.add("hidden-field");
    setHtml("#otherVehiclesList", "");
  }
}

function renderVehicleWorkspace() {
  const holder = clientQs("#clientVehicles");
  const workspace = clientQs("#vehiclesWorkspace");
  const picker = clientQs("#vehiclePickerPanel");
  const vehicles = clientPortalState.vehicles || [];

  if (!holder || !workspace || !picker) return;
  if (!vehicles.length) {
    workspace.classList.add("no-vehicles");
    picker.classList.add("hidden-field");
    clientQs("#vehicleProfileView")?.classList.add("hidden-field");
    clientQs("#vehicleProfileEmpty")?.classList.remove("hidden-field");
    clientQs("#vehicleProfileEmpty").innerHTML = `<span class="client-kicker">Tu primer carro</span><h2>Todavía no tenés carros guardados.</h2><p>Guardarlo es opcional. Sirve para conservar su historial y no repetir los datos al solicitar servicio.</p><button class="client-btn client-btn-primary" type="button" data-open-vehicle-modal>Agregar mi primer carro</button><a class="client-btn client-btn-secondary" href="agenda.html?from=garage">Solicitar sin guardar carro</a>`;
    return;
  }

  workspace.classList.remove("no-vehicles");
  workspace.classList.toggle("single-vehicle", vehicles.length === 1);
  picker.classList.toggle("hidden-field", vehicles.length === 1);
  holder.innerHTML = vehicles.map(renderVehiclePickerCard).join("");
  renderGarageVehicleQuickSwitch();
  renderGarageToolsDrawer();
}

async function openVehicleProfile(vehicleId, options = {}) {
  const { navigate = true, refreshHistory = true } = options;
  const vehicle = mergeVehiclePrefs((clientPortalState.vehicles || []).find((item) => String(item.id) === String(vehicleId)) || {});
  if (!vehicle?.id) return;

  clientPortalState.activeVehicleId = vehicle.id;
  if (navigate) setActiveSection("vehicles");
  renderVehicleWorkspace();
  renderOverview();
  setGlobalServiceLinks(vehicle.id);

  clientQs("#vehicleProfileEmpty")?.classList.add("hidden-field");
  clientQs("#vehicleProfileView")?.classList.remove("hidden-field");
  setText("#vehicleProfileTitle", vehicleTitle(vehicle));
  setText("#vehicleProfileEyebrow", vehicle.nickname ? vehicleBaseTitle(vehicle) : "Historial y próximos servicios");
  setText("#vehicleProfileSubtitle", `${vehicle.plate ? `Placa ${vehicle.plate} · ` : ""}${formatKm(vehicle.mileage)}`);
  const agenda = clientQs("#vehicleProfileAgenda");
  if (agenda) agenda.dataset.vehicleId = vehicle.id;
  const radarAgenda = clientQs(".garage-radar-cta");
  if (radarAgenda) radarAgenda.dataset.vehicleId = vehicle.id;
  const mobileRadarAgenda = clientQs(".garage-radar-mobile [data-open-client-booking]");
  if (mobileRadarAgenda) mobileRadarAgenda.dataset.vehicleId = vehicle.id;

  const insight = getVehicleInsight(vehicle);
  setText("#vehicleStatusText", insight.recommendation ? "Revisión pendiente" : "Ninguna confirmada");
  setText("#vehicleStatusDetail", insight.active ? `Tenés una cita: ${statusLabel(insight.active.status).toLowerCase()}.` : insight.recommendation ? "Hay una recomendación por revisar." : "No hay alertas confirmadas.");
  setText("#vehicleMileageText", vehicle.mileage ? formatKm(vehicle.mileage) : "Falta agregarlo");
  setText("#vehicleNextActionText", insight.active ? statusLabel(insight.active.status) : insight.recommendation ? "Ver recomendación" : "Por calcular");
  setText("#vehicleNextActionDetail", insight.active ? fmtDate(insight.active.scheduled_start) : insight.recommendation || "El historial y el kilometraje nos ayudan a calcularlo.");
  renderGarageToolsDrawer();

  const fieldValues = {
    "#vehicleCareId": vehicle.id,
    "#vehicleCareNickname": vehicle.nickname || "",
    "#vehicleCareMileage": vehicle.mileage || "",
    "#vehicleCareEngine": vehicle.engine || "",
    "#vehicleCareTransmission": vehicle.transmission || "",
    "#vehicleCareUseType": vehicle.use_type || "",
    "#vehicleCareNotes": vehicle.notes || ""
  };
  Object.entries(fieldValues).forEach(([selector, value]) => {
    const field = clientQs(selector);
    if (field) field.value = value;
  });

  let history = clientPortalState.activeVehicleHistory || [];
  if (refreshHistory || String(clientPortalState.activeVehicleId) !== String(vehicleId)) history = [];
  if (refreshHistory) {
    setHtml("#vehicleTimeline", `<div class="client-loading-copy">Cargando el historial...</div>`);
    try {
      history = await DtekBackend.listMyVehicleHistory(vehicle.id);
    } catch (error) {
      console.warn(error);
      setHtml("#vehicleTimeline", renderRetry(friendlyError(), "vehicle-history"));
      history = [];
    }
    clientPortalState.activeVehicleHistory = history;
    clientPortalState.vehicleHistoryMap = clientPortalState.vehicleHistoryMap || {};
    clientPortalState.vehicleHistoryMap[vehicle.id] = history;
  }

  renderOverview();
  setHtml("#vehicleTimeline", renderTimeline(history));
  let healthRecords = clientPortalState.vehicleHealthMap?.[vehicle.id] || [];
  try {
    healthRecords = await DtekBackend.listMyVehicleHealth(vehicle.id);
    clientPortalState.vehicleHealthMap[vehicle.id] = healthRecords;
  } catch (error) {
    // La migración 20 puede no estar aplicada todavía. El tablero sigue
    // funcionando con el historial, pero etiqueta esos cálculos como estimados.
    console.warn("Estado persistente del vehículo no disponible:", error);
  }
  window.DtekVehicleHealth?.render?.(vehicle, history, healthRecords);
  setHtml("#vehicleRecommendations", buildSmartRecommendations(vehicle, history).map(renderRecommendationCard).join(""));
  setHtml("#vehicleQuickFacts", renderQuickFacts(vehicle, history));
}

function renderSocialProfile() {
  const profile = clientPortalState.profile || {};
  const vehicles = clientPortalState.vehicles || [];
  const appointments = clientPortalState.appointments || [];
  const workOrders = clientPortalState.workOrders || [];
  const referrals = clientPortalState.referrals || [];
  const fallbackIdentity = profile.username || profileContactEmail(profile) || "Cliente D-TEK";
  const fullName = profile.full_name || fallbackIdentity.split("@")[0] || "Cliente D-TEK";
  const firstName = fullName.trim().split(/\s+/)[0] || "Cliente";
  const initial = fullName.trim().charAt(0).toUpperCase() || "D";
  const completedServices = workOrders.filter((item) => ["completed", "approved"].includes(item.status)).length
    || appointments.filter((item) => item.status === "completed").length;

  ["#clientAvatarInitial", "#accountMenuInitial", "#profileHeroInitial"].forEach((selector) => setText(selector, initial));
  setText("#clientAccountName", firstName);
  setText("#accountMenuName", fullName);
  setText("#accountMenuSubtitle", vehicles.length ? `${vehicles.length} carro${vehicles.length === 1 ? "" : "s"} en tu garage` : "Garage personal");
  setText("#profileHeroName", fullName);
  setText("#profileStatVehicles", vehicles.length);
  setText("#profileStatServices", completedServices);
  setText("#profileStatReferrals", Number(clientPortalState.loyalty?.points_balance || 0));

  const feed = clientQs("#profileActivityFeed");
  if (!feed) return;
  const activities = [];

  appointments.forEach((item) => {
    activities.push({
      date: item.scheduled_start || item.created_at,
      icon: item.status === "confirmed" ? "✓" : "□",
      title: item.status === "completed" ? "Servicio realizado" : item.status === "confirmed" ? "Cita confirmada" : "Solicitud registrada",
      body: `${item.service_name || "Servicio D-TEK"} · ${item.vehicle_summary || "Vehículo"}`
    });
  });
  workOrders.forEach((item) => {
    activities.push({
      date: item.scheduled_start || item.created_at,
      icon: "◆",
      title: item.service_name || "Trabajo realizado",
      body: item.recommendations || item.diagnosis || item.vehicle_summary || "Actividad registrada por D-TEK"
    });
  });
  referrals.forEach((item) => {
    activities.push({
      date: item.converted_at || item.created_at,
      icon: item.status === "converted" ? "Q" : "+",
      title: item.status === "converted" ? "Saldo acreditado" : "Recomendación registrada",
      body: item.status === "converted" ? `${formatMoney(item.reward_amount || 100)} disponibles por ${item.referred_name || "tu referido"}.` : `${item.referred_name || "Tu contacto"} está en seguimiento.`
    });
  });

  activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const visible = activities.slice(0, 4);
  if (!visible.length) {
    feed.innerHTML = `<div class="client-empty-copy"><strong>Tu actividad empieza aquí.</strong><p>Cuando agregués un carro o solicités un servicio, vas a ver el movimiento de tu garage.</p></div>`;
    return;
  }
  feed.innerHTML = visible.map((item) => `<article class="profile-activity-item">
    <span class="profile-activity-icon" aria-hidden="true">${clientSafe(item.icon)}</span>
    <div class="profile-activity-copy"><strong>${clientSafe(item.title)}</strong><p>${clientSafe(item.body)}</p><small>${clientSafe(formatDateShort(item.date))}</small></div>
  </article>`).join("");
}

function googleAuthMessage(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("provider") && (message.includes("disabled") || message.includes("not enabled") || message.includes("unsupported"))) {
    return "Google todavía no está habilitado en la configuración de acceso de D-TEK.";
  }
  if (message.includes("redirect") || message.includes("url") || message.includes("origin")) {
    return "La dirección de esta página todavía no está autorizada para entrar con Google.";
  }
  if (message.includes("popup") || message.includes("blocked")) {
    return "El navegador bloqueó la ventana de Google. Permití ventanas emergentes e intentá de nuevo.";
  }
  return "No pudimos abrir el acceso con Google. Revisá la configuración o intentá con correo.";
}

function consumeOAuthRedirectError() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const code = hashParams.get("error_code") || queryParams.get("error_code") || hashParams.get("error") || queryParams.get("error");
  const description = hashParams.get("error_description") || queryParams.get("error_description");
  if (!code && !description) return;
  clientStatus(googleAuthMessage(description || code), "error");
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function loadClientProfile() {
  const holder = clientQs("#clientProfile");
  const session = await getSessionOrNull();
  if (!session) return;

  try {
    const profile = mergeProfilePrefs((await DtekBackend.currentProfile()) || {});
    clientPortalState.profile = profile;
    const contactEmail = profileContactEmail(profile, session);
    const localAccess = isInternalLoginEmail(profile.email || session.user.email);
    if (holder) {
      holder.innerHTML = [
        ["Nombre", profile.full_name || "Pendiente"],
        ["Usuario", profile.username || (localAccess ? "Pendiente" : "Entrás con correo / Google")],
        ["Correo", contactEmail || "No agregado"],
        ["WhatsApp", profile.phone || "Pendiente"],
        ["Dirección frecuente", profile.default_location || "Pendiente"],
        ["Zona frecuente", profile.default_city || "Pendiente"],
        ["Horario preferido", profile.preferred_time_window || "Pendiente"],
        ["Contacto", profile.contact_preference || "WhatsApp"]
      ].map(([label, value]) => `<div class="profile-data-row"><span>${clientSafe(label)}</span><strong data-empty="${/^(Pendiente|No agregado)/.test(value) ? "true" : "false"}">${clientSafe(value)}</strong></div>`).join("");
    }
    renderSocialProfile();
    const values = {
      "#profileFullName": profile.full_name || "",
      "#profilePhone": profile.phone || "",
      "#profileDefaultLocation": profile.default_location || "",
      "#profileDefaultCity": profile.default_city || "",
      "#profilePreferredTime": profile.preferred_time_window || "",
      "#profileContactPreference": profile.contact_preference || "WhatsApp",
      "#profileUsername": profile.username || "",
      "#profileContactEmail": contactEmail || ""
    };
    Object.entries(values).forEach(([selector, value]) => {
      const field = clientQs(selector);
      if (field) field.value = value;
    });
    const usernameField = clientQs("#profileUsername");
    const usernameHelp = clientQs("#profileUsernameHelp");
    if (usernameField) usernameField.disabled = !localAccess;
    if (usernameHelp) usernameHelp.textContent = localAccess
      ? "Podés cambiar el usuario que te dio D-TEK."
      : "Esta cuenta entra con correo o Google.";
    clientQs("#temporaryPasswordNotice")?.classList.toggle("hidden-field", !profile.must_change_password);
  } catch (error) {
    console.warn(error);
    if (holder) holder.innerHTML = renderRetry(friendlyError(), "profile");
  }
}

async function loadClientAppointments() {
  const upcomingHolder = clientQs("#clientAppointments");
  const pastHolder = clientQs("#pastAppointments");
  const session = await getSessionOrNull();
  if (!session) return;

  if (upcomingHolder) upcomingHolder.innerHTML = `<div class="client-loading-copy">Cargando tus citas...</div>`;
  try {
    const appointments = await DtekBackend.listMyAppointments();
    clientPortalState.appointments = appointments || [];
    const upcoming = clientPortalState.appointments.filter((item) => ["pending", "requested", "submitted", "scheduled", "confirmed", "in_progress"].includes(item.status));
    const past = clientPortalState.appointments.filter((item) => ["completed", "cancelled", "canceled"].includes(item.status));
    if (upcomingHolder) upcomingHolder.innerHTML = upcoming.length
      ? upcoming.map((item) => renderAppointmentCard(item)).join("")
      : `<div class="client-empty-copy"><strong>No tenés ninguna cita agendada.</strong><p>Cuando querás, pedí servicio para uno de tus carros.</p><button class="client-btn client-btn-primary" type="button" data-open-client-booking data-vehicle-id="${clientSafe(clientPortalState.activeVehicleId || "")}">Solicitar servicio</button></div>`;
    if (pastHolder) pastHolder.innerHTML = past.length
      ? past.map((item) => renderAppointmentCard(item)).join("")
      : `<div class="client-empty-copy"><strong>Todavía no hay citas pasadas.</strong><p>Las citas realizadas o canceladas aparecerán aquí.</p></div>`;
  } catch (error) {
    console.warn(error);
    if (upcomingHolder) upcomingHolder.innerHTML = renderRetry(friendlyError(), "appointments");
    if (pastHolder) pastHolder.innerHTML = renderRetry(friendlyError(), "appointments");
  }
  renderOverview();
  renderSocialProfile();
}

async function loadClientWorkOrders() {
  const holder = clientQs("#clientWorkOrders");
  const session = await getSessionOrNull();
  if (!session) return;
  if (holder) holder.innerHTML = `<div class="client-loading-copy">Cargando reportes...</div>`;
  try {
    const orders = await DtekBackend.listMyWorkOrders();
    clientPortalState.workOrders = orders || [];
    if (holder) holder.innerHTML = orders.length
      ? orders.map(renderWorkOrder).join("")
      : `<div class="client-empty-copy"><strong>Todavía no hay diagnósticos ni trabajos registrados.</strong><p>Cuando D-TEK complete el primero, aparecerá aquí.</p></div>`;
  } catch (error) {
    console.warn(error);
    if (holder) holder.innerHTML = renderRetry(friendlyError(), "work-orders");
  }
  renderOverview();
  renderSocialProfile();
}

async function loadClientVehicles() {
  const holder = clientQs("#clientVehicles");
  const session = await getSessionOrNull();
  if (!session) return;
  if (holder) holder.innerHTML = `<div class="client-loading-copy">Cargando tus carros...</div>`;
  try {
    const vehicles = mergeVehicleList(await DtekBackend.listMyVehicles());
    clientPortalState.vehicles = vehicles;
    if (!vehicles.some((vehicle) => String(vehicle.id) === String(clientPortalState.activeVehicleId))) {
      clientPortalState.activeVehicleId = vehicles[0]?.id || null;
    }
    renderVehicleWorkspace();
    renderOverview();
    if (clientPortalState.activeVehicleId) {
      await openVehicleProfile(clientPortalState.activeVehicleId, { navigate: false, refreshHistory: true });
    }
  } catch (error) {
    console.warn(error);
    if (holder) holder.innerHTML = renderRetry(friendlyError(), "vehicles");
    renderOverview();
  }
  renderSocialProfile();
}

function renderPointsActivity(items = []) {
  const holder = clientQs("#pointsActivity");
  if (!holder) return;
  holder.innerHTML = items.length ? items.map((item) => `<article class="points-list-item">
    <span class="points-list-icon ${Number(item.points) > 0 ? "positive" : "negative"}">${Number(item.points) > 0 ? "+" : ""}${clientSafe(item.points)}</span>
    <div><strong>${clientSafe(item.description || "Puntos D-TEK")}</strong><small>${clientSafe(formatDateShort(item.created_at))}</small></div>
    <b>${clientSafe(formatPoints(item.points))}</b>
  </article>`).join("") : `<div class="client-empty-copy"><strong>Todavía no hay puntos registrados.</strong><p>Ganás 1 punto por cada Q10 en servicios.</p></div>`;
}

function renderRedemptions(items = []) {
  const holder = clientQs("#redemptionList");
  if (!holder) return;
  const labels = { requested: "Solicitado", fulfilled: "Entregado", cancelled: "Cancelado" };
  holder.innerHTML = items.length ? items.map((item) => `<article class="points-list-item">
    <span class="points-list-icon reward">◇</span>
    <div><strong>${clientSafe(item.reward_name || "Canje D-TEK")}</strong><small>${clientSafe(labels[item.status] || item.status)}</small></div>
    <b>-${clientSafe(item.points_cost)}</b>
  </article>`).join("") : `<div class="client-empty-copy"><strong>Todavía no usaste puntos.</strong><p>Los premios que solicités aparecerán aquí.</p></div>`;
}

function renderRewardCatalog(rewards = []) {
  const holder = clientQs("#rewardCatalog");
  if (!holder) return;
  const balance = Number(clientPortalState.loyalty?.points_balance || 0);
  holder.innerHTML = rewards.length ? rewards.map((reward) => {
    const canRedeem = Boolean(reward.can_redeem) || balance >= Number(reward.points_cost || 0);
    return `<article class="reward-card ${canRedeem ? "ready" : "locked"}">
      <span class="reward-icon">${clientSafe(reward.icon || "◇")}</span>
      <strong>${clientSafe(reward.name)}</strong>
      <b>${clientSafe(reward.points_cost)} pts</b>
      <button type="button" data-redeem-reward="${clientSafe(reward.id)}" ${canRedeem ? "" : "disabled"}>${canRedeem ? "Usar puntos" : `Te faltan ${Math.max(0, Number(reward.points_cost) - balance)}`}</button>
    </article>`;
  }).join("") : `<div class="client-empty-copy"><strong>Canjes no disponibles</strong></div>`;
}

function renderLoyaltyState() {
  const points = clientPortalState.loyalty || {};
  const balance = Number(points.points_balance || 0);
  setText("#pointsBalance", balance);
  setText("#servicePoints", points.service_points || 0);
  setText("#referralPoints", points.referral_points || 0);

  const rewards = clientPortalState.rewards || [];
  const next = rewards.filter((item) => Number(item.points_cost) > balance).sort((a,b) => a.points_cost - b.points_cost)[0]
    || rewards.slice().sort((a,b) => b.points_cost - a.points_cost)[0];
  if (next) {
    const target = Number(next.points_cost || 1);
    const progress = Math.min(100, Math.round((balance / target) * 100));
    const box = clientQs("#pointsNextReward");
    if (box) box.innerHTML = `<span>Próximo premio</span><strong>Te faltan ${Math.max(0, target - balance)} puntos para ${clientSafe(next.name)}</strong><div class="points-progress"><i id="pointsProgressBar" style="width:${progress}%"></i></div>`;
  }
  renderRewardCatalog(rewards);
  renderPointsActivity(clientPortalState.pointsActivity || []);
  renderRedemptions(clientPortalState.redemptions || []);
  renderGarageToolsDrawer();
}

async function loadClientLoyalty() {
  const referralsHolder = clientQs("#clientReferrals");
  const session = await getSessionOrNull();
  if (!session) return;
  if (referralsHolder) referralsHolder.innerHTML = `<div class="client-loading-copy">Cargando...</div>`;

  try {
    try { await DtekBackend.claimMyReferrals(); } catch (claimError) { console.warn(claimError); }
    let summary;
    try {
      [summary, clientPortalState.rewards, clientPortalState.pointsActivity, clientPortalState.redemptions, clientPortalState.referrals] = await Promise.all([
        DtekBackend.getMyPointsSummary(),
        DtekBackend.listMyRewards(),
        DtekBackend.listMyPointsActivity(),
        DtekBackend.listMyRedemptions(),
        DtekBackend.listMyReferrals()
      ]);
      clientPortalState.loyalty = {
        points_balance: Number(summary?.points_balance || 0),
        points_earned: Number(summary?.points_earned || 0),
        points_used: Number(summary?.points_used || 0),
        service_points: Number(summary?.service_points || 0),
        referral_points: Number(summary?.referral_points || 0),
        referrals_total: Number(summary?.referrals_total || 0),
        referrals_converted: Number(summary?.referrals_converted || 0),
        referrals_pending: Number(summary?.referrals_pending || 0)
      };
    } catch (pointsError) {
      console.warn("Puntos v27 no activos:", pointsError);
      const [legacy, referrals] = await Promise.all([DtekBackend.getMyLoyaltySummary(), DtekBackend.listMyReferrals()]);
      clientPortalState.referrals = referrals || [];
      clientPortalState.loyalty = {
        points_balance: Number(legacy?.balance || 0), points_earned: Number(legacy?.earned || 0), points_used: Number(legacy?.used || 0),
        service_points: 0, referral_points: Number(legacy?.earned || 0),
        referrals_total: Number(legacy?.referrals_total || 0), referrals_converted: Number(legacy?.referrals_converted || 0), referrals_pending: Number(legacy?.referrals_pending || 0)
      };
      clientPortalState.rewards = DEFAULT_REWARDS;
      panelStatus("#pointsStatus", "Puntos todavía no están activos.", "info");
    }

    if (referralsHolder) referralsHolder.innerHTML = clientPortalState.referrals.length
      ? clientPortalState.referrals.map(renderReferral).join("")
      : `<div class="client-empty-copy"><strong>Sin referidos</strong></div>`;
    renderLoyaltyState();
  } catch (error) {
    console.warn(error);
    if (referralsHolder) referralsHolder.innerHTML = renderRetry(friendlyError(), "loyalty");
  }
  renderOverview();
  renderSocialProfile();
}

async function refreshClientPortal() {
  const session = await getSessionOrNull();
  showAuthGate(!session);
  if (!session) return;

  clientPortalState.loading = true;
  renderOverview();
  await Promise.allSettled([
    loadClientProfile(),
    loadClientAppointments(),
    loadClientWorkOrders()
  ]);
  await loadClientVehicles();
  await loadClientLoyalty();
  clientPortalState.loading = false;
  renderOverview();
  renderSocialProfile();
}

function openVehicleModal() {
  const modal = clientQs("#vehicleModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("client-modal-open");
  setVehicleFormStep(1);
  window.setTimeout(() => clientQs("#vehicleNicknameClient")?.focus(), 50);
}

function closeVehicleModal() {
  const modal = clientQs("#vehicleModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("client-modal-open");
}

function setVehicleFormStep(step) {
  clientQsa("[data-vehicle-form-step]").forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.vehicleFormStep) === Number(step)));
  clientQsa("[data-step-indicator]").forEach((indicator) => indicator.classList.toggle("active", Number(indicator.dataset.stepIndicator) === Number(step)));
}

function openAccountMenu() {
  const menu = clientQs("#clientAccountMenu");
  const trigger = clientQs("#clientAccountToggle");
  if (!menu || !trigger) return;
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
}

function closeAccountMenu() {
  const menu = clientQs("#clientAccountMenu");
  const trigger = clientQs("#clientAccountToggle");
  if (!menu || !trigger) return;
  menu.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
}

function initTabs() {
  clientQsa("[data-appointment-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.appointmentTab;
      clientQsa("[data-appointment-tab]").forEach((item) => item.classList.toggle("active", item === button));
      clientQsa("[data-appointment-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.appointmentTabPanel === tab));
    });
  });

  clientQsa("[data-vehicle-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.vehicleTab;
      clientQsa("[data-vehicle-tab]").forEach((item) => item.classList.toggle("active", item === button));
      clientQsa("[data-vehicle-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.vehicleTabPanel === tab));
    });
  });
}

function initClientPortal() {
  setActiveSection("overview");
  initTabs();
  consumeOAuthRedirectError();
  refreshClientPortal();

  if (DtekBackend?.client?.()) {
    DtekBackend.client().auth.onAuthStateChange(() => refreshClientPortal());
  }

  clientQs("#clientLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const identifier = clientQs("#clientIdentifier")?.value.trim() || "";
    try {
      clientStatus("Entrando a tu cuenta...", "info");
      clientQs("#clientSignupOffer")?.classList.add("hidden-field");
      await DtekBackend.signIn(identifier, clientQs("#clientPassword").value);
      closeSignupPanel();
      clientStatus("", "info");
      try { await DtekBackend.claimMyAppointments(); } catch (error) { console.warn(error); }
      try { await DtekBackend.claimMyReferrals(); } catch (error) { console.warn(error); }
      await refreshClientPortal();
    } catch (error) {
      console.warn(error);
      clientStatus(accessErrorMessage(error), "error");
      showSignupOffer(identifier);
    }
  });

  clientQs("#clientForgotPassword")?.addEventListener("click", async () => {
    const identifier = clientQs("#clientIdentifier")?.value.trim() || "";
    if (!identifier) {
      clientStatus("Escribí primero tu correo o usuario.", "error");
      clientQs("#clientIdentifier")?.focus();
      return;
    }
    try {
      clientStatus("Enviando enlace seguro...", "info");
      await DtekBackend.requestPasswordReset(identifier);
      clientStatus("Revisá tu correo. Ahí vas a poder crear una contraseña nueva.", "ok");
    } catch (error) {
      console.warn("Password recovery:", error);
      clientStatus(error.message || "No se pudo enviar el enlace.", "error");
    }
  });

  clientQs("#googleLoginBtn")?.addEventListener("click", async () => {
    try {
      clientStatus("Abriendo Google...", "info");
      await DtekBackend.signInWithGoogle();
    } catch (error) {
      console.warn("Google OAuth:", error);
      clientStatus(googleAuthMessage(error), "error");
    }
  });

  clientQs("#openClientSignup")?.addEventListener("click", () => openSignupPanel());
  clientQs("#acceptClientSignupOffer")?.addEventListener("click", () => openSignupPanel());
  clientQs("#closeClientSignup")?.addEventListener("click", closeSignupPanel);

  clientQs("#clientSignupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.target.querySelector('button[type="submit"]');
    const username = clientQs("#clientSignupUsername")?.value.trim() || "";
    const contactEmail = clientQs("#clientSignupEmail")?.value.trim() || "";
    const password = clientQs("#clientSignupPassword")?.value || "";
    const confirmation = clientQs("#clientSignupPasswordConfirm")?.value || "";
    if (password !== confirmation) {
      signupStatus("Las contraseñas no coinciden.", "error");
      return;
    }
    try {
      if (submit) { submit.disabled = true; submit.textContent = "Creando acceso..."; }
      signupStatus("Creando tu Garage D-TEK...", "info");
      const result = await DtekBackend.signUpLocal({ username, contactEmail, password });
      if (!result?.session) {
        signupStatus("El acceso fue creado, pero D-TEK todavía debe activarlo. Escribinos por WhatsApp.", "info");
        return;
      }
      signupStatus("Cuenta creada. Ya estás entrando...", "ok");
      closeSignupPanel();
      clientStatus("", "info");
      try { await DtekBackend.claimMyAppointments(); } catch (error) { console.warn(error); }
      await refreshClientPortal();
    } catch (error) {
      console.warn(error);
      signupStatus(accessErrorMessage(error), "error");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Crear cuenta y entrar"; }
    }
  });

  clientQs("#clientLogout")?.addEventListener("click", async () => {
    await DtekBackend.signOut();
    closeAccountMenu();
    closeSignupPanel();
    clientStatus("", "info");
    await refreshClientPortal();
  });

  clientQsa("[data-client-section]").forEach((button) => {
    button.addEventListener("click", () => setActiveSection(button.dataset.clientSection));
  });

  clientQs("#garageTimelineToggle")?.addEventListener("click", () => {
    const expanded = clientQs("#garageTimelineToggle")?.getAttribute("aria-expanded") === "true";
    setGarageTimelineExpanded(!expanded);
  });

  clientQs("#clientRefreshAll")?.addEventListener("click", refreshClientPortal);
  clientQs("#clientRefreshVehicles")?.addEventListener("click", loadClientVehicles);
  clientQs("#clientRefreshAppointments")?.addEventListener("click", loadClientAppointments);
  clientQs("#clientRefreshWorkOrders")?.addEventListener("click", loadClientWorkOrders);
  clientQs("#clientRefreshReferrals")?.addEventListener("click", loadClientLoyalty);

  clientQs("#profileEditToggle")?.addEventListener("click", () => {
    const panel = clientQs("#profileEditPanel");
    if (!panel) return;
    panel.open = true;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => clientQs("#profileFullName")?.focus(), 350);
  });

  clientQs("#clientAccountToggle")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = clientQs("#clientAccountMenu");
    if (menu?.hidden) openAccountMenu(); else closeAccountMenu();
  });
  ["#clientToolsTrigger", "#clientActiveCarTrigger", "#clientCarsRailTrigger"].forEach((selector) => {
    clientQs(selector)?.addEventListener("click", (event) => {
      const open = clientQs("#clientToolsDrawer")?.getAttribute("aria-hidden") === "false";
      if (open) closeToolsDrawer({ restoreFocus: true }); else openToolsDrawer(event.currentTarget);
    });
  });
  clientQsa("[data-open-maintenance-drawer], #clientMaintenanceTrigger").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const open = clientQs("#clientMaintenanceDrawer")?.getAttribute("aria-hidden") === "false";
      if (open) closeMaintenanceDrawer({ restoreFocus: true }); else openMaintenanceDrawer(event.currentTarget);
    });
  });
  installSideDrawerGestures();
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#clientAccountMenu") && !event.target.closest("#clientAccountToggle")) closeAccountMenu();
    if (!event.target.closest("#garageTimelineDock")) setGarageTimelineExpanded(false);
    if (event.target.closest("[data-close-tools-drawer]")) closeToolsDrawer({ restoreFocus: true });
    if (event.target.closest("[data-close-maintenance-drawer]")) closeMaintenanceDrawer({ restoreFocus: true });
    if (event.target.closest("#clientMaintenanceDrawer [data-open-client-booking]")) closeMaintenanceDrawer();
    if (event.target.closest("[data-close-maintenance-after-action]")) closeMaintenanceDrawer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (clientQs("#clientMaintenanceDrawer")?.getAttribute("aria-hidden") === "false") closeMaintenanceDrawer({ restoreFocus: true });
    else if (clientQs("#clientToolsDrawer")?.getAttribute("aria-hidden") === "false") closeToolsDrawer({ restoreFocus: true });
  });

document.addEventListener("click", async (event) => {
  const directTab = event.target.closest("[data-vehicle-tab-open]");
  if (directTab) {
    const target = directTab.dataset.vehicleTabOpen;
    clientQsa("[data-vehicle-tab]").forEach((button) => button.classList.toggle("active", button.dataset.vehicleTab === target));
    clientQsa("[data-vehicle-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.vehicleTabPanel === target));
    clientQs(`[data-vehicle-tab-panel="${target}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const radarItem = event.target.closest("[data-radar-component]");
  if (radarItem) {
    closeMaintenanceDrawer();
    const system = [...clientQsa(".care-system")].find((item) => item.querySelector(`[data-care-component="${radarItem.dataset.radarComponent}"]`));
    if (system) {
      system.open = true;
      system.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      clientQs("#vehicleCareSystems")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const toolsAction = event.target.closest("[data-tools-action]");
  if (toolsAction?.dataset.toolsAction === "mileage") {
    closeToolsDrawer();
    if (clientPortalState.activeVehicleId) {
      await openVehicleProfile(clientPortalState.activeVehicleId, { navigate: true, refreshHistory: false });
      clientQsa("[data-vehicle-tab]").forEach((button) => button.classList.toggle("active", button.dataset.vehicleTab === "technical"));
      clientQsa("[data-vehicle-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.vehicleTabPanel === "technical"));
      clientQs('[data-vehicle-tab-panel="technical"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => clientQs("#vehicleCareMileage")?.focus(), 350);
    }
  }

  const healthJump = event.target.closest("[data-vehicle-tab-jump]");
  if (healthJump) {
    const target = healthJump.dataset.vehicleTabJump;
    clientQsa("[data-vehicle-tab]").forEach((button) => button.classList.toggle("active", button.dataset.vehicleTab === target));
    clientQsa("[data-vehicle-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.vehicleTabPanel === target));
    clientQs("#vehicleCareMileage")?.focus();
  }
    const modalOpen = event.target.closest("[data-open-vehicle-modal]");
    if (modalOpen) {
      closeToolsDrawer();
      openVehicleModal();
    }

    if (event.target.closest("[data-close-vehicle-modal]")) closeVehicleModal();

    const vehicleButton = event.target.closest("[data-open-vehicle]");
    if (vehicleButton) await openVehicleProfile(vehicleButton.dataset.openVehicle);

    const quickVehicle = event.target.closest("[data-quick-vehicle]");
    if (quickVehicle && String(quickVehicle.dataset.quickVehicle) !== String(clientPortalState.activeVehicleId)) {
      await openVehicleProfile(quickVehicle.dataset.quickVehicle, { navigate: false, refreshHistory: true });
      closeToolsDrawer();
    } else if (quickVehicle) {
      closeToolsDrawer({ restoreFocus: true });
    }

    const overviewVehicle = event.target.closest("[data-select-overview-vehicle]");
    if (overviewVehicle) {
      clientPortalState.activeVehicleId = overviewVehicle.dataset.selectOverviewVehicle;
      renderOverview();
      renderVehicleWorkspace();
      setGlobalServiceLinks(clientPortalState.activeVehicleId);
    }

    const pointsTab = event.target.closest("[data-points-list]");
    if (pointsTab) {
      const target = pointsTab.dataset.pointsList;
      clientQsa("[data-points-list]").forEach((button) => button.classList.toggle("active", button === pointsTab));
      clientQsa("[data-points-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.pointsPanel === target));
    }

    const rewardButton = event.target.closest("[data-redeem-reward]");
    if (rewardButton && !rewardButton.disabled) {
      const reward = (clientPortalState.rewards || []).find((item) => item.id === rewardButton.dataset.redeemReward);
      if (!reward) return;
      if (!confirm(`¿Usar ${reward.points_cost} puntos para ${reward.name}?`)) return;
      try {
        rewardButton.disabled = true;
        rewardButton.textContent = "Solicitando...";
        await DtekBackend.redeemReward(reward.id);
        panelStatus("#pointsStatus", `${reward.name} solicitado.`, "ok");
        await loadClientLoyalty();
      } catch (error) {
        console.warn(error);
        panelStatus("#pointsStatus", error?.message || "No pudimos hacer el canje.", "error");
      }
    }

    const retry = event.target.closest("[data-retry-load]");
    if (retry) {
      const action = retry.dataset.retryLoad;
      if (action === "profile") await loadClientProfile();
      if (action === "appointments") await loadClientAppointments();
      if (action === "work-orders") await loadClientWorkOrders();
      if (action === "vehicles") await loadClientVehicles();
      if (action === "loyalty") await loadClientLoyalty();
      if (action === "vehicle-history" && clientPortalState.activeVehicleId) await openVehicleProfile(clientPortalState.activeVehicleId, { navigate: false, refreshHistory: true });
    }
  });

  clientQs("#vehicleNextStep")?.addEventListener("click", () => {
    const required = [clientQs("#vehicleBrandClient"), clientQs("#vehicleLineClient")].filter(Boolean);
    const valid = required.every((field) => field.reportValidity());
    if (valid) setVehicleFormStep(2);
  });
  clientQs("#vehiclePrevStep")?.addEventListener("click", () => setVehicleFormStep(1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeVehicleModal();
      closeAccountMenu();
      closeToolsDrawer();
      setGarageTimelineExpanded(false);
    }
  });

  clientQs("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const prefs = {
        default_location: clientQs("#profileDefaultLocation")?.value.trim() || "",
        default_city: clientQs("#profileDefaultCity")?.value.trim() || "",
        preferred_time_window: clientQs("#profilePreferredTime")?.value || "",
        contact_preference: clientQs("#profileContactPreference")?.value || "WhatsApp"
      };
      saveClientPrefs(prefs);
      await DtekBackend.updateMyProfile(clientQs("#profileFullName").value.trim(), clientQs("#profilePhone").value.trim(), prefs);
      panelStatus("#profileFormStatus", "Listo. Tu perfil quedó actualizado.", "ok");
      await loadClientProfile();
      renderOverview();
    } catch (error) {
      console.warn(error);
      panelStatus("#profileFormStatus", "No pudimos guardar los cambios. Intentá de nuevo.", "error");
    }
  });

  clientQs("#accessForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await DtekBackend.updateMyAccess(
        clientQs("#profileUsername")?.value.trim() || "",
        clientQs("#profileContactEmail")?.value.trim() || ""
      );
      panelStatus("#accessFormStatus", "Listo. Tu forma de entrar quedó actualizada.", "ok");
      await loadClientProfile();
    } catch (error) {
      console.warn(error);
      panelStatus("#accessFormStatus", accessErrorMessage(error), "error");
    }
  });

  clientQs("#passwordForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = clientQs("#profileNewPassword")?.value || "";
    const confirmation = clientQs("#profileNewPasswordConfirm")?.value || "";
    if (password !== confirmation) {
      panelStatus("#passwordFormStatus", "Las contraseñas no coinciden.", "error");
      return;
    }
    try {
      await DtekBackend.updateMyPassword(password);
      event.target.reset();
      panelStatus("#passwordFormStatus", "Contraseña cambiada. Ya solo vos la conocés.", "ok");
      await loadClientProfile();
    } catch (error) {
      console.warn(error);
      panelStatus("#passwordFormStatus", accessErrorMessage(error), "error");
    }
  });

  clientQs("#claimAppointments")?.addEventListener("click", async () => {
    try {
      const count = await DtekBackend.claimMyAppointments();
      panelStatus("#claimStatus", `${count} cita(s) vinculada(s) a tu cuenta.`, "ok");
      await loadClientAppointments();
    } catch (error) {
      console.warn(error);
      panelStatus("#claimStatus", "No pudimos vincular las citas en este momento.", "error");
    }
  });

  clientQs("#clientReferralForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.target.querySelector('button[type="submit"]');
    const name = clientQs("#clientReferredName").value.trim();
    try {
      if (submit) { submit.disabled = true; submit.textContent = "Registrando..."; }
      await DtekBackend.createMyReferral({
        referred_name: name,
        referred_phone: normalizeGtPhone(clientQs("#clientReferredPhone").value),
        referred_vehicle: clientQs("#clientReferredVehicle").value.trim(),
        notes: clientQs("#clientReferralNotes").value.trim()
      });
      event.target.reset();
      panelStatus("#clientReferralStatus", `¡Listo! Cuando ${name} complete su primer trabajo, ganás 100 puntos.`, "ok");
      await loadClientLoyalty();
    } catch (error) {
      console.warn(error);
      panelStatus("#clientReferralStatus", "No pudimos registrar la recomendación. Intentá de nuevo.", "error");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Registrar"; }
    }
  });

  clientQs("#shareReferralWhatsApp")?.addEventListener("click", () => {
    const origin = window.location.origin && window.location.origin.startsWith("http") ? window.location.origin : "https://dtekpro.netlify.app";
    const message = `Te recomiendo D-TEK GT: ${origin}/index.html`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });

  clientQs("#vehicleForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.target.querySelector('button[type="submit"]');
    try {
      if (submit) { submit.disabled = true; submit.textContent = "Guardando..."; }
      const created = await DtekBackend.createMyVehicle({
        nickname: clientQs("#vehicleNicknameClient")?.value.trim() || "",
        brand: clientQs("#vehicleBrandClient").value.trim(),
        line: clientQs("#vehicleLineClient").value.trim(),
        year: clientQs("#vehicleYearClient").value,
        plate: clientQs("#vehiclePlateClient").value.trim(),
        vin: clientQs("#vehicleVinClient").value.trim(),
        mileage: clientQs("#vehicleMileageClient")?.value || "",
        engine: clientQs("#vehicleEngineClient")?.value.trim() || "",
        transmission: clientQs("#vehicleTransmissionClient")?.value.trim() || "",
        use_type: clientQs("#vehicleUseTypeClient")?.value || "",
        notes: clientQs("#vehicleNotesClient").value.trim()
      });
      event.target.reset();
      panelStatus("#vehicleFormStatus", "Listo. Tu carro ya quedó guardado en Garage D-TEK.", "ok");
      if (created?.id) clientPortalState.activeVehicleId = created.id;
      await loadClientVehicles();
      setActiveSection("vehicles");
      window.setTimeout(closeVehicleModal, 500);
    } catch (error) {
      console.warn(error);
      panelStatus("#vehicleFormStatus", "No pudimos guardar el carro. Revisá los datos e intentá de nuevo.", "error");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Guardar vehículo"; }
    }
  });

  clientQs("#vehicleProfileRefresh")?.addEventListener("click", async () => {
    if (clientPortalState.activeVehicleId) await openVehicleProfile(clientPortalState.activeVehicleId, { navigate: false, refreshHistory: true });
  });

  clientQs("#vehicleCareForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const vehicleId = clientQs("#vehicleCareId")?.value;
    const prefs = {
      nickname: clientQs("#vehicleCareNickname")?.value.trim() || "",
      mileage: clientQs("#vehicleCareMileage")?.value || "",
      engine: clientQs("#vehicleCareEngine")?.value.trim() || "",
      transmission: clientQs("#vehicleCareTransmission")?.value.trim() || "",
      use_type: clientQs("#vehicleCareUseType")?.value || "",
      notes: clientQs("#vehicleCareNotes")?.value.trim() || ""
    };
    try {
      saveVehicleCarePrefs(vehicleId, prefs);
      await DtekBackend.updateMyVehicleCare({ vehicle_id: vehicleId, ...prefs });
      panelStatus("#vehicleCareStatus", "Listo. Los datos del carro quedaron actualizados.", "ok");
      await loadClientVehicles();
      await openVehicleProfile(vehicleId, { navigate: false, refreshHistory: true });
    } catch (error) {
      console.warn(error);
      saveVehicleCarePrefs(vehicleId, prefs);
      panelStatus("#vehicleCareStatus", "Guardado en este navegador. Lo sincronizaremos cuando esté disponible.", "info");
      await loadClientVehicles();
      await openVehicleProfile(vehicleId, { navigate: false, refreshHistory: false });
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initClientPortal();
  const updateCompactNavigation = () => {
    document.body.classList.toggle("client-nav-condensed", window.scrollY > 96);
  };
  updateCompactNavigation();
  window.addEventListener("scroll", updateCompactNavigation, { passive: true });
});
