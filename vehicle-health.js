/*
  D-TEK GT v39 — Estado e historial claro del carro
  Convierte catálogo aplicable + uso + historial + inspecciones en próximos pasos.
*/
(() => {
  const DAY = 86400000;
  const KM_PER_MILE = 1.609344;
  let distanceUnit = localStorage.getItem("dtek-distance-unit") === "mi" ? "mi" : "km";
  let lastRenderArgs = null;
  let lastLifeEvents = [];
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
    { key:"engine_oil", group:"Motor", icon:"◉", name:"Aceite y filtro", mode:"interval", months:6, km:8000, excludes:["electric"], words:["aceite","servicio menor","mantenimiento express"] },
    { key:"engine_air_filter", group:"Motor", icon:"≋", name:"Filtro de aire del motor", mode:"interval", months:12, km:15000, excludes:["electric"], words:["filtro de aire","servicio menor plus"] },
    { key:"cabin_air_filter", group:"Filtros", icon:"▦", name:"Filtro de cabina", mode:"interval", months:12, km:20000, words:["filtro de cabina","filtro de polen"] },
    { key:"spark_plugs", group:"Motor", icon:"ϟ", name:"Candelas / bujías", mode:"interval", months:36, km:50000, requires:["gasoline"], words:["candela","bujia"] },
    { key:"fuel_filter", group:"Filtros", icon:"◈", name:"Filtro de combustible", mode:"interval", months:24, km:40000, excludes:["electric"], words:["filtro de combustible","filtro diesel","filtro de diesel"] },
    { key:"coolant", group:"Fluidos", icon:"◒", name:"Refrigerante", mode:"interval", months:36, km:50000, words:["refrigerante","coolant"] },
    { key:"brake_fluid", group:"Fluidos", icon:"●", name:"Líquido de frenos", mode:"inspection", words:["liquido de freno"] },
    { key:"transmission_fluid", group:"Fluidos", icon:"◇", name:"Aceite de transmisión", mode:"interval", months:36, km:50000, excludes:["electric","manual"], words:["aceite de transmision","atf","cvt"] },
    { key:"manual_gear_oil", group:"Fluidos", icon:"◇", name:"Aceite de caja mecánica", mode:"inspection", requires:["manual"], words:["aceite de caja","aceite caja mecanica"] },
    { key:"differential_fluid", group:"Fluidos", icon:"⌘", name:"Aceite de diferencial", mode:"inspection", requires:["awd"], words:["diferencial","aceite de diferencial"] },
    { key:"transfer_case_fluid", group:"Fluidos", icon:"⌘", name:"Transfer / PTU", mode:"inspection", requires:["awd"], words:["transfer","ptu","caja de transferencia"] },
    { key:"tire_rotation", group:"Seguridad", icon:"↻", name:"Rotación de llantas", mode:"interval", months:6, km:8000, words:["rotacion de llantas","rotación de llantas"] },
    { key:"accessory_belt", group:"Motor", icon:"∞", name:"Banda de accesorios", mode:"inspection", excludes:["electric"], words:["banda de accesorios","faja de accesorios"] },
    { key:"timing_drive", group:"Motor", icon:"⟲", name:"Distribución (banda/cadena)", mode:"inspection", excludes:["electric"], words:["banda de tiempo","cadena de tiempo","distribucion"] },
    { key:"pcv_intake", group:"Motor", icon:"≈", name:"PCV y admisión", mode:"inspection", excludes:["electric"], words:["pcv","admision","cuerpo de aceleracion"] },
    { key:"fuel_system", group:"Motor", icon:"⌁", name:"Sistema de combustible", mode:"inspection", excludes:["electric"], words:["inyector","combustible","bomba de combustible"] },
    { key:"front_brakes", group:"Seguridad", icon:"◫", name:"Frenos delanteros", mode:"inspection", words:["balatas delanteras","pastillas delanteras","frenos delanteros","discos de freno"] },
    { key:"rear_brakes", group:"Seguridad", icon:"◫", name:"Frenos traseros", mode:"inspection", words:["balatas traseras","pastillas traseras","frenos traseros"] },
    { key:"brake_hoses", group:"Seguridad", icon:"∿", name:"Mangueras y líneas de freno", mode:"inspection", words:["manguera de freno","linea de freno"] },
    { key:"tires", group:"Seguridad", icon:"◎", name:"Llantas", mode:"inspection", words:["llanta","neumatico","tpms"] },
    { key:"alignment", group:"Seguridad", icon:"↔", name:"Alineación y desgaste", mode:"inspection", words:["alineacion","desgaste irregular"] },
    { key:"battery", group:"Eléctrico", icon:"ϟ", name:"Batería y carga", mode:"inspection", words:["bateria","alternador","sistema de carga"] },
    { key:"lights", group:"Eléctrico", icon:"◌", name:"Luces y señalización", mode:"inspection", words:["bombillo","faro","luces"] },
    { key:"suspension", group:"Chasis", icon:"⌁", name:"Suspensión", mode:"inspection", words:["suspension","amortiguador","buje","rotula"] },
    { key:"steering", group:"Chasis", icon:"⊕", name:"Dirección", mode:"inspection", words:["direccion","terminal","cremallera"] },
    { key:"wheel_bearings", group:"Chasis", icon:"⊙", name:"Rodamientos de rueda", mode:"inspection", words:["rodamiento","cojinete de rueda"] },
    { key:"cooling_hoses", group:"Fluidos", icon:"∿", name:"Mangueras y sistema de enfriamiento", mode:"inspection", words:["manguera","sistema de enfriamiento","radiador","termostato"] },
    { key:"wipers", group:"Confort", icon:"⌇", name:"Plumillas y lavaparabrisas", mode:"inspection", words:["plumilla","limpiaparabrisas"] },
    { key:"ac", group:"Confort", icon:"❄", name:"Aire acondicionado", mode:"inspection", words:["aire acondicionado","a/c"] }
  ];

  const FORD_ESCAPE_2013_2019 = {
    title:"Ford Escape 2013–2019",
    source:"Programa D-TEK para Ford Escape · ajustable al uso real",
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

  function vehicleTraits(vehicle = {}) {
    const text = plain([vehicle.brand, vehicle.line, vehicle.model, vehicle.engine, vehicle.transmission, vehicle.notes].join(" "));
    const electric = /\b(ev|electrico|electrica|electric)\b/.test(text) && !/hibrid/.test(text);
    const diesel = /\b(diesel|tdi|crdi|d4d|duratorq)\b/.test(text);
    const manual = /\b(manual|mecanica|mt)\b/.test(text);
    const awd = /\b(awd|4wd|4x4|quattro|xdrive)\b/.test(text);
    return { electric, diesel, gasoline:!electric && !diesel, manual, awd };
  }

  function componentApplies(component, traits) {
    if ((component.excludes || []).some(flag => traits[flag])) return false;
    if ((component.requires || []).length && !component.requires.some(flag => traits[flag])) return false;
    return true;
  }

  function usageProfile(vehicle = {}) {
    const text = plain([vehicle.use_type, vehicle.notes].join(" "));
    const severe = /(trabajo|trafico|polvo|montana|carga|remolque|trayecto corto|uso severo)/.test(text);
    return {
      severe,
      multiplier:severe ? .75 : 1,
      label:severe ? "Uso exigente detectado" : "Uso normal"
    };
  }

  function planForVehicle(vehicle = {}, records = []) {
    const brand = plain(vehicle.brand);
    const line = plain(vehicle.line || vehicle.model);
    const year = Number(vehicle.year || 0);
    const profile = brand.includes("ford") && line.includes("escape") && year >= 2013 && year <= 2019
      ? FORD_ESCAPE_2013_2019
      : { title:"Plan preventivo D-TEK", source:"Base general · se personaliza con el historial", values:{} };
    const recordMap = Object.fromEntries((records || []).map(item => [item.component_key, item]));
    const traits = vehicleTraits(vehicle);
    const usage = usageProfile(vehicle);
    return COMPONENTS.filter(base => componentApplies(base, traits)).map(base => {
      const modelValue = profile.values[base.key] || {};
      const saved = recordMap[base.key] || {};
      const defaultMonths = Number(modelValue.months || base.months || 0);
      const defaultKm = Number(modelValue.km || base.km || 0);
      return {
        ...base, ...modelValue,
        months:Number(saved.interval_months || (defaultMonths ? Math.max(1, Math.round(defaultMonths * usage.multiplier)) : 0)) || null,
        km:Number(saved.interval_km || (defaultKm ? Math.max(1000, Math.round(defaultKm * usage.multiplier / 500) * 500) : 0)) || null,
        planTitle:saved.plan_title || profile.title,
        planSource:saved.plan_source || `${profile.source} · ${usage.label}`,
        note:saved.plan_note || modelValue.note || "",
        usageLabel:usage.label
      };
    });
  }

  const sourceLabel = source => ({
    dtek:"Confirmado por D-TEK", automatic:"Confirmado por un servicio",
    client:"Dato agregado por vos", estimated:"Estimado con el historial",
    none:"Todavía no revisado"
  })[source] || "Todavía no revisado";

  function latestHistory(component, history) {
    return [...(history || [])].filter(row => {
      if (!["completed","approved"].includes(row.work_order_status || row.appointment_status || row.status || "")) return false;
      const text = plain([row.service_name,row.diagnosis,row.parts_notes,row.recommendations].join(" "));
      return component.words.some(word => text.includes(plain(word)));
    }).sort((a,b) => new Date(dateValue(b) || 0) - new Date(dateValue(a) || 0))[0] || null;
  }

  function intervalState(component, vehicle, evidence) {
    if (!evidence) return {
      tone:"unknown", label:"Sin datos", detail:"No sabemos cuándo se hizo por última vez.",
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
    const label = tone === "due" ? "Vencido" : tone === "soon" ? "Próximo" : "Al día";
    const timeRemaining = component.months ? Math.max(0, Math.round((1 - byTime) * 100)) : null;
    const distanceRemaining = component.km && startKm && currentKm ? Math.max(0, Math.round((1 - byKm) * 100)) : null;
    const dueDate = component.months && !Number.isNaN(doneAt.getTime())
      ? new Date(doneAt.getFullYear(), doneAt.getMonth() + component.months, doneAt.getDate()).toISOString()
      : null;
    const monthsLeft = component.months ? Math.ceil(component.months - elapsedMonths) : null;
    const timeText = monthsLeft == null
      ? "Sin fecha"
      : monthsLeft <= 0 ? "Ya pasó la fecha recomendada" : `Faltan aprox. ${monthsLeft} ${monthsLeft === 1 ? "mes" : "meses"}`;
    const distanceText = kmLeft == null
      ? "Falta kilometraje"
      : kmLeft <= 0 ? `Ya pasó por ${fmtDistance(Math.abs(kmLeft))}` : `Faltan aprox. ${fmtDistance(kmLeft)}`;
    const detailLocalized = [timeText, distanceText].join(" · ");
    return {
      tone, label, detail:detailLocalized, source:evidence.source || "estimated",
      progress:remaining, timeProgress:timeRemaining, distanceProgress:distanceRemaining,
      timeText, distanceText, date:dateValue(evidence), dueKm:nextKm, dueDate
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
    return { tone:"unknown", label:"Todavía no revisado", detail:"D-TEK debe revisarlo para confirmar su estado.", source:"none", progress:null };
  }

  function careRow(component, state) {
    const pct = state.progress == null ? 0 : state.progress;
    const interval = component.mode === "interval"
      ? [component.km ? fmtDistance(component.km) : "", component.months ? `${component.months} meses` : ""].filter(Boolean).join(" · ")
      : "Según inspección";
    const dualTracks = state.progress != null && component.mode === "interval"
      ? `<div class="care-dual-tracks" aria-label="Vida restante por tiempo y recorrido">
          <div class="care-axis">
            <span><b>Tiempo</b><em>${esc(state.timeText || "Sin fecha")}</em></span>
            <div class="care-track ${state.timeProgress == null ? "is-missing" : ""}" role="progressbar" aria-label="${esc(component.name)} por tiempo" aria-valuemin="0" aria-valuemax="100"${state.timeProgress == null ? "" : ` aria-valuenow="${state.timeProgress}"`}><i style="width:${state.timeProgress || 0}%"></i><b style="left:${state.timeProgress || 0}%"></b></div>
          </div>
          <div class="care-axis">
            <span><b>${distanceUnit === "mi" ? "Millas" : "Kilómetros"}</b><em>${esc(state.distanceText || "Falta kilometraje")}</em></span>
            <div class="care-track ${state.distanceProgress == null ? "is-missing" : ""}" role="progressbar" aria-label="${esc(component.name)} por recorrido" aria-valuemin="0" aria-valuemax="100"${state.distanceProgress == null ? "" : ` aria-valuenow="${state.distanceProgress}"`}><i style="width:${state.distanceProgress || 0}%"></i><b style="left:${state.distanceProgress || 0}%"></b></div>
          </div>
        </div>`
      : "";
    return `<article class="care-row ${state.tone}" data-care-tone="${state.tone}" data-care-component="${esc(component.key)}">
      <div class="care-row-icon" aria-hidden="true">${esc(component.icon)}</div>
      <div class="care-row-main">
        <div class="care-row-title"><strong>${esc(component.name)}</strong><small>${esc(interval)}</small></div>
        ${state.progress == null
          ? `<div class="care-unverified-line"><i></i><i></i><i></i><span>${component.mode === "interval" ? "No sabemos cuándo fue el último servicio" : "Todavía no lo hemos revisado"}</span></div>`
          : component.mode === "interval" ? dualTracks
          : `<div class="care-track" role="progressbar" aria-label="${esc(component.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>`}
        <div class="care-row-foot"><span>${esc(state.detail)}</span><em>${esc(sourceLabel(state.source))}${state.date ? ` · ${esc(fmtDate(state.date))}` : ""}</em></div>
        ${component.note ? `<details class="care-note"><summary>¿Por qué se recomienda?</summary><p>${esc(component.note)}</p></details>` : ""}
      </div>
      <div class="care-row-state"><b>${esc(state.label)}</b><span>${state.source === "dtek" ? "Confirmado" : state.source === "none" ? "Sin revisar" : "Estimado"}</span></div>
    </article>`;
  }

  function systemMeter(group, items) {
    const known = items.filter(x => x.state.progress != null);
    const attention = items.filter(x => x.state.tone === "due").length;
    const tone = attention ? "due" : items.some(x => x.state.tone === "soon") ? "soon" : known.length ? "good" : "unknown";
    return `<details class="care-system ${tone}"${attention || group === "Motor" ? " open" : ""}>
      <summary>
        <span class="care-system-count"><i>${known.length}/${items.length}</i></span>
        <span><strong>${esc(group)}</strong><small>${attention ? `${attention} requiere atención` : `${known.length} de ${items.length} revisados`}</small></span>
        <b>${attention ? "Ver atención" : "Ver detalles"} <i>⌄</i></b>
      </summary>
      <div class="care-system-body">${items.map(x => careRow(x.component,x.state)).join("")}</div>
    </details>`;
  }

  function timeline(plan, vehicle, results) {
    const current = Number(vehicle.mileage || 0);
    if (!current) return `<div class="care-mileage-empty"><strong>Agregá el kilometraje actual</strong><span>Escribí el número del tablero para calcular qué servicio viene después.</span></div>`;
    const upcoming = results
      .filter(x => x.state.dueKm)
      .sort((a,b) => a.state.dueKm - b.state.dueKm)
      .slice(0,4);
    const max = Math.max(current + 25000, ...upcoming.map(x => x.state.dueKm));
    return `<div class="care-mileage-route">
      <div class="care-route-head"><span>Próximos servicios por kilometraje</span><strong>${fmtDistance(current)} hoy</strong></div>
      <div class="care-route-line"><i style="left:${Math.min(94,current/max*100)}%"></i>${upcoming.map(x => {
        const left = Math.max(7,Math.min(94,x.state.dueKm/max*100));
        return `<button type="button" style="left:${left}%" title="${esc(x.component.name)} · ${fmtDistance(x.state.dueKm)}"><b></b><span>${fmtDistance(x.state.dueKm)}<small>${esc(x.component.name)}</small></span></button>`;
      }).join("")}</div>
    </div>`;
  }

  function lifePosition(value, min, max) {
    if (value == null || !Number.isFinite(Number(value)) || max <= min) return null;
    return Math.max(3, Math.min(97, ((Number(value) - min) / (max - min)) * 100));
  }

  function lifeEventButton(event, axis, position, index) {
    if (position == null) return "";
    const value = axis === "date" ? fmtDate(event.date) : fmtDistance(event.km);
    return `<button type="button" class="garage-life-event ${event.kind}" style="left:${position.toFixed(2)}%" data-life-event="${index}" aria-label="${esc(event.name)} · ${esc(value)}" title="${esc(event.name)} · ${esc(value)}"><i></i></button>`;
  }

  function renderLifeRibbon(vehicle, history, results) {
    const holder = document.querySelector("#garageLifeAxes");
    const detail = document.querySelector("#garageLifeDetail");
    if (!holder) return;
    const completed = [...(history || [])]
      .filter(row => ["completed","approved","completado","realizado","finalizado"].includes(plain(row.work_order_status || row.appointment_status || row.status)))
      .sort((a,b) => new Date(dateValue(a) || 0) - new Date(dateValue(b) || 0))
      .filter((row, index, rows) => {
        const key = String(row.appointment_id || row.id || `${dateValue(row)}-${row.service_name}`);
        return rows.findIndex(candidate => String(candidate.appointment_id || candidate.id || `${dateValue(candidate)}-${candidate.service_name}`) === key) === index;
      })
      .slice(-7)
      .map(row => ({
        name:row.service_name || "Servicio D-TEK",
        date:dateValue(row),
        km:kmValue(row),
        kind:"done",
        meta:sourceLabel(row.source || "automatic")
      }));
    const nextResult = [...results]
      .filter(item => item.state.dueKm || item.state.dueDate)
      .sort((a,b) => {
        const rank = { due:0, soon:1, good:2, unknown:3 };
        return (rank[a.state.tone] ?? 4) - (rank[b.state.tone] ?? 4);
      })[0];
    if (nextResult) {
      completed.push({
        name:nextResult.component.name,
        date:nextResult.state.dueDate,
        km:nextResult.state.dueKm,
        kind:"next",
        meta:"Próximo vencimiento estimado"
      });
    }
    lastLifeEvents = completed;

    if (!completed.length) {
      holder.innerHTML = `<div class="garage-life-empty"><strong>Todavía no hay servicios registrados.</strong><span>El primer servicio guardará la fecha, el kilometraje y lo que se realizó.</span></div>`;
      if (detail) detail.textContent = "Solicitá el primer servicio para empezar el historial.";
      return;
    }

    const now = Date.now();
    const dated = completed.map(item => item.date ? new Date(item.date).getTime() : null).filter(Number.isFinite);
    const kmValues = completed.map(item => item.km).filter(Number.isFinite);
    const currentKm = Number(vehicle.mileage || 0) || null;
    const dateMin = Math.min(...dated, now - DAY * 180);
    const dateMax = Math.max(...dated, now + DAY * 180);
    const kmMin = Math.max(0, Math.min(...kmValues, currentKm || Infinity, (currentKm || 25000) - 25000));
    const kmMax = Math.max(...kmValues, currentKm || 0, (currentKm || 0) + 25000);
    const todayDate = lifePosition(now, dateMin, dateMax);
    const todayKm = currentKm ? lifePosition(currentKm, kmMin, kmMax) : null;

    holder.innerHTML = `
      <div class="garage-life-axis">
        <span class="garage-life-axis-label"><b>Fecha</b><small>${fmtDate(new Date())}</small></span>
        <div class="garage-life-track">
          <span class="garage-life-progress" style="width:${todayDate || 0}%"></span>
          ${todayDate == null ? "" : `<i class="garage-life-today" style="left:${todayDate}%"><small>Hoy</small></i>`}
          ${completed.map((item,index) => lifeEventButton(item, "date", item.date ? lifePosition(new Date(item.date).getTime(), dateMin, dateMax) : null, index)).join("")}
        </div>
      </div>
      <div class="garage-life-axis">
        <span class="garage-life-axis-label"><b>${distanceUnit === "mi" ? "Millas" : "Kilómetros"}</b><small>${currentKm ? fmtDistance(currentKm) : "Sin dato"}</small></span>
        <div class="garage-life-track">
          <span class="garage-life-progress" style="width:${todayKm || 0}%"></span>
          ${todayKm == null ? "" : `<i class="garage-life-today" style="left:${todayKm}%"><small>Hoy</small></i>`}
          ${completed.map((item,index) => lifeEventButton(item, "km", item.km ? lifePosition(item.km, kmMin, kmMax) : null, index)).join("")}
        </div>
      </div>`;

    if (detail) {
      if (completed.length <= 3) {
        renderLifeDetail(completed, detail);
        setActiveLifeEvents(completed.map((_, index) => index));
      } else {
        const initial = completed.find(item => item.kind === "next") || completed[completed.length - 1];
        const initialIndex = completed.indexOf(initial);
        renderLifeDetail([initial], detail, true);
        setActiveLifeEvents([initialIndex]);
      }
    }
  }

  function lifeDetailRow(item) {
    return `<div class="garage-life-detail-row ${item.kind}">
      <b>${item.kind === "next" ? "Estimado" : "Realizado"}</b>
      <strong>${esc(item.name)}</strong>
      <span>${esc([item.date ? fmtDate(item.date) : "", item.km ? fmtDistance(item.km) : "", item.meta].filter(Boolean).join(" · "))}</span>
    </div>`;
  }

  function renderLifeDetail(items, detail, withHint) {
    const hint = withHint ? `<span class="garage-life-detail-hint">Tocá otro punto para ver ese servicio</span>` : "";
    detail.innerHTML = items.map(lifeDetailRow).join("") + hint;
  }

  function setActiveLifeEvents(indexes) {
    document.querySelectorAll("[data-life-event]").forEach(button => {
      button.classList.toggle("active", indexes.includes(Number(button.dataset.lifeEvent)));
    });
  }

  function renderRadar(vehicle, history, results) {
    const holder = document.querySelector("#garageRadarList");
    const mobileHolder = document.querySelector("#garageRadarMobileList");
    if (!holder && !mobileHolder) return;
    const rank = { due:0, soon:1, unknown:2, recorded:3, good:4 };
    const radar = [...results]
      .sort((a,b) => (rank[a.state.tone] ?? 5) - (rank[b.state.tone] ?? 5))
      .slice(0,4);
    const radarHtml = radar.map(({ component, state }) => `
      <button type="button" class="garage-radar-item ${state.tone}" data-radar-component="${esc(component.key)}">
        <span class="garage-radar-icon" aria-hidden="true">${esc(component.icon)}</span>
        <span class="garage-radar-copy"><strong>${esc(component.name)}</strong><small>${esc(state.detail)}</small></span>
        <span class="garage-radar-state">${esc(state.label)}</span>
        ${component.mode === "interval" ? `<span class="garage-radar-mini" aria-hidden="true"><i style="width:${state.timeProgress || 0}%"></i><i style="width:${state.distanceProgress || 0}%"></i></span>` : ""}
      </button>`).join("");
    if (holder) holder.innerHTML = radarHtml;
    if (mobileHolder) mobileHolder.innerHTML = radarHtml;
    const attention = results.filter(item => ["due","soon"].includes(item.state.tone)).length;
    const count = document.querySelector("#garageRadarCount");
    if (count) count.textContent = String(attention);
    ["#garageRadarMobileCount", "#garageMobileGlanceCount", "#garageRadarRailCount"].forEach((selector) => {
      const mobileCount = document.querySelector(selector);
      if (mobileCount) mobileCount.textContent = String(attention);
    });

    const orderedHistory = [...(history || [])].sort((a,b) => new Date(dateValue(b) || 0) - new Date(dateValue(a) || 0));
    const last = orderedHistory.find(row => ["completed","approved","completado","realizado","finalizado"].includes(plain(row.work_order_status || row.appointment_status || row.status)));
    const appointment = orderedHistory
      .filter(row => new Date(dateValue(row) || 0).getTime() >= Date.now() && !["cancelled","canceled","completed"].includes(plain(row.status || row.appointment_status)))
      .sort((a,b) => new Date(dateValue(a)) - new Date(dateValue(b)))[0];
    const lastHolder = document.querySelector("#garageRadarLast");
    const appointmentHolder = document.querySelector("#garageRadarAppointment");
    if (lastHolder) lastHolder.textContent = last ? `${last.service_name || "Servicio"} · ${fmtDate(dateValue(last))}` : "Sin historial";
    if (appointmentHolder) appointmentHolder.textContent = appointment ? `${appointment.service_name || "Servicio"} · ${fmtDate(dateValue(appointment))}` : "Sin cita";
    const mobileLast = document.querySelector("#garageRadarMobileLast");
    const mobileAppointment = document.querySelector("#garageRadarMobileAppointment");
    if (mobileLast) mobileLast.textContent = last ? `${last.service_name || "Servicio"} · ${fmtDate(dateValue(last))}` : "Sin historial";
    if (mobileAppointment) mobileAppointment.textContent = appointment ? `${appointment.service_name || "Servicio"} · ${fmtDate(dateValue(appointment))}` : "Sin cita";
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
    const next = results.find(x => x.state.tone === "due") || results.find(x => x.state.tone === "soon") || results.find(x => x.state.tone === "unknown");
    const meta = plan[0] || {};

    summary.innerHTML = `<section class="care-command ${counts.due ? "due" : counts.soon ? "soon" : "good"}">
      <div class="care-command-copy">
        <span class="care-live-pill"><i></i> Plan activo</span>
        <small>LO PRÓXIMO QUE NECESITA TU CARRO</small>
        <h3>${esc(next?.component.name || "Todo al día")}</h3>
        <p>${esc(next?.state.detail || "No hay alertas registradas.")}</p>
        <div class="care-command-stats">
          <span><b>${counts.due}</b> ahora</span><span><b>${counts.soon}</b> cerca</span><span><b>${counts.unknown}</b> por revisar</span>
        </div>
      </div>
      <div class="care-coverage-count"><strong>${known.length} de ${results.length}</strong><span>elementos revisados</span></div>
    </section>
    ${timeline(plan, vehicle, results)}
    <div class="care-plan-strip"><span><b>Cómo calculamos lo próximo</b><strong>${esc(meta.planTitle)}</strong><small>${esc(meta.planSource)}</small></span><em>Mejora cuando registramos servicios y kilometraje</em></div>`;

    const groups = [...new Set(plan.map(x => x.group))];
    systems.innerHTML = `<div class="care-system-grid">${groups.map(group => systemMeter(group, results.filter(x => x.component.group === group))).join("")}</div>`;
    renderLifeRibbon(vehicle, history, results);
    renderRadar(vehicle, history, results);
    document.querySelectorAll("[data-care-unit]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.careUnit === distanceUnit));
    });
  }

  window.DtekVehicleHealth = { render, components:COMPONENTS, planForVehicle };
  document.addEventListener("click", event => {
    const lifeButton = event.target.closest("[data-life-event]");
    if (lifeButton) {
      const index = Number(lifeButton.dataset.lifeEvent);
      const item = lastLifeEvents[index];
      const detail = document.querySelector("#garageLifeDetail");
      setActiveLifeEvents([index]);
      if (item && detail) renderLifeDetail([item], detail, lastLifeEvents.length > 1);
    }
    const button = event.target.closest("[data-care-unit]");
    if (!button) return;
    distanceUnit = button.dataset.careUnit === "mi" ? "mi" : "km";
    localStorage.setItem("dtek-distance-unit", distanceUnit);
    if (lastRenderArgs) render(...lastRenderArgs);
  });
})();
