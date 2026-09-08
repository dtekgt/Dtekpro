/*
  Genera styles-public.css y styles-v30-public.css.

  El problema: las 54 paginas publicas cargaban los mismos 446 KB de CSS que el
  Garage y el panel admin, y usaban menos de la mitad. Media descarga tirada en
  cada primera visita.

  Que hace: recorre el CSS regla por regla y descarta las que solo pueden aplicar
  al Garage o al admin. Una regla se CONSERVA si cualquiera de sus clases aparece
  en un archivo publico, o si no tiene clases (body, :root, h1, keyframes,
  variables). Ante la duda, se conserva.

  Que NO toca: cliente.html y las paginas de admin siguen cargando styles.css y
  styles-v30.css completos, con el mismo orden de cascada que siempre. El recorte
  aplica solo a lo publico, que es lo que se puede verificar entero en el navegador.

  Correr despues de tocar styles.css o styles-v30.css:
      node scripts/generar-css-publico.js
      node generar-paginas-servicio.js     (para resellar los ?v=)
*/
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");

// Archivos que solo existen del lado privado. Sus clases son candidatas a recorte.
const GARAGE = [
  "cliente.html", "portal-cliente.js", "vehicle-health.js", "expediente.js",
  "referidos.js", "client-booking.js", "reset-password.html", "reset-password.js",
];
const ADMIN = ["admin-backend.html", "admin.html", "backend-admin.js", "zapier.html"];

function listar(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", ".claude", "referencias", "scripts", "node_modules"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listar(p, ext));
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
}

const tokensPublicos = new Set();
for (const f of listar(RAIZ, /\.(html|js)$/)) {
  const base = path.basename(f);
  if (GARAGE.includes(base) || ADMIN.includes(base) || base === "generar-paginas-servicio.js") continue;
  for (const m of fs.readFileSync(f, "utf8").matchAll(/[A-Za-z_][A-Za-z0-9_-]{1,60}/g)) {
    tokensPublicos.add(m[0]);
  }
}

/* ---------- parser: arbol de nodos, respetando comentarios y strings ---------- */

function parsear(css) {
  let i = 0;
  const saltarRuido = () => {
    for (;;) {
      if (css.startsWith("/*", i)) { const f = css.indexOf("*/", i + 2); i = f === -1 ? css.length : f + 2; }
      else if (/\s/.test(css[i])) i++;
      else return;
    }
  };
  const leerPrelude = () => {
    const ini = i;
    let d = 0;
    while (i < css.length) {
      const c = css[i];
      if (c === "/" && css[i + 1] === "*") { const f = css.indexOf("*/", i + 2); i = f === -1 ? css.length : f + 2; continue; }
      if (c === '"' || c === "'") { const q = c; i++; while (i < css.length && css[i] !== q) { if (css[i] === "\\") i++; i++; } i++; continue; }
      if (c === "(") d++;
      if (c === ")") d--;
      if (d === 0 && (c === "{" || c === ";")) break;
      i++;
    }
    return css.slice(ini, i);
  };
  const leerNodos = (anidado) => {
    const nodos = [];
    for (;;) {
      saltarRuido();
      if (i >= css.length) break;
      if (anidado && css[i] === "}") { i++; break; }
      const prelude = leerPrelude();
      if (css[i] === ";") { i++; nodos.push({ tipo: "decl", texto: prelude.trim() + ";" }); continue; }
      if (css[i] !== "{") break;
      i++;
      if (/^\s*@(media|supports|container|layer|scope)\b/.test(prelude)) {
        nodos.push({ tipo: "at", prelude: prelude.trim(), hijos: leerNodos(true) });
      } else {
        const ini = i;
        let d = 1;
        while (i < css.length && d > 0) {
          const c = css[i];
          if (c === "/" && css[i + 1] === "*") { const f = css.indexOf("*/", i + 2); i = f === -1 ? css.length : f + 2; continue; }
          if (c === '"' || c === "'") { const q = c; i++; while (i < css.length && css[i] !== q) { if (css[i] === "\\") i++; i++; } i++; continue; }
          if (c === "{") d++;
          if (c === "}") d--;
          if (d === 0) break;
          i++;
        }
        nodos.push({ tipo: "regla", prelude: prelude.trim(), cuerpo: css.slice(ini, i) });
        i++;
      }
    }
    return nodos;
  };
  return leerNodos(false);
}

/* Parte la lista de selectores por las comas de primer nivel: las comas dentro
   de :is(), :where() o :not() no separan reglas. */
function partesDeSelector(prelude) {
  const partes = [];
  let prof = 0, actual = "";
  for (const c of prelude) {
    if (c === "(") prof++;
    if (c === ")") prof--;
    if (c === "," && prof === 0) { partes.push(actual); actual = ""; continue; }
    actual += c;
  }
  partes.push(actual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

/* Un selector descendente o compuesto (".a .b", ".a.b") solo coincide si TODAS
   sus clases están presentes en la cadena. Basta con que una sea exclusiva del
   Garage o del admin para que ninguna página pública pueda coincidir.

   Al revés —conservar si ALGUNA clase es pública— parecía razonable pero se
   equivocaba con las clases de estado cortas: ".semaforo-veredicto.warn" se
   conservaba porque "warn" aparece en el JS público dentro de console.warn, y
   "ok" aparece como identificador en cualquier lado. Así se colaban cientos de
   reglas del Garage al CSS público. */
function partePublica(parte) {
  const clases = [...parte.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
  if (!clases.length) return true; // body, :root, h1, #id, *
  return clases.every((c) => tokensPublicos.has(c));
}

function conservar(nodo) {
  if (nodo.tipo === "decl") return true;
  if (nodo.tipo === "at") return nodo.hijos.some(conservar);
  if (nodo.prelude.startsWith("@")) return true; // keyframes, font-face, page
  return partesDeSelector(nodo.prelude).some(partePublica);
}

/* Si una regla agrupaba varios selectores y solo algunos aplican a lo público,
   se emite con esos: arrastrar los demás vuelve a inflar el archivo. */
function preludeRecortado(prelude) {
  const partes = partesDeSelector(prelude);
  const vivas = partes.filter(partePublica);
  return vivas.length === partes.length ? prelude : vivas.join(",");
}

function serializar(nodos) {
  const out = [];
  for (const n of nodos) {
    if (!conservar(n)) continue;
    if (n.tipo === "decl") out.push(n.texto);
    else if (n.tipo === "at") out.push(`${n.prelude}{${serializar(n.hijos)}}`);
    else out.push(`${preludeRecortado(n.prelude)}{${n.cuerpo}}`);
  }
  return out.join("\n");
}

const AVISO =
  "/* GENERADO por scripts/generar-css-publico.js - no editar a mano.\n" +
  "   Version recortada para paginas publicas. Editar styles.css / styles-v30.css. */\n";

for (const [orig, destino] of [
  ["styles.css", "styles-public.css"],
  ["styles-v30.css", "styles-v30-public.css"],
]) {
  const css = fs.readFileSync(path.join(RAIZ, orig), "utf8");
  const salida = AVISO + serializar(parsear(css)) + "\n";
  fs.writeFileSync(path.join(RAIZ, destino), salida, "utf8");
  const kb = (s) => (Buffer.byteLength(s, "utf8") / 1024).toFixed(1);
  const pct = (100 - (Buffer.byteLength(salida) / Buffer.byteLength(css)) * 100).toFixed(1);
  console.log(`${orig.padEnd(15)} ${kb(css).padStart(7)} KB  ->  ${destino.padEnd(22)} ${kb(salida).padStart(7)} KB   -${pct}%`);
}
