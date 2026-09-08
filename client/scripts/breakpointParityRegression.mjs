#!/usr/bin/env node
/**
 * Breakpoint parity regression.
 *
 * Garante que os breakpoints do layout têm uma única fonte de verdade:
 *   `client/src/constants/breakpoints.js`
 * e que o resto do código não recria esses números à mão (a causa clássica
 * de bugs de responsividade mobile portrait × landscape: um hook JS com
 * `max-width: 767px` divergir do `lg:` do Tailwind, etc.).
 *
 * Verifica:
 *   1. BREAKPOINTS (md=768, lg=1024) e HEIGHTS (short=560, compact=520) batem
 *      com os valores documentados usados pelo Tailwind / `index.css`.
 *   2. `index.css` continua a declarar os mesmos valores (`@custom-variant
 *      short (max-height: 560px)` e `--breakpoint-md/-lg`).
 *   3. Nenhum `matchMedia(...)` no `src` embute os px destes breakpoints
 *      (devem ser derivados de constants/breakpoints.js).
 *
 * Exit code: 0 = OK, 1 = falha (desvio de fonte de verdade).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const srcRoot = resolve(import.meta.dirname, "..", "src");
const cssFile = join(srcRoot, "index.css");
const bpFile = join(srcRoot, "constants", "breakpoints.js");

// Números de breakpoint que nunca devem ser re-escritos à mão num matchMedia JS.
const GUARD_PX = ["767", "768", "1023", "1024", "519", "520", "559", "560"];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// ── 1. Esperado documentado ─────────────────────────────────────────────
const EXPECTED = { md: 768, lg: 1024, short: 560, compact: 520 };

// ── 2. Lê a fonte de verdade ─────────────────────────────────────────────
const bpSrc = readFileSync(bpFile, "utf8");
const grab = (re, label) => {
  const m = bpSrc.match(re);
  if (!m) {
    fail(`constants/breakpoints.js sem "${label}".`);
    return null;
  }
  return Number(m[1]);
};
const gotMd = grab(/md:\s*(\d+)/, "md");
const gotLg = grab(/lg:\s*(\d+)/, "lg");
const gotShort = grab(/short:\s*(\d+)/, "short");
const gotCompact = grab(/compact:\s*(\d+)/, "compact");

for (const [key, expected] of Object.entries(EXPECTED)) {
  const got = { md: gotMd, lg: gotLg, short: gotShort, compact: gotCompact }[key];
  if (got === expected) ok(`BREAKPOINTS/HEIGHTS.${key} = ${got}px (esperado).`);
  else fail(`BREAKPOINTS/HEIGHTS.${key} = ${got}px, esperado ${expected}px.`);
}

// ── 3. index.css sincronizado ────────────────────────────────────────────
const css = readFileSync(cssFile, "utf8");
const cssOk = (re, label) => {
  const m = css.match(re);
  if (!m) {
    fail(`index.css: falta "${label}".`);
    return;
  }
  ok(`${label} em index.css = ${m[1]}px.`);
};
cssOk(/@custom-variant short \(@media \(max-height:\s*(\d+)px\)\)/, "short height");
cssOk(/--breakpoint-md:\s*(\d+)px/, "--breakpoint-md");
cssOk(/--breakpoint-lg:\s*(\d+)px/, "--breakpoint-lg");

// ── 4. Nenhum matchMedia em src com os px embutidos ──────────────────────
/** Percorre ficheiros .js/.jsx/.mjs sob um diretório. */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx|mjs)$/.test(name)) acc.push(p);
  }
  return acc;
}
const jsFiles = walk(srcRoot);
let leaked = 0;
for (const file of jsFiles) {
  const txt = readFileSync(file, "utf8");
  // Ignora imports/refs à própria fonte de verdade e ficheiros de regressão.
  if (file.includes("constants/breakpoints.js") || file.endsWith("useIsMobile.js"))
    continue;
  // MatchMedia com breakpoint px embutido é o bug que queremos apanhar.
  if (/matchMedia\s*\(/.test(txt)) {
    for (const px of GUARD_PX) {
      if (new RegExp(`matchMedia\\([^)]*${px}px`).test(txt)) {
        leaked += 1;
        console.error(`  ✗ ${file.replace(srcRoot + "/", "")}: matchMedia com ${px}px embutido.`);
      }
    }
  }
}
if (leaked === 0) ok("Nenhum matchMedia em src embute os px dos breakpoints.");
else fail(`${leaked} matchMedia(s) com breakpoints embutidos no src.`);

// ── Resumo ──────────────────────────────────────────────────────────────
console.log("");
if (failures === 0) {
  console.log("breakpoint parity: OK — fonte de verdade única respeitada.");
  process.exit(0);
} else {
  console.error(`breakpoint parity: ${failures} desvio(s).`);
  process.exit(1);
}
