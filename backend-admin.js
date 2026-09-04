/* D-TEK GT Web OS v30.3 — Admin backend + Pecera */

const adminQs = (selector) => document.querySelector(selector);
const adminQsa = (selector) => Array.from(document.querySelectorAll(selector));
let dtekAdminAppointmentsCache = [];
let dtekAdminReferralsCache = [];
let dtekAdminRedemptionsCache = [];
let dtekAdminBlockedTimesCache = [];
let dtekAdminFilter = "all";
let dtekReferralFilter = "all";
let dtekHorarioSelectedDate = new Date();

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
  const resuelto = item.status === "completed" || item.status === "cancelled";
  if (diffDays === 0) return "today";
  if (diffDays < 0) return resuelto ? "history" : "overdue";
  if (diffDays <= 7) return "soon";
  return "later";
}

function dtekFormatAppointmentWhen(item) {
  const start = item.scheduled_start ? new Date(item.scheduled_start) : null;
  if (!start || Number.isNaN(start.getTime())) return "Sin fecha";
  const fecha = start.toLocaleDateString("es-GT", { weekday: "short", day: "2-digit", month: "short" });
  return `${fecha} · ${dtekFormatTimeRange(item)}`;
}

function appointmentCard(item) {
  const serviceName = item.service_name || item.service_id || "Servicio";
  const vehicleSummary = item.vehicle_summary || [item.vehicle_brand, item.vehicle_line, item.vehicle_year].filter(Boolean).join(" ") || "Vehículo sin datos";
  const status = item.status || "requested";
  const statusButtons = availableStatusActions(status)
    .map(([value, label]) => `<button type="button" data-backend-status="${adminSafe(value)}" data-id="${adminSafe(item.id)}">${adminSafe(label)}</button>`)
    .join("");
  return `
    <article class="memory-item appt-card-v34 ${adminSafe(status)}">
      <div class="memory-item-main">
        <div>
          <strong>${adminSafe(serviceName)}</strong>
          <small>${adminSafe(dtekFormatAppointmentWhen(item))}</small>
          <small>${adminSafe(item.client_name || "Cliente")} · ${adminSafe(item.client_phone || "Sin teléfono")}</small>
        </div>
        <span class="status-pill ${adminSafe(status)}">${adminSafe(dtekStatusLabel(status))}</span>
      </div>
      <div class="appt-meta-v34">
        <span>${adminSafe(vehicleSummary)}</span>
        <span>${adminSafe(item.location || "Sin ubicación")}</span>
      </div>
      ${item.symptom ? `<p class="appt-symptom-v34">${adminSafe(item.symptom)}</p>` : ""}
      <div class="memory-actions appt-actions-v34">
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
  const groups = { today: [], overdue: [], soon: [], later: [], history: [] };
  sorted.forEach((item) => groups[appointmentUrgencyGroup(item)].push(item));
  groups.history.reverse();
  const sections = [
    ["today", "Hoy"],
    ["overdue", "Atrasadas"],
    ["soon", "Próximas (7 días)"],
    ["later", "Más adelante"],
    ["history", "Historial"]
  ].filter(([key]) => groups[key].length).map(([key, label]) => `
    <div class="admin-urgency-group">
      <h3 class="admin-urgency-heading">${label}<b>${groups[key].length}</b></h3>
      ${groups[key].map(appointmentCard).join("")}
    </div>`).join("");
  holder.innerHTML = sorted.length ? sections : `<p class="memory-empty">No hay citas para este filtro.</p>`;
}

/* ---------- Horario: timeline diario que cruza citas + bloqueos ---------- */

const DTEK_HORARIO_PX_POR_HORA = 64;

function dtekTimelineRange(items, dayDate) {
  const DEFAULT_START_H = 8, DEFAULT_END_H = 18, MIN_RANGO_H = 4;
  const atHour = (h) => new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, 0, 0, 0);
  if (!items.length) return { start: atHour(DEFAULT_START_H), end: atHour(DEFAULT_END_H) };
  const minStart = new Date(Math.min(...items.map((i) => i.start.getTime())));
  const maxEnd = new Date(Math.max(...items.map((i) => i.end.getTime())));
  let startH = Math.max(0, Math.floor(minStart.getHours() - 1));
  let endH = Math.min(24, Math.ceil(maxEnd.getHours() + (maxEnd.getMinutes() > 0 ? 1 : 0)) + 1);
  if (endH - startH < MIN_RANGO_H) endH = Math.min(24, startH + MIN_RANGO_H);
  return { start: atHour(startH), end: atHour(endH) };
}

function dtekLayoutTimelineItems(items, rangeStart, rangeEnd, pxPorHora = DTEK_HORARIO_PX_POR_HORA) {
  const pxPorMs = pxPorHora / 3600000;
  const MIN_ALTURA_PX = 30;
  const MIN_ANCHO_COL_PX = 92;

  const usable = items
    .map((it) => ({
      ...it,
      cStart: new Date(Math.max(it.start.getTime(), rangeStart.getTime())),
      cEnd: new Date(Math.min(it.end.getTime(), rangeEnd.getTime()))
    }))
    .filter((it) => it.cEnd > it.cStart)
    .sort((a, b) => a.cStart - b.cStart || a.cEnd - b.cEnd);

  const clusters = [];
  let currentMaxEnd = -Infinity;
  usable.forEach((it) => {
    if (!clusters.length || it.cStart.getTime() >= currentMaxEnd) {
      clusters.push([]);
      currentMaxEnd = -Infinity;
    }
    clusters[clusters.length - 1].push(it);
    currentMaxEnd = Math.max(currentMaxEnd, it.cEnd.getTime());
  });

  let maxColsGlobal = 1;
  const positioned = [];
  clusters.forEach((cluster) => {
    const colEnds = [];
    cluster.forEach((it) => {
      let col = colEnds.findIndex((end) => end <= it.cStart.getTime());
      if (col === -1) { col = colEnds.length; colEnds.push(it.cEnd.getTime()); }
      else colEnds[col] = it.cEnd.getTime();
      it._col = col;
    });
    const totalCols = colEnds.length;
    maxColsGlobal = Math.max(maxColsGlobal, totalCols);
    cluster.forEach((it) => {
      const top = (it.cStart - rangeStart) * pxPorMs;
      const height = Math.max((it.cEnd - it.cStart) * pxPorMs, MIN_ALTURA_PX);
      positioned.push({
        ...it,
        top, height, col: it._col, totalCols,
        left: `${(it._col / totalCols) * 100}%`,
        width: `calc(${100 / totalCols}% - 4px)`
      });
    });
  });

  return { items: positioned, trackMinWidthPx: Math.max(280, maxColsGlobal * MIN_ANCHO_COL_PX) };
}

function dtekTimelineItemsForDay(dayDate) {
  const dayStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const overlaps = (s, e) => s < dayEnd && e > dayStart;

  const citas = dtekAdminAppointmentsCache
    .map((a) => ({
      id: a.id, type: "appointment", status: a.status || "requested", raw: a,
      start: new Date(a.scheduled_start), end: new Date(a.scheduled_end)
    }))
    .filter((it) => !Number.isNaN(it.start.getTime()) && !Number.isNaN(it.end.getTime()) && overlaps(it.start, it.end));

  const bloqueos = dtekAdminBlockedTimesCache
    .map((b) => ({
      id: b.id, type: "blocked", raw: b,
      start: new Date(b.start_time), end: new Date(b.end_time)
    }))
    .filter((it) => !Number.isNaN(it.start.getTime()) && !Number.isNaN(it.end.getTime()) && overlaps(it.start, it.end));

  return [...citas, ...bloqueos];
}

function horarioItemCard(item) {
  const style = `top:${item.top}px;height:${item.height}px;left:${item.left};width:${item.width}`;
  if (item.type === "appointment") {
    const a = item.raw;
    const clienteLinea = a.location ? `${a.client_name || "Cliente"} · ${a.location}` : (a.client_name || "Cliente");
    return `<button type="button" class="horario-item-v34 ${adminSafe(a.status || "requested")}" style="${style}" data-horario-appt="${adminSafe(a.id)}">
      <strong>${adminSafe(dtekFormatTimeRange(a))}</strong>
      <span>${adminSafe(a.service_name || a.service_id || "Servicio")}</span>
      <small>${adminSafe(clienteLinea)}</small>
    </button>`;
  }
  const b = item.raw;
  return `<button type="button" class="horario-item-v34 blocked" style="${style}" data-horario-block="${adminSafe(b.id)}">
    <strong>${adminSafe(dtekFormatTimeRange({ scheduled_start: b.start_time, scheduled_end: b.end_time }))}</strong>
    <span>Bloqueado</span>
    <small>${adminSafe(b.reason || "Sin motivo")}</small>
  </button>`;
}

function renderHorarioView() {
  const track = adminQs("#horarioTrack");
  if (!track) return;
  const label = adminQs("#horarioDateLabel");
  const empty = adminQs("#horarioEmpty");
  const day = dtekHorarioSelectedDate;

  if (label) label.textContent = day.toLocaleDateString("es-GT", { weekday: "long", day: "2-digit", month: "long" });

  const items = dtekTimelineItemsForDay(day);
  const { start, end } = dtekTimelineRange(items, day);
  const { items: positioned, trackMinWidthPx } = dtekLayoutTimelineItems(items, start, end);
  const totalPx = (end - start) / 3600000 * DTEK_HORARIO_PX_POR_HORA;

  const hoy = new Date();
  const esHoy = hoy.toDateString() === day.toDateString();
  const nowTop = (hoy - start) / 3600000 * DTEK_HORARIO_PX_POR_HORA;
  const mostrarAhora = esHoy && nowTop >= 0 && nowTop <= totalPx;

  const horas = [];
  for (let h = start.getHours(), acc = 0; acc <= totalPx; h++, acc += DTEK_HORARIO_PX_POR_HORA) {
    horas.push(`<div class="horario-hourline-v34" style="top:${acc}px"><span>${String(h % 24).padStart(2, "0")}:00</span></div>`);
  }

  track.style.minHeight = `${totalPx}px`;
  track.style.minWidth = `${trackMinWidthPx}px`;
  track.innerHTML = `
    <div class="horario-hourlines-v34">${horas.join("")}</div>
    ${mostrarAhora ? `<div class="horario-now-v34" style="top:${nowTop}px"></div>` : ""}
    <div class="horario-items-v34">${positioned.map(horarioItemCard).join("")}</div>
  `;
  if (empty) empty.hidden = items.length > 0;
}

function bindHorario() {
  adminQs("#horarioPrev")?.addEventListener("click", () => {
    dtekHorarioSelectedDate = new Date(dtekHorarioSelectedDate.getTime() - 86400000);
    renderHorarioView();
  });
  adminQs("#horarioNext")?.addEventListener("click", () => {
    dtekHorarioSelectedDate = new Date(dtekHorarioSelectedDate.getTime() + 86400000);
    renderHorarioView();
  });
  adminQs("#horarioToday")?.addEventListener("click", () => {
    dtekHorarioSelectedDate = new Date();
    renderHorarioView();
  });
  adminQs("#horarioTrack")?.addEventListener("click", (event) => {
    const apptBtn = event.target.closest("[data-horario-appt]");
    if (apptBtn) { openWorkOrderModal(apptBtn.dataset.horarioAppt); return; }

    const blockBtn = event.target.closest("[data-horario-block]");
    if (blockBtn) {
      adminQs(".horario-detail-v34")?.remove();
      const b = dtekAdminBlockedTimesCache.find((x) => String(x.id) === String(blockBtn.dataset.horarioBlock));
      if (!b) return;
      const detail = document.createElement("div");
      detail.className = "horario-detail-v34";
      detail.innerHTML = `
        <span><strong>${adminSafe(b.reason || "Bloqueo D-TEK")}</strong> · ${adminSafe(dtekFormatDateTime(b.start_time))} → ${adminSafe(dtekFormatDateTime(b.end_time))}</span>
        <button type="button" class="btn btn-cyan" data-delete-block="${adminSafe(b.id)}">Eliminar bloqueo</button>
      `;
      adminQs("#horarioTrack").insertAdjacentElement("afterend", detail);
    }
  });
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
    renderHorarioView();
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
    dtekAdminBlockedTimesCache = data || [];
    holder.innerHTML = data.length ? data.map((item) => `
      <article class="memory-item">
        <strong>${adminSafe(item.reason || "Bloqueo D-TEK")}</strong>
        <small>${adminSafe(dtekFormatDateTime(item.start_time))} → ${adminSafe(dtekFormatDateTime(item.end_time))}</small>
        <div class="memory-actions"><button type="button" data-delete-block="${adminSafe(item.id)}">Eliminar bloqueo</button></div>
      </article>
    `).join("") : `<p class="memory-empty">No hay bloqueos manuales.</p>`;
    renderHorarioView();
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
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let dtekReporteVivo = {};   // estado real por component_key ("custom-xxxx" para secciones ad-hoc)
let dtekCustomKeys = [];    // orden de aparición de las secciones ad-hoc
let dtekReco = null;
let dtekRecoKey = null;
let dtekRecoTimeout = null;

function dtekEstadoVacio() {
  return { status: "", notes: "", comment_source: null, photo_paths: [], label: "" };
}

function nombreDeComponenteAdmin(key) {
  const comp = (window.DtekVehicleHealth?.components || []).find(c => c.key === key);
  return comp?.name || key;
}

function filaInspeccionHtml(item) {
  return `
    <div class="inspection-row-v33" data-maintenance-row="${adminSafe(item.key)}">
      <span><strong>${adminSafe(item.name)}</strong><small>${item.mode === "interval" ? `${Number(item.months || 0)} meses · ${Number(item.km || 0).toLocaleString("es-GT")} km` : "Requiere revisión física"}</small></span>
      <select data-inspection-key="${adminSafe(item.key)}" aria-label="Estado de ${adminSafe(item.name)}">
        <option value="">No revisado</option>
        ${item.mode === "interval" ? `<option value="serviced">Servicio realizado hoy</option>` : ""}
        ${item.mode === "inspection" ? `<option value="ok">Bien</option>
        <option value="monitor">Vigilar</option>
        <option value="attention">Requiere atención</option>` : ""}
      </select>
      <div class="inspection-note-cell">
        <input type="text" data-inspection-note="${adminSafe(item.key)}" aria-label="Medición o nota para ${adminSafe(item.name)}" placeholder="Medición, nota o dictado">
        ${SpeechRecognitionCtor ? `<button type="button" class="dictate-btn-v33" data-dictate="${adminSafe(item.key)}" aria-label="Mantené presionado para dictar">🎙</button>` : ""}
      </div>
      <div class="inspection-photos-row-v33" data-photos-for="${adminSafe(item.key)}">
        <label class="photo-add-btn-v33" aria-label="Agregar foto de ${adminSafe(item.name)}"><input type="file" accept="image/*" capture="environment" data-photo-input="${adminSafe(item.key)}" hidden>📷</label>
      </div>
      ${item.mode === "interval" ? `<div class="maintenance-interval-edit">
        <label>Intervalo meses<input type="number" min="1" step="1" value="${adminSafe(item.months || "")}" data-interval-months="${adminSafe(item.key)}"></label>
        <label>Intervalo km<input type="number" min="1" step="1" value="${adminSafe(item.km || "")}" data-interval-km="${adminSafe(item.key)}"></label>
        <label>Fecha realizada<input type="date" data-service-date="${adminSafe(item.key)}"></label>
        <label>Km realizado<input type="number" min="0" step="1" data-service-mileage="${adminSafe(item.key)}" placeholder="Usar km del cierre"></label>
      </div>` : ""}
    </div>`;
}

function renderWorkOrderInspections(appointment = {}) {
  const holder = adminQs("#workOrderInspections");
  if (!holder) return;
  const vehicle = {
    brand: appointment.vehicle_brand,
    line: appointment.vehicle_line,
    year: appointment.vehicle_year
  };
  const allowed = window.DtekVehicleHealth?.planForVehicle?.(vehicle, []) || window.DtekVehicleHealth?.components || [];
  dtekReporteVivo = {};
  allowed.forEach(item => { dtekReporteVivo[item.key] = dtekEstadoVacio(); });
  holder.innerHTML = allowed.map(filaInspeccionHtml).join("");
  dtekCustomKeys = [];
  pintarSeccionesCustom();
}

function nuevaClaveCustom() {
  const base = window.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `custom-${base.replace(/-/g, "").slice(0, 8)}`;
}

function filaInspeccionCustomHtml(key) {
  const item = dtekReporteVivo[key] || dtekEstadoVacio();
  return `
    <div class="inspection-row-v33 inspection-row-custom-v33" data-maintenance-row="${adminSafe(key)}">
      <span><input type="text" class="custom-title-input" data-custom-title="${adminSafe(key)}" placeholder="Título de la sección (ej. Fuga de aceite)" value="${adminSafe(item.label || "")}"></span>
      <select data-inspection-key="${adminSafe(key)}" aria-label="Estado de la sección">
        <option value="">Sin estado</option>
        <option value="ok">Bien</option>
        <option value="monitor">Vigilar</option>
        <option value="attention">Requiere atención</option>
      </select>
      <div class="inspection-note-cell">
        <input type="text" data-inspection-note="${adminSafe(key)}" placeholder="Nota o dictado por voz" aria-label="Nota">
        ${SpeechRecognitionCtor ? `<button type="button" class="dictate-btn-v33" data-dictate="${adminSafe(key)}" aria-label="Mantené presionado para dictar">🎙</button>` : ""}
      </div>
      <div class="inspection-photos-row-v33" data-photos-for="${adminSafe(key)}">
        <label class="photo-add-btn-v33" aria-label="Agregar foto"><input type="file" accept="image/*" capture="environment" data-photo-input="${adminSafe(key)}" hidden>📷</label>
      </div>
      <button type="button" class="btn btn-ghost linea-quitar" data-remove-section="${adminSafe(key)}" aria-label="Quitar esta sección">Quitar sección</button>
    </div>`;
}

function pintarSeccionesCustom() {
  const holder = adminQs("#workOrderCustomSections");
  if (!holder) return;
  holder.innerHTML = dtekCustomKeys.map(filaInspeccionCustomHtml).join("");
}

function collectWorkOrderInspections() {
  return Object.keys(dtekReporteVivo).map(key => {
    const item = dtekReporteVivo[key];
    const esCustom = dtekCustomKeys.includes(key);
    return {
      component_key: key,
      component_label: esCustom ? ((item.label || "").trim() || null) : null,
      status: item.status || "",
      notes: (item.notes || "").trim() || null,
      comment_source: item.comment_source || null,
      photo_paths: item.photo_paths || [],
      interval_months: Number(adminQs(`[data-interval-months="${key}"]`)?.value || 0) || null,
      interval_km: Number(adminQs(`[data-interval-km="${key}"]`)?.value || 0) || null,
      service_date: adminQs(`[data-service-date="${key}"]`)?.value || null,
      service_mileage: Number(adminQs(`[data-service-mileage="${key}"]`)?.value || 0) || null
    };
  }).filter(item => item.status || item.notes || item.photo_paths.length || item.component_label);
}

function validarReporteVivo() {
  const errores = [];
  Object.keys(dtekReporteVivo).forEach(key => {
    const item = dtekReporteVivo[key];
    const esCustom = dtekCustomKeys.includes(key);
    const nombre = esCustom ? ((item.label || "").trim() || "Sección sin título") : nombreDeComponenteAdmin(key);
    const tocado = Boolean((item.notes || "").trim() || item.photo_paths.length || item.status || (esCustom && (item.label || "").trim()));
    if (!tocado) return;
    if (esCustom && !(item.label || "").trim()) errores.push(`"${nombre}": falta el título de la sección.`);
    if (!item.status) errores.push(`"${nombre}": falta marcar el estado.`);
    if (!item.photo_paths.length) errores.push(`"${nombre}": falta la foto.`);
  });
  return errores;
}

function comprimirImagen(file, { maxDim = 1600, calidad = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala) || 1;
      const h = Math.round(img.height * escala) || 1;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo comprimir la foto.")), "image/jpeg", calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la foto.")); };
    img.src = url;
  });
}

function rutaFoto(vehicleId, appointmentId, componentKey) {
  const slug = String(componentKey || "seccion").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const uuid = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${vehicleId}/${appointmentId}/${slug}/${uuid}.jpg`;
}

