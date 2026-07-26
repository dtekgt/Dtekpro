/* D-TEK v25 · Selector Pro
   Interfaz progresiva inspirada en catálogos rápidos: vehículo → servicio → horario.
*/
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const services = () => window.DTEK_SERVICES || [];
  const groups = () => window.DTEK_SERVICE_GROUPS || [];
  const symptoms = () => window.DTEK_SYMPTOM_GROUPS || [];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const serviceById = id => services().find(service => service.id === id);
  const estimatedPoints = service => {
    const match = String(service?.price || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    const price = match ? Number(match[1]) : 0;
    return Math.max(10, Math.floor(price / 10));
  };

  function serviceRow(service, { booking = false, compact = false } = {}) {
    const selected = Boolean(booking && window.DtekServiceBuilder?.isSelected?.(service.id));
    const action = booking
      ? `<button type="button" class="selector-service-pick ${selected ? "selected" : ""}" data-agenda-service="${esc(service.id)}" aria-pressed="${selected}">${selected ? "Quitar" : "Agregar"}</button>`
      : `<a class="selector-service-pick" href="agenda.html?servicio=${encodeURIComponent(service.id)}">Agendar</a>`;
    const showDetail = !booking && !compact && service.short;
    const detail = showDetail
      ? `<div class="selector-service-extra"><p>${esc(service.short)}</p><a class="selector-service-detail-link" href="${serviceUrl(service.id)}">Ver qué incluye →</a></div>`
      : "";
    return `<article class="selector-service-row ${compact ? "compact" : ""} ${selected ? "selected" : ""} ${service.requiresDescription ? "open-request" : ""}" data-service-name="${esc(`${service.name} ${service.category}`.toLowerCase())}">
      <div class="selector-service-toggle selector-service-direct">
        <span class="selector-service-main"><strong>${esc(service.name)}</strong></span>
        <span class="selector-service-facts"><b>${esc(service.price)}</b><small>${esc(service.durationMinutes || 60)} min</small><em>+${estimatedPoints(service)} pts</em>${action}</span>
      </div>
      ${detail}
    </article>`;
  }

  function serviceAccordionHtml({ booking = false, limitGroups = 0, compact = false, openFirst = true } = {}) {
    const set = limitGroups ? groups().slice(0, limitGroups) : groups();
    return set.map((group, index) => {
      const groupServices = group.services.map(serviceById).filter(Boolean);
      const opened = openFirst && index === 0;
      return `<section class="selector-group ${opened ? "open" : ""}">
        <button type="button" class="selector-group-toggle" aria-expanded="${opened ? "true" : "false"}">
          <span><strong>${esc(group.title)}</strong></span>
          <b>${groupServices.length}</b><i>${opened ? "−" : "＋"}</i>
        </button>
        <div class="selector-group-content" ${opened ? "" : "hidden"}>${groupServices.map(service => serviceRow(service, { booking, compact })).join("")}</div>
      </section>`;
    }).join("");
  }

  function symptomAccordionHtml({ booking = false, openFirst = true } = {}) {
    return symptoms().map((symptom, index) => {
      const recommendations = symptom.recommended.map(serviceById).filter(Boolean).slice(0, 4);
      const opened = openFirst && index === 0;
      return `<section class="selector-group symptom ${opened ? "open" : ""}">
        <button type="button" class="selector-group-toggle" aria-expanded="${opened ? "true" : "false"}">
          <span><strong>${esc(symptom.label)}</strong></span><b>${recommendations.length}</b><i>${opened ? "−" : "＋"}</i>
        </button>
        <div class="selector-group-content" ${opened ? "" : "hidden"}>${recommendations.map(service => serviceRow(service, { booking, compact: true })).join("")}</div>
      </section>`;
    }).join("");
  }

  function bindAccordion(root = document) {
    root.addEventListener("click", event => {
      const groupButton = event.target.closest(".selector-group-toggle");
      if (groupButton) {
        const group = groupButton.closest(".selector-group");
        const content = $(".selector-group-content", group);
        const opening = !group.classList.contains("open");
        if (opening && document.body.classList.contains("page-services-v27")) {
          const accordion = group.parentElement;
          $$(".selector-group.open", accordion).forEach(other => {
            if (other === group) return;
            other.classList.remove("open");
            $(".selector-group-content", other).hidden = true;
            $(".selector-group-toggle", other).setAttribute("aria-expanded", "false");
            const otherIcon = $(".selector-group-toggle i", other);
            if (otherIcon) otherIcon.textContent = "＋";
          });
        }
        group.classList.toggle("open", opening);
        groupButton.setAttribute("aria-expanded", String(opening));
        const icon = $("i", groupButton);
        if (icon) icon.textContent = opening ? "−" : "＋";
        if (content) content.hidden = !opening;
      }
      const serviceButton = event.target.closest(".selector-service-toggle");
      if (serviceButton && serviceButton.tagName === "BUTTON") {
        const row = serviceButton.closest(".selector-service-row");
        const detail = $(".selector-service-detail", row);
        const opening = detail?.hidden !== false;
        if (detail) detail.hidden = !opening;
        serviceButton.setAttribute("aria-expanded", String(opening));
        const icon = $(".selector-service-facts i", serviceButton);
        if (icon) icon.textContent = opening ? "−" : "＋";
      }
    });
  }

  function renderServiceCatalog() {
    const holder = $("#serviceAccordion");
    if (!holder) return;
    holder.innerHTML = serviceAccordionHtml({ openFirst: false });
    const symptomHolder = $("#symptomAccordion");
    if (symptomHolder) symptomHolder.innerHTML = symptomAccordionHtml({ openFirst: false });

    const addOnHolder = $("#serviceAddOnsCatalog");
    if (addOnHolder) {
      addOnHolder.innerHTML = (window.DTEK_ADD_ONS || []).map(addon => `
        <article class="additional-catalog-card-v274">
          <span>${esc(addon.category || "Adicional")}</span>
          <h3>${esc(addon.name)}</h3>
          <p>${esc(addon.short || "Servicio adicional sujeto a confirmación.")}</p>
          <div><strong>${esc(addon.price || "Por cotizar")}</strong><a href="agenda.html?adicional=${encodeURIComponent(addon.id)}">Agregar a cotización</a></div>
        </article>`).join("");
    }

    const search = $("#serviceSearch");
    search?.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      $$(".selector-service-row", holder).forEach(row => {
        row.hidden = Boolean(query) && !row.dataset.serviceName.includes(query);
      });
      $$(".selector-group", holder).forEach(group => {
        const visible = $$(".selector-service-row", group).some(row => !row.hidden);
        group.hidden = !visible;
        if (query && visible) {
          group.classList.add("open");
          $(".selector-group-content", group).hidden = false;
          $(".selector-group-toggle", group).setAttribute("aria-expanded", "true");
          $(".selector-group-toggle i", group).textContent = "−";
        }
      });
    });

    $$("[data-catalog-mode]").forEach(button => button.addEventListener("click", () => {
      const mode = button.dataset.catalogMode;
      $$("[data-catalog-mode]").forEach(item => item.classList.toggle("active", item === button));
      $("#serviceCatalogPanel")?.classList.toggle("active", mode === "services");
      $("#symptomCatalogPanel")?.classList.toggle("active", mode === "symptoms");
    }));
  }

  function renderHomeQuickServices() {
    const holder = $("#homeQuickServices");
    if (!holder) return;
    holder.innerHTML = serviceAccordionHtml({ limitGroups: 4, compact: true, openFirst: false });
  }

  function fillEngineSelect() {
    const select = $("#vehicleEngine");
    if (!select || select.dataset.loaded) return;
    select.innerHTML = `<option value="">Elegir motor</option>` + (window.DTEK_ENGINE_OPTIONS || []).map(option => `<option value="${esc(option)}">${esc(option)}</option>`).join("");
    select.dataset.loaded = "true";
  }

  function updatePublicVehicleCascade() {
    const brand = $("#vehicleBrand")?.value || "";
    const line = $("#vehicleLine")?.value || "";
    const year = $("#vehicleYear")?.value || "";
    const engine = $("#vehicleEngine")?.value || "";
    // Un carro traído del Garage puede venir sin motor: no lo escondamos o el paso 1 se traba.
    const linked = document.body.dataset.vehicleLinked === "true";
    const states = linked
      ? { line: true, year: true, engine: true, moves: true }
      : { line: Boolean(brand), year: Boolean(brand && line), engine: Boolean(brand && line && year), moves: Boolean(brand && line && year && engine) };
    Object.entries(states).forEach(([level, visible]) => {
      const label = $(`[data-cascade-level="${level}"]`);
      if (label) label.classList.toggle("cascade-hidden", !visible);
    });
  }

  function renderAgendaSelector() {
    const holder = $("#agendaServiceAccordion");
    if (holder) holder.innerHTML = serviceAccordionHtml({ booking: true });
    const symptomHolder = $("#agendaSymptomAccordion");
    if (symptomHolder) symptomHolder.innerHTML = symptomAccordionHtml({ booking: true });
    fillEngineSelect();
    updatePublicVehicleCascade();
    ["#vehicleBrand", "#vehicleLine", "#vehicleYear", "#vehicleEngine"].forEach(selector => $(selector)?.addEventListener("change", () => window.setTimeout(updatePublicVehicleCascade, 0)));
    Object.keys(FIELD_MESSAGES).forEach(selector => $(selector)?.addEventListener("change", clearFieldAttention));
    Object.keys(FIELD_MESSAGES).forEach(selector => $(selector)?.addEventListener("input", clearFieldAttention));
    $$('[data-agenda-list-mode]').forEach(button => button.addEventListener('click', () => {
      const mode = button.dataset.agendaListMode;
      $$('[data-agenda-list-mode]').forEach(item => item.classList.toggle('active', item === button));
      $('#agendaServicesListPanel')?.classList.toggle('active', mode === 'services');
      $('#agendaSymptomsListPanel')?.classList.toggle('active', mode === 'symptoms');
    }));
  }

  function setBookingStep(step, options = {}) {
    const maxStep = 4;
    const normalized = Math.max(1, Math.min(maxStep, Number(step) || 1));
    const shouldScroll = options.scroll !== false;
    document.body.dataset.bookingStep = String(normalized);
    $$("[data-booking-step]").forEach(panel => panel.classList.toggle("active", Number(panel.dataset.bookingStep) === normalized));
    let currentLabel = "";
    $$("[data-progress-step]").forEach(item => {
      const itemStep = Number(item.dataset.progressStep);
      const done = itemStep < normalized;
      const active = itemStep === normalized;
      item.classList.toggle("active", active);
      item.classList.toggle("done", done);
      item.classList.toggle("pending", itemStep > normalized);
      item.setAttribute("aria-current", active ? "step" : "false");
      const badge = $("b", item);
      if (badge) {
        item.dataset.stepNumber ||= String(itemStep);
        badge.textContent = done ? "✓" : item.dataset.stepNumber;
      }
      if (!item.dataset.stepLabel) {
        const clone = item.cloneNode(true);
        const b = $("b", clone);
        if (b) b.remove();
        item.dataset.stepLabel = clone.textContent.trim();
      }
      if (active) currentLabel = item.dataset.stepLabel;
    });
    const caption = $("#bookingProgressCaption");
    if (caption) caption.textContent = `Paso ${normalized} de ${maxStep} · ${currentLabel}`;
    const rail = $("#wizardProgress");
    if (rail) rail.style.setProperty("--progress-fill", `${((normalized - 1) / (maxStep - 1)) * 100}%`);
    document.dispatchEvent(new CustomEvent("dtek:booking-step", { detail: { step: normalized } }));
    if (shouldScroll) {
      window.requestAnimationFrame(() => {
        const target = $("#bookingFlow") || $("#wizardProgress");
        if (!target) return;
        const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 82);
        window.scrollTo({ top, behavior: "smooth" });
      });
    }
  }

  window.DtekBookingWizard = {
    setStep: setBookingStep,
    getStep: () => Number(document.body.dataset.bookingStep || 1)
  };

  /* El aviso nativo del navegador sale en inglés ("Select an item in the list") y en el
     webview de iOS se ancla lejos del campo. Usamos uno propio, en español y pegado al campo. */
  const FIELD_MESSAGES = {
    "#vehicleBrand": "Elegí la marca de tu carro para continuar.",
    "#vehicleLine": "Elegí la línea o modelo.",
    "#vehicleYear": "Elegí el año del carro.",
    "#vehicleEngine": "Elegí el motor. Si no lo sabés, elegí «No sé».",
    "#vehicleMoves": "Contanos si el carro arranca y se mueve.",
    "#clientName": "Escribí tu nombre.",
    "#clientPhone": "Escribí tu teléfono para confirmarte por WhatsApp.",
    "#clientEmail": "Escribí un correo válido.",
    "#clientCity": "Escribí tu zona o municipio.",
    "#clientAddress": "Escribí la dirección o una referencia."
  };

  function clearFieldAttention() {
    $$(".field-needs-attention-v31").forEach(el => el.classList.remove("field-needs-attention-v31"));
    $$(".field-hint-v31").forEach(el => el.remove());
  }

  function flagField(field, message) {
    if (!field) return;
    clearFieldAttention();
    field.classList.add("field-needs-attention-v31");
    const anchor = field.closest("label") || field;
    const hint = document.createElement("p");
    hint.className = "field-hint-v31";
    hint.setAttribute("role", "alert");
    hint.textContent = message || "Completá este dato para continuar.";
    anchor.insertAdjacentElement("afterend", hint);
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => { try { field.focus({ preventScroll: true }); } catch (error) { /* iOS puede rechazar el focus */ } }, 220);
  }

  window.DtekSelectorPro = {
    updateVehicleCascade: updatePublicVehicleCascade,
    flagField,
    clearFieldAttention,
    messageFor: selector => FIELD_MESSAGES[selector]
  };

  function selectedServiceExists() {
    return Boolean($("#agendaService")?.value);
  }

  function validateStep(step) {
    if (step === 1) {
      // Con un carro del Garage los selects quedan bloqueados: solo falta confirmar si arranca.
      const linked = document.body.dataset.vehicleLinked === "true";
      const ordered = linked ? ["#vehicleMoves"] : ["#vehicleBrand", "#vehicleLine", "#vehicleYear", "#vehicleEngine", "#vehicleMoves"];
      for (const selector of ordered) {
        const field = $(selector);
        if (field && !field.value) {
          updatePublicVehicleCascade();
          flagField(field, FIELD_MESSAGES[selector]);
          return false;
        }
      }
      clearFieldAttention();
      return true;
    }
    if (step === 2 && !selectedServiceExists()) {
      $("#agendaStepMessage").textContent = "Agregá por lo menos un servicio para continuar.";
      return false;
    }
    if (step === 2 && window.DtekServiceBuilder?.isSelected?.("otros-servicios") && !$("#otherServiceDetails")?.value.trim()) {
      $("#agendaStepMessage").textContent = "Contanos qué otro servicio o clavo necesitás.";
      $("#otherServiceDetails")?.focus();
      return false;
    }
    if (step === 3 && !$(".time-chip.selected")) {
      $("#agendaStepMessage").textContent = "Elegí un horario disponible para continuar.";
      return false;
    }
    return true;
  }

  function initAgendaWizard() {
    if (!$("#agendaForm") || !$("[data-booking-step]")) return;
    // Siempre arrancamos en el paso 1. Si el carro guardado sí carga, app.js adelanta el paso;
    // si no carga, la persona lo escribe a mano sin quedarse sin vehículo.
    setBookingStep(1, { scroll: false });

    document.addEventListener("click", event => {
      const next = event.target.closest("[data-booking-next]");
      if (next) {
        const current = Number(document.body.dataset.bookingStep || 1);
        $("#agendaStepMessage").textContent = "";
        if (validateStep(current)) setBookingStep(current + 1);
      }
      const back = event.target.closest("[data-booking-back]");
      if (back) setBookingStep(Number(document.body.dataset.bookingStep || 1) - 1);
      const picked = event.target.closest("[data-agenda-service]");
      if (picked && $("#agendaService")) {
        window.setTimeout(() => {
          $$(".selector-service-pick").forEach(button => {
            const selected = Boolean(window.DtekServiceBuilder?.isSelected?.(button.dataset.agendaService));
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
            button.textContent = selected ? "Quitar" : "Agregar";
            button.closest(".selector-service-row")?.classList.toggle("selected", selected);
          });
          $("#agendaStepMessage").textContent = "";
        }, 20);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindAccordion(document);
    renderServiceCatalog();
    renderHomeQuickServices();
    renderAgendaSelector();
    initAgendaWizard();
  });
})();
