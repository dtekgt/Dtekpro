/* D-TEK GT Web OS v30.3 — Admin backend + Pecera */

const adminQs = (selector) => document.querySelector(selector);
let dtekAdminAppointmentsCache = [];
let dtekAdminReferralsCache = [];
let dtekAdminRedemptionsCache = [];
let dtekAdminFilter = "all";
let dtekReferralFilter = "all";

function adminSafe(value) {
  return String(value ?? "").replace(/[<>&"]/g, (char) => ({"<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;"}[char]));
}

function backendStatus(message, type = "info") {
  const box = adminQs("#backendAuthStatus");
  if (box) box.innerHTML = `<p class="status-${type}">${adminSafe(message)}</p>`;
}

function blockedStatus(message, type = "info") {
  const box = adminQs("#blockedStatus");
  if (box) box.innerHTML = `<p class="status-${type}">${adminSafe(message)}</p>`;
}

function provisionStatus(message, type = "info") {
  const box = adminQs("#clientProvisionStatus");
  if (box) box.innerHTML = `<p class="status-${type}">${adminSafe(message)}</p>`;
}

function normalizeProvisionPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 8 ? `502${digits}` : digits;
}

function dtekStatusLabel(status) {
  const labels = {
    requested: "Solicitada",
    confirmed: "Confirmada",
    completed: "Realizada",
    cancelled: "Cancelada"
  };
  return labels[status] || status || "Solicitada";
}

function dtekReferralStatusLabel(status) {
  const labels = {
    submitted: "Nuevo",
    contacted: "Contactado",
    scheduled: "Con cita",
    converted: "Convertido",
    discarded: "Descartado"
  };
  return labels[status] || status || "Nuevo";
}

function dtekMoney(value) {
  return `Q${Number(value || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dtekFormatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-GT", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function dtekFormatTimeRange(item) {
  const start = item.scheduled_start ? new Date(item.scheduled_start) : null;
  const end = item.scheduled_end ? new Date(item.scheduled_end) : null;
  if (!start || !end) return "Sin hora";
  return `${start.toLocaleTimeString("es-GT", { hour:"2-digit", minute:"2-digit" })} – ${end.toLocaleTimeString("es-GT", { hour:"2-digit", minute:"2-digit" })}`;
}

function renderBackendSystemStatus(extra = "") {
  const box = adminQs("#backendSystemStatus");
  if (!box) return;
  const cfg = window.DTEK_CONFIG || {};
  box.innerHTML = `
    <div class="summary-line"><span>Modo Supabase</span><strong>${cfg.useSupabase ? "Activo" : "Demo/local"}</strong></div>
    <div class="summary-line"><span>URL</span><strong>${cfg.supabaseUrl ? "Configurada" : "Pendiente"}</strong></div>
    <div class="summary-line"><span>Anon Key</span><strong>${cfg.supabaseAnonKey ? "Configurada" : "Pendiente"}</strong></div>
    <div class="summary-line"><span>Cliente JS</span><strong>${window.supabase ? "Cargado" : "No cargado"}</strong></div>
    ${extra ? `<p class="muted">${adminSafe(extra)}</p>` : ""}
  `;
}

function withTimeout(promise, ms, label = "operación") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Tiempo agotado al cargar ${label}. Revisá permisos/RLS o conexión.`)), ms))
  ]);
}


function dtekZapierEnabled() {
  return Boolean(window.DTEK_ZAPIER_ENABLED && String(window.DTEK_ZAPIER_WEBHOOK_URL || "").trim());
}

async function dtekSendZapierEvent(eventType, payload = {}) {
  if (!dtekZapierEnabled()) return { skipped: true };
  const url = String(window.DTEK_ZAPIER_WEBHOOK_URL || "").trim();
  const body = {
    eventType,
    source: "DTEK Web OS Admin",
    timestamp: new Date().toISOString(),
    ownerEmail: window.DTEK_OWNER_EMAIL || window.DTEK_CONFIG?.ownerEmail || "",
    ...payload
  };
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    console.info("DTEK_ZAPIER_EVENT_SENT", eventType, body);
    return { ok: true };
  } catch (error) {
    console.warn("DTEK_ZAPIER_EVENT_FAILED", error);
    return { ok: false, error };
  }
}

