/*
  D-TEK GT · Generador de páginas de servicio
  Propiedad de D-TEK GT / Dominic Morales.

  Crea una página estática por servicio en /servicio/<id>.html, con su propio
  título, descripción, encabezado y ficha para Google. Antes existían 45
  detalles que solo se armaban con JavaScript desde el catálogo: sin enlace
  que un buscador pudiera seguir y con la misma descripción para todos.

  También genera sitemap.xml y robots.txt, porque páginas que nadie puede
  encontrar no sirven de nada.

  Se vuelve a correr cuando cambien precios o servicios:
      node generar-paginas-servicio.js
*/
const fs = require("fs");
const path = require("path");

const RAIZ = __dirname;
const SITIO = "https://dtekpro.vercel.app";
const WA = "50247082329";
const VERSION = "31.5.0";

global.window = {};
eval(fs.readFileSync(path.join(RAIZ, "services-data.js"), "utf8"));
const SERVICIOS = window.DTEK_SERVICES || [];
const GRUPOS = window.DTEK_SERVICE_GROUPS || [];

const esc = (v = "") => String(v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const montoDe = (precio) => {
  const m = String(precio || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

const recorta = (texto, max = 155) => {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/[\s,;.]+\S*$/, "") + "…";
};

// La ficha de arriba es para datos cortos. Cuando el repuesto se describe
// con una frase larga, ya aparece completo en "Que incluye".
const repuestoCorto = (servicio) => {
  const p = String(servicio.partsIncluded || "").trim();
  if (!p || /^no$/i.test(p) || p.length > 38) return "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

const categoriaDe = (id) => {
  const g = GRUPOS.find((grupo) => grupo.services.includes(id));
  return g ? g.title : "Servicios";
};

/* ---------- piezas compartidas ---------- */

const NAV = `<header class="public-header-v25"><div class="public-nav-v25">
  <a class="public-brand-v25" href="../index.html"><img src="../assets/logo-dtek.png" alt="D-TEK GT"><span><strong>D-TEK GT</strong><small>Mecánica a domicilio</small></span></a>
  <button class="menu-toggle public-menu-toggle-v25" id="menuToggle" type="button" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span><span></span></button>
  <nav class="public-links-v25 nav-links" id="navLinks"><a href="../index.html">Inicio</a><a class="active" href="../servicios.html">Servicios</a><a href="../compra-segura.html">Compra segura</a><a href="../faq.html">Preguntas</a><a href="../cliente.html">Garage</a><a class="public-nav-cta-v25" href="../agenda.html">Agendar</a></nav>
</div></header>`;

const PIE = `<footer class="public-footer-v25"><strong>D-TEK GT</strong><nav><a href="../servicios.html">Servicios</a><a href="../agenda.html">Agendar</a><a href="../faq.html">Preguntas</a><a href="../cliente.html">Garage</a><a href="https://wa.me/${WA}" target="_blank" rel="noopener">WhatsApp</a></nav><small>© 2026 D-TEK GT · Mecánica a domicilio en Guatemala</small></footer>`;

const WA_SVG = `<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>`;

const NAV_MOVIL = `<nav class="public-mobile-nav-v25"><a href="../index.html"><small>Inicio</small></a><a class="active" href="../servicios.html"><small>Servicios</small></a><a href="../agenda.html"><small>Agendar</small></a><a href="../cliente.html"><small>Garage</small></a></nav>`;

/* ---------- la página ---------- */

function pagina(servicio) {
  const categoria = categoriaDe(servicio.id);
  const monto = montoDe(servicio.price);
  const titulo = `${servicio.name} a domicilio${monto ? ` desde Q${monto.toLocaleString("es-GT")}` : ""} | D-TEK GT`;
  const descripcion = recorta(
    `${servicio.description || servicio.short}${monto ? ` Precio de referencia desde Q${monto.toLocaleString("es-GT")}.` : ""} A domicilio en Guatemala.`
  );
  const url = `${SITIO}/servicio/${servicio.id}.html`;

  const fichaGoogle = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: servicio.name,
    description: servicio.description || servicio.short,
    serviceType: categoria,
    provider: {
      "@type": "AutoRepair",
      name: "D-TEK GT",
      telephone: "+502 4708 2329",
      areaServed: { "@type": "City", name: "Ciudad de Guatemala" },
      url: SITIO
    },
    areaServed: { "@type": "AdministrativeArea", name: "Guatemala" },
    ...(monto ? {
      offers: {
        "@type": "Offer",
        price: monto,
        priceCurrency: "GTQ",
        url,
        availability: "https://schema.org/InStock",
        priceValidUntil: "2026-10-27"
      }
    } : {})
  };

  const migas = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITIO + "/" },
      { "@type": "ListItem", position: 2, name: "Servicios", item: SITIO + "/servicios.html" },
      { "@type": "ListItem", position: 3, name: servicio.name, item: url }
    ]
  };

  const lista = (items) => (items || []).map((i) => `<li>${esc(i)}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="author" content="D-TEK GT / Dominic Morales"><meta name="theme-color" content="#030405">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="../assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<link rel="manifest" href="../site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="D-TEK GT">
<meta property="og:locale" content="es_GT">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:image" content="${SITIO}/assets/og-image.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(descripcion)}">
<meta name="twitter:image" content="${SITIO}/assets/og-image.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../styles.css?v=${VERSION}"><link rel="stylesheet" href="../styles-v30.css?v=${VERSION}">
<script type="application/ld+json">${JSON.stringify(fichaGoogle)}</script>
<script type="application/ld+json">${JSON.stringify(migas)}</script>
</head>
<body class="page-public-v25 page-public-v24 page-service-detail-v24">
${NAV}
<main>
  <section class="public-shell-v24 public-service-detail-v24">
    <div class="public-service-detail-hero-v24 service-detail-v27">
      <div>
        <a class="public-back-link-v24" href="../servicios.html">← Servicios</a>
        <span class="public-kicker-v24">${esc(categoria)}</span>
        <h1>${esc(servicio.name)}</h1>
        <p class="servicio-resumen">${esc(servicio.description || servicio.short)}</p>
        <div class="public-detail-facts-v24">
          <span><small>Precio</small><strong>${esc(servicio.price)}</strong></span>
          <span><small>Tiempo</small><strong>${esc(servicio.duration)}</strong></span>
          ${repuestoCorto(servicio)
            ? `<span><small>Incluye</small><strong>${esc(repuestoCorto(servicio))}</strong></span>` : ""}
        </div>
        <div class="public-hero-actions-v24">
          <a class="public-btn-v24 primary" href="../agenda.html?servicio=${encodeURIComponent(servicio.id)}">Agendar este servicio</a>
          <a class="public-btn-v24 secondary" href="https://wa.me/${WA}?text=${encodeURIComponent(`Hola D-TEK, quiero consultar por ${servicio.name}.`)}" target="_blank" rel="noopener">Preguntar por WhatsApp</a>
        </div>
      </div>
    </div>

    <div class="public-detail-grid-v24 two">
      <article><span>01</span><h2>Qué incluye</h2><ul>${lista(servicio.includes)}</ul></article>
      <article><span>02</span><h2>Qué necesitamos saber</h2><ul>${lista(servicio.dataNeeded)}</ul></article>
    </div>

    ${servicio.ideal && servicio.ideal.length ? `<div class="servicio-ideal">
      <h2>Ideal si</h2>
      <ul>${lista(servicio.ideal)}</ul>
    </div>` : ""}

    ${servicio.priceNote ? `<p class="servicio-nota">${esc(servicio.priceNote)}</p>` : ""}
    <p class="servicio-nota">Precio de referencia base sobre un sedán de 4 cilindros. Puede variar según el vehículo y lo que encontremos en la revisión.${servicio.bookingPolicy ? " " + esc(servicio.bookingPolicy) : ""}</p>

    <nav class="servicio-hermanos" aria-label="Otros servicios de ${esc(categoria)}">
      <h2>Otros de ${esc(categoria)}</h2>
      <div>${hermanos(servicio, categoria)}</div>
    </nav>
  </section>
</main>
${PIE}
${NAV_MOVIL}
<a class="dtek-wa-float" href="https://wa.me/${WA}?text=${encodeURIComponent(`Hola D-TEK, quiero consultar por ${servicio.name}.`)}" target="_blank" rel="noopener" aria-label="Escribir a D-TEK por WhatsApp">${WA_SVG}<b>WhatsApp</b></a>
<script src="../services-data.js?v=${VERSION}"></script><script src="../app.js?v=${VERSION}"></script><script src="../dtek-v30.js?v=${VERSION}"></script>
</body></html>`;
}

