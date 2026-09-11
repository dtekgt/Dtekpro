#!/usr/bin/env node
/* ¿Está Vercel sirviendo lo último?
 *
 *   node scripts/verificar-despliegue.js
 *
 * No hace falta la CLI de Vercel ni entrar al panel. La idea es simple: cada
 * página enlaza sus archivos con ?v=<md5 de 8>, y ese hash sale del CONTENIDO
 * del archivo (lo sella generar-paginas-servicio.js). Entonces:
 *
 *   - Si el hash que sirve producción es igual al que da el archivo local,
 *     producción tiene exactamente ese contenido.
 *   - Si es distinto, el deploy todavía no salió o quedó a medias.
 *
 * Revisa tres cosas, en orden de lo que suele fallar:
 *   1. Que no haya nada sin commitear ni sin pushear (lo más común).
 *   2. Que el HTML de producción traiga los mismos hashes que los archivos
 *      locales.
 *   3. Que los archivos servidos de verdad tengan ese contenido (no solo que
 *      la URL lo diga).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "..");
const SITIO = process.env.DTEK_SITIO || "https://dtekpro.vercel.app";
// admin-backend.html va acá aunque no sea pública: es la que más se toca y la
// única cuyo JS no carga ninguna otra página, así que si su ?v= se queda atrás
// nadie más lo nota. Ya pasó: se arreglaba el reporte técnico, se subía, y el
// navegador de Dominic seguía con la copia vieja.
const PAGINAS = ["index.html", "servicios.html", "agenda.html", "cliente.html", "compra-segura.html", "admin-backend.html"];

const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;

function hashLocal(archivo) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) return null;
  return crypto.createHash("md5").update(fs.readFileSync(ruta)).digest("hex").slice(0, 8);
}

function git(cmd) {
  try { return execSync(`git ${cmd}`, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}

async function bajar(url) {
  const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}cb=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} en ${url}`);
  return r.text();
}

(async () => {
  let problemas = 0;

  /* Que version es. No hay package.json ni numero central: la generacion
     vigente se reconoce por el sufijo que usan las clases del CSS (v41 en el
     modelo 2026), y cliente.html lleva el sello data-dtek-version. Si los dos
     no coinciden, el sello quedo viejo. */
  const generacion = (() => {
    const css = fs.readFileSync(path.join(RAIZ, "styles-v30.css"), "utf8");
    const cuenta = {};
    for (const m of css.matchAll(/-v(\d{2})\b/g)) cuenta[m[1]] = (cuenta[m[1]] || 0) + 1;
    const orden = Object.keys(cuenta).sort((a, b) => Number(b) - Number(a));
    return orden[0] ? `v${orden[0]}` : "?";
  })();
  const sello = (fs.readFileSync(path.join(RAIZ, "cliente.html"), "utf8").match(/data-dtek-version="([^"]*)"/) || [])[1];

  console.log(`\n  D-TEK ${generacion}${sello ? gris(`  (sello del Garage: ${sello})`) : ""}`);
  if (sello && `v${parseInt(sello, 10)}` !== generacion) {
    console.log(`  ${rojo("x")} El sello de cliente.html dice ${sello} pero el CSS va en ${generacion}.`);
  }
  console.log(`\n  Comparando ${SITIO} contra esta carpeta.\n`);

  /* 1. git ------------------------------------------------------------- */
  const sucio = git("status --porcelain");
  const rama = git("rev-parse --abbrev-ref HEAD");
  git("fetch origin");
  const adelante = git(`rev-list --count origin/${rama}..HEAD`);

  if (sucio) {
    const n = sucio.split("\n").length;
    console.log(`  ${rojo("x")} Hay ${n} archivo(s) sin commitear. Eso NO está en Vercel.`);
    problemas++;
  } else {
    console.log(`  ${verde("ok")} Nada sin commitear.`);
  }

  if (adelante && Number(adelante) > 0) {
    console.log(`  ${rojo("x")} Hay ${adelante} commit(s) sin pushear. Vercel no los vio.`);
    problemas++;
  } else if (adelante !== null) {
    console.log(`  ${verde("ok")} Todo pusheado a GitHub.`);
  }

  console.log(gris(`     último commit: ${git("log --oneline -1") || "?"}\n`));

  /* 1.b archivos sellados que el sellador no conoce ---------------------
     Un archivo con ?v= que no esté en la lista ASSETS de
     generar-paginas-servicio.js se queda con el hash congelado: lo subís a
     Vercel, pero el navegador de quien ya visitó nunca lo vuelve a pedir.
     Pasó de verdad con vehicle-health.js, que además tenía dos números
     escritos a mano y distintos en dos páginas. */
  const gen = fs.readFileSync(path.join(RAIZ, "generar-paginas-servicio.js"), "utf8");
  const ini = gen.indexOf("const ASSETS = [");
  const declarados = new Set([...gen.slice(ini, gen.indexOf("];", ini)).matchAll(/"([^"]+)"/g)].map((m) => m[1]));

  const huerfanos = new Set();
  for (const p of fs.readdirSync(RAIZ).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(RAIZ, p), "utf8");
    for (const m of html.matchAll(/(?:href|src)="([a-z0-9.-]+\.(?:css|js))\?v=/g)) {
      if (!declarados.has(m[1])) huerfanos.add(m[1]);
    }
  }

  if (huerfanos.size) {
    console.log(`  ${rojo("x")} Estos llevan ?v= pero no están en ASSETS, así que su hash nunca cambia:`);
    huerfanos.forEach((h) => console.log(gris(`       ${h}`)));
    console.log(gris("     Agregalos a ASSETS en generar-paginas-servicio.js y volvé a sellar."));
    problemas++;
  } else {
    console.log(`  ${verde("ok")} Todos los archivos sellados están en la lista del sellador.`);
  }

  console.log("");

  /* 2. hashes en el HTML de producción --------------------------------- */
  const pendientes = new Map();

  for (const pagina of PAGINAS) {
    let html;
    try { html = await bajar(`${SITIO}/${pagina}`); }
    catch (e) { console.log(`  ${rojo("x")} ${pagina}: no se pudo bajar (${e.message})`); problemas++; continue; }

    const enLaPagina = [...html.matchAll(/(?:href|src)="([a-z0-9.-]+\.(?:css|js))\?v=([a-f0-9]{8})"/g)];
    if (!enLaPagina.length) { console.log(`  ${gris("-")} ${pagina}: sin archivos sellados.`); continue; }

    const malos = [];
    for (const [, archivo, hashRemoto] of enLaPagina) {
      const local = hashLocal(archivo);
      if (!local) continue;
      if (local !== hashRemoto) malos.push(`${archivo} (produccion ${hashRemoto}, local ${local})`);
      else pendientes.set(archivo, local);
    }

    if (malos.length) {
      console.log(`  ${rojo("x")} ${pagina}: ${malos.length} archivo(s) desfasado(s)`);
      malos.forEach((m) => console.log(gris(`       ${m}`)));
      problemas++;
    } else {
      console.log(`  ${verde("ok")} ${pagina}`);
    }
  }

  /* 3. el contenido servido coincide con el hash que dice la URL -------- */
  console.log("");
  for (const [archivo, esperado] of pendientes) {
    try {
      const texto = await bajar(`${SITIO}/${archivo}`);
      const real = crypto.createHash("md5").update(Buffer.from(texto, "utf8")).digest("hex").slice(0, 8);
      if (real === esperado) console.log(`  ${verde("ok")} ${archivo} ${gris("servido con el contenido correcto")}`);
      else console.log(`  ${rojo("x")} ${archivo} ${gris(`la URL dice ${esperado} pero el contenido da ${real}`)}`) , problemas++;
    } catch (e) {
      console.log(`  ${rojo("x")} ${archivo}: ${e.message}`);
      problemas++;
    }
  }

  console.log("");
  if (problemas === 0) {
    console.log(`  ${verde("Vercel está sirviendo exactamente lo que tenés local.")}\n`);
  } else {
    console.log(`  ${rojo(`${problemas} cosa(s) fuera de lugar.`)} Si recién pusheaste, esperá un minuto y corrélo de nuevo:`);
    console.log(gris("  Vercel tarda entre 30 y 90 segundos en publicar.\n"));
    process.exitCode = 1;
  }
})();