async function subirFoto(file, componentKey) {
  const appointment = dtekAdminAppointmentsCache.find(item => String(item.id) === String(dtekWorkOrderAppointmentId));
  // Citas de invitado o con vehículo escrito a mano no tienen vehicle_id
  // real — se usa el propio id de la cita como carpeta. Sigue siendo un
  // uuid válido para el cast de la política RLS de storage.objects; el
  // acceso de Dominic (admin) no depende de esa política de todos modos.
  const carpetaId = appointment?.vehicle_id || dtekWorkOrderAppointmentId;
  const blob = await comprimirImagen(file);
  const ruta = rutaFoto(carpetaId, dtekWorkOrderAppointmentId, componentKey);
  await DtekBackend.uploadInspectionPhoto(ruta, blob);
  return { ruta, blob };
}

function crearMiniatura(ruta, previewUrl) {
  const span = document.createElement("span");
  span.className = "photo-thumb-v33";
  span.innerHTML = `<img src="${previewUrl}" alt="Foto"><button type="button" data-remove-photo="${adminSafe(ruta)}" aria-label="Quitar foto">×</button>`;
  return span;
}

function iniciarDictado(key) {
  if (!SpeechRecognitionCtor) return;
  if (dtekReco) { try { dtekReco.stop(); } catch (e) {} }
  dtekReco = new SpeechRecognitionCtor();
  dtekReco.lang = "es-419";
  dtekReco.continuous = true;
  dtekReco.interimResults = false;
  dtekReco.maxAlternatives = 1;
  dtekRecoKey = key;
  adminQs(`[data-dictate="${key}"]`)?.classList.add("is-recording");
  dtekReco.onresult = (ev) => {
    let nuevo = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) nuevo += ev.results[i][0].transcript + " ";
    }
    nuevo = nuevo.trim();
    if (!nuevo) return;
    const item = dtekReporteVivo[key] = dtekReporteVivo[key] || dtekEstadoVacio();
    item.notes = item.notes ? `${item.notes.trim()} ${nuevo}` : nuevo;
    item.comment_source = "voice";
    const input = adminQs(`[data-inspection-note="${key}"]`);
    if (input) input.value = item.notes;
  };
  const limpiar = () => {
    adminQs(`[data-dictate="${key}"]`)?.classList.remove("is-recording");
    if (dtekRecoKey === key) dtekRecoKey = null;
  };
  dtekReco.onerror = limpiar;
  dtekReco.onend = limpiar;
  try { dtekReco.start(); } catch (e) {}
  clearTimeout(dtekRecoTimeout);
  dtekRecoTimeout = setTimeout(() => detenerDictado(key), 15000);
}