// Enlaces reales entre servicios de la misma categoría: le dan a Google
// un camino para llegar a las 45 y al cliente una salida natural.
function hermanos(servicio, categoria) {
  const g = GRUPOS.find((grupo) => grupo.title === categoria);
  if (!g) return "";
  return g.services
    .filter((id) => id !== servicio.id)
    .map((id) => SERVICIOS.find((s) => s.id === id))
    .filter(Boolean)
    .slice(0, 6)
    .map((s) => `<a href="${s.id}.html"><strong>${esc(s.name)}</strong><small>${esc(s.price)}</small></a>`)
    .join("");
}

/* ---------- escribir ---------- */

const carpeta = path.join(RAIZ, "servicio");
if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta);

let escritas = 0;
SERVICIOS.forEach((s) => {
  fs.writeFileSync(path.join(carpeta, `${s.id}.html`), pagina(s), "utf8");
  escritas++;
});

/* ---------- mapa del sitio ---------- */

const fijas = [
  { url: "/", prioridad: "1.0", frecuencia: "weekly" },
  { url: "/servicios.html", prioridad: "0.9", frecuencia: "weekly" },
  { url: "/compra-segura.html", prioridad: "0.8", frecuencia: "monthly" },
  { url: "/agenda.html", prioridad: "0.8", frecuencia: "monthly" },
  { url: "/faq.html", prioridad: "0.6", frecuencia: "monthly" },
  { url: "/cliente.html", prioridad: "0.5", frecuencia: "monthly" },
  { url: "/referir.html", prioridad: "0.4", frecuencia: "monthly" }
];
const hoy = new Date().toISOString().slice(0, 10);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fijas.map((p) => `  <url><loc>${SITIO}${p.url}</loc><lastmod>${hoy}</lastmod><changefreq>${p.frecuencia}</changefreq><priority>${p.prioridad}</priority></url>`).join("\n")}
${SERVICIOS.map((s) => `  <url><loc>${SITIO}/servicio/${s.id}.html</loc><lastmod>${hoy}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(RAIZ, "sitemap.xml"), sitemap, "utf8");

fs.writeFileSync(path.join(RAIZ, "robots.txt"), `User-agent: *
Allow: /

# Paneles internos: no tienen nada que hacer en un buscador.
Disallow: /admin.html
Disallow: /admin-backend.html
Disallow: /zapier.html
Disallow: /reset-password.html
Disallow: /database/

Sitemap: ${SITIO}/sitemap.xml
`, "utf8");

console.log(`paginas de servicio: ${escritas}`);
console.log(`sitemap.xml: ${fijas.length + SERVICIOS.length} direcciones`);
console.log("robots.txt: escrito");
