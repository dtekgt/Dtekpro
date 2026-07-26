/*
  D-TEK GT — Movimiento de la línea de tiempo del Garage.

  Reparto de responsabilidades:
  - Entrada escalonada de las tarjetas: anime.js v4 (CDN, import dinámico).
  - Progreso del riel rojo: cálculo propio sobre scroll.
    El ScrollObserver de anime.js resuelve <body> como contenedor en esta
    página y ahí la distancia scrolleable es 0, así que el progreso nunca
    avanzaba. Calcularlo a mano son cuatro líneas y no depende de que la
    librería adivine bien el contenedor.

  Regla de oro: el contenido nunca depende de que la animación corra.
  Si el CDN falla o el usuario pidió menos movimiento, las tarjetas quedan
  visibles y el riel dibujado por completo.
*/
(() => {
  const ANIME_CDN = "https://cdn.jsdelivr.net/npm/animejs@4/+esm";
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let animePromise = null;
  let railTicking = false;
  let railBound = false;
  const animated = new WeakSet();

  function loadAnime() {
    if (!animePromise) animePromise = import(ANIME_CDN).catch(() => null);
    return animePromise;
  }

  function showEvents(events) {
    events.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }

  function paintStatic() {
    const rail = document.querySelector("#spineRailFill");
    if (rail) rail.style.transform = "scaleY(1)";
    showEvents([...document.querySelectorAll("[data-spine-event]")]);
  }

  /* El riel marca por dónde vas: se llena a medida que la mitad de la
     pantalla recorre la espina. */
  function updateRail() {
    railTicking = false;
    const rail = document.querySelector("#spineRailFill");
    const spine = document.querySelector("#garageSpine");
    if (!rail || !spine) return;
    const rect = spine.getBoundingClientRect();
    if (!rect.height) return;
    const middle = window.innerHeight * 0.5;
    const raw = (middle - rect.top) / rect.height;
    const progress = Math.max(0, Math.min(1, raw));
    rail.style.transform = `scaleY(${progress.toFixed(4)})`;
  }

  function requestRailUpdate() {
    if (railTicking) return;
    railTicking = true;
    window.requestAnimationFrame(updateRail);
  }

  function bindRail() {
    if (railBound) return;
    railBound = true;
    window.addEventListener("scroll", requestRailUpdate, { passive: true });
    window.addEventListener("resize", requestRailUpdate, { passive: true });
  }

  /* Red de seguridad: si algo dejó una tarjeta invisible, la mostramos. */
  function guardVisibility() {
    window.setTimeout(() => {
      document.querySelectorAll("[data-spine-event]").forEach((el) => {
        if (Number(getComputedStyle(el).opacity) < 0.05) {
          el.style.opacity = "1";
          el.style.transform = "none";
        }
      });
    }, 1400);
  }

  async function refresh() {
    const rail = document.querySelector("#spineRailFill");
    const events = [...document.querySelectorAll("[data-spine-event]")];
    if (!rail || !events.length) return;

    if (reduced) {
      paintStatic();
      return;
    }

    bindRail();
    updateRail();

    const anime = await loadAnime();
    if (!anime) {
      showEvents(events);
      return;
    }

    try {
      const { animate, stagger, utils } = anime;
      // Entrada inmediata, no atada al scroll: la espina vive arriba del
      // Resumen, así que un disparo por scroll podría no ocurrir nunca.
      const fresh = events.filter((el) => !animated.has(el));
      if (!fresh.length) return;
      fresh.forEach((el) => animated.add(el));

      utils.set(fresh, { opacity: 0, y: 14 });
      animate(fresh, {
        opacity: 1,
        y: 0,
        duration: 520,
        delay: stagger(70),
        ease: "out(2)",
        onComplete: () => showEvents(fresh)
      });
      guardVisibility();
    } catch (error) {
      console.warn("Garage motion desactivado:", error);
      showEvents(events);
    }
  }

  window.DtekGarageMotion = { refresh };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
