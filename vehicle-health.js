/*
  D-TEK GT v33 — Estado del Vehículo
  Presenta evidencia real, estimaciones de mantenimiento y elementos sin revisar
  sin convertirlos en un porcentaje falso de "salud general".
*/
(() => {
  const DAY = 86400000;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
  const plain = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const dateValue = row => row.service_date || row.scheduled_start || row.created_at || null;
  const kmValue = row => Number(row.mileage_at_service || row.mileage || 0) || null;

  const COMPONENTS = [
    { key:"engine_oil", group:"Motor", name:"Aceite de motor", mode:"interval", months:6, km:8000, words:["aceite","servicio menor","mantenimiento express"] },
    { key:"engine_air_filter", group:"Motor", name:"Filtro de aire", mode:"interval", months:12, km:15000, words:["filtro de aire","servicio menor plus"] },
    { key:"spark_plugs", group:"Motor", name:"Candelas / bujías", mode:"interval", months:36, km:50000, words:["candela","bujia"] },
    { key:"coolant", group:"Fluidos", name:"Refrigerante", mode:"interval", months:36, km:50000, words:["refrigerante","coolant","radiador","termostato","bomba de agua"] },
    { key:"brake_fluid", group:"Fluidos", name:"Líquido de frenos", mode:"interval", months:24, km:30000, words:["liquido de freno"] },
    { key:"transmission_fluid", group:"Fluidos", name:"Aceite de transmisión", mode:"interval", months:36, km:50000, words:["aceite de transmision","atf","cvt"] },
    { key:"front_brakes", group:"Seguridad", name:"Frenos delanteros", mode:"inspection", words:["balatas delanteras","pastillas delanteras","frenos delanteros","discos de freno"] },
    { key:"rear_brakes", group:"Seguridad", name:"Frenos traseros", mode:"inspection", words:["balatas traseras","pastillas traseras","frenos traseros"] },
    { key:"tires", group:"Seguridad", name:"Llantas", mode:"inspection", words:["llanta","neumatico","tpms"] },
    { key:"battery", group:"Eléctrico", name:"Batería y carga", mode:"inspection", words:["bateria","alternador","sistema de carga"] },
    { key:"suspension", group:"Chasis", name:"Suspensión", mode:"inspection", words:["suspension","amortiguador","buje","rotula"] },
    { key:"steering", group:"Chasis", name:"Dirección", mode:"inspection", words:["direccion","terminal","cremallera"] },
    { key:"ac", group:"Confort", name:"Aire acondicionado", mode:"inspection", words:["aire acondicionado","a/c"] }
  ];

  const sourceLabel = source => ({
    dtek:"Confirmado por D-TEK", automatic:"Confirmado por servicio",
    client:"Reportado por el cliente", estimated:"Estimado por historial",
    none:"Sin revisión registrada"
  })[source] || "Sin revisión registrada";

  function latestHistory(component, history) {
    return [...history]
      .filter(row => {
        if (!["completed","approved"].includes(row.work_order_status || row.appointment_status || row.status || "")) return false;
        const text = plain([row.service_name,row.diagnosis,row.parts_notes,row.recommendations].join(" "));
        return component.words.some(word => text.includes(plain(word)));
      })
      .sort((a,b) => new Date(dateValue(b) || 0) - new Date(dateValue(a) || 0))[0] || null;
  }

  function intervalState(component, vehicle, evidence) {
    if (!evidence) return { tone:"unknown", label:"Sin registro", detail:"Agregalo cuando se realice el servicio.", source:"none", progress:null };
    const doneAt = new Date(dateValue(evidence));
    const elapsedMonths = Math.max(0, (Date.now() - doneAt.getTime()) / (DAY * 30.4375));
    const startKm = kmValue(evidence);
    const currentKm = Number(vehicle.mileage || 0) || null;
    const byTime = elapsedMonths / component.months;
    const byKm = startKm && currentKm ? Math.max(0, currentKm - startKm) / component.km : 0;
    const used = Math.max(byTime, byKm);
    const remaining = Math.max(0, Math.round((1 - used) * 100));
    const tone = used >= 1 ? "due" : used >= .8 ? "soon" : "good";
    const label = tone === "due" ? "Toca revisar" : tone === "soon" ? "Próximamente" : `${remaining}% restante`;
    const nextKm = startKm ? startKm + component.km : null;
    const detail = nextKm && currentKm
      ? `Próximo aprox. a ${nextKm.toLocaleString("es-GT")} km`
      : `Intervalo estimado: ${component.months} meses`;
    return { tone, label, detail, source:evidence.source || "estimated", progress:remaining, date:dateValue(evidence) };
  }

  function inspectionState(component, record, evidence) {
    if (record) {
      const status = record.status || "unknown";
      return {
        tone: ({ok:"good",monitor:"soon",attention:"due"})[status] || "unknown",
        label: ({ok:"Bien",monitor:"Vigilar",attention:"Requiere atención"})[status] || "Sin resultado",
        detail: record.notes || (record.measured_value ? `Medición: ${record.measured_value}` : "Revisión registrada."),
        source: record.source || "dtek", date: record.inspected_at
      };
    }
    if (evidence) return {
      tone:"recorded", label:"Servicio registrado",
      detail:"Existe trabajo relacionado, pero no una medición de condición.",
      source:"automatic", date:dateValue(evidence)
    };
    return { tone:"unknown", label:"Sin revisar", detail:"Necesita inspección física para mostrar un estado.", source:"none" };
  }

  function card(component, state) {
    const bar = state.progress == null ? "" : `<div class="vehicle-care-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state.progress}"><i style="width:${state.progress}%"></i></div>`;
    const when = state.date ? `<small>Último registro: ${new Date(state.date).toLocaleDateString("es-GT",{day:"numeric",month:"short",year:"numeric"})}</small>` : "";
    return `<article class="vehicle-care-item ${state.tone}">
      <div class="vehicle-care-item-top"><strong>${esc(component.name)}</strong><span>${esc(state.label)}</span></div>
      ${bar}<p>${esc(state.detail)}</p>
      <div class="vehicle-care-source"><em>${esc(sourceLabel(state.source))}</em>${when}</div>
    </article>`;
  }

  function render(vehicle = {}, history = [], records = []) {
    const systems = document.querySelector("#vehicleCareSystems");
    const summary = document.querySelector("#vehicleCareSummary");
    if (!systems || !summary) return;
    const recordMap = Object.fromEntries((records || []).map(item => [item.component_key, item]));
    const results = COMPONENTS.map(component => {
      const evidence = latestHistory(component, history || []);
      const persisted = recordMap[component.key];
      const persistedIntervalEvidence = persisted ? {
        service_date: persisted.inspected_at,
        mileage_at_service: persisted.mileage,
        source: persisted.source || "automatic"
      } : null;
      const state = component.mode === "interval"
        ? intervalState(component, vehicle, persistedIntervalEvidence || evidence)
        : inspectionState(component, persisted, evidence);
      return { component, state };
    });
    const counts = {
      due: results.filter(x => x.state.tone === "due").length,
      soon: results.filter(x => x.state.tone === "soon").length,
      unknown: results.filter(x => x.state.tone === "unknown").length
    };
    summary.innerHTML = `
      <article class="${counts.due ? "due" : "good"}"><strong>${counts.due}</strong><span>Atención</span></article>
      <article class="${counts.soon ? "soon" : "good"}"><strong>${counts.soon}</strong><span>Próximamente</span></article>
      <article class="unknown"><strong>${counts.unknown}</strong><span>Sin revisar</span></article>`;
    const groups = [...new Set(COMPONENTS.map(x => x.group))];
    systems.innerHTML = groups.map((group,index) => {
      const items = results.filter(x => x.component.group === group);
      const alert = items.some(x => ["due","soon"].includes(x.state.tone));
      return `<details class="vehicle-care-system"${index === 0 || alert ? " open" : ""}>
        <summary><span><strong>${esc(group)}</strong><small>${items.length} elementos</small></span><b>${alert ? "Revisar" : "Ver"}</b></summary>
        <div class="vehicle-care-list">${items.map(x => card(x.component,x.state)).join("")}</div>
      </details>`;
    }).join("");
  }

  window.DtekVehicleHealth = { render, components: COMPONENTS };
})();
