/*
  D-TEK GT Web OS v38 — Detalle del trabajo
  Propiedad de D-TEK GT / Dominic Morales.

  Cada servicio deja de estar repartido entre "cita" y "reporte técnico":
  las dos filas del historial se funden en un solo expediente con dirección
  propia. No agrega tablas ni llamadas nuevas — usa el historial ya cargado.

  Ruta: cliente.html#/servicio/<appointment_id>
*/
(() => {
  const RUTA = /^#\/servicio\/([0-9a-zA-Z-]+)$/;

  const seguro = (valor) => (typeof clientSafe === "function" ? clientSafe(valor) : String(valor ?? ""));
  const dinero = (valor) => (typeof formatMoney === "function" ? formatMoney(valor) : `Q${valor}`);
  const fecha = (valor) => (typeof fmtDate === "function" ? fmtDate(valor) : String(valor ?? ""));
  const tono = (valor) => (typeof statusTone === "function" ? statusTone(valor) : "neutral");
  const etiqueta = (valor) => (typeof statusLabel === "function" ? statusLabel(valor) : String(valor ?? ""));

  /* ---------- datos ---------- */

  // El historial devuelve hasta dos filas por servicio: la cita y su reporte.
  // El expediente es la unión de ambas.
  function juntarServicio(idServicio) {
    const estado = window.clientPortalState || (typeof clientPortalState !== "undefined" ? clientPortalState : null);
    if (!estado) return null;

    const fuentes = [];
    const mapa = estado.vehicleHistoryMap || {};
    Object.keys(mapa).forEach((idVehiculo) => {
      (mapa[idVehiculo] || []).forEach((fila) => fuentes.push({ fila, idVehiculo }));
    });
    (estado.activeVehicleHistory || []).forEach((fila) => {
      fuentes.push({ fila, idVehiculo: estado.activeVehicleId });
    });

    const coincide = fuentes.filter(({ fila }) =>
      String(fila.appointment_id ?? fila.id) === String(idServicio));
    if (!coincide.length) return null;

    const filas = coincide.map((c) => c.fila);
    const cita = filas.find((f) => f.kind !== "work_order") || filas[0];
    const reporte = filas.find((f) => f.kind === "work_order") || null;
    const idVehiculo = coincide[0].idVehiculo;
    const vehiculo = (estado.vehicles || []).find((v) => String(v.id) === String(idVehiculo)) || null;

    return {
      id: String(cita.appointment_id ?? cita.id),
      nombre: cita.service_name || reporte?.service_name || "Servicio D-TEK",
      precioCatalogo: cita.service_price || reporte?.service_price || "",
      cuando: cita.scheduled_start || cita.created_at,
      estadoCita: cita.appointment_status || cita.status || "requested",
      estadoReporte: reporte?.work_order_status || null,
      sintoma: cita.symptom || "",
      lugar: cita.location || "",
      diagnostico: reporte?.diagnosis || cita.diagnosis || "",
      recomendaciones: reporte?.recommendations || cita.recommendations || "",
      repuestos: reporte?.parts_notes || cita.parts_notes || "",
      manoObra: reporte?.labor_total ?? cita.labor_total ?? null,
      partes: reporte?.parts_total ?? cita.parts_total ?? null,
      total: reporte?.grand_total ?? cita.grand_total ?? null,
      tieneReporte: Boolean(reporte),
      vehiculo
    };
  }

  /* ---------- vista ---------- */

  function bloque(titulo, cuerpo) {
    if (!cuerpo) return "";
    return `<section class="exp-bloque">
      <h3>${seguro(titulo)}</h3>
      <p>${seguro(cuerpo)}</p>
    </section>`;
  }

  function desglose(exp) {
    const lineas = [
      ["Mano de obra", exp.manoObra],
      ["Repuestos", exp.partes]
    ].filter(([, v]) => v !== null && v !== undefined && v !== "");

    if (!lineas.length && (exp.total === null || exp.total === undefined)) {
      return exp.precioCatalogo
        ? `<section class="exp-bloque exp-costos">
             <h3>Costo</h3>
             <div class="exp-linea exp-total"><span>Precio de referencia</span><strong>${seguro(exp.precioCatalogo)}</strong></div>
             <p class="exp-nota">El total definitivo se registra cuando el trabajo se cierra.</p>
           </section>`
        : "";
    }

    return `<section class="exp-bloque exp-costos">
      <h3>Costo</h3>
      ${lineas.map(([nombre, valor]) => `<div class="exp-linea"><span>${seguro(nombre)}</span><b>${seguro(dinero(valor))}</b></div>`).join("")}
      ${exp.total !== null && exp.total !== undefined
        ? `<div class="exp-linea exp-total"><span>Total</span><strong>${seguro(dinero(exp.total))}</strong></div>`
        : ""}
    </section>`;
  }

  function pendiente(titulo, texto) {
    return `<section class="exp-bloque exp-pendiente">
      <h3>${seguro(titulo)}</h3>
      <p>${seguro(texto)}</p>
    </section>`;
  }

  function pintar(exp) {
    const cuerpo = document.querySelector("#expedienteBody");
    const titulo = document.querySelector("#expedienteTitle");
    if (!cuerpo || !titulo) return;

    titulo.textContent = exp.nombre;

    const estado = exp.estadoReporte || exp.estadoCita;
    const carro = exp.vehiculo
      ? [exp.vehiculo.nickname, [exp.vehiculo.brand, exp.vehiculo.line, exp.vehiculo.year].filter(Boolean).join(" ")]
          .filter(Boolean).join(" · ")
      : "";

    cuerpo.innerHTML = `
      <div class="exp-cabecera">
        <span class="client-status-badge ${seguro(tono(estado))}">${seguro(etiqueta(estado))}</span>
        <span class="exp-fecha">${seguro(fecha(exp.cuando))}</span>
      </div>

      ${carro || exp.lugar ? `<div class="exp-datos">
        ${carro ? `<div><dt>Carro</dt><dd>${seguro(carro)}</dd></div>` : ""}
        ${exp.vehiculo?.plate ? `<div><dt>Placa</dt><dd>${seguro(exp.vehiculo.plate)}</dd></div>` : ""}
        ${exp.vehiculo?.mileage ? `<div><dt>Kilometraje</dt><dd>${seguro(Number(exp.vehiculo.mileage).toLocaleString("es-GT"))} km</dd></div>` : ""}
        ${exp.lugar ? `<div><dt>Lugar</dt><dd>${seguro(exp.lugar)}</dd></div>` : ""}
      </div>` : ""}

      ${bloque("Lo que reportaste", exp.sintoma)}
      ${bloque("Diagnóstico", exp.diagnostico)}
      ${bloque("Recomendaciones", exp.recomendaciones)}
      ${bloque("Repuestos", exp.repuestos)}
      ${desglose(exp)}

      ${!exp.tieneReporte ? `<section class="exp-bloque exp-aviso">
        <h3>Trabajo pendiente</h3>
        <p>Cuando se realice, aquí aparecerán el diagnóstico, lo que se cambió y el total.</p>
      </section>` : ""}

      ${pendiente("Fotos del trabajo", "Próximamente vas a ver acá las fotos que se tomaron durante este servicio.")}
      ${pendiente("Conversación", "Próximamente vas a poder preguntar sobre este servicio y que quede por escrito.")}
    `;
  }

  /* ---------- abrir y cerrar ---------- */

  let ultimoFoco = null;
  let reintento = null;

  function abrir(idServicio, { desdeRuta = false } = {}) {
    const exp = juntarServicio(idServicio);
    const modal = document.querySelector("#expedienteModal");
    if (!modal) return false;
    if (!exp) {
      // El historial de ese carro todavía no está cargado.
      if (desdeRuta) return false;
      return false;
    }

    pintar(exp);
    ultimoFoco = document.activeElement;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("client-modal-open");
    if (!desdeRuta && window.location.hash !== `#/servicio/${exp.id}`) {
      window.history.pushState({ expediente: exp.id }, "", `#/servicio/${exp.id}`);
    }
    window.setTimeout(() => modal.querySelector("[data-close-expediente]")?.focus(), 60);
    return true;
  }

  function cerrar({ volver = true } = {}) {
    const modal = document.querySelector("#expedienteModal");
    if (!modal || modal.getAttribute("aria-hidden") === "true") return;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("client-modal-open");
    if (volver && RUTA.test(window.location.hash)) {
      window.history.pushState({}, "", window.location.pathname + window.location.search);
    }
    ultimoFoco?.focus?.();
    ultimoFoco = null;
  }

  function leerRuta() {
    const m = window.location.hash.match(RUTA);
    if (!m) { cerrar({ volver: false }); return; }
    if (!abrir(m[1], { desdeRuta: true })) {
      // Enlace directo: el historial llega despues de la sesion de Supabase.
      // 30 intentos de 500 ms cubren una carga lenta con datos moviles.
      let intentos = 0;
      window.clearInterval(reintento);
      reintento = window.setInterval(() => {
        intentos += 1;
        if (abrir(m[1], { desdeRuta: true }) || intentos > 30) window.clearInterval(reintento);
      }, 500);
    }
  }

  /* ---------- enganches ---------- */

  document.addEventListener("click", (evento) => {
    const disparador = evento.target.closest("[data-open-expediente]");
    if (disparador) {
      const id = disparador.getAttribute("data-open-expediente");
      if (id) { evento.preventDefault(); abrir(id); }
      return;
    }
    if (evento.target.closest("[data-close-expediente]")) {
      evento.preventDefault();
      cerrar();
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") cerrar();
    if (evento.key !== "Enter" && evento.key !== " ") return;
    const disparador = evento.target.closest?.("[data-open-expediente]");
    if (disparador && disparador.getAttribute("role") === "button") {
      evento.preventDefault();
      abrir(disparador.getAttribute("data-open-expediente"));
    }
  });

  window.addEventListener("popstate", leerRuta);
  window.addEventListener("hashchange", leerRuta);

  // Este archivo se carga al final del body: para entonces DOMContentLoaded
  // ya suele haber pasado, y esperarlo dejaba el enlace directo sin abrir.
  function arranque() {
    if (RUTA.test(window.location.hash)) leerRuta();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arranque);
  else arranque();

  window.DtekExpediente = { abrir, cerrar };
})();
