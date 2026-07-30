/*
  D-TEK GT v35 — Pasaporte vivo del vehículo
  Convierte el plan del fabricante + historial + inspecciones en un mapa visual.
*/
(() => {
  const DAY = 86400000;
  const KM_PER_MILE = 1.609344;
  let distanceUnit = localStorage.getItem("dtek-distance-unit") === "mi" ? "mi" : "km";
  let lastRenderArgs = null;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
  const plain = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const dateValue = row => row?.service_date || row?.inspected_at || row?.scheduled_start || row?.created_at || null;
  const kmValue = row => Number(row?.mileage_at_service || row?.mileage || 0) || null;
  const fmtKm = value => Number(value || 0).toLocaleString("es-GT");
  const distanceValue = km => distanceUnit === "mi" ? Number(km || 0) / KM_PER_MILE : Number(km || 0);
  const fmtDistance = km => `${Math.round(distanceValue(km)).toLocaleString("es-GT")} ${distanceUnit === "mi" ? "mi" : "km"}`;
  const fmtDate = value => value ? new Date(value).toLocaleDateString("es-GT", { day:"numeric", month:"short", year:"numeric" }) : "";

  const COMPONENTS = [
    { key:"engine_oil", group:"Motor", icon:"◉", name:"Aceite y filtro", mode:"interval", months:6, km:8000, words:["aceite","servicio menor","mantenimiento express"] },
    { key:"engine_air_filter", group:"Motor", icon:"≋", name:"Filtro de aire del motor", mode:"interval", months:12, km:15000, words:["filtro de aire","servicio menor plus"] },
    { key:"cabin_air_filter", group:"Filtros", icon:"▦", name:"Filtro de cabina", mode:"interval", months:12, km:20000, words:["filtro de cabina","filtro de polen"] },
    { key:"spark_plugs", group:"Motor", icon:"ϟ", name:"Candelas / bujías", mode:"interval", months:36, km:50000, words:["candela","bujia"] },
    { key:"coolant", group:"Fluidos", icon:"◒", name:"Refrigerante", mode:"interval", months:36, km:50000, words:["refrigerante","coolant"] },
    { key:"brake_fluid", group:"Fluidos", icon:"●", name:"Líquido de frenos", mode:"inspection", words:["liquido de freno"] },
    { key:"transmission_fluid", group:"Fluidos", icon:"◇", name:"Aceite de transmisión", mode:"interval", months:36, km:50000, words:["aceite de transmision","atf","cvt"] },
    { key:"tire_rotation", group:"Seguridad", icon:"↻", name:"Rotación de llantas", mode:"interval", months:6, km:8000, words:["rotacion de llantas","rotación de llantas"] },
    { key:"accessory_belt", group:"Motor", icon:"∞", name:"Banda de accesorios", mode:"inspection", words:["banda de accesorios","faja de accesorios"] },
    { key:"front_brakes", group:"Seguridad", icon:"◫", name:"Frenos delanteros", mode:"inspection", words:["balatas delanteras","pastillas delanteras","frenos delanteros","discos de freno"] },
    { key:"rear_brakes", group:"Seguridad", icon:"◫", name:"Frenos traseros", mode:"inspection", words:["balatas traseras","pastillas traseras","frenos traseros"] },
    { key:"tires", group:"Seguridad", icon:"◎", name:"Llantas", mode:"inspection", words:["llanta","neumatico","tpms"] },
    { key:"battery", group:"Eléctrico", icon:"ϟ", name:"Batería y carga", mode:"inspection", words:["bateria","alternador","sistema de carga"] },
    { key:"suspension", group:"Chasis", icon:"⌁", name:"Suspensión", mode:"inspection", words:["suspension","amortiguador","buje","rotula"] },
    { key:"steering", group:"Chasis", icon:"⊕", name:"Dirección", mode:"inspection", words:["direccion","terminal","cremallera"] },
    { key:"ac", group:"Confort", icon:"❄", name:"Aire acondicionado", mode:"inspection", words:["aire acondicionado","a/c"] }
  ];

  const FORD_ESCAPE_2013_2019 = {
    title:"Ford Escape 2013–2019",
    source:"Manual oficial Ford · Mantenimiento normal",
    url:"https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1614707&Uid=G1614704&buildtype=web&countryCode=USA&div=f&languageCode=en&moidRef=G1612532&userMarket=usa&vFilteringEnabled=False&variantid=2929",
    values:{
      engine_oil:{ months:12, km:16000, note:"Seguir Intelligent Oil-Life Monitor; máximo 1 año o 16,000 km. Uso severo: 8,000–12,000 km." },
      tire_rotation:{ months:12, km:16000, note:"Realizar junto con cada cambio de aceite." },
      cabin_air_filter:{ months:24, km:32000 },
      engine_air_filter:{ months:36, km:48000 },
      spark_plugs:{ months:72, km:160000 },
      coolant:{ months:72, km:160000, note:"Primer cambio a 6 años/160,000 km; luego cada 3 años/80,000 km.", repeatMonths:36, repeatKm:80000 },
      transmission_fluid:{ months:120, km:240000, note:"Uso normal. El uso severo requiere criterio técnico." },
      accessory_belt:{ note:"Inspeccionar a 160,000 km y después cada dos cambios de aceite." }
    }
  };

  function planForVehicle(vehicle = {}, records = []) {
    const brand = plain(vehicle.brand);
    const line = plain(vehicle.line || vehicle.model);
    const year = Number(vehicle.year || 0);
    const profile = brand.includes("ford") && line.includes("escape") && year >= 2013 && year <= 2019
      ? FORD_ESCAPE_2013_2019
      : { title:"Plan base D-TEK", source:"Provisional · pendiente de validar con manual específico", url:"", values:{} };
    const recordMap = Object.fromEntries((records || []).map(item => [item.component_key, item]));
    return COMPONENTS.map(base => {
      const modelValue = profile.values[base.key] || {};
      const saved = recordMap[base.key] || {};
      return {
        ...base, ...modelValue,
        months:Number(saved.interval_months || modelValue.months || base.months || 0) || null,
        km:Number(saved.interval_km || modelValue.km || base.km || 0) || null,
        planTitle:saved.plan_title || profile.title,
        planSource:saved.plan_source || profile.source,
        planUrl:saved.plan_url || profile.url,
        note:saved.plan_note || modelValue.note || ""
      };
    });
  }

  const sourceLabel = source => ({
    dtek:"Verificado por D-TEK", automatic:"Confirmado por servicio",
    client:"Reportado por el cliente", estimated:"Estimado con historial",
    none:"Aún no revisado"
  })[source] || "Aún no revisado";

  function latestHistory(component, history) {
    return [...(history || [])].filter(row => {
      if (!["completed","approved"].includes(row.work_order_status || row.appointment_status || row.status || "")) return false;
      const text = plain([row.service_name,row.diagnosis,row.parts_notes,row.recommendations].join(" "));
      return component.words.some(word => text.includes(plain(word)));
    }).sort((a,b) => new Date(dateValue(b) || 0) - new Date(dateValue(a) || 0))[0] || null;
  }

  function intervalState(component, vehicle, evidence) {
    if (!evidence) return {
      tone:"unknown", label:"Sin punto de partida", detail:"Registrá el último servicio para activar el cálculo.",
      source:"none", progress:null, timeProgress:null, distanceProgress:null, dueKm:null
    };
    const doneAt = new Date(dateValue(evidence));
    const elapsedMonths = Math.max(0, (Date.now() - doneAt.getTime()) / (DAY * 30.4375));
    const startKm = kmValue(evidence);
    const currentKm = Number(vehicle.mileage || 0) || null;
    const byTime = component.months ? elapsedMonths / component.months : 0;
    const byKm = component.km && startKm && currentKm ? Math.max(0, currentKm - startKm) / component.km : 0;
    const used = Math.max(byTime, byKm);
    const remaining = Math.max(0, Math.round((1 - used) * 100));
    const tone = used >= 1 ? "due" : used >= .8 ? "soon" : "good";
    const nextKm = startKm && component.km ? startKm + component.km : null;
    const kmLeft = nextKm && currentKm ? nextKm - currentKm : null;
    const label = tone === "due" ? "Vencido" : tone === "soon" ? "Ya se acerca" : `${remaining}% disponible`;
    const detail = kmLeft == null
      ? `Cada ${component.months} meses`
      : kmLeft <= 0 ? `Pasó por ${fmtKm(Math.abs(kmLeft))} km` : `Faltan aprox. ${fmtKm(kmLeft)} km`;
    const timeRemaining = component.months ? Math.max(0, Math.round((1 - byTime) * 100)) : null;
    const distanceRemaining = component.km && startKm && currentKm ? Math.max(0, Math.round((1 - byKm) * 100)) : null;
    const detailLocalized = kmLeft == null
      ? `Cada ${component.months} meses`
      : kmLeft <= 0 ? `Pasó por ${fmtDistance(Math.abs(kmLeft))}` : `Faltan aprox. ${fmtDistance(kmLeft)}`;
    return {
      tone, label, detail:detailLocalized, source:evidence.source || "estimated",
      progress:remaining, timeProgress:timeRemaining, distanceProgress:distanceRemaining,
      date:dateValue(evidence), dueKm:nextKm
    };
  }

  function inspectionState(component, record, evidence) {
    if (record) {
      const status = record.status || "unknown";
      return {
        tone:({ok:"good",monitor:"soon",attention:"due",serviced:"good"})[status] || "unknown",
        label:({ok:"En buen estado",monitor:"Mantener vigilado",attention:"Requiere atención",serviced:"Servicio realizado"})[status] || "Sin resultado",
        detail:record.notes || (record.measured_value ? `Medición: ${record.measured_value}` : "Revisión registrada."),
        source:record.source || "dtek", date:dateValue(record), progress:status === "ok" ? 100 : status === "monitor" ? 55 : status === "attention" ? 12 : null
      };
    }
    if (evidence) return { tone:"recorded", label:"Trabajo relacionado", detail:"Falta una medición de condición.", source:"automatic", date:dateValue(evidence), progress:null };
    return { tone:"unknown", label:"Aún no revisado", detail:"Se activa al hacer una inspección física.", source:"none", progress:null };
  }

  function careRow(component, state) {
    const pct = state.progress == null ? 0 : state.progress;
    const interval = component.mode === "interval"
      ? [component.km ? fmtDistance(component.km) : "", component.months ? `${component.months} meses` : ""].filter(Boolean).join(" · ")
      : "Según inspección";
    const dualTracks = state.progress != null && component.mode === "interval"
      ? `<div class="care-dual-tracks" aria-label="Vida restante por tiempo y recorrido">
          <div class="care-axis">
            <span><b>Tiempo</b><em>${state.timeProgress == null ? "Sin fecha" : `${state.timeProgress}%`}</em></span>
            <div class="care-track ${state.timeProgress == null ? "is-missing" : ""}" role="progressbar" aria-label="${esc(component.name)} por tiempo" aria-valuemin="0" aria-valuemax="100"${state.timeProgress == null ? "" : ` aria-valuenow="${state.timeProgress}"`}><i style="width:${state.timeProgress || 0}%"></i><b style="left:${state.timeProgress || 0}%"></b></div>
          </div>
          <div class="care-axis">
            <span><b>${distanceUnit === "mi" ? "Millas" : "Kilómetros"}</b><em>${state.distanceProgress == null ? "Sin recorrido" : `${state.distanceProgress}%`}</em></span>
            <div class="care-track ${state.distanceProgress == null ? "is-missing" : ""}" role="progressbar" aria-label="${esc(component.name)} por recorrido" aria-valuemin="0" aria-valuemax="100"${state.distanceProgress == null ? "" : ` aria-valuenow="${state.distanceProgress}"`}><i style="width:${state.distanceProgress || 0}%"></i><b style="left:${state.distanceProgress || 0}%"></b></div>
          </div>
        </div>`
      : "";
    return `<article class="care-row ${state.tone}" data-care-tone="${state.tone}">
      <div class="care-row-icon" aria-hidden="true">${esc(component.icon)}</div>
      <div class="care-row-main">
        <div class="care-row-title"><strong>${esc(component.name)}</strong><small>${esc(interval)}</small></div>
        ${state.progress == null
          ? `<div class="care-unverified-line"><i></i><i></i><i></i><span>Esperando evidencia</span></div>`
          : component.mode === "interval" ? dualTracks
          : `<div class="care-track" role="progressbar" aria-label="${esc(component.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>`}
        <div class="care-row-foot"><span>${esc(state.detail)}</span><em>${esc(sourceLabel(state.source))}${state.date ? ` · ${esc(fmtDate(state.date))}` : ""}</em></div>
        ${component.note ? `<details class="care-note"><summary>Nota del fabricante</summary><p>${esc(component.note)}</p></details>` : ""}
      </div>
      <div class="care-row-state"><b>${esc(state.label)}</b>${state.progress == null ? `<span>—</span>` : `<span>${pct}%</span>`}</div>
    </article>`;
  }

  function systemMeter(group, items) {
    const known = items.filter(x => x.state.progress != null);
    const average = known.length ? Math.round(known.reduce((sum,x) => sum + x.state.progress, 0) / known.length) : 0;
    const attention = items.filter(x => x.state.tone === "due").length;
    const tone = attention ? "due" : items.some(x => x.state.tone === "soon") ? "soon" : known.length ? "good" : "unknown";
    return `<details class="care-system ${tone}"${attention || group === "Motor" ? " open" : ""}>
      <summary>
        <span class="care-system-ring" style="--ring:${average * 3.6}deg"><i>${known.length ? average : "—"}</i></span>
        <span><strong>${esc(group)}</strong><small>${attention ? `${attention} requiere atención` : `${known.length}/${items.length} con datos`}</small></span>
        <b>${attention ? "Atender" : "Explorar"} <i>⌄</i></b>
      </summary>
      <div class="care-system-body">${items.map(x => careRow(x.component,x.state)).join("")}</div>
    </details>`;
  }

  function timeline(plan, vehicle, results) {
    const current = Number(vehicle.mileage || 0);
    if (!current) return `<div class="care-mileage-empty"><strong>Activá la ruta por kilometraje</strong><span>Ingresá el millaje actual para ordenar lo próximo.</span></div>`;
    const upcoming = results
      .filter(x => x.state.dueKm)
      .sort((a,b) => a.state.dueKm - b.state.dueKm)
      .slice(0,4);
    const max = Math.max(current + 25000, ...upcoming.map(x => x.state.dueKm));
    return `<div class="care-mileage-route">
      <div class="care-route-head"><span>Ruta de mantenimiento</span><strong>${fmtDistance(current)} hoy</strong></div>
      <div class="care-route-line"><i style="left:${Math.min(94,current/max*100)}%"></i>${upcoming.map(x => {
        const left = Math.max(7,Math.min(94,x.state.dueKm/max*100));
        return `<button type="button" style="left:${left}%" title="${esc(x.component.name)} · ${fmtDistance(x.state.dueKm)}"><b></b><span>${fmtDistance(x.state.dueKm)}<small>${esc(x.component.name)}</small></span></button>`;
      }).join("")}</div>
    </div>`;
  }

  function render(vehicle = {}, history = [], records = []) {
    lastRenderArgs = [vehicle, history, records];
    const systems = document.querySelector("#vehicleCareSystems");
    const summary = document.querySelector("#vehicleCareSummary");
    if (!systems || !summary) return;
    const recordMap = Object.fromEntries((records || []).map(item => [item.component_key, item]));
    const plan = planForVehicle(vehicle, records);
    const results = plan.map(component => {
      const evidence = latestHistory(component, history);
      const persisted = recordMap[component.key];
      const serviceEvidence = persisted?.status === "serviced" ? persisted : null;
      const state = component.mode === "interval"
        ? intervalState(component, vehicle, serviceEvidence || evidence)
        : inspectionState(component, persisted, evidence);
      return { component, state };
    });
    const counts = {
      due:results.filter(x => x.state.tone === "due").length,
      soon:results.filter(x => x.state.tone === "soon").length,
      unknown:results.filter(x => x.state.tone === "unknown").length
    };
    const known = results.filter(x => x.state.progress != null);
    const coverage = Math.round(known.length / results.length * 100);
    const next = results.find(x => x.state.tone === "due") || results.find(x => x.state.tone === "soon") || results.find(x => x.state.tone === "unknown");
    const meta = plan[0] || {};

    summary.innerHTML = `<section class="care-command ${counts.due ? "due" : counts.soon ? "soon" : "good"}">
      <div class="care-command-copy">
        <span class="care-live-pill"><i></i> Pasaporte activo</span>
        <small>PRÓXIMA DECISIÓN</small>
        <h3>${esc(next?.component.name || "Todo al día")}</h3>
        <p>${esc(next?.state.detail || "No hay alertas registradas.")}</p>
        <div class="care-command-stats">
          <span><b>${counts.due}</b> ahora</span><span><b>${counts.soon}</b> cerca</span><span><b>${counts.unknown}</b> por revisar</span>
        </div>
      </div>
      <div class="care-coverage" style="--coverage:${coverage * 3.6}deg"><div><strong>${coverage}%</strong><span>expediente<br>con evidencia</span></div></div>
    </section>
    ${timeline(plan, vehicle, results)}
    <div class="care-plan-strip"><span><b>Plan aplicado</b><strong>${esc(meta.planTitle)}</strong><small>${esc(meta.planSource)}</small></span>${meta.planUrl ? `<a href="${esc(meta.planUrl)}" target="_blank" rel="noopener">Abrir manual ↗</a>` : `<em>Validación pendiente</em>`}</div>`;

    const groups = [...new Set(plan.map(x => x.group))];
    systems.innerHTML = `<div class="care-system-grid">${groups.map(group => systemMeter(group, results.filter(x => x.component.group === group))).join("")}</div>`;
    document.querySelectorAll("[data-care-unit]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.careUnit === distanceUnit));
    });
  }

  window.DtekVehicleHealth = { render, components:COMPONENTS, planForVehicle };
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-care-unit]");
    if (!button) return;
    distanceUnit = button.dataset.careUnit === "mi" ? "mi" : "km";
    localStorage.setItem("dtek-distance-unit", distanceUnit);
    if (lastRenderArgs) render(...lastRenderArgs);
  });
})();