function detenerDictado(key) {
  clearTimeout(dtekRecoTimeout);
  if (dtekReco && dtekRecoKey === key) { try { dtekReco.stop(); } catch (e) {} }
}

function bindInspecciones() {
  const contenedor = adminQs(".inspection-capture-v33");
  if (!contenedor) return;

  contenedor.addEventListener("change", (ev) => {
    const sel = ev.target.closest("[data-inspection-key]");
    if (sel) {
      (dtekReporteVivo[sel.dataset.inspectionKey] = dtekReporteVivo[sel.dataset.inspectionKey] || dtekEstadoVacio()).status = sel.value;
      return;
    }
    const input = ev.target.closest("[data-photo-input]");
    if (!input || !input.files?.length) return;
    const key = input.dataset.photoInput;
    const file = input.files[0];
    input.value = "";
    const fotosHolder = adminQs(`[data-photos-for="${key}"]`);
    const temp = document.createElement("span");
    temp.className = "photo-thumb-v33 is-uploading";
    temp.textContent = "…";
    fotosHolder?.insertBefore(temp, fotosHolder.querySelector(".photo-add-btn-v33"));
    subirFoto(file, key).then(({ ruta, blob }) => {
      (dtekReporteVivo[key] = dtekReporteVivo[key] || dtekEstadoVacio()).photo_paths.push(ruta);
      temp.replaceWith(crearMiniatura(ruta, URL.createObjectURL(blob)));
    }).catch((error) => {
      temp.remove();
      alert(`No se pudo subir la foto: ${error.message}`);
    });
  });

  contenedor.addEventListener("input", (ev) => {
    const nota = ev.target.closest("[data-inspection-note]");
    if (nota) {
      const key = nota.dataset.inspectionNote;
      const item = dtekReporteVivo[key] = dtekReporteVivo[key] || dtekEstadoVacio();
      item.notes = nota.value;
      item.comment_source = "text";
      return;
    }
    const titulo = ev.target.closest("[data-custom-title]");
    if (titulo) {
      const key = titulo.dataset.customTitle;
      (dtekReporteVivo[key] = dtekReporteVivo[key] || dtekEstadoVacio()).label = titulo.value;
    }
  });

  contenedor.addEventListener("click", (ev) => {
    const quitarFoto = ev.target.closest("[data-remove-photo]");
    if (quitarFoto) {
      const thumb = quitarFoto.closest(".photo-thumb-v33");
      const fila = quitarFoto.closest("[data-maintenance-row]");
      const key = fila?.dataset.maintenanceRow;
      const ruta = quitarFoto.dataset.removePhoto;
      if (key && dtekReporteVivo[key]) dtekReporteVivo[key].photo_paths = dtekReporteVivo[key].photo_paths.filter(p => p !== ruta);
      thumb?.remove();
      return;
    }
    const quitarSeccion = ev.target.closest("[data-remove-section]");
    if (quitarSeccion) {
      const key = quitarSeccion.dataset.removeSection;
      if (!confirm("¿Quitar esta sección del reporte?")) return;
      dtekCustomKeys = dtekCustomKeys.filter(k => k !== key);
      delete dtekReporteVivo[key];
      pintarSeccionesCustom();
    }
  });

  adminQs("#workOrderAddCustomSection")?.addEventListener("click", () => {
    const key = nuevaClaveCustom();
    dtekCustomKeys.push(key);
    dtekReporteVivo[key] = dtekEstadoVacio();
    pintarSeccionesCustom();
    adminQs(`[data-custom-title="${key}"]`)?.focus();
  });

  const empezarDictado = (ev) => {
    const b = ev.target.closest("[data-dictate]");
    if (b) { ev.preventDefault(); iniciarDictado(b.dataset.dictate); }
  };
  const pararDictado = (ev) => {
    const b = ev.target.closest("[data-dictate]");
    if (b) detenerDictado(b.dataset.dictate);
  };
  contenedor.addEventListener("mousedown", empezarDictado);
  contenedor.addEventListener("touchstart", empezarDictado, { passive: false });
  ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(evt => contenedor.addEventListener(evt, pararDictado));
}

