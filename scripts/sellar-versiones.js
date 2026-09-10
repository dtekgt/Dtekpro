#!/usr/bin/env node
/*
  Sella los ?v= de cada .css y .js con los primeros 8 del md5 del archivo.

  Por que existe: _headers y vercel.json sirven js y css como
  "immutable, max-age=31536000". Si el ?v= no cambia cuando cambia el archivo,
  el navegador se queda con la copia vieja UN ANO y ninguna correccion le
  llega. Asi paso con vehicle-health.js, que traia un numero escrito a mano
  (?v=36000001) en vez del hash: era el unico archivo del sitio fuera del
  sellado, y es justo el que le da al panel de admin la lista de areas para
  inspeccionar.

  Uso:  node scripts/sellar-versiones.js          (sella)
        node scripts/sellar-versiones.js --check  (solo revisa; sale 1 si hay desfase)
*/
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const raiz = path.resolve(__dirname, "..");
const soloRevisar = process.argv.includes("--check");
const hash = (archivo) => crypto.createHash("md5").update(fs.readFileSync(archivo)).digest("hex").slice(0, 8);

function paginas(dir = raiz, acc = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) paginas(completo, acc);
    else if (entrada.name.endsWith(".html")) acc.push(completo);
  }
  return acc;
}

let cambiadas = 0;
let desfasadas = 0;

for (const pagina of paginas()) {
  const original = fs.readFileSync(pagina, "utf8");
  const nuevo = original.replace(/(href|src)="([^":?]+\.(?:css|js))(\?v=[^"]*)?"/g, (todo, attr, ref, query) => {
    if (/^(https?:)?\/\//.test(ref)) return todo;
    const destino = ref.startsWith("/") ? path.join(raiz, ref.slice(1)) : path.join(path.dirname(pagina), ref);
    if (!fs.existsSync(destino)) return todo;
    const sello = hash(destino);
    if (query === `?v=${sello}`) return todo;
    desfasadas += 1;
    console.log(`${soloRevisar ? "DESFASADO" : "sellado  "} ${path.relative(raiz, pagina)} -> ${ref} ${query || "(sin ?v=)"} => ?v=${sello}`);
    return `${attr}="${ref}?v=${sello}"`;
  });
  if (nuevo !== original && !soloRevisar) {
    fs.writeFileSync(pagina, nuevo);
    cambiadas += 1;
  }
}

if (soloRevisar) {
  console.log(desfasadas ? `\n${desfasadas} referencia(s) desfasada(s). Corre: node scripts/sellar-versiones.js` : "Todas las referencias estan selladas al dia.");
  process.exit(desfasadas ? 1 : 0);
}
console.log(desfasadas ? `\n${desfasadas} referencia(s) resellada(s) en ${cambiadas} pagina(s).` : "Nada que resellar.");
