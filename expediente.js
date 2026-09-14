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
      lineas: reporte?.lineas || cita.lineas || [],
      tieneReporte: Boolean(reporte),
      idVehiculo,
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

  // Cada línea puede llevar foto (29_foto_en_recibo.sql): la ruta de Storage
  // no es una URL, así que el espacio queda vacío hasta que
  // cargarInspeccionesDelExpediente firme las rutas y lo llene (pintarFotosDeLineas).
  function espacioFotoLinea(ruta) {
    return ruta ? `<span class="exp-linea-foto" data-recibo-foto="${seguro(ruta)}"></span>` : "";
  }

  function desglose(exp) {
    const detalle = Array.isArray(exp.lineas) ? exp.lineas.filter((l) => l && l.descripcion) : [];

    if (detalle.length) {
      const filas = detalle.map((l) => `
        <tr>
          <td>${seguro(l.descripcion)}${espacioFotoLinea(l.foto)}</td>
          <td>${seguro(l.cantidad ?? "")}</td>
          <td>${seguro(dinero(l.precio))}</td>
          <td>${seguro(dinero(l.subtotal))}</td>
        </tr>`).join("");
      return `<section class="exp-bloque exp-costos">
        <h3>Detalle del recibo</h3>
        <table class="exp-recibo-tabla">
          <thead><tr><th>Descripción</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        ${exp.total !== null && exp.total !== undefined
          ? `<div class="exp-linea exp-total"><span>Total</span><strong>${seguro(dinero(exp.total))}</strong></div>`
          : ""}
      </section>`;
    }

    // Reportes viejos, de antes de que el recibo guardara el detalle por línea:
    // el resumen de mano de obra / repuestos sigue siendo lo único que hay.
    const resumen = [
      ["Mano de obra", exp.manoObra],
      ["Repuestos", exp.partes]
    ].filter(([, v]) => v !== null && v !== undefined && v !== "");

    if (!resumen.length && (exp.total === null || exp.total === undefined)) {
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
      ${resumen.map(([nombre, valor]) => `<div class="exp-linea"><span>${seguro(nombre)}</span><b>${seguro(dinero(valor))}</b></div>`).join("")}
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

      ${exp.tieneReporte ? `<section class="exp-bloque exp-inspecciones" id="expedienteInspecciones">
        <h3>Cómo quedó tu carro</h3>
        <div class="exp-inspecciones-body" id="expedienteInspeccionesBody">
          <p class="exp-nota">Cargando...</p>
        </div>
      </section>` : pendiente("Fotos y revisión del mecánico", "Cuando se realice el trabajo, aquí vas a ver las fotos y notas de lo revisado.")}
    `;
  }

  /* ---------- semáforo del carro ----------

     El cliente no quiere leer trece renglones para saber si su carro está bien:
     quiere una respuesta y después el detalle. Así que la revisión se agrupa en
     tres colores, con una frase arriba que contesta la pregunta que trae.

     Antes esta sección filtraba y solo mostraba los ítems con nota o foto. Eso
     escondía lo que estaba bien —que es justamente la mayoría— y dejaba al
     cliente sin la proporción: veía tres problemas y ningún contexto.
  */

  const GRUPOS = [
    { id: "corregir", estados: ["attention"], titulo: "Hay que corregir", icono: "🛑", clase: "bad" },
    { id: "vigilar", estados: ["monitor"], titulo: "Para vigilar", icono: "👁", clase: "warn" },
    { id: "bien", estados: ["ok", "serviced"], titulo: "Está bien", icono: "✅", clase: "ok" },
  ];

  function componentePorKey(key) {
    return (window.DtekVehicleHealth?.components || []).find((c) => c.key === key) || null;
  }

  function nombreDeComponente(key) {
    return componentePorKey(key)?.name || null;
  }

  const sinTildes = (texto) => String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

  /* El componente ya trae las palabras con las que se reconoce un trabajo suyo
     ("balatas delanteras", "frenos delanteros"...). Las reusamos al revés para
     encontrar qué servicio del catálogo corrige ese hallazgo, en vez de mantener
     un segundo mapeo a mano que se desincronizaría del catálogo. */
  function servicioQueCorrige(componentKey) {
    const comp = componentePorKey(componentKey);
    const palabras = comp?.words || [];
    if (!palabras.length) return null;
    const servicios = window.DTEK_SERVICES || [];
    let mejor = null;
    palabras.forEach((palabra) => {
      const clave = sinTildes(palabra);
      servicios.forEach((servicio) => {
        const nombre = sinTildes(servicio.name);
        if (!nombre.includes(clave)) return;
        // Ante varios candidatos gana la palabra más específica
        // ("balatas delanteras" antes que "frenos").
        if (!mejor || clave.length > mejor.largo) mejor = { id: servicio.id, largo: clave.length };
      });
    });
    return mejor?.id || null;
  }

  /* fmtDate trae día de la semana y hora ("viernes, 4 de septiembre, 7:00 a. m."),
     que arriba del veredicto compite con el titular. Acá basta el día. */
  function fechaCorta(valor) {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return fecha(valor);
    return d.toLocaleDateString("es-GT", { day: "numeric", month: "long" });
  }

  function veredicto(conteo, exp) {
    const cuando = exp.cuando ? `Revisión del ${fechaCorta(exp.cuando)}` : "Revisión";
    const km = exp.vehiculo?.mileage
      ? ` · ${Number(exp.vehiculo.mileage).toLocaleString("es-GT")} km` : "";
    let titulo, detalle, clase;
    if (conteo.corregir > 0) {
      clase = "bad";
      titulo = conteo.corregir === 1 ? "Tu carro necesita una corrección" : `Tu carro necesita ${conteo.corregir} correcciones`;
      detalle = conteo.vigilar > 0
        ? `Hay ${conteo.vigilar === 1 ? "algo más" : `${conteo.vigilar} cosas más`} para vigilar. El resto está bien.`
        : "El resto de lo que revisamos está bien.";
    } else if (conteo.vigilar > 0) {
      clase = "warn";
      titulo = "Tu carro está bien, con cosas para vigilar";
      detalle = `No hay nada que corregir ahora. ${conteo.vigilar === 1 ? "Hay un punto" : `Hay ${conteo.vigilar} puntos`} que conviene mirar en la próxima visita.`;
    } else if (conteo.bien > 0) {
      clase = "ok";
      titulo = "Tu carro está bien";
      detalle = "No encontramos nada que corregir ni que vigilar en lo que revisamos.";
    } else {
      return "";
    }
    return `<div class="semaforo-veredicto ${clase}">
      <span class="semaforo-cuando">${seguro(cuando)}${seguro(km)}</span>
      <h4>${seguro(titulo)}</h4>
      <p>${seguro(detalle)}</p>
    </div>`;
  }

  function barra(conteo) {
    const total = conteo.corregir + conteo.vigilar + conteo.bien;
    if (!total) return "";
    const pct = (n) => (n / total) * 100;
    const clave = [
      conteo.corregir ? `<span><b class="bad"></b>${conteo.corregir} ${conteo.corregir === 1 ? "corrección" : "correcciones"}</span>` : "",
      conteo.vigilar ? `<span><b class="warn"></b>${conteo.vigilar} vigilar</span>` : "",
      conteo.bien ? `<span><b class="ok"></b>${conteo.bien} bien</span>` : "",
    ].join("");
    return `<div class="semaforo-medidor-caja">
      <div class="semaforo-medidor" role="img" aria-label="${conteo.corregir} para corregir, ${conteo.vigilar} para vigilar, ${conteo.bien} bien">
        ${conteo.corregir ? `<i class="bad" style="width:${pct(conteo.corregir)}%"></i>` : ""}
        ${conteo.vigilar ? `<i class="warn" style="width:${pct(conteo.vigilar)}%"></i>` : ""}
        ${conteo.bien ? `<i class="ok" style="width:${pct(conteo.bien)}%"></i>` : ""}
      </div>
      <div class="semaforo-clave">${clave}</div>
    </div>`;
  }

  function itemSemaforo(item, urls, exp, esCorreccion) {
    const comp = componentePorKey(item.component_key);
    const nombre = item.component_label || comp?.name || "Revisión";
    const fotos = (item.photo_paths || []).map((ruta) => {
      const url = urls[ruta];
      return url ? `<a class="exp-foto-thumb" href="${seguro(url)}" target="_blank" rel="noopener noreferrer"><img src="${seguro(url)}" alt="Foto de ${seguro(nombre)}" loading="lazy"></a>` : "";
    }).join("");
    /* La evidencia se muestra, no se exige: hay piezas que se revisan sin poder
       fotografiar. Bloquear el guardado dejaba dos salidas malas —inventar una
       foto o no registrar nada—, así que el ítem dice cuál de las dos cosas es
       y el cliente decide qué peso darle. */
    const evidencia = fotos
      ? `<span class="semaforo-evidencia con-foto">📷 Con foto de la revisión</span>`
      : `<span class="semaforo-evidencia sin-foto">Revisado sin foto</span>`;

    const servicioId = esCorreccion ? servicioQueCorrige(item.component_key) : null;
    const cta = servicioId
      ? `<button type="button" class="semaforo-cta" data-open-client-booking
           data-vehicle-id="${seguro(exp.idVehiculo ?? "")}"
           data-booking-service="${seguro(servicioId)}"
           data-desde-expediente="1">Pedir esta corrección</button>`
      : "";

    return `<article class="semaforo-item">
      <span class="semaforo-ico" aria-hidden="true">${seguro(comp?.icon || "•")}</span>
      <div class="semaforo-cuerpo">
        <strong>${seguro(nombre)}</strong>
        ${item.notes ? `<p>${seguro(item.notes)}</p>` : ""}
        ${evidencia}
        ${fotos ? `<div class="exp-inspeccion-fotos">${fotos}</div>` : ""}
        ${cta}
      </div>
    </article>`;
  }

  /* Lo que no se revisó va al final, en gris y en un solo renglón: no es un
     pendiente del taller, es que no entraba en este servicio. Mezclarlo con el
     resto hacía que pareciera un problema. */
  function noRevisado(items) {
    const revisados = new Set(items.map((it) => it.component_key).filter(Boolean));
    const faltantes = (window.DtekVehicleHealth?.components || [])
      .filter((c) => !revisados.has(c.key))
      .map((c) => c.name);
    if (!faltantes.length) return "";
    const lista = faltantes.length > 6
      ? `${faltantes.slice(0, 6).join(", ")} y ${faltantes.length - 6} más`
      : faltantes.join(", ");
    return `<section class="semaforo-grupo none">
      <header><span aria-hidden="true">○</span><strong>No se revisó esta vez</strong><span class="semaforo-n">${faltantes.length}</span></header>
      <div class="semaforo-item">
        <span class="semaforo-ico" aria-hidden="true">⚙️</span>
        <div class="semaforo-cuerpo">
          <strong>${seguro(lista)}</strong>
          <p>No entraban en este servicio. Se pueden revisar en la próxima visita.</p>
        </div>
      </div>
    </section>`;
  }

  function codigosDeFalla(codigos, exp) {
    if (!Array.isArray(codigos) || !codigos.length) return "";
    const km = exp.vehiculo?.mileage ? `${Number(exp.vehiculo.mileage).toLocaleString("es-GT")} km` : "";
    const filas = codigos.map((c) => {
      const code = typeof c === "string" ? c : (c.code || c.codigo || "");
      const desc = typeof c === "string" ? "" : (c.description || c.descripcion || c.detalle || "");
      if (!code) return "";
      return `<div class="semaforo-codigo">
        <b>${seguro(code)}</b><span>${seguro(desc)}</span>${km ? `<small>${seguro(km)}</small>` : ""}
      </div>`;
    }).join("");
    if (!filas) return "";
    return `<section class="semaforo-codigos">
      <strong>Códigos que leyó el escáner</strong>
      <p>Los guardamos con el kilometraje de hoy para poder comparar en la próxima visita.</p>
      ${filas}
    </section>`;
  }

  // Las rutas de las fotos del recibo se firman junto con las de la revisión
  // en la misma llamada — es el mismo bucket, y evita un segundo viaje.
  function pintarFotosDeLineas(exp, urls) {
    (exp.lineas || []).forEach((l) => {
      const url = l?.foto && urls[l.foto];
      if (!url) return;
      const holder = document.querySelector(`[data-recibo-foto="${CSS.escape(l.foto)}"]`);
      if (holder) holder.innerHTML = `<a href="${seguro(url)}" target="_blank" rel="noopener noreferrer"><img src="${seguro(url)}" alt="Foto de ${seguro(l.descripcion || "la línea")}" loading="lazy"></a>`;
    });
  }

  async function cargarInspeccionesDelExpediente(exp) {
    const cuerpo = document.querySelector("#expedienteInspeccionesBody");
    if (!cuerpo || !exp.tieneReporte) return;
    const rutasLineas = [...new Set((exp.lineas || []).map((l) => l.foto).filter(Boolean))];
    try {
      const [items, codigos] = await Promise.all([
        window.DtekBackend.listWorkOrderInspections(exp.id),
        window.DtekBackend.getFaultCodes?.(exp.id).catch(() => []) ?? [],
      ]);
      const revisados = (items || []).filter((it) => it.component_key || it.component_label);

      const rutas = [...new Set([...revisados.flatMap((it) => it.photo_paths || []), ...rutasLineas])];
      const urls = rutas.length ? await window.DtekBackend.createInspectionPhotoUrls(rutas) : {};
      pintarFotosDeLineas(exp, urls);

      if (!revisados.length) {
        cuerpo.innerHTML = `<p class="exp-nota">En esta visita no se registró una revisión por componente.</p>`;
        return;
      }

      const porGrupo = {};
      GRUPOS.forEach((g) => { porGrupo[g.id] = revisados.filter((it) => g.estados.includes(it.status)); });
      const conteo = { corregir: porGrupo.corregir.length, vigilar: porGrupo.vigilar.length, bien: porGrupo.bien.length };

      const secciones = GRUPOS.map((g) => {
        const lista = porGrupo[g.id];
        if (!lista.length) return "";
        return `<section class="semaforo-grupo ${g.clase}">
          <header><span aria-hidden="true">${g.icono}</span><strong>${seguro(g.titulo)}</strong><span class="semaforo-n">${lista.length}</span></header>
          ${lista.map((it) => itemSemaforo(it, urls, exp, g.id === "corregir")).join("")}
        </section>`;
      }).join("");

      cuerpo.innerHTML = veredicto(conteo, exp) + barra(conteo) + secciones
        + noRevisado(revisados) + codigosDeFalla(codigos, exp);
    } catch (error) {
      console.warn(error);
      cuerpo.innerHTML = `<p class="exp-nota">No pudimos cargar la revisión ahora. Volvé a intentar más tarde.</p>`;
    }
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
    cargarInspeccionesDelExpediente(exp);
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
        if (abrir(m[1], { desdeRuta: true })) { window.clearInterval(reintento); return; }
        if (intentos > 30) {
          window.clearInterval(reintento);
          window.history.pushState({}, "", window.location.pathname + window.location.search);
          alert("No pudimos abrir ese servicio. Puede que el enlace esté vencido — buscalo en el historial de tu carro.");
        }
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