let lastFocusedBeforeWorkOrder = null;
function openWorkOrderModal(appointmentId) {
  const modal = adminQs("#workOrderModal");
  const form = adminQs("#workOrderForm");
  if (!modal || !form) return;
  lastFocusedBeforeWorkOrder = document.activeElement;
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
  renderWorkOrderInspections(appointment);

  form.querySelectorAll("[data-wo-subtab]").forEach((b) => b.classList.toggle("active", b.dataset.woSubtab === "recibo"));
  form.querySelectorAll("[data-wo-subpanel]").forEach((p) => p.classList.toggle("active", p.dataset.woSubpanel === "recibo"));

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

  // Si esta cita ya tiene un trabajo registrado (por ejemplo, el que se creo
  // con "Registrar trabajo"), traemos lo que ya esta guardado. Sin esto el
  // modal arranca con UNA linea del catalogo y al guardar se pierde el
  // detalle anterior: dtek_admin_cerrar_trabajo borra work_order_items y los
  // reemplaza enteros por lo que manda el panel (19_lineas_de_recibo.sql:150).
  precargarReporteExistente(appointmentId);
}

async function precargarReporteExistente(appointmentId) {
  const statusBox = adminQs("#workOrderStatusBox");
  try {
    const recibo = await withTimeout(DtekBackend.obtenerRecibo(appointmentId), 8000, "leer el reporte guardado");
    // El modal pudo cerrarse o cambiar de cita mientras se cargaba.
    if (String(dtekWorkOrderAppointmentId) !== String(appointmentId)) return;
    if (!recibo) return;

    const lineas = Array.isArray(recibo.lineas) ? recibo.lineas : [];
    const tieneAlgo = lineas.length || recibo.hallazgos || recibo.recomendaciones || recibo.notas || recibo.km;
    if (!tieneAlgo) return;

    if (lineas.length) {
      dtekLineas = lineas.map((l) => ({
        description: l.descripcion || "",
        kind: l.tipo || "part",
        quantity: Number(l.cantidad) || 1,
        unit_price: Number(l.precio) || 0,
        service_id: ""
      }));
      pintarLineas();
    }

    const set = (selector, value) => {
      const field = adminQs(selector);
      if (field && value != null && value !== "") field.value = value;
    };
    set("#workOrderMileage", recibo.km);
    set("#workOrderDiagnosis", recibo.hallazgos);
    set("#workOrderRecommendations", recibo.recomendaciones);
    set("#workOrderPartsNotes", recibo.notas);

    if (statusBox) {
      statusBox.innerHTML = `<p class="status-info">Este trabajo ya estaba registrado: cargamos ${lineas.length} línea${lineas.length === 1 ? "" : "s"} del recibo y lo que ya habías escrito. Editá lo que necesités y agregá las revisiones abajo.</p>`;
    }
  } catch (error) {
    // No bloquea: el modal ya está abierto y usable con la línea por defecto.
    console.warn("No se pudo precargar el reporte guardado:", error);
    if (statusBox && String(dtekWorkOrderAppointmentId) === String(appointmentId)) {
      statusBox.innerHTML = `<p class="status-warning">No pudimos leer si esta cita ya tenía un recibo guardado. Si ya le habías registrado el trabajo, revisá las líneas antes de guardar: al cerrar se reemplazan por las que estén acá.</p>`;
    }
  }
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

/* ---------- Registrar trabajo (cliente existente, fuera de catálogo) ----------
   Líneas de recibo duplicadas con nombres propios en vez de parametrizar
   agregarLinea/pintarLineas/sumarLineas/bindLineas: esas ya funcionan en
   producción para el modal de reporte técnico: tocarlas por un ahorro de
   código arriesga romper un flujo que ya anda, sin necesidad real (los dos
   formularios nunca están abiertos a la vez). */

let dtekWalkInClientId = null;
let dtekWalkInVehicles = [];
let dtekWalkInLineas = [];

function walkInStatus(message, type = "info") {
  const box = adminQs("#walkInJobStatus");
  if (box) box.innerHTML = message ? `<p class="status-${type}">${adminSafe(message)}</p>` : "";
}

function agregarLineaWalkIn(datos = {}) {
  dtekWalkInLineas.push({
    description: datos.description || "",
    kind: datos.kind || "part",
    quantity: Number(datos.quantity) || 1,
    unit_price: Number(datos.unit_price) || 0,
    service_id: ""
  });
  pintarLineasWalkIn();
}

function pintarLineasWalkIn() {
  const holder = adminQs("#walkInItems");
  const vacio = adminQs("#walkInItemsEmpty");
  if (!holder) return;

  holder.innerHTML = dtekWalkInLineas.map((l, i) => `
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

  if (vacio) vacio.style.display = dtekWalkInLineas.length ? "none" : "block";
  sumarLineasWalkIn();
}

function sumarLineasWalkIn() {
  const mano = dtekWalkInLineas.filter((l) => l.kind === "labor").reduce((a, l) => a + l.quantity * l.unit_price, 0);
  const resto = dtekWalkInLineas.filter((l) => l.kind !== "labor").reduce((a, l) => a + l.quantity * l.unit_price, 0);
  const set = (sel, v) => { const e = adminQs(sel); if (e) e.textContent = dtekMoneda(v); };
  set("#walkInPartsSum", resto);
  set("#walkInLaborSum", mano);
  set("#walkInGrandSum", mano + resto);
  return { mano, resto, total: mano + resto };
}

function bindLineasWalkIn() {
  const holder = adminQs("#walkInItems");
  if (!holder) return;

  holder.addEventListener("input", (ev) => {
    const fila = ev.target.closest("[data-linea]");
    if (!fila) return;
    const i = Number(fila.dataset.linea);
    const l = dtekWalkInLineas[i];
    if (!l) return;
    if (ev.target.classList.contains("linea-desc")) l.description = ev.target.value;
    if (ev.target.classList.contains("linea-cant")) l.quantity = Number(ev.target.value) || 0;
    if (ev.target.classList.contains("linea-precio")) l.unit_price = Number(ev.target.value) || 0;
    const sub = fila.querySelector(".linea-sub");
    if (sub) sub.textContent = dtekMoneda(l.quantity * l.unit_price);
    sumarLineasWalkIn();
  });

  holder.addEventListener("change", (ev) => {
    const fila = ev.target.closest("[data-linea]");
    if (!fila || !ev.target.classList.contains("linea-kind")) return;
    const l = dtekWalkInLineas[Number(fila.dataset.linea)];
    if (l) { l.kind = ev.target.value; sumarLineasWalkIn(); }
  });

  holder.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".linea-quitar");
    if (!btn) return;
    dtekWalkInLineas.splice(Number(btn.closest("[data-linea]").dataset.linea), 1);
    pintarLineasWalkIn();
  });

  adminQs("#walkInAddItem")?.addEventListener("click", () => {
    agregarLineaWalkIn({ kind: "part" });
    adminQs("#walkInItems .linea-v320:last-child .linea-desc")?.focus();
  });
}

function pintarWalkInVehiculos() {
  const select = adminQs("#walkInVehicle");
  const manual = adminQs("#walkInManualVehicle");
  if (!select) return;
  const opciones = dtekWalkInVehicles.map((v, i) =>
    `<option value="${i}">${adminSafe([v.brand, v.line, v.year].filter(Boolean).join(" ") || "Vehículo")}${v.plate ? " · " + adminSafe(v.plate) : ""}</option>`
  ).join("");
  select.innerHTML = opciones + `<option value="manual">Otro vehículo (escribir a mano)</option>`;
  const esManual = dtekWalkInVehicles.length === 0;
  select.value = esManual ? "manual" : "0";
  manual.classList.toggle("hidden-field", !esManual);
  adminQs("#walkInVehicleBrand").required = esManual;
  adminQs("#walkInVehicleLine").required = esManual;
}

function bindWalkInJob() {
  adminQs("#walkInJobStatus")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-abrir-reporte]");
    if (btn) openWorkOrderModal(btn.dataset.abrirReporte);
  });

  adminQs("#walkInVehicle")?.addEventListener("change", (event) => {
    const manual = event.target.value === "manual";
    adminQs("#walkInManualVehicle")?.classList.toggle("hidden-field", !manual);
    adminQs("#walkInVehicleBrand").required = manual;
    adminQs("#walkInVehicleLine").required = manual;
  });

  adminQs("#walkInSearchClient")?.addEventListener("click", async () => {
    const phone = adminQs("#walkInPhone")?.value.trim() || "";
    const foundBox = adminQs("#walkInClientFound");
    const missingBox = adminQs("#walkInClientMissing");
    const vehicleBlock = adminQs("#walkInVehicleBlock");
    foundBox?.classList.add("hidden-field");
    missingBox?.classList.add("hidden-field");
    vehicleBlock?.classList.add("hidden-field");
    dtekWalkInClientId = null;
    dtekWalkInVehicles = [];
    if (!phone) { walkInStatus("Escribí el teléfono del cliente.", "error"); return; }
    try {
      walkInStatus("Buscando...", "info");
      const result = await DtekBackend.lookupClientByPhoneAdmin(phone);
      if (!result?.found) {
        missingBox.classList.remove("hidden-field");
        missingBox.innerHTML = `<p class="status-warning">Ese teléfono no tiene una cuenta todavía. Usá "Crear acceso" para darlo de alta primero.</p>`;
        walkInStatus("", "info");
        return;
      }
      dtekWalkInClientId = result.client_id;
      dtekWalkInVehicles = result.vehicles || [];
      foundBox.classList.remove("hidden-field");
      foundBox.innerHTML = `<p class="status-ok">${adminSafe(result.name || "Cliente")} · ${adminSafe(result.phone || phone)}</p>`;
      pintarWalkInVehiculos();
      if (!adminQs("#walkInServiceDate").value) {
        adminQs("#walkInServiceDate").value = new Date().toISOString().slice(0, 10);
      }
      vehicleBlock.classList.remove("hidden-field");
      walkInStatus("", "info");
    } catch (error) {
      walkInStatus(error?.message || "No se pudo buscar el cliente.", "error");
    }
  });

  adminQs("#walkInJobForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!dtekWalkInClientId) { walkInStatus("Buscá y confirmá el cliente antes de registrar el trabajo.", "error"); return; }
    const lineas = dtekWalkInLineas.filter((l) => String(l.description || "").trim());
    const descripcion = adminQs("#walkInDescription")?.value.trim() || "";
    if (!descripcion) { walkInStatus("Escribí qué trabajo se hizo.", "error"); return; }

    const vSel = adminQs("#walkInVehicle")?.value;
    const esManual = vSel === "manual" || dtekWalkInVehicles.length === 0;
    const vehiculo = esManual ? null : dtekWalkInVehicles[Number(vSel)];
    if (esManual && (!adminQs("#walkInVehicleBrand")?.value.trim() || !adminQs("#walkInVehicleLine")?.value.trim())) {
      walkInStatus("Indicá marca y línea del vehículo.", "error");
      return;
    }

    const submit = event.target.querySelector('button[type="submit"]');
    try {
      if (submit) { submit.disabled = true; submit.textContent = "Registrando..."; }
      walkInStatus("Registrando el trabajo...", "info");
      const payload = {
        client_id: dtekWalkInClientId,
        vehicle_id: vehiculo?.id || null,
        vehicle_brand: esManual ? adminQs("#walkInVehicleBrand")?.value.trim() : null,
        vehicle_line: esManual ? adminQs("#walkInVehicleLine")?.value.trim() : null,
        vehicle_year: esManual ? (adminQs("#walkInVehicleYear")?.value || null) : null,
        service_date: adminQs("#walkInServiceDate")?.value || null,
        mileage: adminQs("#walkInMileage")?.value || null,
        job_description: descripcion,
        recommendations: adminQs("#walkInRecommendations")?.value.trim() || "",
        duration_minutes: adminQs("#walkInDuration")?.value || null,
        location: adminQs("#walkInLocation")?.value.trim() || null,
        items: lineas.map((l, i) => ({ ...l, position: i }))
      };
      const orden = await withTimeout(DtekBackend.logCompletedJob(payload), 12000, "registrar el trabajo");
      // "Registrar trabajo" no captura estado de frenos/llantas ni el proximo
      // servicio: eso vive en el reporte tecnico. Antes habia que ir a Citas y
      // encontrar el boton uno mismo, asi que se ofrece el atajo aca.
      const citaRegistrada = orden?.appointment_id || null;
      walkInStatus("Trabajo registrado. Ya aparece en Citas.", "ok");
      event.target.reset();
      dtekWalkInClientId = null;
      dtekWalkInVehicles = [];
      dtekWalkInLineas = [];
      pintarLineasWalkIn();
      adminQs("#walkInVehicleBlock")?.classList.add("hidden-field");
      adminQs("#walkInClientFound")?.classList.add("hidden-field");
      await refreshAllAdminData();
      // La cita ya esta en cache: recien aca el atajo puede abrir el modal.
      if (citaRegistrada) {
        const box = adminQs("#walkInJobStatus");
        if (box) {
          box.innerHTML = `<p class="status-ok">Trabajo registrado. Ya aparece en Citas.</p>`
            + `<p class="status-info">Falta lo que este formulario no pregunta: cada cuántos km toca el próximo servicio y cómo quedaron frenos, llantas, batería y suspensión.</p>`
            + `<button type="button" class="btn btn-primary" data-abrir-reporte="${adminSafe(citaRegistrada)}">Agregar revisiones y próximo servicio</button>`;
        }
      }
    } catch (error) {
      walkInStatus(error?.message || "No se pudo registrar el trabajo.", "error");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Registrar trabajo"; }
    }
  });
}

/* ====== Crear cita en vivo (WhatsApp → cita abierta → reporte en vivo) ======
   Variables y funciones propias, sin tocar dtekWalkIn* — mismo criterio
   que "Registrar trabajo": no arriesgar un flujo ya en producción. */
let dtekLiveClientId = null;
let dtekLiveVehicles = [];

function liveApptStatus(message, type = "info") {
  const box = adminQs("#liveApptStatus");
  if (box) box.innerHTML = message ? `<p class="status-${type}">${adminSafe(message)}</p>` : "";
}

function pintarLiveVehiculos() {
  const select = adminQs("#liveApptVehicle");
  const manual = adminQs("#liveApptManualVehicle");
  if (!select) return;
  const opciones = dtekLiveVehicles.map((v, i) =>
    `<option value="${i}">${adminSafe([v.brand, v.line, v.year].filter(Boolean).join(" ") || "Vehículo")}${v.plate ? " · " + adminSafe(v.plate) : ""}</option>`
  ).join("");
  select.innerHTML = opciones + `<option value="manual">Otro vehículo (escribir a mano)</option>`;
  const esManual = dtekLiveVehicles.length === 0;
  select.value = esManual ? "manual" : "0";
  manual.classList.toggle("hidden-field", !esManual);
}

function dtekAhoraParaInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openLiveApptModal() {
  const modal = adminQs("#liveApptModal");
  const form = adminQs("#liveApptForm");
  if (!modal || !form) return;
  form.reset();
  dtekLiveClientId = null;
  dtekLiveVehicles = [];
  liveApptStatus("");
  adminQs("#liveApptClientFound")?.classList.add("hidden-field");
  adminQs("#liveApptGuestFields")?.classList.add("hidden-field");
  adminQs("#liveApptVehicleBlock")?.classList.add("hidden-field");
  adminQs("#liveApptWhen").value = dtekAhoraParaInput();
  adminQs("#liveApptDuration").value = "60";
  modal.classList.remove("hidden-field");
  adminQs("#liveApptPhone")?.focus();
}

function closeLiveApptModal() {
  adminQs("#liveApptModal")?.classList.add("hidden-field");
}

function bindLiveApptModal() {
  adminQs("#horarioNewAppt")?.addEventListener("click", openLiveApptModal);
  adminQs("#liveApptModalClose")?.addEventListener("click", closeLiveApptModal);
  adminQs("#liveApptModalCancel")?.addEventListener("click", closeLiveApptModal);
  adminQs("#liveApptModal")?.addEventListener("click", (event) => {
    if (event.target.id === "liveApptModal") closeLiveApptModal();
  });

  adminQs("#liveApptVehicle")?.addEventListener("change", (event) => {
    adminQs("#liveApptManualVehicle")?.classList.toggle("hidden-field", event.target.value !== "manual");
  });

  adminQs("#liveApptSearchClient")?.addEventListener("click", async () => {
    const phone = adminQs("#liveApptPhone")?.value.trim() || "";
    dtekLiveClientId = null;
    dtekLiveVehicles = [];
    adminQs("#liveApptClientFound")?.classList.add("hidden-field");
    adminQs("#liveApptGuestFields")?.classList.add("hidden-field");
    adminQs("#liveApptVehicleBlock")?.classList.add("hidden-field");
    if (!phone) { liveApptStatus("Escribí el teléfono del cliente.", "error"); return; }
    try {
      liveApptStatus("Buscando...", "info");
      const result = await DtekBackend.lookupClientByPhoneAdmin(phone);
      if (!result?.found) {
        // A diferencia de "Registrar trabajo", acá NO se bloquea: es
        // normal que alguien escriba por WhatsApp por primera vez.
        adminQs("#liveApptGuestFields")?.classList.remove("hidden-field");
        adminQs("#liveApptVehicleBlock")?.classList.remove("hidden-field");
        adminQs("#liveApptManualVehicle")?.classList.remove("hidden-field");
        liveApptStatus("No tiene cuenta todavía — se crea la cita como cliente nuevo.", "info");
        adminQs("#liveApptName")?.focus();
        return;
      }
      dtekLiveClientId = result.client_id;
      dtekLiveVehicles = result.vehicles || [];
      const foundBox = adminQs("#liveApptClientFound");
      foundBox?.classList.remove("hidden-field");
      if (foundBox) foundBox.innerHTML = `<p class="status-ok">${adminSafe(result.name || "Cliente")} · ${adminSafe(result.phone || phone)}</p>`;
      pintarLiveVehiculos();
      adminQs("#liveApptVehicleBlock")?.classList.remove("hidden-field");
      liveApptStatus("", "info");
    } catch (error) {
      liveApptStatus(error?.message || "No se pudo buscar el cliente.", "error");
    }
  });

  adminQs("#liveApptForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const esInvitado = !dtekLiveClientId;
    if (esInvitado && !adminQs("#liveApptName")?.value.trim()) {
      liveApptStatus("Escribí el nombre del cliente.", "error");
      return;
    }
    const vSel = adminQs("#liveApptVehicle")?.value;
    const esManual = esInvitado || vSel === "manual" || dtekLiveVehicles.length === 0;
    const vehiculo = esManual ? null : dtekLiveVehicles[Number(vSel)];
    if (esManual && (!adminQs("#liveApptVehicleBrand")?.value.trim() || !adminQs("#liveApptVehicleLine")?.value.trim())) {
      liveApptStatus("Indicá marca y línea del vehículo.", "error");
      return;
    }
    const cuando = adminQs("#liveApptWhen")?.value;
    if (!cuando) { liveApptStatus("Elegí fecha y hora.", "error"); return; }

    const submit = event.target.querySelector('button[type="submit"]');
    try {
      if (submit) { submit.disabled = true; submit.textContent = "Creando..."; }
      liveApptStatus("Creando la cita...", "info");
      const payload = {
        client_id: dtekLiveClientId || null,
        vehicle_id: vehiculo?.id || null,
        client_name: esInvitado ? adminQs("#liveApptName")?.value.trim() : null,
        client_phone: adminQs("#liveApptPhone")?.value.trim() || null,
        vehicle_brand: esManual ? adminQs("#liveApptVehicleBrand")?.value.trim() : null,
        vehicle_line: esManual ? adminQs("#liveApptVehicleLine")?.value.trim() : null,
        vehicle_year: esManual ? (adminQs("#liveApptVehicleYear")?.value || null) : null,
        service_label: adminQs("#liveApptDescription")?.value.trim() || null,
        location: adminQs("#liveApptLocation")?.value.trim() || null,
        scheduled_start: new Date(cuando).toISOString(),
        duration_minutes: Number(adminQs("#liveApptDuration")?.value) || 60
      };
      const nuevaCita = await withTimeout(DtekBackend.createLiveAppointment(payload), 12000, "crear la cita");
      dtekAdminAppointmentsCache.unshift(nuevaCita);
      renderMetrics(dtekAdminAppointmentsCache);
      renderAppointmentsList(dtekAdminAppointmentsCache);
      renderHorarioView();
      closeLiveApptModal();
      openWorkOrderModal(nuevaCita.id);
      refreshAllAdminData();
    } catch (error) {
      liveApptStatus(error?.message || "No se pudo crear la cita.", "error");
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Crear cita y abrir reporte"; }
    }
  });
}

function closeWorkOrderModal() {
  adminQs("#workOrderModal")?.classList.add("hidden-field");
  dtekWorkOrderAppointmentId = null;
  lastFocusedBeforeWorkOrder?.focus?.();
  lastFocusedBeforeWorkOrder = null;
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

  const erroresInspeccion = validarReporteVivo();
  if (erroresInspeccion.length) {
    if (statusBox) statusBox.innerHTML = `<p class="status-error">Revisá antes de publicar:<br>${erroresInspeccion.map(adminSafe).join("<br>")}</p>`;
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
    const inspections = collectWorkOrderInspections();
    if (inspections.length) {
      await withTimeout(DtekBackend.saveVehicleInspections(appointmentId, inspections), 12000, "guardar las revisiones");
    }
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

/* ---------- Navegación del panel (tabs + sub-tabs) ---------- */

const ADMIN_SECTIONS = ["resumen", "citas", "referidos", "clientes"];

function setAdminSection(section) {
  const normalized = ADMIN_SECTIONS.includes(section) ? section : "resumen";
  document.body.dataset.adminSectionActive = normalized;
  adminQsa("[data-admin-section]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.adminSection === normalized);
    btn.setAttribute("aria-current", btn.dataset.adminSection === normalized ? "page" : "false");
  });
  adminQsa("[data-admin-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.adminPanel === normalized));
  try { sessionStorage.setItem("dtekAdminSection", normalized); } catch (e) {}
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindAdminNav() {
  adminQsa("[data-admin-section]").forEach((btn) => btn.addEventListener("click", () => setAdminSection(btn.dataset.adminSection)));
  let restored = "resumen";
  try { restored = sessionStorage.getItem("dtekAdminSection") || "resumen"; } catch (e) {}
  setAdminSection(restored);
}

// Generica: sirve tanto para los sub-tabs de pagina (Citas/Bloqueos, etc.)
// como para los del modal de orden de trabajo (Recibo/Inspeccion).
function bindAdminSectionSubtabs(container, subtabAttr, subpanelAttr) {
  if (!container) return;
  container.addEventListener("click", (event) => {
    const btn = event.target.closest(`[${subtabAttr}]`);
    if (!btn) return;
    // Cada grupo de sub-tabs vive junto a sus paneles dentro del mismo padre
    // (ej. la <section> de "Citas" tiene su propio par lista/bloqueos). Sin
    // este scope, tocar un sub-tab en una sección apagaba el sub-tab activo
    // de las otras secciones, dejándolas en blanco hasta volver a tocarlas.
    const scope = btn.closest(".admin-subtabs-v34, .wo-subtabs-v34")?.parentElement || container;
    const key = btn.getAttribute(subtabAttr);
    scope.querySelectorAll(`[${subtabAttr}]`).forEach((b) => b.classList.toggle("active", b === btn));
    scope.querySelectorAll(`[${subpanelAttr}]`).forEach((p) => p.classList.toggle("active", p.getAttribute(subpanelAttr) === key));
  });
}

/* ---------- Modal generico (reemplaza prompt()/confirm() nativos) ---------- */

let dtekGenericModalResolver = null;
let dtekGenericModalMode = "confirm"; // "confirm" | "prompt"

function adminGenericModalOpen({ title = "Confirmar", message = "", inputLabel = null, inputValue = "", okLabel = "Aceptar", cancelLabel = "Cancelar" } = {}) {
  return new Promise((resolve) => {
    dtekGenericModalResolver = resolve;
    dtekGenericModalMode = inputLabel != null ? "prompt" : "confirm";
    adminQs("#adminGenericModalTitle").textContent = title;
    adminQs("#adminGenericModalMessage").textContent = message;
    const wrap = adminQs("#adminGenericModalInputWrap");
    const input = adminQs("#adminGenericModalInput");
    wrap.classList.toggle("hidden-field", dtekGenericModalMode !== "prompt");
    if (dtekGenericModalMode === "prompt") {
      adminQs("#adminGenericModalInputLabel").textContent = inputLabel;
      input.value = inputValue;
    }
    adminQs("#adminGenericModalOk").textContent = okLabel;
    adminQs("#adminGenericModalCancel").textContent = cancelLabel;
    adminQs("#adminGenericModal").classList.remove("hidden-field");
    (dtekGenericModalMode === "prompt" ? input : adminQs("#adminGenericModalOk"))?.focus();
  });
}

function adminGenericModalClose(result) {
  adminQs("#adminGenericModal")?.classList.add("hidden-field");
  const resolve = dtekGenericModalResolver;
  dtekGenericModalResolver = null;
  resolve?.(result);
}

function adminConfirm(message, opts = {}) {
  return adminGenericModalOpen({ message, ...opts });
}

function adminPrompt(message, { defaultValue = "", ...opts } = {}) {
  return adminGenericModalOpen({ inputLabel: message, inputValue: defaultValue, ...opts })
    .then((result) => (result === false ? null : result));
}

function bindAdminGenericModal() {
  const okValue = () => (dtekGenericModalMode === "prompt" ? adminQs("#adminGenericModalInput").value : true);
  const cancelValue = () => (dtekGenericModalMode === "prompt" ? null : false);
  adminQs("#adminGenericModalOk")?.addEventListener("click", () => adminGenericModalClose(okValue()));
  adminQs("#adminGenericModalCancel")?.addEventListener("click", () => adminGenericModalClose(cancelValue()));
  adminQs("#adminGenericModal")?.addEventListener("click", (event) => {
    if (event.target.id === "adminGenericModal") adminGenericModalClose(cancelValue());
  });
  adminQs("#adminGenericModalInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); adminQs("#adminGenericModalOk")?.click(); }
  });
}

function handleAdminEscape(event) {
  if (event.key !== "Escape") return;
  if (!adminQs("#adminGenericModal")?.classList.contains("hidden-field")) {
    adminGenericModalClose(dtekGenericModalMode === "prompt" ? null : false);
    return;
  }
  if (!adminQs("#workOrderModal")?.classList.contains("hidden-field")) closeWorkOrderModal();
}

/* ---------- Gate (login) vs shell (panel logueado) ---------- */

async function refreshAdminGateState() {
  const gate = adminQs("#adminGate");
  const shell = adminQs("#adminShell");
  const logoutBtn = adminQs("#backendLogout");
  try {
    const { session, profile, isAdmin } = await getAdminProfileOrExplain();
    const authed = Boolean(session && isAdmin);
    gate?.classList.toggle("hidden-field", authed);
    shell?.classList.toggle("hidden-field", !authed);
    logoutBtn?.classList.toggle("hidden-field", !authed);
    if (authed) {
      backendStatus(`Sesión admin activa: ${profile.email || session.user.email}`, "ok");
      await refreshAllAdminData();
    }
  } catch (error) {
    gate?.classList.remove("hidden-field");
    shell?.classList.add("hidden-field");
    logoutBtn?.classList.add("hidden-field");
  }
}

/* ---------- Bind por sección ---------- */

function bindResumen() {
  adminQs("#backendLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      backendStatus("Iniciando sesión...", "info");
      await withTimeout(DtekBackend.signIn(adminQs("#backendIdentifier").value.trim(), adminQs("#backendPassword").value), 10000, "login");
      backendStatus("Sesión iniciada. Cargando panel...", "ok");
      await refreshAdminGateState();
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
    adminQs("#adminGate")?.classList.remove("hidden-field");
    adminQs("#adminShell")?.classList.add("hidden-field");
    adminQs("#backendLogout")?.classList.add("hidden-field");
  });
}

function bindCitas() {
  adminQs("#backendRefresh")?.addEventListener("click", refreshAllAdminData);

  document.addEventListener("click", async (event) => {
    const filterBtn = event.target.closest("[data-filter-status]");
    if (filterBtn) {
      dtekAdminFilter = filterBtn.dataset.filterStatus;
      adminQsa("[data-filter-status]").forEach((b) => b.classList.toggle("active", b === filterBtn));
      renderAppointmentsList(dtekAdminAppointmentsCache);
      return;
    }

    const pendienteBtn = event.target.closest("[data-admin-filter]");
    if (pendienteBtn) {
      dtekAdminFilter = pendienteBtn.dataset.adminFilter;
      adminQsa("[data-filter-status]").forEach((b) => b.classList.toggle("active", b.dataset.filterStatus === dtekAdminFilter));
      renderAppointmentsList(dtekAdminAppointmentsCache);
      setAdminSection("citas");
      const citasSubtab = adminQs('#adminShell [data-admin-subtab="lista"]');
      citasSubtab?.click();
      return;
    }

    const statusBtn = event.target.closest("[data-backend-status]");
    if (statusBtn) {
      try {
        const status = statusBtn.dataset.backendStatus;
        const note = (await adminPrompt(`Nota interna para marcar como ${dtekStatusLabel(status)}:`, { defaultValue: `Estado actualizado a ${dtekStatusLabel(status)}` })) || "";
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
      if (!(await adminConfirm("¿Eliminar este bloqueo de agenda?"))) return;
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

function bindReferidos() {
  adminQs("#backendRefreshReferrals")?.addEventListener("click", loadBackendReferrals);
  adminQs("#backendRefreshRedemptions")?.addEventListener("click", loadBackendRedemptions);

  document.addEventListener("click", async (event) => {
    const referralFilterBtn = event.target.closest("[data-referral-filter]");
    if (referralFilterBtn) {
      dtekReferralFilter = referralFilterBtn.dataset.referralFilter || "all";
      adminQsa("[data-referral-filter]").forEach((b) => b.classList.toggle("active", b === referralFilterBtn));
      renderReferralsList(dtekAdminReferralsCache);
      return;
    }

    const referralStatusBtn = event.target.closest("[data-referral-status]");
    if (referralStatusBtn) {
      try {
        const status = referralStatusBtn.dataset.referralStatus;
        const referral = dtekAdminReferralsCache.find(item => String(item.id) === String(referralStatusBtn.dataset.referralId));
        const reward = 0;
        if (status === "converted" && !(await adminConfirm(`¿Confirmar que ${referral?.referred_name || "el referido"} completó su primer trabajo y acreditar 100 puntos?`))) return;
        if (status === "discarded" && !(await adminConfirm("¿Marcar esta recomendación como no convertida?"))) return;
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
        const amountText = await adminPrompt(`Ajuste de puntos para ${loyaltyAdjustBtn.dataset.referrerName}.`, { defaultValue: "100" });
        if (amountText === null) return;
        const amount = Number(amountText);
        if (!Number.isInteger(amount) || amount === 0) throw new Error("Ingresá puntos enteros diferentes de cero.");
        const description = (await adminPrompt("Motivo:", { defaultValue: amount < 0 ? "Ajuste de puntos" : "Puntos manuales" })) || "Ajuste D-TEK";
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
        const note = (await adminPrompt(status === "fulfilled" ? "Nota del canje:" : "Motivo de cancelación:", { defaultValue: "" })) || "";
        await withTimeout(DtekBackend.updateRedemptionStatus(redemptionBtn.dataset.redemptionId, status, note), 8000, "actualizar canje");
        await loadBackendRedemptions();
      } catch (error) { alert(error.message); }
    }
  });
}

function bindClientes() {
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

  const quickServiceSelect = adminQs("#quickService");
  if (quickServiceSelect) {
    quickServiceSelect.innerHTML = `<option value="">Elegir servicio</option>` +
      (window.DTEK_SERVICES || []).map(s => `<option value="${adminSafe(s.id)}">${adminSafe(s.name)} · ${adminSafe(s.price)}</option>`).join("");
  }

  adminQs("#quickClientPhone")?.addEventListener("blur", async (event) => {
    const raw = event.target.value.trim();
    const key = raw.replace(/\D/g, "").slice(-8);
    if (key.length < 8 || key === quickPhoneLookupLastKey || quickPhoneLookupBusy) return;
    quickPhoneLookupBusy = true;
    quickPhoneLookupLastKey = key;
    try {
      const result = await DtekBackend.lookupByPhone(raw);
      if (!result?.found) return;
      const vehicle = (result.vehicles || [])[0];
      if (vehicle) {
        if (vehicle.brand) adminQs("#quickBrand").value = vehicle.brand;
        if (vehicle.line) adminQs("#quickLine").value = vehicle.line;
        if (vehicle.year) adminQs("#quickYear").value = vehicle.year;
        if (vehicle.engine) adminQs("#quickEngine").value = vehicle.engine;
      }
      if (result.name && !adminQs("#quickClientName").value.trim()) adminQs("#quickClientName").value = result.name;
      if (result.email) adminQs("#quickClientEmail").value = result.email;
      if (result.city) adminQs("#quickClientCity").value = result.city;
      if (result.location) adminQs("#quickClientAddress").value = result.location;
    } catch (error) {
      console.warn("No se pudo buscar por teléfono", error);
    } finally {
      quickPhoneLookupBusy = false;
    }
  });

  adminQs("#quickScheduleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const brand = adminQs("#quickBrand")?.value.trim() || "";
    const line = adminQs("#quickLine")?.value.trim() || "";
    const year = adminQs("#quickYear")?.value || "";
    const engine = adminQs("#quickEngine")?.value.trim() || "";
    const moves = adminQs("#quickMoves")?.value || "";
    const serviceId = adminQs("#quickService")?.value || "";
    const clientName = adminQs("#quickClientName")?.value.trim() || "";
    const clientPhone = adminQs("#quickClientPhone")?.value.trim() || "";
    const clientEmail = adminQs("#quickClientEmail")?.value.trim() || "";
    const clientCity = adminQs("#quickClientCity")?.value.trim() || "";
    const clientAddress = adminQs("#quickClientAddress")?.value.trim() || "";
    const customDesc = adminQs("#quickCustomDesc")?.value.trim() || "";
    const customPrice = adminQs("#quickCustomPrice")?.value || "";
    const customDuration = adminQs("#quickCustomDuration")?.value || "";

    if (!serviceId && !customDesc) {
      provisionStatus("Elegí un servicio del catálogo o escribí una descripción para cotizar aparte.", "error");
      return;
    }
    const phoneDigits = clientPhone.replace(/\D/g, "");
    if (clientPhone && (phoneDigits.length < 8 || phoneDigits.length > 12)) {
      provisionStatus("Ese teléfono no parece completo — revisalo antes de generar el link (el botón de WhatsApp abre a ese número).", "error");
      return;
    }

    const qp = new URLSearchParams();
    qp.set("marca", brand);
    qp.set("linea", line);
    if (year) qp.set("anio", year);
    if (engine) qp.set("motor", engine);
    if (moves) qp.set("arranca", moves);
    if (clientName) qp.set("nombre", clientName);
    if (clientPhone) qp.set("telefono", clientPhone);
    if (clientEmail) qp.set("correo", clientEmail);
    if (clientCity) qp.set("zona", clientCity);
    if (clientAddress) qp.set("direccion", clientAddress);

    let serviceName;
    let precioTexto;
    if (customDesc) {
      qp.set("servicio", "custom-quote");
      qp.set("descripcion", customDesc);
      if (customPrice) qp.set("estimado", customPrice);
      if (customDuration) qp.set("duracion", customDuration);
      serviceName = customDesc;
      precioTexto = customPrice ? `, estimado desde Q${Number(customPrice).toLocaleString("es-GT")}` : "";
    } else {
      qp.set("servicio", serviceId);
      serviceName = window.DTEK_SERVICES?.find(s => s.id === serviceId)?.name || "el servicio";
      precioTexto = "";
    }

    const link = `${window.location.origin}/agenda.html?${qp.toString()}`;
    const primerNombre = clientName.split(" ")[0] || "";
    const mensaje = `Hola${primerNombre ? " " + primerNombre : ""}, quedó listo tu pedido de ${serviceName} para tu ${brand} ${line}${precioTexto}. Elegí el día y la hora que mejor te quede aquí: ${link}`;

    const resultBox = adminQs("#quickScheduleResult");
    if (resultBox) {
      resultBox.classList.remove("hidden-field");
      resultBox.innerHTML = `
        <h3>Link listo</h3>
        <div class="dtek-provision-credentials">
          <code>${adminSafe(link)}</code>
        </div>
        <button class="btn btn-cyan" type="button" id="copyQuickLink">Copiar mensaje para WhatsApp</button>
        ${clientPhone ? `<button class="btn btn-primary" type="button" id="openQuickWhatsapp">Abrir WhatsApp con este cliente</button>` : ""}
      `;
      adminQs("#copyQuickLink")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(mensaje);
        provisionStatus("Mensaje copiado. Pegalo en la conversación de WhatsApp.", "ok");
      });
      adminQs("#openQuickWhatsapp")?.addEventListener("click", () => {
        const digits = clientPhone.replace(/\D/g, "");
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
      });
    }
  });
}

function bindWorkOrderModal() {
  adminQs("#workOrderForm")?.addEventListener("submit", (ev) => submitWorkOrderReport(ev, { compartir: false }));
  adminQs("#workOrderSaveAndShare")?.addEventListener("click", (ev) => submitWorkOrderReport(ev, { compartir: true }));
  adminQs("#workOrderModalClose")?.addEventListener("click", closeWorkOrderModal);
  adminQs("#workOrderModalCancel")?.addEventListener("click", closeWorkOrderModal);
  adminQs("#workOrderModal")?.addEventListener("click", (event) => {
    if (event.target.id === "workOrderModal") closeWorkOrderModal();
  });
}

let quickPhoneLookupBusy = false;
let quickPhoneLookupLastKey = "";

async function initBackendAdmin() {
  renderBackendSystemStatus();

  bindResumen();
  bindCitas();
  bindHorario();
  bindReferidos();
  bindClientes();
  bindWorkOrderModal();
  bindLiveApptModal();
  bindLineas();
  bindWalkInJob();
  bindLineasWalkIn();
  bindInspecciones();
  bindAdminNav();
  bindAdminSectionSubtabs(adminQs("#adminShell"), "data-admin-subtab", "data-admin-subpanel");
  bindAdminSectionSubtabs(adminQs("#workOrderForm"), "data-wo-subtab", "data-wo-subpanel");
  bindAdminGenericModal();
  document.addEventListener("keydown", handleAdminEscape);

  await refreshAdminGateState();
}

document.addEventListener("DOMContentLoaded", initBackendAdmin);