function dtekWhatsAppClientLink(item) {
  const phone = String(item.client_phone || "").replace(/\D/g, "");
  if (!phone) return "#";
  const message = `Hola ${item.client_name || ""}, te escribe D-TEK GT por tu solicitud de ${item.service_name || item.service_id || "servicio"}.\n\nFecha: ${dtekFormatDateTime(item.scheduled_start)}\nEstado: ${dtekStatusLabel(item.status)}\n\nQuedo atento para coordinar detalles.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function dtekWhatsAppReferralLink(phone, name, referrerName = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "#";
  const message = `Hola ${name || ""}, te escribe D-TEK GT. ${referrerName ? `${referrerName} nos compartió tu contacto porque pensó que podíamos ayudarte con tu vehículo.` : "Nos compartieron tu contacto porque quizá podemos ayudarte con tu vehículo."} ¿Qué problema o servicio necesitás revisar?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function referralCard(item) {
  const status = item.status || "submitted";
  const credit = status === "converted" ? "100 puntos acreditados" : "100 puntos al convertir";
  return `
    <article class="memory-item referral-admin-card ${adminSafe(status)}">
      <div class="memory-item-main">
        <div>
          <strong>${adminSafe(item.referred_name || "Recomendado")}</strong>
          <small>${adminSafe(item.referred_phone || "Sin teléfono")} · ${adminSafe(item.referred_vehicle || "Vehículo pendiente")}</small>
          <small>Lo recomienda: ${adminSafe(item.referrer_name || "—")} · ${adminSafe(item.referrer_phone || "—")}</small>
          <small>${adminSafe(credit)} · ${adminSafe(dtekFormatDateTime(item.created_at))}</small>
        </div>
        <span class="status-pill ${adminSafe(status)}">${adminSafe(dtekReferralStatusLabel(status))}</span>
      </div>
      ${item.notes ? `<div class="referral-admin-note"><span>Nota</span><strong>${adminSafe(item.notes)}</strong></div>` : ""}
      <div class="memory-actions referral-admin-actions">
        <button type="button" data-referral-status="contacted" data-referral-id="${adminSafe(item.id)}">Contactado</button>
        <button type="button" data-referral-status="scheduled" data-referral-id="${adminSafe(item.id)}">Con cita</button>
        <button type="button" data-referral-status="converted" data-referral-id="${adminSafe(item.id)}">Convertir +100 pts</button>
        <button type="button" data-referral-status="discarded" data-referral-id="${adminSafe(item.id)}">Descartar</button>
        ${item.referrer_id ? `<button type="button" data-points-adjust="${adminSafe(item.referrer_id)}" data-referrer-name="${adminSafe(item.referrer_name || "Cliente")}">Ajustar puntos</button>` : ""}
        <a class="wa-action" href="${adminSafe(dtekWhatsAppReferralLink(item.referred_phone, item.referred_name, item.referrer_name))}" target="_blank" rel="noopener noreferrer">WhatsApp recomendado</a>
        <a class="wa-action" href="${adminSafe(dtekWhatsAppReferralLink(item.referrer_phone, item.referrer_name))}" target="_blank" rel="noopener noreferrer">WhatsApp referente</a>
      </div>
    </article>`;
}

function renderReferralMetrics(items) {
  const box = adminQs("#backendReferralMetrics");
  if (!box) return;
  const counts = items.reduce((acc, item) => {
    acc[item.status || "submitted"] = (acc[item.status || "submitted"] || 0) + 1;
    return acc;
  }, {});
  const credited = items.filter(item => item.credit_status === "credited").reduce((sum, item) => sum + Number(item.reward_amount || 0), 0);
  box.innerHTML = [
    ["Nuevos", counts.submitted || 0],
    ["Contactados", counts.contacted || 0],
    ["Con cita", counts.scheduled || 0],
    ["Convertidos", counts.converted || 0],
    ["Puntos", (counts.converted || 0) * 100]
  ].map(([label, value]) => `<div class="metric-card"><span>${adminSafe(label)}</span><strong>${adminSafe(value)}</strong></div>`).join("");
}

function renderReferralsList(items) {
  const holder = adminQs("#backendReferrals");
  if (!holder) return;
  const filtered = dtekReferralFilter === "all" ? items : items.filter(item => (item.status || "submitted") === dtekReferralFilter);
  holder.innerHTML = filtered.length ? filtered.map(referralCard).join("") : `<p class="memory-empty">No hay referidos para este filtro.</p>`;
}

function redemptionCard(item) {
  const labels = { requested: "Solicitado", fulfilled: "Entregado", cancelled: "Cancelado" };
  return `<article class="memory-item">
    <div class="memory-item-main"><div><strong>${adminSafe(item.reward_name || "Canje D-TEK")}</strong><small>${adminSafe(item.client_name || "Cliente")} · ${adminSafe(item.client_phone || item.client_email || "Sin contacto")}</small><small>${adminSafe(item.points_cost)} puntos · ${adminSafe(dtekFormatDateTime(item.created_at))}</small></div><span class="status-pill ${adminSafe(item.status)}">${adminSafe(labels[item.status] || item.status)}</span></div>
    <div class="memory-actions">
      <button type="button" data-redemption-status="fulfilled" data-redemption-id="${adminSafe(item.id)}">Entregado</button>
      <button type="button" data-redemption-status="cancelled" data-redemption-id="${adminSafe(item.id)}">Cancelar y devolver</button>
    </div>
  </article>`;
}

function renderRedemptionsList(items) {
  const holder = adminQs("#backendRedemptions");
  if (!holder) return;
  holder.innerHTML = items.length ? items.map(redemptionCard).join("") : `<p class="memory-empty">No hay canjes.</p>`;
}

function availableStatusActions(status) {
  const transitions = {
    requested: [["confirmed", "Confirmar"], ["cancelled", "Cancelar"]],
    confirmed: [["completed", "Realizada"], ["cancelled", "Cancelar"]],
    completed: [],
    cancelled: []
  };
  return transitions[status] || transitions.requested;
}

function appointmentUrgencyGroup(item, now = new Date()) {
  const start = item.scheduled_start ? new Date(item.scheduled_start) : null;
  if (!start || Number.isNaN(start.getTime())) return "later";
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startDay - today) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays <= 7) return "soon";
  return "later";
}

