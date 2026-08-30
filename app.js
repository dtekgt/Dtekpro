/*
  D-TEK GT Web OS v5 Own Scheduler — Propiedad de D-TEK GT / Dominic Morales.
  Código creado para uso exclusivo de D-TEK GT.
*/

console.info("%cD-TEK GT Web OS v5 · Own Scheduler", "color:#e32025;font-size:18px;font-weight:900");
console.info("Propiedad de D-TEK GT / Dominic Morales · Agenda propia local tipo Setmore, creada desde cero.");

let currentCategory = "Recomendados";
let selectedAgendaDate = "";
let selectedAgendaTime = "";
let dtekBusyBlocksCache = {};
let linkedAgendaVehicle = null;
let linkedAgendaVehicleId = "";
let linkedAgendaProfile = null;
let linkedAgendaSession = null;
let selectedSymptomLabel = "";
let selectedAgendaServiceIds = [];
let smartAgendaContextPromise = null;
let smartProfileEditing = false;
let agendaGarageVehicles = [];
let agendaAccountMode = "guest";
const DTEK_CLIENT_PREFS_KEY = "dtek_client_preferences_v1";

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const params = new URLSearchParams(window.location.search);

function findService(id) {
  return dtekServices.find(service => service.id === id);
}

function estimateServicePoints(service) {
  const match = String(service?.price || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  const price = match ? Number(match[1]) : 0;
  return Math.max(10, Math.floor(price / 10));
}

function quotedAmount(item) {
  if (!item) return null;
  if (Number.isFinite(item.priceAmount)) return Number(item.priceAmount);
  const match = String(item.price || "").replace(/,/g, "").match(/Q\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : null;
}

function getSelectedServices() {
  return selectedAgendaServiceIds.map(id => findService(id)).filter(Boolean);
}

function getPrimaryService() {
  return getSelectedServices()[0] || null;
}

function serviceSelectionText(services = getSelectedServices()) {
  if (!services.length) return "Ninguno";
  return services.map(service => `- ${service.name} (${service.price})`).join("\n");
}

function buildQuoteSummary(services = getSelectedServices(), addOns = getSelectedAddOns()) {
  const items = [...services, ...addOns];
  const fixedTotal = items.reduce((sum, item) => sum + (quotedAmount(item) || 0), 0);
  const variableCount = items.filter(item => quotedAmount(item) === null).length;
  const count = items.length;
  let label = "Agregá un servicio";
  if (fixedTotal > 0 && variableCount) label = `Desde Q${fixedTotal.toLocaleString("es-GT")} + por cotizar`;
  else if (fixedTotal > 0) label = `Desde Q${fixedTotal.toLocaleString("es-GT")}`;
  else if (variableCount) label = "Cotización por confirmar";
  return { fixedTotal, variableCount, count, label };
}

function buildCompositeAgendaService() {
  const services = getSelectedServices();
  if (!services.length) return null;
  const addOns = getSelectedAddOns();
  const primary = services[0];
  const durationMinutes = Math.min(480, Math.max(30,
    services.reduce((sum, service) => sum + Number(service.durationMinutes || 60), 0) +
    addOns.reduce((sum, addon) => sum + Number(addon.durationMinutes || 0), 0)
  ));
  return {
    ...primary,
    name: services.length > 1 ? `${primary.name} + ${services.length - 1} servicio${services.length > 2 ? "s" : ""} más` : primary.name,
    durationMinutes,
    bufferBefore: Math.max(...services.map(service => Number(service.bufferBefore || 0)), 15),
    bufferAfter: Math.max(...services.map(service => Number(service.bufferAfter || 0)), 30)
  };
}

function otherServiceIsSelected() {
  return selectedAgendaServiceIds.includes("otros-servicios");
}

function updateOtherServiceField() {
  const holder = qs("#otherServiceRequest");
  const input = qs("#otherServiceDetails");
  const visible = otherServiceIsSelected();
  holder?.classList.toggle("hidden-field", !visible);
  if (input) input.required = visible;
}

function updateServiceSelectionButtons() {
  qsa("[data-agenda-service]").forEach(button => {
    const selected = selectedAgendaServiceIds.includes(button.dataset.agendaService);
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    if (button.classList.contains("selector-service-pick")) button.textContent = selected ? "Quitar" : "Agregar";
  });
}

function renderServiceBuilderQuote() {
  const holder = qs("#serviceQuoteBuilder");
  if (!holder) return;
  const services = getSelectedServices();
  const addOns = getSelectedAddOns();
  const quote = buildQuoteSummary(services, addOns);
  const rows = [
    ...services.map((service, index) => `<li><span><small>${index === 0 ? "Servicio principal" : "Servicio adicional"}</small><strong>${safeText(service.name)}</strong></span><b>${safeText(service.price)}</b><button type="button" data-remove-service="${safeText(service.id)}" aria-label="Quitar ${safeText(service.name)}">×</button></li>`),
    ...addOns.map(addon => `<li class="quote-addon"><span><small>Adicional</small><strong>${safeText(addon.name)}</strong></span><b>${safeText(addon.price)}</b><button type="button" data-remove-addon="${safeText(addon.id)}" aria-label="Quitar ${safeText(addon.name)}">×</button></li>`)
  ];
  if (!rows.length) {
    holder.innerHTML = `<div class="service-quote-empty compact-v2741"><strong>Todavía no agregaste servicios</strong><span>Tocá una categoría y elegí lo que necesita el carro.</span></div>`;
  } else {
    holder.innerHTML = `
      <div class="service-quote-head compact-v2741"><span>Cotización inicial</span><strong>${safeText(quote.label)}</strong><small>${quote.count} trabajo${quote.count === 1 ? "" : "s"} seleccionado${quote.count === 1 ? "" : "s"}</small></div>
      <details class="service-quote-details-v2741">
        <summary>Ver detalle de la solicitud <b>⌄</b></summary>
        <ul class="service-quote-list">${rows.join("")}</ul>
        <p class="service-quote-note">Estimado inicial. Repuestos y trabajos “por cotizar” se confirman antes de trabajar.</p>
      </details>`;
  }
  updateServiceSelectionButtons();
  updateOtherServiceField();
  updateCompactPickerState();
}

window.DtekServiceBuilder = {
  isSelected: (id) => selectedAgendaServiceIds.includes(id),
  selectedIds: () => [...selectedAgendaServiceIds]
};

function getDtekWhatsAppNumber() {
  return String(window.DTEK_WHATSAPP_NUMBER || DTEK_WHATSAPP_NUMBER || "").replace(/\D/g, "");
}

function waLink(message) {
  const number = getDtekWhatsAppNumber();
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function whatsAppReady() {
  const number = getDtekWhatsAppNumber();
  return Boolean(number) && !number.includes("XXXXXXXX") && number.length >= 11;
}

/* El navegador solo deja abrir una pestaña mientras dura el gesto de la persona.
   Guardar la cita se lleva varios segundos en datos móviles, así que para entonces
   window.open ya viene bloqueado y el WhatsApp nunca se abría. Reservamos la pestaña
   en el mismo clic y hasta después le ponemos la dirección. */
function reserveWhatsAppWindow() {
  if (!whatsAppReady()) return null;
  try {
    const reserved = window.open("", "_blank");
    if (!reserved) return null;
    try { reserved.opener = null; } catch (error) { /* algunos navegadores no lo permiten */ }
    try {
      reserved.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D-TEK GT</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#07080b;color:#fff;font:600 16px/1.5 system-ui,sans-serif">Preparando tu mensaje de WhatsApp...</body></html>');
      reserved.document.close();
    } catch (error) { /* about:blank basta */ }
    return reserved;
  } catch (error) {
    return null;
  }
}

function closeReservedWhatsAppWindow(reserved) {
  try { if (reserved && !reserved.closed) reserved.close(); }
  catch (error) { /* la persona ya la cerró */ }
}

/* Devuelve true solo si WhatsApp realmente se abrió: el mensaje de éxito no debe
   decir "ya abrimos WhatsApp" cuando el navegador lo bloqueó. */
function deliverWhatsApp(message, reserved = null) {
  if (!whatsAppReady()) {
    closeReservedWhatsAppWindow(reserved);
    alert("Falta configurar correctamente el WhatsApp oficial de D-TEK en services-data.js.");
    return false;
  }
  const href = waLink(message);
  try {
    if (reserved && !reserved.closed) { reserved.location.replace(href); return true; }
  } catch (error) {
    console.warn("No se pudo reutilizar la pestaña reservada de WhatsApp", error);
  }
  try { return Boolean(window.open(href, "_blank", "noopener,noreferrer")); }
  catch (error) { return false; }
}

function openWhatsApp(message) {
  return deliverWhatsApp(message);
}

function getDtekOwnerEmail() {
  return String(window.DTEK_OWNER_EMAIL || DTEK_OWNER_EMAIL || "").trim();
}

function agendaUrl(id = "") {
  return id ? `agenda.html?servicio=${encodeURIComponent(id)}` : "agenda.html";
}

// Cada servicio tiene su pagina estatica generada por generar-paginas-servicio.js.
// Ruta absoluta para que sirva igual desde la raiz que desde /servicio/.
function serviceUrl(id = "") {
  return id ? `/servicio/${encodeURIComponent(id)}.html` : "/servicios.html";
}

function setFieldValue(selector, value) {
  const el = qs(selector);
  if (!el) return;
  el.value = value || "";
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function firstAgendaValue(...values) {
  return values.find(value => String(value || "").trim()) || "";
}

function loadAgendaLocalProfile() {
  try { return JSON.parse(localStorage.getItem(DTEK_CLIENT_PREFS_KEY) || "{}"); }
  catch { return {}; }
}

function saveAgendaLocalProfile(data = {}) {
  try {
    const current = loadAgendaLocalProfile();
    localStorage.setItem(DTEK_CLIENT_PREFS_KEY, JSON.stringify({
      ...current,
      default_location: data.address || current.default_location || "",
      default_city: data.city || current.default_city || ""
    }));
  } catch (error) {
    console.warn("No se pudieron guardar preferencias locales de agenda", error);
  }
}

function safeText(value) {
  return String(value || "").replace(/[<>&"]/g, (char) => ({"<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;"}[char]));
}


function moneyLineFromAddOn(addon) {
  if (!addon) return "";
  return `${addon.name} (${addon.price})`;
}

function getSelectedAddOns() {
  if (typeof dtekAddOns === "undefined") return [];
  return qsa("[data-addon-check]:checked").map(input => dtekAddOns.find(addon => addon.id === input.value)).filter(Boolean);
}

function selectedAddOnsText(addOns = getSelectedAddOns()) {
  if (!addOns.length) return "Ninguno";
  return addOns.map(addon => `- ${moneyLineFromAddOn(addon)}`).join("\n");
}

function renderAppointmentAddOns() {
  const holder = qs("#appointmentAddOns");
  if (!holder || typeof dtekAddOns === "undefined") return;
  holder.innerHTML = dtekAddOns.map(addon => `
    <label class="addon-pill quote-addon-card">
      <input type="checkbox" value="${safeText(addon.id)}" data-addon-check>
      <span><strong>${safeText(addon.name)}</strong><small>${safeText(addon.price)} · ${safeText(addon.short)}</small></span>
      <b>＋</b>
    </label>
  `).join("");
}

let compactPickerState = { mode: "services", id: "", previous: null };

function compactServiceRow(service) {
  const selected = selectedAgendaServiceIds.includes(service.id);
  return `<article class="compact-service-row-v2741 ${selected ? "selected" : ""}">
    <div><small>${safeText(service.category)}</small><strong>${safeText(service.name)}</strong><span>${safeText(service.price)} · ${safeText(service.durationMinutes || 60)} min</span></div>
    <button type="button" data-agenda-service="${safeText(service.id)}" aria-pressed="${selected}">${selected ? "Quitar" : "Agregar"}</button>
  </article>`;
}

function renderAgendaCompactLaunchers() {
  const categoryHolder = qs("#agendaCategoryLaunchers");
  if (categoryHolder && typeof dtekServiceGroups !== "undefined") {
    categoryHolder.innerHTML = dtekServiceGroups.map(group => `
      <button type="button" class="agenda-category-launcher-v2741 ${group.id === "otros" ? "other" : ""}" data-open-service-group="${safeText(group.id)}">
        <strong>${safeText(group.title)}</strong><small>${group.services.length} ${group.services.length === 1 ? "opción" : "opciones"}</small><b>›</b>
      </button>`).join("");
  }
  const symptomHolder = qs("#agendaSymptomLaunchers");
  if (symptomHolder && typeof dtekSymptomGroups !== "undefined") {
    const quick = dtekSymptomGroups.slice(0, 4);
    symptomHolder.innerHTML = `
      <div class="agenda-symptom-quick-v2741">${quick.map(symptom => `<button type="button" data-open-symptom-group="${safeText(symptom.id)}"><strong>${safeText(symptom.label)}</strong><small>${safeText(symptom.chapin)}</small></button>`).join("")}</div>
      <button type="button" class="agenda-all-symptoms-v2741" data-open-symptom-browser><span><strong>Ver todos los síntomas</strong><small>${dtekSymptomGroups.length} formas comunes de describir el clavo</small></span><b>›</b></button>`;
  }
}

function updateCompactPickerState() {
  const serviceCount = selectedAgendaServiceIds.length;
  const addOnCount = getSelectedAddOns().length;
  const count = qs("#servicePickerCount");
  if (count) count.textContent = `${serviceCount + addOnCount} seleccionado${serviceCount + addOnCount === 1 ? "" : "s"}`;
  const addOnLabel = qs("#selectedAddOnCount");
  if (addOnLabel) addOnLabel.textContent = addOnCount ? `${addOnCount} adicional${addOnCount === 1 ? "" : "es"} agregado${addOnCount === 1 ? "" : "s"}` : "Filtros, batería, llantas y más";
  qsa(".compact-service-row-v2741").forEach(row => {
    const button = row.querySelector("[data-agenda-service]");
    if (!button) return;
    const selected = selectedAgendaServiceIds.includes(button.dataset.agendaService);
    row.classList.toggle("selected", selected);
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "Quitar" : "Agregar";
  });
}

function setCompactPickerHeader(eyebrow, title, canGoBack = false) {
  const e = qs("#servicePickerEyebrow");
  const t = qs("#servicePickerTitle");
  const back = qs("#servicePickerBack");
  if (e) e.textContent = eyebrow;
  if (t) t.textContent = title;
  back?.classList.toggle("hidden-field", !canGoBack);
}

function renderCompactPicker(mode, id = "", previous = null) {
  const body = qs("#servicePickerBody");
  const addOns = qs("#appointmentAddOns");
  if (!body || !addOns) return;
  compactPickerState = { mode, id, previous };
  body.innerHTML = "";
  body.classList.remove("hidden-field");
  addOns.classList.add("hidden-field");

  if (mode === "category-browser") {
    setCompactPickerHeader("Servicios", "¿Qué más necesita el carro?");
    body.innerHTML = `<div class="category-browser-v2741">${dtekServiceGroups.map(group => `<button type="button" data-open-service-group="${safeText(group.id)}" data-from-category-browser="true"><strong>${safeText(group.title)}</strong><small>${safeText(group.hint)}</small><b>›</b></button>`).join("")}</div>`;
  } else if (mode === "group") {
    const group = dtekServiceGroups.find(item => item.id === id);
    const services = group?.services.map(findService).filter(Boolean) || [];
    setCompactPickerHeader("Servicios", group?.title || "Elegí un servicio", Boolean(previous));
    body.innerHTML = services.map(compactServiceRow).join("");
  } else if (mode === "symptom") {
    const symptom = dtekSymptomGroups.find(item => item.id === id);
    const services = symptom?.recommended.map(findService).filter(Boolean) || [];
    selectedSymptomLabel = symptom?.label || selectedSymptomLabel;
    setCompactPickerHeader("Recomendado para", symptom?.label || "Tu síntoma", Boolean(previous));
    body.innerHTML = services.map(compactServiceRow).join("");
  } else if (mode === "symptom-browser") {
    setCompactPickerHeader("Por síntoma", "¿Qué está haciendo el carro?");
    body.innerHTML = `<div class="symptom-browser-v2741">${dtekSymptomGroups.map(symptom => `<button type="button" data-open-symptom-group="${safeText(symptom.id)}" data-from-browser="true"><strong>${safeText(symptom.label)}</strong><small>${safeText(symptom.chapin)}</small><b>›</b></button>`).join("")}</div>`;
  } else if (mode === "addons") {
    setCompactPickerHeader("Opcional", "Servicios adicionales");
    body.classList.add("hidden-field");
    addOns.classList.remove("hidden-field");
  }
  updateCompactPickerState();
}

function openCompactPicker(mode, id = "", previous = null) {
  const dialog = qs("#servicePickerDialog");
  if (!dialog) return;
  renderCompactPicker(mode, id, previous);
  dialog.classList.remove("hidden-field");
  document.body.classList.add("service-picker-open-v2741");
  window.setTimeout(() => qs("#servicePickerTitle")?.focus?.(), 0);
}

function closeCompactPicker() {
  const dialog = qs("#servicePickerDialog");
  dialog?.classList.add("hidden-field");
  document.body.classList.remove("service-picker-open-v2741");
}

function hideAutoField(selector, shouldHide) {
  const el = qs(selector);
  const label = el?.closest("label");
  if (!label) return;
  label.classList.toggle("auto-field-hidden", Boolean(shouldHide));
}

function setReadOnlyIfValue(selector) {
  const el = qs(selector);
  if (!el) return false;
  const hasValue = Boolean(String(el.value || "").trim());
  el.readOnly = hasValue;
  hideAutoField(selector, hasValue);
  return hasValue;
}

function renderSmartProfileBanner() {
  const holder = qs("#smartProfileBanner");
  if (!holder) return;
  const email = linkedAgendaProfile?.contact_email || linkedAgendaProfile?.email || qs("#clientEmail")?.value || "";
  const name = qs("#clientName")?.value || linkedAgendaProfile?.full_name || "";
  const phone = qs("#clientPhone")?.value || linkedAgendaProfile?.phone || "";
  const address = qs("#clientAddress")?.value || linkedAgendaProfile?.default_location || "";
  const city = qs("#clientCity")?.value || linkedAgendaProfile?.default_city || "";
  const vehicle = linkedAgendaVehicle ? [linkedAgendaVehicle.brand, linkedAgendaVehicle.line, linkedAgendaVehicle.year].filter(Boolean).join(" ") : "";
  if (!email && !vehicle) {
    holder.classList.add("hidden-field");
    holder.innerHTML = "";
    return;
  }
  const missing = [
    [name, "nombre"],
    [phone, "teléfono"],
    [email, "correo"],
    [city, "zona o municipio"],
    [address, "dirección"]
  ].filter(([value]) => !String(value || "").trim()).map(([, label]) => label);
  holder.classList.remove("hidden-field");
  holder.innerHTML = `
    <div class="smart-profile-card dtek-glass">
      <span class="eyebrow">Datos de tu cuenta</span>
      <strong>${safeText(name || "Cliente D-TEK")}</strong>
      <small>${safeText(phone || "Teléfono pendiente")} · ${safeText(email || "Correo pendiente")}</small>
      ${(address || city) ? `<p>${safeText([address, city].filter(Boolean).join(" · "))}</p>` : ""}
      <div class="smart-profile-actions">
        <span>${missing.length ? `Solo falta: ${safeText(missing.join(", "))}.` : "Ya cargamos tus datos; no tenés que escribirlos otra vez."}</span>
        <button type="button" id="editSmartProfileData">${smartProfileEditing ? "Usar datos guardados" : "Cambiar datos"}</button>
      </div>
      ${vehicle ? `<p>Servicio para <b>${safeText(vehicle)}</b>.</p>` : ""}
    </div>`;
}

function toggleKnownProfileField(selector) {
  const el = qs(selector);
  const label = el?.closest("label");
  if (!el || !label) return;
  const hasValue = Boolean(String(el.value || "").trim());
  const shouldCompact = Boolean(linkedAgendaSession) && hasValue && !smartProfileEditing;
  label.classList.toggle("auto-field-hidden", shouldCompact);
  el.readOnly = shouldCompact;
}

function compactSmartAgendaFields() {
  const form = qs("#agendaForm");
  if (!form) return;
  const hasVehicle = Boolean(linkedAgendaVehicle?.id);
  form.classList.toggle("agenda-smart-profile", Boolean(linkedAgendaSession));
  form.classList.toggle("agenda-smart-vehicle", hasVehicle);

  ["#clientName", "#clientEmail", "#clientPhone", "#clientCity", "#clientAddress"].forEach(toggleKnownProfileField);

  qsa(".vehicle-manual-field").forEach(label => label.classList.toggle("auto-field-hidden", hasVehicle));
  renderSmartProfileBanner();
  renderGuestAccountChoice();
}

/* Paso 4: invitado por defecto. Crear perfil siempre es opcional. */
function renderGuestAccountChoice() {
  const block = qs("#guestAccountChoice");
  if (!block) return;
  const alreadyLogged = Boolean(linkedAgendaSession?.user);
  block.classList.toggle("hidden-field", alreadyLogged);
  if (alreadyLogged && agendaAccountMode !== "guest") setAgendaAccountMode("guest");
  qsa("#guestAccountFields input").forEach(input => { input.disabled = alreadyLogged || agendaAccountMode !== "create"; });
}

function setAgendaAccountMode(mode) {
  agendaAccountMode = mode === "create" ? "create" : "guest";
  qsa("[data-account-mode]").forEach(button => {
    const active = button.dataset.accountMode === agendaAccountMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const fields = qs("#guestAccountFields");
  fields?.classList.toggle("hidden-field", agendaAccountMode !== "create");
  // Deshabilitados en modo invitado: si no, un usuario a medio escribir dispara
  // la validación nativa sobre un campo oculto y el botón "Confirmar" no responde.
  qsa("#guestAccountFields input").forEach(input => { input.disabled = agendaAccountMode !== "create"; });
  setGuestAccountStatus("");
}

function setGuestAccountStatus(message = "", tone = "") {
  const el = qs("#guestAccountStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `guest-account-status-v31 ${message ? `is-visible ${tone}` : ""}`.trim();
}

function guestAccountRequest() {
  return {
    username: qs("#guestAccountUser")?.value.trim() || "",
    password: qs("#guestAccountPassword")?.value || "",
    confirm: qs("#guestAccountPasswordConfirm")?.value || "",
    saveVehicle: Boolean(qs("#guestAccountSaveVehicle")?.checked)
  };
}

function validateGuestAccountFields() {
  if (agendaAccountMode !== "create") return { ok: true };
  const { username, password, confirm } = guestAccountRequest();
  if (username.length < 3) return { ok: false, message: "Elegí un usuario de al menos 3 caracteres.", focus: "#guestAccountUser" };
  if (password.length < 6) return { ok: false, message: "La contraseña necesita al menos 6 caracteres.", focus: "#guestAccountPassword" };
  if (password !== confirm) return { ok: false, message: "Las contraseñas no coinciden.", focus: "#guestAccountPasswordConfirm" };
  return { ok: true };
}

/* Se ejecuta DESPUÉS de guardar la cita: si el perfil falla, la cita ya está a salvo. */
async function createProfileAfterBooking(data) {
  if (agendaAccountMode !== "create") return null;
  if (!dtekBackendActive() || !window.DtekBackend?.signUpLocal) {
    return { ok: false, message: "El perfil no se pudo crear desde aquí, pero tu cita ya quedó guardada." };
  }
  const { username, password, saveVehicle } = guestAccountRequest();
  try {
    await window.DtekBackend.signUpLocal({
      username,
      password,
      contactEmail: data.email,
      fullName: data.fullName,
      phone: data.phone
    });
    smartAgendaContextPromise = null;
    linkedAgendaSession = await window.DtekBackend.getSession?.() || null;

    try { await window.DtekBackend.updateMyProfile?.(data.fullName, data.phone, { default_location: data.address, default_city: data.city }); }
    catch (profileError) { console.warn("Perfil creado, pero no se guardaron las preferencias", profileError); }

    if (saveVehicle && data.brand && window.DtekBackend?.createMyVehicle) {
      try { await window.DtekBackend.createMyVehicle({ brand: data.brand, line: data.line, year: data.year, engine: data.engine }); }
      catch (vehicleError) { console.warn("Perfil creado, pero el carro no se guardó en el Garage", vehicleError); }
    }

    try { await window.DtekBackend.claimMyAppointments?.(); }
    catch (claimError) { console.warn("Perfil creado, pero la cita no se vinculó automáticamente", claimError); }

    return { ok: true, username };
  } catch (error) {
    console.warn("No se pudo crear el perfil desde la agenda", error);
    const code = error?.code || "";
    const message = code === "USERNAME_TAKEN" ? "Ese usuario ya existe."
      : code === "EMAIL_ALREADY_REGISTERED" ? "Ese correo ya tiene cuenta."
      : String(error?.message || "No se pudo crear el perfil.");
    return { ok: false, message: `${message} Tu cita sí quedó guardada; podés crear tu perfil después desde el Garage.` };
  }
}

async function fetchLatestAgendaDetails() {
  if (!linkedAgendaSession || !window.DtekBackend?.listMyAppointments) return null;
  try {
    const appointments = await window.DtekBackend.listMyAppointments();
    return (appointments || []).find(item => item && (item.client_name || item.client_phone || item.location || item.city)) || null;
  } catch (error) {
    console.warn("No se pudo reutilizar la última cita para autocompletar", error);
    return null;
  }
}

async function loadSmartAgendaContext(options = {}) {
  if (!qs("#agendaForm") || !dtekBackendActive() || !window.DtekBackend?.getSession) return null;
  if (smartAgendaContextPromise && !options.force) return smartAgendaContextPromise;

  smartAgendaContextPromise = (async () => {
    try {
      const session = await window.DtekBackend.getSession();
      linkedAgendaSession = session;
      if (!session?.user) {
        compactSmartAgendaFields();
        return null;
      }

      let profile = null;
      if (window.DtekBackend?.currentProfile) {
        try { profile = await window.DtekBackend.currentProfile(); }
        catch (profileError) { console.warn("No se pudo cargar perfil para agenda inteligente", profileError); }
      }

      const meta = session.user.user_metadata || {};
      const local = loadAgendaLocalProfile();
      const needsHistory = !profile?.full_name || !profile?.phone || !profile?.default_location || !profile?.default_city;
      const latest = needsHistory ? await fetchLatestAgendaDetails() : null;

      const resolved = {
        ...(profile || {}),
        full_name: firstAgendaValue(profile?.full_name, meta.full_name, meta.name, latest?.client_name),
        phone: firstAgendaValue(profile?.phone, meta.phone, latest?.client_phone),
        email: firstAgendaValue(profile?.contact_email, DtekBackend.isLocalLoginEmail?.(session.user.email) ? "" : session.user.email, DtekBackend.isLocalLoginEmail?.(profile?.email) ? "" : profile?.email, latest?.client_email),
        default_location: firstAgendaValue(profile?.default_location, local.default_location, latest?.location),
        default_city: firstAgendaValue(profile?.default_city, local.default_city, latest?.city)
      };
      linkedAgendaProfile = resolved;

      const values = {
        "#clientName": resolved.full_name,
        "#clientPhone": resolved.phone,
        "#clientEmail": resolved.email,
        "#clientAddress": resolved.default_location,
        "#clientCity": resolved.default_city
      };
      Object.entries(values).forEach(([selector, value]) => {
        if (value && !String(qs(selector)?.value || "").trim()) setFieldValue(selector, value);
      });

      compactSmartAgendaFields();
      updateAgendaSummary();
      return resolved;
    } catch (error) {
      console.warn("No se pudo cargar sesión para agenda inteligente", error);
      compactSmartAgendaFields();
      return null;
    }
  })();

  try { return await smartAgendaContextPromise; }
  finally {
    if (options.force) smartAgendaContextPromise = null;
  }
}

async function persistSmartAgendaProfile(data) {
  if (!linkedAgendaSession?.user) return;
  saveAgendaLocalProfile(data);
  if (!window.DtekBackend?.updateMyProfile) return;
  try {
    const updated = await window.DtekBackend.updateMyProfile(data.fullName, data.phone, {
      default_location: data.address,
      default_city: data.city,
      preferred_time_window: linkedAgendaProfile?.preferred_time_window || "",
      contact_preference: linkedAgendaProfile?.contact_preference || "WhatsApp"
    });
    linkedAgendaProfile = { ...(linkedAgendaProfile || {}), ...(updated || {}) };
  } catch (error) {
    console.warn("La cita se guardó, pero no se pudo actualizar el perfil", error);
  }
}


function serviceCard(service) {
  const iconMap = {
    "Revisión y diagnóstico": "⌕",
    "Compra Segura": "✓",
    "Mantenimiento": "↻",
    "Frenos": "◉",
    "Inyección y admisión": "≈",
    "TPMS, eléctrico y batería": "↯",
    "A/C, suspensión y varios": "⌁"
  };
  return `
    <article class="public-service-card-v24 reveal">
      <div class="public-service-card-head-v24">
        <span class="public-service-icon-v24">${safeText(iconMap[service.category] || service.name.slice(0, 1))}</span>
        <span class="public-service-price-v24">${safeText(service.price)}</span>
      </div>
      <span class="public-service-category-v24">${safeText(service.category)}</span>
      <h3>${safeText(service.name)}</h3>
      <div class="public-service-meta-v24"><span>${safeText(service.durationMinutes || 60)} min</span><span>+${estimateServicePoints(service)} pts</span></div>
      <div class="public-service-actions-v24">
        <a class="public-btn-v24 primary" href="${agendaUrl(service.id)}">Elegir horario</a>
        <a class="public-card-link-v24" href="${serviceUrl(service.id)}">Ver qué incluye →</a>
      </div>
    </article>`;
}

function renderPreviewServices() {
  const holder = qs("#previewServices");
  if (!holder) return;
  holder.innerHTML = dtekServices.filter(service => service.featured).slice(0, 4).map(serviceCard).join("");
  setupReveal();
}

function renderFilters() {
  const holder = qs("#filters");
  if (!holder) return;
  holder.innerHTML = dtekServiceCategories.map(cat => `<button class="filter-btn ${cat === currentCategory ? "active" : ""}" data-filter="${safeText(cat)}" type="button">${safeText(cat)}</button>`).join("");
}

function renderServices() {
  const grid = qs("#servicesGrid");
  if (!grid) return;
  const services = currentCategory === "Todos"
    ? dtekServices
    : currentCategory === "Recomendados"
      ? dtekServices.filter(service => service.featured)
      : dtekServices.filter(service => service.category === currentCategory);
  grid.innerHTML = services.map(serviceCard).join("");
  setupReveal();
}

function renderServiceDetail() {
  const shell = qs("#serviceDetail");
  if (!shell) return;
  const id = params.get("servicio") || "revision-express";
  const service = findService(id);

  if (!service) {
    shell.innerHTML = `
      <section class="section page-hero">
        <div class="section-heading dtek-glass-strong copy-card">
          <span class="page-kicker">Servicio no encontrado</span>
          <h1>No encontramos ese servicio.</h1>
          <p>Volvé al catálogo y elegí una opción disponible.</p>
          <div class="detail-actions"><a class="btn btn-primary" href="servicios.html">Ver servicios</a></div>
        </div>
      </section>`;
    return;
  }

  document.title = `${service.name} | D-TEK GT`;
  shell.innerHTML = `
    <section class="public-shell-v24 public-service-detail-v24">
      <div class="public-service-detail-hero-v24 reveal service-detail-v27">
        <div>
          <a class="public-back-link-v24" href="servicios.html">← Servicios</a>
          <span class="public-kicker-v24">${safeText(service.category)}</span>
          <h1>${safeText(service.name)}</h1>
          <div class="public-detail-facts-v24"><span><small>Desde</small><strong>${safeText(service.price)}</strong></span><span><small>Tiempo</small><strong>${safeText(service.durationMinutes || 60)} min</strong></span><span><small>Puntos</small><strong>+${estimateServicePoints(service)}</strong></span></div>
          <div class="public-hero-actions-v24"><a class="public-btn-v24 primary" href="${agendaUrl(service.id)}">Agendar</a><a class="public-btn-v24 secondary" href="agenda.html?flow=symptoms">Síntoma</a></div>
        </div>
      </div>
      <div class="public-detail-grid-v24 two reveal">
        <article><span>01</span><h2>Incluye</h2><ul>${service.includes.map(item => `<li>${safeText(item)}</li>`).join("")}</ul></article>
        <article><span>02</span><h2>Datos</h2><ul>${service.dataNeeded.map(item => `<li>${safeText(item)}</li>`).join("")}</ul></article>
      </div>
    </section>`;
  setupReveal();
}

function parseMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return (hours * 60) + (minutes || 0);
}

function formatMinutes(total) {
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = ((hours24 + 11) % 12) + 1;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function storageGetAppointments() {
  try {
    return JSON.parse(localStorage.getItem(DTEK_APPOINTMENTS_STORAGE_KEY) || "[]");
  } catch (error) {
    console.warn("No se pudo leer memoria local de agenda.", error);
    return [];
  }
}

function storageSetAppointments(appointments) {
  localStorage.setItem(DTEK_APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments));
}

function appointmentStatusLabel(status = "pending") {
  const labels = {
    pending: "Solicitada",
    requested: "Solicitada",
    confirmed: "Confirmada",
    completed: "Realizada",
    cancelled: "Cancelada"
  };
  return labels[status] || "Solicitada";
}

function updateAppointmentStatus(appointmentId, status) {
  const appointments = storageGetAppointments();
  const index = appointments.findIndex(item => item.id === appointmentId);
  if (index === -1) return false;
  appointments[index].status = status;
  appointments[index].updatedAt = new Date().toISOString();
  storageSetAppointments(appointments);
  sendAutomationEvent("appointment_status_updated", appointments[index]);
  return true;
}

function generateBookingId() {
  return `DTEK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function formatDateForInput(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return copy.toISOString().slice(0, 10);
}

function dateFromValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function displayDateLabel(value) {
  if (!value) return "Sin elegir";
  const date = dateFromValue(value);
  return date.toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
}

function getWorkingWindow(dateValue) {
  const date = dateFromValue(dateValue);
  if (!date) return null;
  const config = dtekWorkingHours[date.getDay()];
  if (!config) return null;
  return { start: parseMinutes(config.start), end: parseMinutes(config.end), label: `${config.start}–${config.end}` };
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function appointmentBlockingInterval(appointment) {
  return {
    start: Number(appointment.blockStartMinutes ?? appointment.startMinutes),
    end: Number(appointment.blockEndMinutes ?? appointment.endMinutes)
  };
}


function dtekBackendActive() {
  return Boolean(window.DTEK_CONFIG?.useSupabase && window.DtekBackend?.isConfigured?.());
}

function dayRangeIso(dateValue) {
  const start = dateFromValue(dateValue);
  if (!start) return null;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function buildDateTimeIso(dateValue, minutes) {
  const date = dateFromValue(dateValue);
  if (!date) return "";
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toISOString();
}

function busyBlockToMinutes(block, dateValue) {
  const day = dateFromValue(dateValue);
  if (!day) return null;
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const startDate = new Date(block.block_start || block.blockStart || block.start_time || block.start);
  const endDate = new Date(block.block_end || block.blockEnd || block.end_time || block.end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  if (endDate <= dayStart || startDate >= dayEnd) return null;

  const clampedStart = startDate < dayStart ? dayStart : startDate;
  const clampedEnd = endDate > dayEnd ? dayEnd : endDate;
  return {
    start: clampedStart.getHours() * 60 + clampedStart.getMinutes(),
    end: clampedEnd.getHours() * 60 + clampedEnd.getMinutes()
  };
}

async function refreshBackendBusyBlocks(dateValue) {
  if (!dtekBackendActive() || !dateValue) return [];
  const range = dayRangeIso(dateValue);
  if (!range) return [];
  const cacheKey = dateValue;
  try {
    const blocks = await DtekBackend.getBusyBlocks(range.startIso, range.endIso);
    dtekBusyBlocksCache[cacheKey] = blocks || [];
    return dtekBusyBlocksCache[cacheKey];
  } catch (error) {
    console.warn("No se pudieron cargar horarios ocupados desde Supabase. Usando fallback local.", error);
    dtekBusyBlocksCache[cacheKey] = [];
    return [];
  }
}

function computeAvailableSlots(service, dateValue) {
  if (!service || !dateValue) return [];
  const window = getWorkingWindow(dateValue);
  if (!window) return [];

  const localAppointments = storageGetAppointments().filter(item => item.date === dateValue && item.status !== "cancelled");
  const backendBlocks = (dtekBusyBlocksCache[dateValue] || [])
    .filter(item => (item.status || "") !== "cancelled")
    .map(item => busyBlockToMinutes(item, dateValue))
    .filter(Boolean);
  const appointments = localAppointments.map(appointmentBlockingInterval).concat(backendBlocks);
  const slots = [];
  const slotStep = 30;
  const firstStart = window.start + (service.bufferBefore || 0);
  const lastStart = window.end - (service.durationMinutes || 60) - (service.bufferAfter || 0);

  for (let start = firstStart; start <= lastStart; start += slotStep) {
    const end = start + (service.durationMinutes || 60);
    const blockStart = start - (service.bufferBefore || 0);
    const blockEnd = end + (service.bufferAfter || 0);
    const conflict = appointments.some(blocked => intervalsOverlap(blockStart, blockEnd, blocked.start, blocked.end));
    if (!conflict) {
      slots.push({ start, end, blockStart, blockEnd, label: formatMinutes(start), endLabel: formatMinutes(end) });
    }
  }
  return slots;
}

function renderDateButtons() {
  const holder = qs("#dateButtons");
  if (!holder) return;
  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });

  const firstOpen = dates.find(date => getWorkingWindow(formatDateForInput(date)));
  selectedAgendaDate = selectedAgendaDate || formatDateForInput(firstOpen || dates[0]);

  const weekdayHeaders = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const leadBlanks = dates[0].getDay();
  const blanksHtml = Array.from({ length: leadBlanks }, () => `<span class="calendar-blank"></span>`).join("");

  const cellsHtml = dates.map((date, index) => {
    const value = formatDateForInput(date);
    const dayNum = date.getDate();
    const closed = !getWorkingWindow(value);
    const showMonth = index === 0 || dayNum === 1;
    const monthTag = showMonth ? `<small>${date.toLocaleDateString("es-GT", { month: "short" }).replace(".", "")}</small>` : "";
    return `<button class="date-chip ${value === selectedAgendaDate ? "selected" : ""} ${closed ? "disabled" : ""}" type="button" data-date="${value}" ${closed ? "disabled" : ""}>${monthTag}<strong>${dayNum}</strong>${closed ? "<em>Cerrado</em>" : ""}</button>`;
  }).join("");

  holder.innerHTML = `<div class="calendar-weekdays">${weekdayHeaders.map(day => `<span>${day}</span>`).join("")}</div><div class="calendar-grid">${blanksHtml}${cellsHtml}</div>`;
}

async function renderTimeButtons() {
  const holder = qs("#timeButtons");
  if (!holder) return;
  const service = buildCompositeAgendaService();

  if (!service) {
    selectedAgendaTime = "";
    holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>Elegí primero un servicio.</strong><p>Primero elegí qué necesitás para mostrar horarios disponibles.</p></div>`;
    return;
  }

  holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>Buscando horarios...</strong><p>Un momento, estamos revisando disponibilidad.</p></div>`;
  await refreshBackendBusyBlocks(selectedAgendaDate);
  const slots = computeAvailableSlots(service, selectedAgendaDate);
  if (!slots.length) {
    selectedAgendaTime = "";
    holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>No hay espacios disponibles para este servicio ese día.</strong><p>Probá otro día o escribinos por WhatsApp para revisar opciones.</p></div>`;
    return;
  }

  if (!slots.some(slot => slot.label === selectedAgendaTime)) selectedAgendaTime = slots[0].label;
  holder.innerHTML = slots.map(slot => `<button class="time-chip ${slot.label === selectedAgendaTime ? "selected" : ""}" type="button" data-time="${slot.label}" data-start="${slot.start}" data-end="${slot.end}" data-block-start="${slot.blockStart}" data-block-end="${slot.blockEnd}">${slot.label}<small>${slot.endLabel}</small></button>`).join("");
}

function renderAgendaMemory() {
  const holder = qs("#agendaMemory");
  if (!holder) return;
  const appointments = storageGetAppointments().sort((a, b) => `${a.date} ${a.startMinutes}`.localeCompare(`${b.date} ${b.startMinutes}`));
  const activeAppointments = appointments.filter(item => item.status !== "cancelled");

  if (!appointments.length) {
    holder.innerHTML = `
      <div class="memory-header"><strong>Panel local D-TEK</strong><span>0 citas</span></div>
      <p class="memory-empty">Todavía no hay citas guardadas en este navegador. Al confirmar una solicitud, esa hora se bloqueará para las siguientes pruebas.</p>`;
    return;
  }

  holder.innerHTML = `
    <div class="memory-header"><strong>Panel local D-TEK</strong><span>${activeAppointments.length} activa${activeAppointments.length === 1 ? "" : "s"}</span></div>
    <p class="memory-empty memory-note">Estados locales: solicitada, confirmada, realizada o cancelada. Cancelar libera el horario; realizada conserva el historial.</p>
    <div class="memory-list">
      ${appointments.map(appt => `
        <article class="memory-item ${safeText(appt.status || "pending")}">
          <div class="memory-item-main">
            <div>
              <strong>${safeText(appt.serviceName)}</strong>
              <small>${safeText(displayDateLabel(appt.date))} · ${safeText(appt.time)}–${safeText(formatMinutes(appt.endMinutes))}</small>
              <small>${safeText(appt.client.fullName || "Cliente sin nombre")} · ${safeText(appt.client.email || "Sin correo")}</small>
            </div>
            <span class="status-pill ${safeText(appt.status || "pending")}">${safeText(appointmentStatusLabel(appt.status))}</span>
          </div>
          <div class="memory-actions">
            <button type="button" data-appointment-status="confirmed" data-appointment-id="${safeText(appt.id)}">Confirmar</button>
            <button type="button" data-appointment-status="completed" data-appointment-id="${safeText(appt.id)}">Realizada</button>
            <button type="button" data-appointment-status="cancelled" data-appointment-id="${safeText(appt.id)}">Cancelar</button>
          </div>
        </article>`).join("")}
    </div>
    <button class="btn btn-cyan clear-memory" type="button" id="clearAgendaMemory">Borrar memoria de prueba</button>`;
}

function yearOptions() {
  const current = new Date().getFullYear() + 1;
  const years = [];
  for (let year = current; year >= 1980; year--) years.push(year);
  return years;
}

function selectedVehicleBrand() {
  const selectValue = qs("#vehicleBrand")?.value || "";
  if (selectValue === "Otra marca") return qs("#vehicleBrandOther")?.value.trim() || "Otra marca";
  return selectValue;
}

function selectedVehicleLine() {
  const selectValue = qs("#vehicleLine")?.value || "";
  if (selectValue === "Otra línea") return qs("#vehicleLineOther")?.value.trim() || "Otra línea";
  return selectValue;
}

function toggleVehicleCustomFields() {
  const brandSelect = qs("#vehicleBrand");
  const lineSelect = qs("#vehicleLine");
  const brandOtherField = qs(".custom-brand-field");
  const lineOtherField = qs(".custom-line-field");
  const brandOtherInput = qs("#vehicleBrandOther");
  const lineOtherInput = qs("#vehicleLineOther");

  const customBrand = brandSelect?.value === "Otra marca";
  const customLine = lineSelect?.value === "Otra línea";

  if (brandOtherField) brandOtherField.classList.toggle("hidden-field", !customBrand);
  if (brandOtherInput) brandOtherInput.required = customBrand;
  if (lineOtherField) lineOtherField.classList.toggle("hidden-field", !customLine);
  if (lineOtherInput) lineOtherInput.required = customLine;
}

function updateVehicleLineOptions() {
  const brandSelect = qs("#vehicleBrand");
  const lineSelect = qs("#vehicleLine");
  if (!brandSelect || !lineSelect) return;

  const selectedBrand = brandSelect.value;
  const lines = dtekVehicleCatalog[selectedBrand] || [];

  if (!selectedBrand) {
    lineSelect.disabled = true;
    lineSelect.innerHTML = `<option value="">Primero elegí marca</option>`;
    toggleVehicleCustomFields();
    return;
  }

  lineSelect.disabled = false;
  lineSelect.innerHTML = `<option value="">Elegir línea</option>` + lines.map(line => `<option value="${safeText(line)}">${safeText(line)}</option>`).join("");
  if (!lines.includes("Otra línea")) lineSelect.innerHTML += `<option value="Otra línea">Otra línea</option>`;
  toggleVehicleCustomFields();
}

function renderVehicleCatalogFields() {
  const brandSelect = qs("#vehicleBrand");
  const yearSelect = qs("#vehicleYear");
  if (brandSelect && !brandSelect.dataset.loaded) {
    const brands = Object.keys(dtekVehicleCatalog).sort((a, b) => a.localeCompare(b, "es"));
    brandSelect.innerHTML = `<option value="">Elegir marca</option>` + brands.map(brand => `<option value="${safeText(brand)}">${safeText(brand)}</option>`).join("");
    brandSelect.dataset.loaded = "true";
  }
  if (yearSelect && !yearSelect.dataset.loaded) {
    yearSelect.innerHTML = `<option value="">Elegir año</option>` + yearOptions().map(year => `<option value="${year}">${year}</option>`).join("");
    yearSelect.dataset.loaded = "true";
  }
  updateVehicleLineOptions();
}

function lockVehicleFields(locked = true) {
  ["#vehicleBrand", "#vehicleBrandOther", "#vehicleLine", "#vehicleLineOther", "#vehicleYear", "#vehicleEngine"].forEach(selector => {
    const el = qs(selector);
    if (el) {
      el.disabled = locked;
      el.classList.toggle("linked-locked", locked);
    }
  });
  document.body.dataset.vehicleLinked = locked ? "true" : "false";
}

function clearVehicleFields() {
  ["#vehicleBrandOther", "#vehicleLineOther"].forEach(selector => setFieldValue(selector, ""));
  setFieldValue("#vehicleBrand", "");
  updateVehicleLineOptions();
  setFieldValue("#vehicleYear", "");
  setFieldValue("#vehicleEngine", "");
  setFieldValue("#vehicleMoves", "");
  toggleVehicleCustomFields();
}

/* Modo manual: cualquiera puede escribir su carro sin tenerlo en el Garage. */
function useManualVehicle({ clear = true } = {}) {
  linkedAgendaVehicle = null;
  linkedAgendaVehicleId = "";
  lockVehicleFields(false);
  if (clear) clearVehicleFields();
  renderLinkedVehicleBanner(null);
  window.DtekSelectorPro?.updateVehicleCascade?.();
  renderVehicleSourcePicker();
  compactSmartAgendaFields();
  updateAgendaSummary();
  qs("#vehicleBrand")?.focus();
}

function useGarageVehicle(vehicleId) {
  const vehicle = agendaGarageVehicles.find(item => String(item.id) === String(vehicleId));
  if (!vehicle) return;
  linkedAgendaVehicle = vehicle;
  linkedAgendaVehicleId = vehicle.id;
  applyVehicleToAgendaFields(vehicle);
  renderLinkedVehicleBanner(vehicle);
  window.DtekSelectorPro?.updateVehicleCascade?.();
  renderVehicleSourcePicker();
  compactSmartAgendaFields();
  updateAgendaSummary();
}

function vehicleSourceLabel(vehicle) {
  return [vehicle.nickname || vehicle.brand, vehicle.nickname ? "" : vehicle.line, vehicle.year || ""].filter(Boolean).join(" ");
}

/* Solo aparece si la persona ya inició sesión y tiene carros guardados.
   Siempre incluye la salida "Otro carro" para no obligar a usar el Garage. */
function renderVehicleSourcePicker() {
  const holder = qs("#vehicleSourcePicker");
  if (!holder) return;
  if (!agendaGarageVehicles.length) {
    holder.classList.add("hidden-field");
    holder.innerHTML = "";
    return;
  }
  const activeId = linkedAgendaVehicle?.id || linkedAgendaVehicleId || "";
  holder.classList.remove("hidden-field");
  holder.innerHTML = `
    <span class="vehicle-source-eyebrow-v31">Tus carros guardados</span>
    <div class="vehicle-source-options-v31">
      ${agendaGarageVehicles.map(vehicle => `
        <button type="button" class="vehicle-source-chip-v31 ${String(vehicle.id) === String(activeId) ? "active" : ""}" data-garage-vehicle="${safeText(vehicle.id)}" aria-pressed="${String(vehicle.id) === String(activeId)}">
          <strong>${safeText(vehicleSourceLabel(vehicle))}</strong>
          <small>${safeText([vehicle.brand, vehicle.line].filter(Boolean).join(" ") || "Vehículo guardado")}</small>
        </button>`).join("")}
      <button type="button" class="vehicle-source-chip-v31 manual ${activeId ? "" : "active"}" data-manual-vehicle aria-pressed="${!activeId}">
        <strong>Otro carro</strong>
        <small>Escribilo ahora. No se guarda en tu Garage.</small>
      </button>
    </div>`;
}

async function loadAgendaGarageVehicles() {
  if (!qs("#agendaForm") || !linkedAgendaSession?.user || !window.DtekBackend?.listMyVehicles) return [];
  try {
    agendaGarageVehicles = (await window.DtekBackend.listMyVehicles()) || [];
  } catch (error) {
    console.warn("No se pudieron cargar los carros del Garage para la agenda", error);
    agendaGarageVehicles = [];
  }
  renderVehicleSourcePicker();
  return agendaGarageVehicles;
}

function applyVehicleToAgendaFields(vehicle) {
  if (!vehicle) return;
  renderVehicleCatalogFields();

  const brandSelect = qs("#vehicleBrand");
  const brand = vehicle.brand || "";
  const line = vehicle.line || "";
  const year = vehicle.year || "";
  const brandKnown = brandSelect && [...brandSelect.options].some(opt => opt.value === brand);

  if (brandKnown) {
    setFieldValue("#vehicleBrand", brand);
  } else {
    setFieldValue("#vehicleBrand", "Otra marca");
    const otherBrand = qs("#vehicleBrandOther");
    if (otherBrand) otherBrand.value = brand;
  }

  updateVehicleLineOptions();
  const lineSelect = qs("#vehicleLine");
  const lineKnown = lineSelect && [...lineSelect.options].some(opt => opt.value === line);
  if (lineKnown) {
    setFieldValue("#vehicleLine", line);
  } else {
    setFieldValue("#vehicleLine", "Otra línea");
    const otherLine = qs("#vehicleLineOther");
    if (otherLine) otherLine.value = line;
  }

  const yearSelect = qs("#vehicleYear");
  if (yearSelect && year && ![...yearSelect.options].some(opt => opt.value === String(year))) {
    yearSelect.insertAdjacentHTML("beforeend", `<option value="${safeText(year)}">${safeText(year)}</option>`);
  }
  setFieldValue("#vehicleYear", String(year || ""));
  const engineSelect = qs("#vehicleEngine");
  if (engineSelect && vehicle.engine) {
    if (![...engineSelect.options].some(opt => opt.value === String(vehicle.engine))) {
      engineSelect.insertAdjacentHTML("beforeend", `<option value="${safeText(vehicle.engine)}">${safeText(vehicle.engine)}</option>`);
    }
    engineSelect.value = String(vehicle.engine);
  }
  toggleVehicleCustomFields();
  lockVehicleFields(true);
}

function renderLinkedVehicleBanner(vehicle) {
  const holder = qs("#linkedVehicleBanner");
  if (!holder) return;
  if (!vehicle) {
    holder.classList.add("hidden-field");
    holder.innerHTML = "";
    return;
  }
  holder.classList.remove("hidden-field");
  holder.innerHTML = `
    <div class="linked-vehicle-card dtek-glass">
      <span class="eyebrow">Vehículo seleccionado</span>
      <strong>${safeText(vehicle.brand)} ${safeText(vehicle.line)} ${safeText(vehicle.year || "")}</strong>
      <small>Placa: ${safeText(vehicle.plate || "—")} · VIN: ${safeText(vehicle.vin || "—")}</small>
      <button class="linked-vehicle-switch-v31" type="button" data-manual-vehicle>Es otro carro, quiero escribirlo</button>
    </div>`;
}

async function loadLinkedVehicleFromUrl() {
  const vehicleId = params.get("vehicle_id");
  linkedAgendaVehicleId = vehicleId || "";
  if (!qs("#agendaForm")) return;

  await loadSmartAgendaContext();
  await loadAgendaGarageVehicles();

  if (!vehicleId) {
    lockVehicleFields(false);
    compactSmartAgendaFields();
    updateAgendaSummary();
    return;
  }

  if (!dtekBackendActive() || !window.DtekBackend?.getMyVehicle) {
    setAgendaStepMessage("Ese carro guardado solo se carga con tu sesión abierta. Escribilo aquí abajo y seguimos igual.");
    useManualVehicle();
    return;
  }

  try {
    const vehicle = await window.DtekBackend.getMyVehicle(vehicleId);
    linkedAgendaVehicle = vehicle;
    applyVehicleToAgendaFields(vehicle);
    renderLinkedVehicleBanner(vehicle);
    renderVehicleSourcePicker();
    window.DtekSelectorPro?.updateVehicleCascade?.();
    compactSmartAgendaFields();
    updateAgendaSummary();
    if (params.get("from") === "garage" && !params.get("servicio") && !qs("#agendaService")?.value) {
      renderAgendaGroups();
    }
    // El carro ya está resuelto: saltamos al paso que toca.
    const target = params.get("servicio") ? 3 : 2;
    if (window.DtekBookingWizard?.getStep?.() === 1) window.DtekBookingWizard.setStep(target, { scroll: false });
  } catch (error) {
    console.warn("No se pudo cargar vehículo ligado", error);
    setAgendaStepMessage("No pudimos abrir ese carro guardado. Escribí los datos aquí abajo y tu cita sigue igual.");
    useManualVehicle();
  }
}


function serviceMiniCard(service) {
  return `<button type="button" class="service-mini-card dtek-glass" data-agenda-service="${safeText(service.id)}">
    <span>${safeText(service.category)}</span>
    <strong>${safeText(service.name)}</strong>
    <small>${safeText(service.price)} · ${safeText(service.durationMinutes || 60)} min · +${estimateServicePoints(service)} pts</small>
  </button>`;
}

function renderAgendaGroups() {
  const holder = qs("#agendaCategoryPanel");
  if (!holder || typeof dtekServiceGroups === "undefined") return;
  holder.innerHTML = `<div class="choice-section-head"><span class="eyebrow">Servicios</span><h3>Categorías D-TEK</h3></div>
    <div class="category-chip-grid">
      ${dtekServiceGroups.map(group => `<button type="button" class="category-chip" data-agenda-group="${safeText(group.id)}"><strong>${safeText(group.title)}</strong><small>${safeText(group.hint)}</small></button>`).join("")}
    </div>`;
}

function renderAgendaSymptoms() {
  const holder = qs("#agendaSymptomsPanel");
  if (!holder || typeof dtekSymptomGroups === "undefined") return;
  holder.innerHTML = `<div class="choice-section-head"><span class="eyebrow">Síntomas</span><h3>¿Qué está haciendo el carro?</h3></div>
    <div class="symptom-chip-grid">
      ${dtekSymptomGroups.map(symptom => `<button type="button" class="symptom-chip" data-agenda-symptom="${safeText(symptom.id)}"><strong>${safeText(symptom.label)}</strong><small>${safeText(symptom.chapin)}</small></button>`).join("")}
    </div>`;
}

function renderAgendaServiceOptions(serviceIds = [], title = "Opciones recomendadas") {
  const holder = qs("#agendaServicePanel");
  if (!holder) return;
  const services = serviceIds.map(id => findService(id)).filter(Boolean);
  holder.innerHTML = services.length
    ? `<div class="choice-section-head"><span class="eyebrow">Elegí</span><h3>${safeText(title)}</h3></div><div class="service-mini-grid">${services.map(serviceMiniCard).join("")}</div>`
    : `<p class="memory-empty">No hay opciones configuradas para esta selección.</p>`;
}

function clearAgendaChoicePanels(keep = "") {
  ["#agendaCategoryPanel", "#agendaSymptomsPanel", "#agendaServicePanel"].forEach(selector => {
    const el = qs(selector);
    if (el && selector !== keep) el.innerHTML = "";
  });
}

function updateSelectedServiceBanner() {
  const banner = qs("#selectedServiceBanner");
  const services = getSelectedServices();
  const composite = buildCompositeAgendaService();
  const quote = buildQuoteSummary(services, getSelectedAddOns());
  if (!banner) return;
  document.body.classList.toggle("agenda-service-selected", Boolean(composite));
  const stepTwoNext = qs('.booking-step-v25[data-booking-step="2"] [data-booking-next]');
  if (stepTwoNext) {
    stepTwoNext.disabled = !composite;
    stepTwoNext.textContent = composite ? "Ver fechas y horarios" : "Elegí un servicio";
  }
  if (!composite) {
    banner.classList.remove("service-ready");
    banner.querySelector("h2").textContent = "Agregá uno o varios servicios";
    const p = banner.querySelector("p");
    if (p) p.textContent = "Tu cotización inicial se arma mientras agregás trabajos.";
    renderServiceBuilderQuote();
    return;
  }
  banner.classList.add("service-ready");
  banner.querySelector("h2").textContent = services.length === 1 ? services[0].name : `${services.length} servicios seleccionados`;
  const p = banner.querySelector("p");
  if (p) p.textContent = `${quote.label} · ${composite.durationMinutes} min estimados`;
  const progress = qs("#wizardProgress");
  if (progress) progress.querySelectorAll("span").forEach((item, index) => item.classList.toggle("active", index <= 1));
  renderServiceBuilderQuote();
}

function chooseAgendaService(serviceId, shouldScroll = true) {
  const select = qs("#agendaService");
  const service = findService(serviceId);
  if (!select || !service) return;
  const alreadySelected = selectedAgendaServiceIds.includes(service.id);
  selectedAgendaServiceIds = alreadySelected
    ? selectedAgendaServiceIds.filter(id => id !== service.id)
    : [...selectedAgendaServiceIds, service.id];
  const primary = getPrimaryService();
  select.value = primary?.id || "";
  selectedAgendaTime = "";
  updateSelectedServiceBanner();
  const commentsField = qs("#clientComments");
  if (commentsField && !commentsField.value.trim() && selectedSymptomLabel) commentsField.value = selectedSymptomLabel;
  renderTimeButtons();
  updateAgendaSummary();
  updateCompactPickerState();
  const pickerOpen = !qs("#servicePickerDialog")?.classList.contains("hidden-field");
  if (shouldScroll && !pickerOpen) qs("#serviceQuoteBuilder")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderAgendaStartDefault() {
  renderAgendaGroups();
  const symptoms = qs("#agendaSymptomsPanel");
  if (symptoms) symptoms.innerHTML = "";
  const servicePanel = qs("#agendaServicePanel");
  if (servicePanel) servicePanel.innerHTML = "";
}

function setAgendaStartCollapsed(collapsed, summaryText = "") {
  const start = qs("#agendaStart");
  if (!start) return;
  start.classList.toggle("agenda-start-collapsed", Boolean(collapsed));
  const summary = qs("#agendaStartSummary");
  if (!summary) return;
  summary.textContent = summaryText;
  summary.classList.toggle("hidden-field", !collapsed || !summaryText);
}

function renderAgendaPage() {
  const form = qs("#agendaForm");
  if (!form) return;

  const select = qs("#agendaService");
  const selected = params.get("servicio");
  selectedAgendaServiceIds = [];
  select.innerHTML = `<option value="">Elegir servicio</option>` + dtekServices.map(s => `<option value="${s.id}">${safeText(s.name)} · ${safeText(s.price)} · ${safeText(s.durationMinutes || 60)} min</option>`).join("");
  renderAgendaStartDefault();
  const flow = params.get("flow");
  if (selected && findService(selected)) {
    selectedAgendaServiceIds = [selected];
    select.value = selected;
    updateSelectedServiceBanner();
    renderAgendaServiceOptions([selected], "Servicio agregado");
    setAgendaStartCollapsed(false);
  } else if (flow) {
    const groupMap = {
      diagnostico: "diagnostico",
      falla: "diagnostico",
      compra: "compra",
      mantenimiento: "mantenimiento",
      frenos: "frenos",
      inyeccion: "inyeccion",
      electrico: "electrico",
      varios: "varios"
    };
    if (flow === "symptoms" || flow === "sintomas") {
      clearAgendaChoicePanels("#agendaSymptomsPanel");
      renderAgendaSymptoms();
    } else {
      const groupId = groupMap[flow];
      const group = (typeof dtekServiceGroups !== "undefined") ? dtekServiceGroups.find(item => item.id === groupId) : null;
      if (group) {
        clearAgendaChoicePanels("#agendaServicePanel");
        renderAgendaServiceOptions(group.services, group.title);
      }
    }
  }

  renderVehicleCatalogFields();
  renderAppointmentAddOns();
  renderAgendaCompactLaunchers();
  const requestedAddOn = params.get("adicional");
  if (requestedAddOn) {
    const input = qsa("[data-addon-check]").find(item => item.value === requestedAddOn);
    if (input) {
      input.checked = true;
      input.closest(".addon-pill")?.classList.add("selected");
      const icon = input.closest(".addon-pill")?.querySelector(":scope > b");
      if (icon) icon.textContent = "✓";
    }
  }
  renderServiceBuilderQuote();
  renderDateButtons();
  renderTimeButtons();
  updateAgendaSummary();
  updateSelectedServiceBanner();
  renderAgendaMemory();
}

function getSelectedTimeSlot() {
  const active = qs(".time-chip.selected");
  if (!active) return null;
  return {
    label: active.dataset.time,
    start: Number(active.dataset.start),
    end: Number(active.dataset.end),
    blockStart: Number(active.dataset.blockStart),
    blockEnd: Number(active.dataset.blockEnd)
  };
}

function getAgendaFormValues() {
  const services = getSelectedServices();
  const addOns = getSelectedAddOns();
  const service = buildCompositeAgendaService();
  const quote = buildQuoteSummary(services, addOns);
  const slot = getSelectedTimeSlot();
  return {
    service,
    primaryService: services[0] || null,
    services,
    serviceName: services.length ? services.map(item => item.name).join(" + ") : "Elegí servicio",
    price: service ? quote.label : "—",
    duration: service ? `${service.durationMinutes} min estimados` : "—",
    buffer: service ? `${(service.bufferBefore || 0) + (service.bufferAfter || 0)} min` : "—",
    date: selectedAgendaDate,
    time: selectedAgendaTime,
    slot,
    fullName: qs("#clientName")?.value.trim() || "",
    phone: qs("#clientPhone")?.value.trim() || "",
    email: qs("#clientEmail")?.value.trim() || "",
    address: qs("#clientAddress")?.value.trim() || "",
    city: qs("#clientCity")?.value.trim() || "",
    vehicleId: linkedAgendaVehicle?.id || linkedAgendaVehicleId || "",
    brand: linkedAgendaVehicle?.brand || selectedVehicleBrand(),
    line: linkedAgendaVehicle?.line || selectedVehicleLine(),
    model: linkedAgendaVehicle?.line || selectedVehicleLine(),
    year: linkedAgendaVehicle?.year || qs("#vehicleYear")?.value || "",
    engine: linkedAgendaVehicle?.engine || qs("#vehicleEngine")?.value || "",
    moves: qs("#vehicleMoves")?.value || "",
    comments: qs("#clientComments")?.value.trim() || "",
    otherServiceDetails: qs("#otherServiceDetails")?.value.trim() || "",
    addOns
  };
}

function updateAgendaSummary() {
  const holder = qs("#agendaSummary");
  if (!holder) return;
  const data = getAgendaFormValues();
  const service = data.service;
  const vehicleText = [data.brand, data.line, data.year].filter(Boolean).join(" ");
  const vehicleComplete = Boolean(data.vehicleId || (data.brand && data.line && data.year && data.engine && data.moves));
  const serviceComplete = Boolean(service);
  const scheduleComplete = Boolean(data.date && data.time);
  const detailsComplete = Boolean(data.fullName && data.phone && data.email && data.address && data.city);
  const hasMeaningfulData = vehicleComplete || serviceComplete || scheduleComplete || detailsComplete || Boolean(data.addOns?.length);
  holder.classList.toggle("summary-empty", !hasMeaningfulData);

  const choice = (step, label, value, complete, meta = "", pendingText = "Falta elegir") => `
    <div class="summary-choice ${complete ? "is-complete" : "is-pending"}">
      <span class="summary-choice-status" aria-hidden="true">${complete ? "✓" : step}</span>
      <div>
        <small>${safeText(label)}</small>
        <strong>${safeText(complete ? value : pendingText)}</strong>
        ${meta ? `<em>${safeText(meta)}</em>` : ""}
      </div>
    </div>`;

  holder.innerHTML = `
    <div class="summary-logo"><img src="assets/logo-dtek.png" alt="D-TEK GT"><strong>D-TEK GT</strong></div>
    <div class="summary-total ${serviceComplete ? "" : "is-empty"}"><span>Total estimado</span><strong>${safeText(data.price)}</strong></div>
    <div class="summary-block summary-choice-list">
      <h3>Tu solicitud</h3>
      ${choice(1, "Carro", vehicleText, vehicleComplete, data.vehicleId ? "Guardado en Garage" : "", vehicleText ? "Falta completar" : "Falta elegir")}
      ${choice(2, "Servicios", data.serviceName || "", serviceComplete, service ? `${data.services.length} trabajo${data.services.length === 1 ? "" : "s"} · ${data.price} · ${data.duration}` : "")}
      ${choice(3, "Horario", scheduleComplete ? `${displayDateLabel(data.date)} · ${data.time}` : "", scheduleComplete)}
      ${choice(4, "Confirmar", detailsComplete ? "Datos completos" : "", detailsComplete, "", "Falta completar")}
    </div>
    <div class="summary-optional">
      <span>Adicionales</span><strong>${data.addOns?.length ? `${data.addOns.length} agregados` : "Ninguno"}</strong>
    </div>
  `;
}

document.addEventListener("dtek:booking-step", updateAgendaSummary);
document.addEventListener("dtek:booking-step", async (event) => {
  if (Number(event.detail?.step) !== 4) return;
  await loadSmartAgendaContext();
  compactSmartAgendaFields();
});

function buildAgendaMessage(appointmentId = "") {
  const data = getAgendaFormValues();
  const vehicle = [data.brand, data.line, data.year].filter(Boolean).join(" ") || "Sin datos";
  const endTime = data.slot ? formatMinutes(data.slot.end) : "Sin hora final";
  return `Hola D-TEK, quiero confirmar esta solicitud de agenda.

ID de solicitud: ${appointmentId}
Servicios solicitados:
${serviceSelectionText(data.services)}

Cotización inicial mostrada: ${data.price}
Tiempo estimado total: ${data.duration}
Día solicitado: ${displayDateLabel(data.date)}
Horario solicitado: ${data.time}–${endTime}

Datos del cliente:
Nombre: ${data.fullName}
Teléfono: ${data.phone}
Email: ${data.email}
Dirección: ${data.address}
Ciudad/Zona/Municipio: ${data.city}

Vehículo:
Marca: ${data.brand || "Sin datos"}
Línea: ${data.line || "Sin datos"}
Modelo/Año: ${data.year || "Sin datos"}
Resumen: ${vehicle}
¿Arranca y se mueve?: ${data.moves}
Comentarios / síntoma:
${data.comments || "Sin comentario"}

Otro servicio solicitado:
${data.otherServiceDetails || "No aplica"}

Servicios adicionales solicitados:
${selectedAddOnsText(data.addOns)}

Entiendo que la cita queda sujeta a confirmación final según ubicación, acceso, vehículo, disponibilidad y alcance real del servicio.`;
}

function showBookingSuccess(saved, data, waMessage, accountResult = null, whatsappOpened = true) {
  const holder = qs("#bookingSuccess");
  if (!holder) return;
  const vehicle = [data.brand, data.line, data.year].filter(Boolean).join(" ") || "Sin datos";
  const endTime = data.slot ? formatMinutes(data.slot.end) : "";
  const folio = saved.id ? String(saved.id).slice(0, 8).toUpperCase() : "—";
  const waHref = typeof waLink === "function" ? waLink(waMessage) : "#";
  const accountNote = !accountResult ? ""
    : accountResult.ok
      ? `<div class="success-account-v31 ok"><strong>Tu perfil quedó listo.</strong><p>Entrá al Garage con el usuario <b>${safeText(accountResult.username)}</b> y la contraseña que elegiste.</p></div>`
      : `<div class="success-account-v31 warn"><strong>La cita quedó guardada.</strong><p>${safeText(accountResult.message)}</p></div>`;

  holder.innerHTML = `
    <div class="booking-success-card-v25">
      <div class="success-check-v25" aria-hidden="true">✓</div>
      <span class="success-status-pill-v25">Solicitud recibida</span>
      <h2>¡Listo, ${safeText(data.fullName || "gracias")}!</h2>
      <p class="success-lead-v25">Guardamos tu solicitud. Confirmamos por WhatsApp en breve según disponibilidad real de horario y acceso.</p>

      <div class="success-details-v25">
        <div><small>Servicio</small><strong>${safeText(data.serviceName || "—")}</strong></div>
        <div><small>Fecha y hora</small><strong>${safeText(displayDateLabel(data.date))} · ${safeText(data.time)}${endTime ? `–${safeText(endTime)}` : ""}</strong></div>
        <div><small>Vehículo</small><strong>${safeText(vehicle)}</strong></div>
        <div><small>Nombre</small><strong>${safeText(data.fullName || "—")}</strong></div>
      </div>

      <div class="success-folio-v25">Folio de referencia: <strong>DTK-${safeText(folio)}</strong></div>

      <div class="success-siguiente-v318">
        <span>Qué sigue ahora</span>
        <ol>
          <li><b>Revisamos el horario</b><em>Confirmamos que el espacio siga libre y que se pueda llegar.</em></li>
          <li><b>Te escribimos por WhatsApp</b><em>Normalmente el mismo día. Si agendaste de noche, a primera hora.</em></li>
          <li><b>Llegamos a donde estés</b><em>Ese día trabajamos en el lugar y todo queda en tu Garage.</em></li>
        </ol>
        <p>Si necesitás moverlo o preguntar algo antes, escribinos y listo — no hace falta volver a agendar.</p>
      </div>
      ${accountNote}

      <div class="success-whatsapp-v25 ${whatsappOpened ? "" : "needs-tap-v31"}">
        <p>${whatsappOpened
          ? "Ya abrimos WhatsApp con el resumen listo. Si no se abrió, tocá el botón y solo hace falta que presiones <strong>Enviar</strong>."
          : "<strong>Falta un paso.</strong> Tu navegador no dejó abrir WhatsApp solo. Tocá el botón y presioná <strong>Enviar</strong> para que recibamos tu solicitud."}</p>
        <a class="public-btn-v25 primary" href="${waHref}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp y enviar</a>
      </div>

      <div class="success-actions-v25">
        <a class="public-btn-v25 secondary" href="cliente.html">Ver mi Garage</a>
        <a class="public-btn-v25 secondary" href="agenda.html">Agendar otra cita</a>
        <a class="public-btn-v25 secondary" href="index.html">Volver al inicio</a>
      </div>
    </div>`;

  qs("#wizardProgress")?.classList.add("hidden-field");
  qs(".booking-workspace-v25")?.classList.add("hidden-field");
  qs("#agendaStepMessage")?.classList.add("hidden-field");
  holder.classList.remove("hidden-field");
  window.requestAnimationFrame(() => {
    const top = Math.max(0, holder.getBoundingClientRect().top + window.scrollY - 82);
    window.scrollTo({ top, behavior: "smooth" });
    holder.focus({ preventScroll: true });
  });
}

function getZapierWebhookUrl() {
  return String(window.DTEK_ZAPIER_WEBHOOK_URL || "").trim();
}

function zapierEnabled() {
  return Boolean(window.DTEK_ZAPIER_ENABLED && getZapierWebhookUrl());
}

function appointmentAutomationPayload(eventType, appointment) {
  return {
    eventType,
    source: "DTEK Web OS",
    timestamp: new Date().toISOString(),
    ownerEmail: getDtekOwnerEmail(),
    appointment,
    service: findService(appointment.serviceId) || null,
    vehicleSummary: appointment?.vehicle ? [appointment.vehicle.brand, appointment.vehicle.line, appointment.vehicle.year].filter(Boolean).join(" ") : "",
    statusLabel: appointmentStatusLabel(appointment?.status),
    dateLabel: displayDateLabel(appointment?.date),
    timeLabel: appointment ? `${appointment.time}–${formatMinutes(appointment.endMinutes)}` : ""
  };
}

async function sendAutomationEvent(eventType, appointment) {
  if (!zapierEnabled() || !appointment) return { skipped: true };
  const url = getZapierWebhookUrl();
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appointmentAutomationPayload(eventType, appointment))
    });
    return { ok: true };
  } catch (error) {
    console.warn("D-TEK Zapier webhook no pudo enviarse:", error);
    return { ok: false, error };
  }
}

function buildConfirmationEmail(appointment, target = "owner") {
  const service = appointment.serviceName;
  const vehicle = [appointment.vehicle.brand, appointment.vehicle.line, appointment.vehicle.year].filter(Boolean).join(" ") || "Sin datos";
  const subject = target === "client"
    ? `Solicitud recibida D-TEK GT · ${service}`
    : `Nueva solicitud D-TEK · ${service} · ${appointment.client.fullName}`;
  const body = `D-TEK GT · Confirmación de solicitud

ID: ${appointment.id}
Estado: ${appointmentStatusLabel(appointment.status)}
Servicio: ${service}
Precio base: ${appointment.price}
Fecha: ${displayDateLabel(appointment.date)}
Horario: ${appointment.time}–${formatMinutes(appointment.endMinutes)}

Cliente:
Nombre: ${appointment.client.fullName}
Teléfono: ${appointment.client.phone}
Correo: ${appointment.client.email}
Dirección: ${appointment.client.address}
Ciudad/Zona/Municipio: ${appointment.client.city}

Vehículo:
${vehicle}
¿Arranca y se mueve?: ${appointment.vehicle.moves}

Comentarios / síntoma:
${appointment.vehicle.comments || "Sin comentarios"}

Nota: La solicitud queda sujeta a confirmación final según ubicación, acceso, vehículo, disponibilidad y alcance real del servicio.`;
  return { subject, body };
}

function mailtoLink(to, email) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
}

function setBookingStatus(message, type = "warn") {
  const el = qs("#bookingStatus");
  if (!el) return;
  el.className = `booking-status is-visible ${type}`;
  el.textContent = message;
}

function clearBookingStatus() {
  const el = qs("#bookingStatus");
  if (!el) return;
  el.className = "booking-status";
  el.textContent = "";
}

function setAgendaStepMessage(message = "") {
  const el = qs("#agendaStepMessage");
  if (el) el.textContent = message;
}

function prepareConfirmationEmails(appointment) {
  const ownerEmail = getDtekOwnerEmail();
  const clientEmail = appointment.client.email;
  const ownerPayload = buildConfirmationEmail(appointment, "owner");
  const clientPayload = buildConfirmationEmail(appointment, "client");

  // Si Zapier está habilitado, se manda payload para correos, Sheets, Calendar, CRM, etc.
  sendAutomationEvent("appointment_created", appointment);

  // Prototipo local: si DTEK_EMAIL_MODE sigue en mailto, abre borradores de correo.
  if (String(window.DTEK_EMAIL_MODE || "mailto") === "mailto") {
    if (ownerEmail) window.open(mailtoLink(ownerEmail, ownerPayload), "_blank", "noopener,noreferrer");
    if (clientEmail) setTimeout(() => window.open(mailtoLink(clientEmail, clientPayload), "_blank", "noopener,noreferrer"), 500);
  }
}

async function saveAppointment() {
  const data = getAgendaFormValues();
  if (!data.service || !data.slot) return null;
  const commentsWithAddOns = [
    data.engine ? `Motor indicado: ${data.engine}` : "",
    data.services?.length ? `Servicios solicitados:\n${serviceSelectionText(data.services)}` : "",
    data.otherServiceDetails ? `Otro servicio / clavo descrito:\n${data.otherServiceDetails}` : "",
    data.comments,
    data.addOns?.length ? `Servicios adicionales solicitados:\n${selectedAddOnsText(data.addOns)}` : ""
  ].filter(Boolean).join("\n\n");

  const appointment = {
    id: generateBookingId(),
    createdAt: new Date().toISOString(),
    status: "pending",
    serviceId: data.primaryService?.backendServiceId || data.primaryService?.id || data.service.id,
    serviceName: data.serviceName,
    services: data.services || [],
    price: data.price,
    date: data.date,
    time: data.time,
    startMinutes: data.slot.start,
    endMinutes: data.slot.end,
    blockStartMinutes: data.slot.blockStart,
    blockEndMinutes: data.slot.blockEnd,
    client: {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city
    },
    vehicle: {
      id: data.vehicleId || "",
      brand: data.brand,
      line: data.line,
      model: data.line,
      year: data.year,
      moves: data.moves,
      comments: commentsWithAddOns
    },
    addOns: data.addOns || []
  };

  if (dtekBackendActive()) {
    try {
      const rpcPayload = {
        service_id: data.primaryService?.backendServiceId || data.primaryService?.id || data.service.id,
        client_name: data.fullName,
        client_email: data.email,
        client_phone: data.phone,
        vehicle_brand: data.brand,
        vehicle_line: data.line,
        vehicle_year: Number(data.year) || null,
        vehicle_moves: data.moves,
        location: data.address,
        city: data.city,
        symptom: commentsWithAddOns,
        scheduled_start: buildDateTimeIso(data.date, data.slot.start),
        scheduled_end: buildDateTimeIso(data.date, data.slot.end),
        block_start: buildDateTimeIso(data.date, data.slot.blockStart),
        block_end: buildDateTimeIso(data.date, data.slot.blockEnd),
        source: "web-agenda"
      };
      if (data.vehicleId && window.DtekBackend?.createAppointmentForVehicle) {
        rpcPayload.vehicle_id = data.vehicleId;
        rpcPayload.source = "client-portal-vehicle";
      }
      const saved = data.vehicleId && window.DtekBackend?.createAppointmentForVehicle
        ? await window.DtekBackend.createAppointmentForVehicle(rpcPayload)
        : await DtekBackend.createPublicAppointment(rpcPayload);
      if (!saved?.id) throw new Error("Supabase respondió, pero no devolvió ID de cita.");
      appointment.id = saved.id;
      appointment.status = saved.status || "requested";
      appointment.supabase = true;
      appointment.supabaseRaw = saved;
      await refreshBackendBusyBlocks(data.date);
      return appointment;
    } catch (error) {
      console.error("Error guardando cita en Supabase:", error);
      const msg = String(error?.message || error || "Error desconocido");
      if (msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("ocup")) {
        return { conflict: true };
      }
      return { error: true, message: msg };
    }
  }

  console.error("La agenda real no está configurada en esta carpeta.");
  return { error: true, message: "La agenda real no está activa en esta carpeta. Revisá configuración antes de publicar." };
}

const DTEK_ADMIN_SESSION_KEY = "dtek_admin_unlocked";
let currentAdminFilter = "all";

function isAdminUnlocked() {
  return sessionStorage.getItem(DTEK_ADMIN_SESSION_KEY) === "true";
}

function setAdminUnlocked(value) {
  if (value) sessionStorage.setItem(DTEK_ADMIN_SESSION_KEY, "true");
  else sessionStorage.removeItem(DTEK_ADMIN_SESSION_KEY);
}

function renderAdminPage() {
  const loginPanel = qs("#adminLoginPanel");
  const adminPanel = qs("#adminPanel");
  if (!loginPanel || !adminPanel) return;
  const unlocked = isAdminUnlocked();
  loginPanel.classList.toggle("hidden-field", unlocked);
  adminPanel.classList.toggle("hidden-field", !unlocked);
  if (unlocked) renderAdminAppointments();
}

function renderAdminAppointments() {
  const holder = qs("#adminAppointments");
  if (!holder) return;
  const appointments = storageGetAppointments().sort((a, b) => `${a.date} ${a.startMinutes}`.localeCompare(`${b.date} ${b.startMinutes}`));
  const filtered = currentAdminFilter === "all" ? appointments : appointments.filter(item => (item.status || "pending") === currentAdminFilter);
  if (!filtered.length) {
    holder.innerHTML = `<div class="empty-slots dtek-glass"><strong>No hay solicitudes en este filtro.</strong><p>Cuando un cliente agende, aparecerá aquí.</p></div>`;
    return;
  }
  holder.innerHTML = `
    <div class="memory-list admin-memory-list">
      ${filtered.map(appt => `
        <article class="memory-item ${safeText(appt.status || "pending")}">
          <div class="memory-item-main">
            <div>
              <strong>${safeText(appt.serviceName)}</strong>
              <small>ID ${safeText(appt.id)} · ${safeText(displayDateLabel(appt.date))} · ${safeText(appt.time)}–${safeText(formatMinutes(appt.endMinutes))}</small>
              <small>${safeText(appt.client.fullName || "Cliente")} · ${safeText(appt.client.phone || "Sin teléfono")} · ${safeText(appt.client.email || "Sin correo")}</small>
              <small>${safeText([appt.vehicle?.brand, appt.vehicle?.line, appt.vehicle?.year].filter(Boolean).join(" "))} · ${safeText(appt.client.city || "Sin zona")}</small>
            </div>
            <span class="status-pill ${safeText(appt.status || "pending")}">${safeText(appointmentStatusLabel(appt.status))}</span>
          </div>
          <p class="muted-copy">${safeText(appt.vehicle?.comments || "Sin comentarios")}</p>
          <div class="memory-actions">
            <button type="button" data-appointment-status="pending" data-appointment-id="${safeText(appt.id)}">Solicitada</button>
            <button type="button" data-appointment-status="confirmed" data-appointment-id="${safeText(appt.id)}">Confirmar</button>
            <button type="button" data-appointment-status="completed" data-appointment-id="${safeText(appt.id)}">Realizada</button>
            <button type="button" data-appointment-status="cancelled" data-appointment-id="${safeText(appt.id)}">Cancelar</button>
          </div>
        </article>`).join("")}
    </div>`;
}

function renderFaqs() {
  const holder = qs("#faqList");
  if (!holder) return;
  holder.innerHTML = dtekFaqs.map(([q, a]) => `
    <article class="faq-item dtek-glass">
      <button class="faq-question" type="button">${safeText(q)}<span>+</span></button>
      <div class="faq-answer"><p>${safeText(a)}</p></div>
    </article>
  `).join("");
}

function setupReveal() {
  const items = qsa(".reveal:not(.visible)");
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    items.forEach(el => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(el => observer.observe(el));
}

function setupEvents() {
  const menuToggle = qs("#menuToggle");
  const navLinks = qs("#navLinks");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(open));
    });
  }

  document.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-filter]");
    if (filter) {
      currentCategory = filter.dataset.filter;
      renderFilters();
      renderServices();
      return;
    }

    const agendaMode = event.target.closest("[data-agenda-mode]");
    if (agendaMode) {
      if (agendaMode.dataset.agendaMode === "services") {
        renderAgendaGroups();
        qs("#agendaCategoryPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (agendaMode.dataset.agendaMode === "symptoms") {
        clearAgendaChoicePanels("#agendaSymptomsPanel");
        renderAgendaSymptoms();
        qs("#agendaSymptomsPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const agendaGroup = event.target.closest("[data-agenda-group]");
    if (agendaGroup) {
      const group = (typeof dtekServiceGroups !== "undefined") ? dtekServiceGroups.find(item => item.id === agendaGroup.dataset.agendaGroup) : null;
      if (group) {
        renderAgendaServiceOptions(group.services, group.title);
        qs("#agendaServicePanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const agendaSymptom = event.target.closest("[data-agenda-symptom]");
    if (agendaSymptom) {
      const symptom = (typeof dtekSymptomGroups !== "undefined") ? dtekSymptomGroups.find(item => item.id === agendaSymptom.dataset.agendaSymptom) : null;
      if (symptom) {
        selectedSymptomLabel = symptom.label;
        renderAgendaServiceOptions(symptom.recommended, `Recomendado para: ${symptom.label}`);
        qs("#agendaServicePanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const openServiceBrowser = event.target.closest("#openServiceBrowser");
    if (openServiceBrowser) {
      openCompactPicker("category-browser");
      return;
    }

    const openGroup = event.target.closest("[data-open-service-group]");
    if (openGroup) {
      openCompactPicker("group", openGroup.dataset.openServiceGroup, openGroup.dataset.fromCategoryBrowser === "true" ? "category-browser" : null);
      return;
    }

    const openSymptomBrowser = event.target.closest("[data-open-symptom-browser]");
    if (openSymptomBrowser) {
      openCompactPicker("symptom-browser");
      return;
    }

    const openSymptom = event.target.closest("[data-open-symptom-group]");
    if (openSymptom) {
      const fromBrowser = openSymptom.dataset.fromBrowser === "true";
      openCompactPicker("symptom", openSymptom.dataset.openSymptomGroup, fromBrowser ? "symptom-browser" : null);
      return;
    }

    const openAddOns = event.target.closest("#openAddOnPicker");
    if (openAddOns) {
      openCompactPicker("addons");
      return;
    }

    const pickerBack = event.target.closest("#servicePickerBack");
    if (pickerBack) {
      if (compactPickerState.previous === "symptom-browser") renderCompactPicker("symptom-browser");
      if (compactPickerState.previous === "category-browser") renderCompactPicker("category-browser");
      return;
    }

    const closePicker = event.target.closest("[data-close-service-picker]");
    if (closePicker) {
      closeCompactPicker();
      return;
    }

    const agendaService = event.target.closest("[data-agenda-service]");
    if (agendaService) {
      chooseAgendaService(agendaService.dataset.agendaService);
      return;
    }

    const removeService = event.target.closest("[data-remove-service]");
    if (removeService) {
      chooseAgendaService(removeService.dataset.removeService, false);
      return;
    }

    const removeAddOn = event.target.closest("[data-remove-addon]");
    if (removeAddOn) {
      const input = qs(`[data-addon-check][value="${CSS.escape(removeAddOn.dataset.removeAddon)}"]`);
      if (input) input.checked = false;
      selectedAgendaTime = "";
      renderServiceBuilderQuote();
      updateSelectedServiceBanner();
      renderTimeButtons();
      updateAgendaSummary();
      return;
    }

    const resetAgenda = event.target.closest("#resetAgendaChoice");
    if (resetAgenda) {
      const select = qs("#agendaService");
      if (select) select.value = "";
      selectedAgendaServiceIds = [];
      qsa("[data-addon-check]").forEach(input => { input.checked = false; });
      const otherDetails = qs("#otherServiceDetails");
      if (otherDetails) otherDetails.value = "";
      selectedAgendaTime = "";
      selectedSymptomLabel = "";
      setAgendaStartCollapsed(false);
      qs("#agendaStart")?.classList.remove("path-chosen");
      renderAgendaStartDefault();
      renderAgendaCompactLaunchers();
      closeCompactPicker();
      updateSelectedServiceBanner();
      renderTimeButtons();
      updateAgendaSummary();
      qs("#agendaStart")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const dateButton = event.target.closest("[data-date]");
    if (dateButton && !dateButton.disabled) {
      selectedAgendaDate = dateButton.dataset.date;
      selectedAgendaTime = "";
      renderDateButtons();
      renderTimeButtons();
      updateAgendaSummary();
      return;
    }

    const timeButton = event.target.closest("[data-time]");
    if (timeButton) {
      selectedAgendaTime = timeButton.dataset.time;
      renderTimeButtons();
      updateAgendaSummary();
      return;
    }

    const editSmartProfile = event.target.closest("#editSmartProfileData");
    if (editSmartProfile) {
      smartProfileEditing = !smartProfileEditing;
      compactSmartAgendaFields();
      if (smartProfileEditing) qs("#clientName")?.focus();
      return;
    }

    const manualVehicle = event.target.closest("[data-manual-vehicle]");
    if (manualVehicle) {
      setAgendaStepMessage("");
      useManualVehicle();
      return;
    }

    const garageVehicle = event.target.closest("[data-garage-vehicle]");
    if (garageVehicle) {
      setAgendaStepMessage("");
      useGarageVehicle(garageVehicle.dataset.garageVehicle);
      return;
    }

    const accountMode = event.target.closest("[data-account-mode]");
    if (accountMode) {
      setAgendaAccountMode(accountMode.dataset.accountMode);
      if (agendaAccountMode === "create") qs("#guestAccountUser")?.focus();
      return;
    }

    const statusButton = event.target.closest("[data-appointment-status]");
    if (statusButton) {
      const id = statusButton.dataset.appointmentId;
      const status = statusButton.dataset.appointmentStatus;
      const ok = updateAppointmentStatus(id, status);
      if (ok) {
        renderTimeButtons();
        updateAgendaSummary();
        renderAgendaMemory();
        renderAdminAppointments();
      }
      return;
    }

    const adminFilter = event.target.closest("[data-admin-filter]");
    if (adminFilter) {
      currentAdminFilter = adminFilter.dataset.adminFilter || "all";
      renderAdminAppointments();
      return;
    }

    const adminLogout = event.target.closest("#adminLogout");
    if (adminLogout) {
      setAdminUnlocked(false);
      renderAdminPage();
      return;
    }

    const clearMemory = event.target.closest("#clearAgendaMemory");
    if (clearMemory) {
      const ok = confirm("¿Borrar citas guardadas en la memoria local de prueba?");
      if (ok) {
        storageSetAppointments([]);
        selectedAgendaTime = "";
        renderTimeButtons();
        updateAgendaSummary();
        renderAgendaMemory();
      }
      return;
    }

    const faqButton = event.target.closest(".faq-question");
    if (faqButton) {
      faqButton.closest(".faq-item").classList.toggle("open");
    }
  });

  const agendaFields = ["#agendaService", "#clientName", "#clientPhone", "#clientEmail", "#clientAddress", "#clientCity", "#vehicleBrand", "#vehicleBrandOther", "#vehicleLine", "#vehicleLineOther", "#vehicleYear", "#vehicleEngine", "#vehicleMoves", "#clientComments", "#otherServiceDetails"];
  agendaFields.forEach(selector => {
    const el = qs(selector);
    if (el) el.addEventListener("input", updateAgendaSummary);
    if (el) el.addEventListener("change", () => {
      if (selector === "#agendaService") {
        selectedAgendaTime = "";
        renderTimeButtons();
        updateSelectedServiceBanner();
      }
      if (selector === "#vehicleBrand") {
        updateVehicleLineOptions();
      }
      if (selector === "#vehicleLine") {
        toggleVehicleCustomFields();
      }
      updateAgendaSummary();
    });
  });

  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("[data-addon-check]")) {
      event.target.closest(".addon-pill")?.classList.toggle("selected", event.target.checked);
      const icon = event.target.closest(".addon-pill")?.querySelector(":scope > b");
      if (icon) icon.textContent = event.target.checked ? "✓" : "＋";
      selectedAgendaTime = "";
      renderServiceBuilderQuote();
      updateSelectedServiceBanner();
      renderTimeButtons();
      updateAgendaSummary();
      updateCompactPickerState();
    }
  });

  // El acceso por PIN se retiró: viajaba al navegador en services-data.js.
  // El panel real es admin-backend.html, con sesión de Supabase y role admin.

  const agendaForm = qs("#agendaForm");
  if (agendaForm) {
    agendaForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setAgendaStepMessage("");
      const data = getAgendaFormValues();
      if (!data.service) {
        alert("Elegí un servicio antes de continuar.");
        return;
      }
      if (otherServiceIsSelected() && !data.otherServiceDetails) {
        alert("Contanos qué otro servicio o clavo necesitás antes de continuar.");
        window.DtekBookingWizard?.setStep?.(2);
        qs("#otherServiceDetails")?.focus();
        return;
      }
      if (!selectedAgendaDate || !selectedAgendaTime || !data.slot) {
        alert("Elegí día y hora disponible antes de continuar.");
        return;
      }
      if (!agendaForm.checkValidity()) {
        // Un campo obligatorio de otro paso está oculto: el aviso nativo no puede enfocarlo
        // y el botón parecería no responder. Llevamos a la persona al paso correcto.
        const firstInvalid = agendaForm.querySelector(":invalid");
        const stepNumber = Number(firstInvalid?.closest("[data-booking-step]")?.dataset.bookingStep || 0);
        const hint = window.DtekSelectorPro?.messageFor?.(`#${firstInvalid?.id}`);
        if (stepNumber && stepNumber !== window.DtekBookingWizard?.getStep?.()) {
          window.DtekBookingWizard?.setStep?.(stepNumber);
          setAgendaStepMessage("Falta un dato en este paso para poder confirmar tu cita.");
          window.setTimeout(() => window.DtekSelectorPro?.flagField?.(firstInvalid, hint), 260);
          return;
        }
        window.DtekSelectorPro?.flagField?.(firstInvalid, hint);
        return;
      }
      const accountCheck = validateGuestAccountFields();
      if (!accountCheck.ok) {
        setGuestAccountStatus(accountCheck.message, "error");
        qs(accountCheck.focus)?.focus();
        return;
      }
      const submitButton = agendaForm.querySelector(".submit-booking");
      clearBookingStatus();
      // Se reserva aquí, todavía dentro del clic, porque después del await ya no hay permiso.
      const waWindow = reserveWhatsAppWindow();
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Guardando solicitud..."; }
      const saved = await saveAppointment();
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = "Guardar solicitud y abrir WhatsApp"; }
      if (!saved || saved.conflict) {
        closeReservedWhatsAppWindow(waWindow);
        setBookingStatus("Ese horario se acaba de ocupar o genera traslape. Elegí otro espacio.", "error");
        alert("Ese horario se acaba de ocupar o genera traslape. Elegí otro espacio.");
        renderTimeButtons();
        updateAgendaSummary();
        renderAgendaMemory();
        renderAdminAppointments();
        return;
      }
      if (saved.error) {
        closeReservedWhatsAppWindow(waWindow);
        setBookingStatus(`No se pudo guardar la solicitud: ${saved.message}.`, "error");
        console.error("DTEK_FORM_SAVE_ERROR:", saved);
        return;
      }
      if (!saved.supabase || !saved.id) {
        closeReservedWhatsAppWindow(waWindow);
        setBookingStatus("La solicitud no quedó confirmada en el sistema. Revisá consola antes de publicar.", "error");
        console.error("DTEK_FORM_SAVE_WITHOUT_SUPABASE_ID:", saved);
        return;
      }
      await persistSmartAgendaProfile(data);
      const accountResult = await createProfileAfterBooking(data);
      renderTimeButtons();
      updateAgendaSummary();
      renderAgendaMemory();
      renderAdminAppointments();
      prepareConfirmationEmails(saved);
      const waMessage = buildAgendaMessage(saved.id);
      const waOpened = deliverWhatsApp(waMessage, waWindow);
      setBookingStatus(waOpened
        ? "Solicitud guardada. Abrimos WhatsApp con el resumen."
        : "Solicitud guardada. Tocá «Abrir WhatsApp y enviar» para mandarnos el resumen.", "ok");
      showBookingSuccess(saved, data, waMessage, accountResult, waOpened);
    });
  }
}

function markActiveNav() {
  const page = location.pathname.split("/").pop() || "index.html";
  qsa(".nav-links a").forEach(link => {
    const href = link.getAttribute("href");
    if (href === page || (page === "" && href === "index.html")) link.classList.add("active");
  });
}

function init() {
  renderPreviewServices();
  renderFilters();
  renderServices();
  renderServiceDetail();
  renderAgendaPage();
  loadLinkedVehicleFromUrl();
  renderAdminPage();
  renderFaqs();
  setupEvents();
  setupReveal();
  markActiveNav();
}

document.addEventListener("DOMContentLoaded", init);