function appointmentCard(item) {
  const serviceName = item.service_name || item.service_id || "Servicio";
  const vehicleSummary = item.vehicle_summary || [item.vehicle_brand, item.vehicle_line, item.vehicle_year].filter(Boolean).join(" ") || "Vehículo sin datos";
  const status = item.status || "requested";
  const statusButtons = availableStatusActions(status)
    .map(([value, label]) => `<button type="button" data-backend-status="${adminSafe(value)}" data-id="${adminSafe(item.id)}">${adminSafe(label)}</button>`)
    .join("");
  return `
    <article class="memory-item ${adminSafe(status)}">
      <div class="memory-item-main">
        <div>
          <strong>${adminSafe(serviceName)}</strong>
          <small>${adminSafe(dtekFormatDateTime(item.scheduled_start))} · ${adminSafe(dtekFormatTimeRange(item))}</small>
          <small>${adminSafe(item.client_name || "Cliente")} · ${adminSafe(item.client_phone || "Sin teléfono")} · ${adminSafe(item.client_email || "Sin correo")}</small>
        </div>
        <span class="status-pill ${adminSafe(status)}">${adminSafe(dtekStatusLabel(status))}</span>
      </div>
      <div class="appointment-grid">
        <div><span>Vehículo</span><strong>${adminSafe(vehicleSummary)}</strong></div>
        <div><span>Ubicación</span><strong>${adminSafe(item.location || "Sin ubicación")}</strong></div>
        <div><span>Síntoma</span><strong>${adminSafe(item.symptom || "Sin síntoma")}</strong></div>
        <div><span>Fuente</span><strong>${adminSafe(item.source || "web")}</strong></div>
      </div>
      <div class="memory-actions">
        ${statusButtons}
        <button type="button" data-workorder-report="${adminSafe(item.id)}">Reporte técnico</button>
        <a class="wa-action" href="${adminSafe(dtekWhatsAppClientLink(item))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
    </article>`;
}

function renderMetrics(items) {
  const box = adminQs("#backendMetrics");
  if (!box) return;
  const counts = items.reduce((acc, item) => {
    acc[item.status || "requested"] = (acc[item.status || "requested"] || 0) + 1;
    return acc;
  }, {});
  box.innerHTML = [
    ["Solicitadas", counts.requested || 0],
    ["Confirmadas", counts.confirmed || 0],
    ["Realizadas", counts.completed || 0],
    ["Canceladas", counts.cancelled || 0]
  ].map(([label, value]) => `<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`).join("");

  renderPendientes(items);
}

// C-06 · El panel mostraba listas pero nada decia que estaba esperando algo
// de vos. Asi se acumularon quince trabajos sin cerrar sin que nadie lo notara.
function renderPendientes(items = []) {
  const box = adminQs("#backendPendientes");
  if (!box) return;

  const ahora = Date.now();
  const yaPaso = (item) => new Date(item.scheduled_start || 0).getTime() < ahora;

  const porConfirmar = items.filter((i) => (i.status || "requested") === "requested");
  const sinCerrar = items.filter((i) => yaPaso(i) && (i.status || "") !== "cancelled" && (i.status || "") !== "completed");
  const sinTotal = items.filter((i) => (i.status || "") === "completed" && !Number(i.grand_total || 0));

  const avisos = [
    [porConfirmar.length, "por confirmar", "por confirmar", "requested"],
    [sinCerrar.length, "ya pasó y sigue abierta", "ya pasaron y siguen abiertas", "confirmed"],
    [sinTotal.length, "realizada sin monto", "realizadas sin monto", "completed"]
  ].filter(([n]) => n > 0)
   .map(([n, uno, varios, filtro]) => [n, n === 1 ? uno : varios, filtro]);

  if (!avisos.length) {
    box.className = "pendientes-v318 al-dia";
    box.innerHTML = `<strong>Todo al día.</strong><span>No hay nada esperando por vos.</span>`;
    return;
  }

  box.className = "pendientes-v318";
  box.innerHTML = `<strong>Te toca revisar</strong>` + avisos.map(([n, texto, filtro]) =>
    `<button type="button" data-admin-filter="${filtro}"><b>${n}</b> ${adminSafe(texto)}</button>`).join("");
}

function renderAppointmentsList(items) {
  const holder = adminQs("#backendAppointments");
  if (!holder) return;
  const filtered = dtekAdminFilter === "all" ? items : items.filter((item) => (item.status || "requested") === dtekAdminFilter);
  const sorted = [...filtered].sort((a, b) => new Date(a.scheduled_start || 0) - new Date(b.scheduled_start || 0));
  const groups = { today: [], soon: [], later: [] };
  sorted.forEach((item) => groups[appointmentUrgencyGroup(item)].push(item));
  const sections = [
    ["today", "Hoy y atrasadas"],
    ["soon", "Próximas (7 días)"],
    ["later", "Más adelante"]
  ].filter(([key]) => groups[key].length).map(([key, label]) => `
    <div class="admin-urgency-group">
      <h3 class="admin-urgency-heading">${label}<b>${groups[key].length}</b></h3>
      ${groups[key].map(appointmentCard).join("")}
    </div>`).join("");
  holder.innerHTML = sorted.length ? sections : `<p class="memory-empty">No hay citas para este filtro.</p>`;
}

async function getAdminProfileOrExplain() {
  const session = await withTimeout(DtekBackend.getSession(), 6000, "sesión");
  if (!session) return { session: null, profile: null, isAdmin: false };

  const profile = await withTimeout(DtekBackend.currentProfile(), 6000, "perfil admin");
  const isAdmin = profile?.role === "admin";
  return { session, profile, isAdmin };
}

async function ensureAdminReady() {
  if (!DtekBackend.isConfigured()) throw new Error("Supabase todavía no está activo. Revisá supabase-config.js.");
  const { session, profile, isAdmin } = await getAdminProfileOrExplain();
  if (!session) throw new Error("Necesitás iniciar sesión como admin.");
  if (!isAdmin) throw new Error(`Sesión iniciada, pero este usuario no es admin. Role actual: ${profile?.role || "sin role"}`);
  backendStatus(`Sesión admin activa: ${profile.email || session.user.email}`, "ok");
  return { session, profile };
}

async function loadBackendAppointments() {
  const holder = adminQs("#backendAppointments");
  if (!holder) return;
  holder.innerHTML = `<p class="memory-empty">Cargando citas reales...</p>`;

  try {
    await ensureAdminReady();

    let data = [];
    try {
      data = await withTimeout(DtekBackend.listAppointmentsForAdmin(), 8000, "appointments_view");
    } catch (viewError) {
      console.warn("appointments_view falló, probando tabla appointments:", viewError);
      data = await withTimeout(DtekBackend.listAppointmentsRawForAdmin(), 8000, "appointments");
    }

    dtekAdminAppointmentsCache = data || [];
    renderMetrics(dtekAdminAppointmentsCache);
    renderAppointmentsList(dtekAdminAppointmentsCache);
  } catch (error) {
    console.error("D-TEK admin backend error:", error);
    backendStatus(error.message, "error");
    holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>Error al cargar panel.</strong><p>${adminSafe(error.message)}</p><p>Abrí F12 → Console para ver el detalle técnico.</p></div>`;
  }
}

async function loadBackendReferrals() {
  const holder = adminQs("#backendReferrals");
  if (!holder) return;
  holder.innerHTML = `<p class="memory-empty">Cargando referidos...</p>`;
  try {
    await ensureAdminReady();
    const data = await withTimeout(DtekBackend.listReferralsForAdmin(), 8000, "referidos");
    dtekAdminReferralsCache = data || [];
    renderReferralMetrics(dtekAdminReferralsCache);
    renderReferralsList(dtekAdminReferralsCache);
  } catch (error) {
    console.warn("Referidos no disponibles:", error);
    holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>No se pudieron cargar referidos.</strong><p>${adminSafe(String(error.message || error).includes("dtek_admin_list_referrals") ? "Corré database/12_v22_loyalty_referrals.sql en Supabase." : error.message)}</p></div>`;
  }
}

async function loadBackendRedemptions() {
  const holder = adminQs("#backendRedemptions");
  if (!holder) return;
  holder.innerHTML = `<p class="memory-empty">Cargando canjes...</p>`;
  try {
    await ensureAdminReady();
    dtekAdminRedemptionsCache = await withTimeout(DtekBackend.listRedemptionsForAdmin(), 8000, "canjes");
    renderRedemptionsList(dtekAdminRedemptionsCache || []);
  } catch (error) {
    holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>Canjes no disponibles.</strong><p>${adminSafe(String(error.message || error).includes("dtek_admin_list_redemptions") ? "Corré database/13_v27_points_rewards.sql." : error.message)}</p></div>`;
  }
}

async function loadBlockedTimes() {
  const holder = adminQs("#blockedTimesList");
  if (!holder) return;
  try {
    await ensureAdminReady();
    const data = await withTimeout(DtekBackend.listBlockedTimes(), 8000, "bloqueos");
    holder.innerHTML = data.length ? data.map((item) => `
      <article class="memory-item">
        <strong>${adminSafe(item.reason || "Bloqueo D-TEK")}</strong>
        <small>${adminSafe(dtekFormatDateTime(item.start_time))} → ${adminSafe(dtekFormatDateTime(item.end_time))}</small>
        <div class="memory-actions"><button type="button" data-delete-block="${adminSafe(item.id)}">Eliminar bloqueo</button></div>
      </article>
    `).join("") : `<p class="memory-empty">No hay bloqueos manuales.</p>`;
  } catch (error) {
    holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>No se pudieron cargar bloqueos.</strong><p>${adminSafe(error.message)}</p></div>`;
  }
}

async function refreshAllAdminData() {
  await loadBackendAppointments();
  await loadBackendReferrals();
  await loadBackendRedemptions();
  await loadBlockedTimes();
}

let dtekWorkOrderAppointmentId = null;

function openWorkOrderModal(appointmentId) {
  const modal = adminQs("#workOrderModal");
  const form = adminQs("#workOrderForm");
  if (!modal || !form) return;
  const appointment = dtekAdminAppointmentsCache.find(item => String(item.id) === String(appointmentId));
  dtekWorkOrderAppointmentId = appointmentId;
  const subtitle = adminQs("#workOrderModalSubtitle");
  if (subtitle) {
    subtitle.textContent = appointment
      ? `${appointment.service_name || appointment.service_id || "Servicio"} · ${appointment.client_name || "Cliente"}`
      : "";
  }
  form.reset();
  adminQs("#workOrderStatusBox").innerHTML = "";
  adminQs("#workOrderCloseAppointment").checked = true;
  adminQs("#workOrderMileage").value = "";

  // Arranca con una linea del servicio agendado, para no empezar en blanco.
  dtekLineas = [];
  const precio = dtekPrecioDeCatalogo(appointment?.service_id);
  agregarLinea({
    description: appointment?.service_name || appointment?.service_id || "Servicio",
    kind: "service",
    quantity: 1,
    unit_price: precio || 0,
    service_id: appointment?.service_id || ""
  });

  modal.classList.remove("hidden-field");
  adminQs("#workOrderDiagnosis")?.focus();
}

/* ---------- Lineas del recibo ----------
   El recibo detalla descripcion, cantidad y precio. Antes solo habia dos
   montos globales, asi que no habia donde escribir el detalle. */

let dtekLineas = [];

function dtekPrecioDeCatalogo(serviceId) {
  const s = (window.DTEK_SERVICES || []).find((x) => x.id === serviceId);
  if (!s) return 0;
  const m = String(s.price || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

function agregarLinea(datos = {}) {
  dtekLineas.push({
    description: datos.description || "",
    kind: datos.kind || "part",
    quantity: Number(datos.quantity) || 1,
    unit_price: Number(datos.unit_price) || 0,
    service_id: datos.service_id || ""
  });
  pintarLineas();
}

function pintarLineas() {
  const holder = adminQs("#workOrderItems");
  const vacio = adminQs("#workOrderItemsEmpty");
  if (!holder) return;

  holder.innerHTML = dtekLineas.map((l, i) => `
    <div class="linea-v320" data-linea="${i}">
      <input class="linea-desc" type="text" value="${adminSafe(l.description)}" placeholder="Descripción" aria-label="Descripción de la línea ${i + 1}">
      <select class="linea-kind" aria-label="Tipo de la línea ${i + 1}">
        <option value="part"${l.kind === "part" ? " selected" : ""}>Repuesto</option>
        <option value="labor"${l.kind === "labor" ? " selected" : ""}>Mano de obra</option>
        <option value="service"${l.kind === "service" ? " selected" : ""}>Servicio</option>
      </select>
      <input class="linea-cant" type="number" min="0.01" step="0.01" value="${l.quantity}" aria-label="Cantidad de la línea ${i + 1}">
      <input class="linea-precio" type="number" min="0" step="0.01" value="${l.unit_price}" aria-label="Precio unitario de la línea ${i + 1}">
      <b class="linea-sub">${adminSafe(dtekMoneda(l.quantity * l.unit_price))}</b>
      <button type="button" class="linea-quitar" aria-label="Quitar la línea ${i + 1}">×</button>
    </div>`).join("");

  if (vacio) vacio.style.display = dtekLineas.length ? "none" : "block";
  sumarLineas();
}

function dtekMoneda(n) {
  return "Q" + Number(n || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sumarLineas() {
  const mano = dtekLineas.filter((l) => l.kind === "labor").reduce((a, l) => a + l.quantity * l.unit_price, 0);
  const resto = dtekLineas.filter((l) => l.kind !== "labor").reduce((a, l) => a + l.quantity * l.unit_price, 0);
  const set = (sel, v) => { const e = adminQs(sel); if (e) e.textContent = dtekMoneda(v); };
  set("#workOrderPartsSum", resto);
  set("#workOrderLaborSum", mano);
  set("#workOrderGrandSum", mano + resto);
  return { mano, resto, total: mano + resto };
}

function bindLineas() {
  const holder = adminQs("#workOrderItems");
  if (!holder) return;

  holder.addEventListener("input", (ev) => {
    const fila = ev.target.closest("[data-linea]");
    if (!fila) return;
    const i = Number(fila.dataset.linea);
    const l = dtekLineas[i];
    if (!l) return;
    if (ev.target.classList.contains("linea-desc")) l.description = ev.target.value;
    if (ev.target.classList.contains("linea-cant")) l.quantity = Number(ev.target.value) || 0;
    if (ev.target.classList.contains("linea-precio")) l.unit_price = Number(ev.target.value) || 0;
    const sub = fila.querySelector(".linea-sub");
    if (sub) sub.textContent = dtekMoneda(l.quantity * l.unit_price);
    sumarLineas();
  });

  holder.addEventListener("change", (ev) => {
    const fila = ev.target.closest("[data-linea]");
    if (!fila || !ev.target.classList.contains("linea-kind")) return;
    const l = dtekLineas[Number(fila.dataset.linea)];
    if (l) { l.kind = ev.target.value; sumarLineas(); }
  });

  holder.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".linea-quitar");
    if (!btn) return;
    dtekLineas.splice(Number(btn.closest("[data-linea]").dataset.linea), 1);
    pintarLineas();
  });

  adminQs("#workOrderAddItem")?.addEventListener("click", () => {
    agregarLinea({ kind: "part" });
    adminQs("#workOrderItems .linea-v320:last-child .linea-desc")?.focus();
  });
}

function closeWorkOrderModal() {
  adminQs("#workOrderModal")?.classList.add("hidden-field");
  dtekWorkOrderAppointmentId = null;
}

// El recibo en el molde que Dominic ya usa, con la marca D-TEK GT y en km.
function armarRecibo({ appointment, lineas, totales, hallazgos, recomendaciones, km }) {
  const hoy = new Date().toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const vehiculo = [appointment?.vehicle_brand, appointment?.vehicle_line, appointment?.vehicle_year]
    .filter(Boolean).join(" ") || "—";

  const partes = [
    "D-TEK GT · Mecánica a domicilio",
    `RECIBO — Fecha: ${hoy}`,
    "",
    `Cliente: ${appointment?.client_name || "—"}`,
    `Vehículo: ${vehiculo}`,
    km ? `Kilometraje: ${Number(km).toLocaleString("es-GT")} km` : null,
    ""
  ];

  if (hallazgos) partes.push("Hallazgos:", ...hallazgos.split("\n").filter(Boolean).map((l) => `- ${l.trim()}`), "");
  if (recomendaciones) partes.push("Recomendaciones:", ...recomendaciones.split("\n").filter(Boolean).map((l) => `- ${l.trim()}`), "");

  partes.push("Trabajo realizado:");
  lineas.forEach((l) => {
    const cant = l.quantity === 1 ? "" : `${l.quantity} × `;
    partes.push(`- ${l.description}: ${cant}${dtekMoneda(l.unit_price)} = ${dtekMoneda(l.quantity * l.unit_price)}`);
  });

  partes.push("", `Total pagado: ${dtekMoneda(totales.total)}`, "",
    "Garantía de 90 días sobre mano de obra y repuestos.");

  return partes.filter((l) => l !== null).join("\n");
}

async function submitWorkOrderReport(event, { compartir = false } = {}) {
  if (event) event.preventDefault();
  const appointmentId = dtekWorkOrderAppointmentId;
  const statusBox = adminQs("#workOrderStatusBox");
  if (!appointmentId) {
    if (statusBox) statusBox.innerHTML = `<p class="status-error">No hay una cita seleccionada.</p>`;
    return;
  }

  const lineas = dtekLineas.filter((l) => String(l.description || "").trim());
  if (!lineas.length) {
    if (statusBox) statusBox.innerHTML = `<p class="status-error">Agregá al menos una línea con descripción antes de cerrar.</p>`;
    return;
  }

  // La ventana se abre en blanco dentro del clic (antes del await), porque
  // despues el navegador ya no deja abrir ventanas nuevas por script.
  const waWindow = compartir ? window.open("", "_blank") : null;
  if (waWindow) { try { waWindow.opener = null; } catch (e) {} }

  try {
    if (statusBox) statusBox.innerHTML = `<p class="status-info">Cerrando el trabajo...</p>`;
    const appointment = dtekAdminAppointmentsCache.find(item => String(item.id) === String(appointmentId));
    const totales = sumarLineas();
    const km = adminQs("#workOrderMileage").value;
    const hallazgos = adminQs("#workOrderDiagnosis").value.trim();
    const recomendaciones = adminQs("#workOrderRecommendations").value.trim();

    const payload = {
      appointment_id: appointmentId,
      diagnosis: hallazgos,
      recommendations: recomendaciones,
      parts_notes: adminQs("#workOrderPartsNotes").value.trim(),
      mileage: km ? Number(km) : null,
      items: lineas.map((l, i) => ({ ...l, position: i })),
      cerrar_cita: adminQs("#workOrderCloseAppointment").checked
    };

    const saved = await withTimeout(DtekBackend.cerrarTrabajo(payload), 12000, "cerrar el trabajo");
    await dtekSendZapierEvent("work_order_updated", { appointmentId, appointment, workOrder: saved });

    if (compartir) {
      const texto = armarRecibo({ appointment, lineas, totales, hallazgos, recomendaciones, km });
      const tel = String(appointment?.client_phone || "").replace(/\D/g, "");
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
      if (waWindow) { waWindow.location.href = url; } else { window.open(url, "_blank", "noopener"); }
    }

    if (statusBox) {
      statusBox.innerHTML = `<p class="status-ok">Trabajo cerrado por ${adminSafe(dtekMoneda(totales.total))}.${compartir ? " Abrimos WhatsApp con el recibo." : ""} El cliente ya lo ve en su Garage.</p>`;
    }
    await refreshAllAdminData();
    setTimeout(closeWorkOrderModal, 1200);
  } catch (error) {
    if (waWindow) { try { waWindow.close(); } catch (e) {} }
    if (statusBox) statusBox.innerHTML = `<p class="status-error">${adminSafe(error.message)}</p>`;
  }
}

async function initBackendAdmin() {
  renderBackendSystemStatus();
  await refreshAllAdminData();

  adminQs("#workOrderForm")?.addEventListener("submit", (ev) => submitWorkOrderReport(ev, { compartir: false }));
  adminQs("#workOrderSaveAndShare")?.addEventListener("click", (ev) => submitWorkOrderReport(ev, { compartir: true }));
  bindLineas();
  adminQs("#workOrderModalClose")?.addEventListener("click", closeWorkOrderModal);
  adminQs("#workOrderModalCancel")?.addEventListener("click", closeWorkOrderModal);
  adminQs("#workOrderModal")?.addEventListener("click", (event) => {
    if (event.target.id === "workOrderModal") closeWorkOrderModal();
  });

  adminQs("#backendLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      backendStatus("Iniciando sesión...", "info");
      await withTimeout(DtekBackend.signIn(adminQs("#backendIdentifier").value.trim(), adminQs("#backendPassword").value), 10000, "login");
      backendStatus("Sesión iniciada. Cargando panel...", "ok");
      await refreshAllAdminData();
    } catch (error) {
      console.error("Login/admin load error:", error);
      backendStatus(error.message, "error");
    }
  });

  adminQs("#backendForgotPassword")?.addEventListener("click", async () => {
    const identifier = adminQs("#backendIdentifier")?.value.trim() || "";
    if (!identifier) {
      backendStatus("Escribí primero tu usuario o correo admin.", "error");
      adminQs("#backendIdentifier")?.focus();
      return;
    }
    try {
      backendStatus("Enviando enlace seguro...", "info");
      await withTimeout(DtekBackend.requestPasswordReset(identifier), 12000, "recuperar contraseña");
      backendStatus("Revisá tu correo. El enlace abrirá una pantalla para crear la contraseña nueva.", "ok");
    } catch (error) {
      console.error("Password recovery error:", error);
      backendStatus(error.message || "No se pudo enviar el enlace.", "error");
    }
  });

  adminQs("#backendLogout")?.addEventListener("click", async () => {
    await DtekBackend.signOut();
    backendStatus("Sesión cerrada.", "info");
    dtekAdminAppointmentsCache = [];
    dtekAdminReferralsCache = [];
    dtekAdminRedemptionsCache = [];
    renderAppointmentsList([]);
    renderMetrics([]);
    renderReferralsList([]);
    renderReferralMetrics([]);
    renderRedemptionsList([]);
  });

  adminQs("#backendRefresh")?.addEventListener("click", refreshAllAdminData);
  adminQs("#backendRefreshReferrals")?.addEventListener("click", loadBackendReferrals);
  adminQs("#backendRefreshRedemptions")?.addEventListener("click", loadBackendRedemptions);

  document.addEventListener("click", async (event) => {
    const filterBtn = event.target.closest("[data-filter-status]");
    if (filterBtn) {
      dtekAdminFilter = filterBtn.dataset.filterStatus;
      renderAppointmentsList(dtekAdminAppointmentsCache);
      return;
    }

    const referralFilterBtn = event.target.closest("[data-referral-filter]");
    if (referralFilterBtn) {
      dtekReferralFilter = referralFilterBtn.dataset.referralFilter || "all";
      renderReferralsList(dtekAdminReferralsCache);
      return;
    }

    const referralStatusBtn = event.target.closest("[data-referral-status]");
    if (referralStatusBtn) {
      try {
        const status = referralStatusBtn.dataset.referralStatus;
        const referral = dtekAdminReferralsCache.find(item => String(item.id) === String(referralStatusBtn.dataset.referralId));
        const reward = 0;
        if (status === "converted" && !confirm(`¿Confirmar que ${referral?.referred_name || "el referido"} completó su primer trabajo y acreditar 100 puntos?`)) return;
        if (status === "discarded" && !confirm("¿Marcar esta recomendación como no convertida?")) return;
        await withTimeout(DtekBackend.updateReferralStatus(referralStatusBtn.dataset.referralId, status, reward, null), 8000, "actualizar referido");
        await loadBackendReferrals();
      } catch (error) {
        alert(error.message);
      }
      return;
    }

    const loyaltyAdjustBtn = event.target.closest("[data-points-adjust]");
    if (loyaltyAdjustBtn) {
      try {
        const amountText = prompt(`Ajuste de puntos para ${loyaltyAdjustBtn.dataset.referrerName}.`, "100");
        if (amountText === null) return;
        const amount = Number(amountText);
        if (!Number.isInteger(amount) || amount === 0) throw new Error("Ingresá puntos enteros diferentes de cero.");
        const description = prompt("Motivo:", amount < 0 ? "Ajuste de puntos" : "Puntos manuales") || "Ajuste D-TEK";
        await withTimeout(DtekBackend.adjustPoints(loyaltyAdjustBtn.dataset.pointsAdjust, amount, description), 8000, "ajustar puntos");
        alert(`Puntos ajustados: ${amount}.`);
        await loadBackendReferrals();
      } catch (error) {
        alert(error.message);
      }
      return;
    }

    const redemptionBtn = event.target.closest("[data-redemption-status]");
    if (redemptionBtn) {
      try {
        const status = redemptionBtn.dataset.redemptionStatus;
        const note = prompt(status === "fulfilled" ? "Nota del canje:" : "Motivo de cancelación:", "") || "";
        await withTimeout(DtekBackend.updateRedemptionStatus(redemptionBtn.dataset.redemptionId, status, note), 8000, "actualizar canje");
        await loadBackendRedemptions();
      } catch (error) { alert(error.message); }
      return;
    }

    const statusBtn = event.target.closest("[data-backend-status]");
    if (statusBtn) {
      try {
        const status = statusBtn.dataset.backendStatus;
        const note = prompt(`Nota interna para marcar como ${dtekStatusLabel(status)}:`, `Estado actualizado a ${dtekStatusLabel(status)}`) || "";
        const updated = await withTimeout(DtekBackend.updateAppointmentStatus(statusBtn.dataset.id, status, note), 8000, "actualizar estado");
        const appointment = dtekAdminAppointmentsCache.find(item => String(item.id) === String(statusBtn.dataset.id)) || { id: statusBtn.dataset.id };
        await dtekSendZapierEvent("appointment_status_updated", {
          appointmentId: statusBtn.dataset.id,
          status,
          statusLabel: dtekStatusLabel(status),
          note,
          appointment,
          updated
        });
        await refreshAllAdminData();
      } catch (error) {
        alert(error.message);
      }
      return;
    }

    const reportBtn = event.target.closest("[data-workorder-report]");
    if (reportBtn) {
      openWorkOrderModal(reportBtn.dataset.workorderReport);
      return;
    }

    const deleteBlockBtn = event.target.closest("[data-delete-block]");
    if (deleteBlockBtn) {
      if (!confirm("¿Eliminar este bloqueo de agenda?")) return;
      try {
        await withTimeout(DtekBackend.deleteBlockedTime(deleteBlockBtn.dataset.deleteBlock), 8000, "eliminar bloqueo");
        await refreshAllAdminData();
      } catch (error) {
        alert(error.message);
      }
    }
  });

  adminQs("#blockedTimeForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      blockedStatus("Creando bloqueo...", "info");
      const startValue = adminQs("#blockedStart").value;
      const endValue = adminQs("#blockedEnd").value;
      const reason = adminQs("#blockedReason").value.trim();
      if (!startValue || !endValue) throw new Error("Elegí inicio y fin del bloqueo.");
      const createdBlock = await withTimeout(DtekBackend.createBlockedTime(new Date(startValue).toISOString(), new Date(endValue).toISOString(), reason), 8000, "crear bloqueo");
      await dtekSendZapierEvent("blocked_time_created", {
        startTime: new Date(startValue).toISOString(),
        endTime: new Date(endValue).toISOString(),
        reason,
        createdBlock
      });
      blockedStatus("Bloqueo creado. Ese horario ya no debería aparecer disponible.", "ok");
      event.target.reset();
      await refreshAllAdminData();
    } catch (error) {
      blockedStatus(error.message, "error");
    }
  });
}



adminQs("#clientProvisionForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.target.querySelector('button[type="submit"]');
  const payload = {
    fullName: adminQs("#provisionFullName")?.value.trim() || "",
    phone: normalizeProvisionPhone(adminQs("#provisionPhone")?.value),
    username: adminQs("#provisionUsername")?.value.trim() || "",
    password: adminQs("#provisionPassword")?.value || "",
    contactEmail: adminQs("#provisionEmail")?.value.trim() || "",
    vehicleBrand: adminQs("#provisionVehicleBrand")?.value.trim() || "",
    vehicleLine: adminQs("#provisionVehicleLine")?.value.trim() || "",
    vehicleYear: adminQs("#provisionVehicleYear")?.value || "",
    vehiclePlate: adminQs("#provisionVehiclePlate")?.value.trim() || "",
    vehicleMileage: adminQs("#provisionVehicleMileage")?.value || "",
    vehicleNickname: adminQs("#provisionVehicleNickname")?.value.trim() || "",
    serviceDate: adminQs("#provisionServiceDate")?.value || "",
    serviceDescription: adminQs("#provisionServiceDescription")?.value.trim() || "",
    serviceRecommendations: adminQs("#provisionServiceRecommendations")?.value.trim() || "",
    laborTotal: adminQs("#provisionLaborTotal")?.value || "",
    partsTotal: adminQs("#provisionPartsTotal")?.value || ""
  };
  try {
    if (submit) { submit.disabled = true; submit.textContent = "Creando perfil..."; }
    provisionStatus("Creando acceso, garage e historial...", "info");
    const result = await DtekBackend.createClientAccessAsAdmin(payload);
    const portalUrl = `${window.location.origin}/cliente.html`;
    const whatsappMessage = `Hola ${payload.fullName.split(" ")[0] || ""}, ya está listo tu Garage D-TEK con la información de tu carro.\n\nUsuario: ${result.username}\nContraseña temporal: ${result.temporaryPassword}\nEntrá aquí: ${portalUrl}\n\nDentro de Perfil podés cambiar tu usuario y contraseña.`;
    const resultBox = adminQs("#clientProvisionResult");
    if (resultBox) {
      resultBox.classList.remove("hidden-field");
      resultBox.innerHTML = `
        <h3>Perfil listo para entregar</h3>
        <div class="dtek-provision-credentials">
          <code>Usuario: ${adminSafe(result.username)}</code>
          <code>Contraseña temporal: ${adminSafe(result.temporaryPassword)}</code>
        </div>
        <p>${result.vehicle ? `Carro agregado: <strong>${adminSafe(result.vehicle.brand)} ${adminSafe(result.vehicle.line)}</strong>.` : "Acceso creado sin carro."}</p>
        <button class="btn btn-cyan" type="button" id="copyProvisionAccess">Copiar mensaje para WhatsApp</button>
        ${result.warnings?.length ? `<p class="status-warning">Revisar: ${adminSafe(result.warnings.join(" · "))}</p>` : ""}
      `;
      adminQs("#copyProvisionAccess")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(whatsappMessage);
        provisionStatus("Mensaje copiado. Ya podés enviárselo al cliente.", "ok");
      });
    }
    provisionStatus(result.warnings?.length ? "El acceso se creó con detalles pendientes." : "Perfil creado correctamente.", result.warnings?.length ? "warning" : "ok");
    event.target.reset();
  } catch (error) {
    console.warn(error);
    provisionStatus(error?.message || "No se pudo crear el perfil.", "error");
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = "Crear perfil listo para entregar"; }
  }
});

document.addEventListener("DOMContentLoaded", initBackendAdmin);
