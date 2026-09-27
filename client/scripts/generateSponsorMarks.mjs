#!/usr/bin/env node
/**
 * generateSponsorMarks.mjs — converte os logos de patrocinador em *marcas*
 * (símbolo apenas) para `client/public/sponsors/<id>.svg`.
 *
 * Antes: placa branca 84x116 + pictograma pequeno + nome prensado no rodapé
 * (`textLength="80"`), tudo com o mesmo molde — 60 etiquetas iguais.
 * Agora: fundo transparente, `viewBox="0 0 100 100"`, pictograma normalizado
 * (lado maior = 74, centrado) e uma silhueta branca por baixo para a marca
 * ler em qualquer cor de camisola. O nome deixa de ser desenhado no SVG
 * (era comprimido até 35%) e passa a texto HTML nos componentes.
 *
 * Idempotente: reconhece a própria saída (`data-art`) e re-normaliza.
 *
 * Uso:  node scripts/generateSponsorMarks.mjs [--check]
 *       (a partir de `client/`; precisa de playwright-core + chromium)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/sponsors");
/** Lado maior do pictograma dentro da caixa 100x100. */
const TARGET = 74;
/** Espessura da silhueta, em unidades da caixa final. */
const HALO = 5;
/** Correções manuais: id -> [regex, substituição]. */
const FIXUPS = {};

/** Extrai o pictograma do ficheiro atual (formato novo ou antigo). */
function extractArt(svg) {
  const wrapped = svg.match(/<g data-art[^>]*>([\s\S]*?)<\/g>/);
  if (wrapped) return wrapped[1];
  // formato antigo: entre a placa (primeiro <rect .../>) e o <text>
  const body = svg.slice(0, svg.indexOf("<text") === -1 ? undefined : svg.indexOf("<text"));
  const plate = body.match(/<rect[^>]*\/>/);
  return body.slice(plate ? plate.index + plate[0].length : body.indexOf(">") + 1);
}

/**
 * Silhueta: mesma geometria pintada de branco e engrossada. Mantém
 * `fill="none"` (formas só de contorno) para não tapar o interior, remove
 * tracejados/opacidades e arredonda as juntas.
 * @param {string} art
 * @param {number} scale
 */
function halo(art, scale) {
  const grow = HALO / scale;
  return art.replace(/<(rect|circle|ellipse|path)\b([^>]*?)\/>/g, (_, tag, attrs) => {
    const get = (k) => (attrs.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const w = Number(get("stroke-width")) || 0;
    const noFill = get("fill") === "none";
    return `<${tag}${attrs.replace(/\s*(fill|stroke|stroke-width|stroke-dasharray|opacity|stroke-linejoin|stroke-linecap)="[^"]*"/g, "")}` +
      `${noFill ? ' fill="none"' : ' fill="#fff"'} stroke="#fff" stroke-width="${w + grow}"` +
      ` stroke-linejoin="round" stroke-linecap="round"/>`;
  });
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg")).sort();
const jobs = files.map((f) => {
  const id = f.slice(0, -4);
  const svg = fs.readFileSync(path.join(DIR, f), "utf8");
  let art = extractArt(svg);
  for (const [re, rep] of FIXUPS[id] || []) art = art.replace(re, rep);
  const label = (svg.match(/aria-label="([^"]*)"/) || [])[1] || id;
  return { id, art: art.trim(), label };
});

// Bbox real medida pelo browser (paths com arcos e `transform` à mistura).
const { chromium } = await import("playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
});
const page = await browser.newPage();
await page.setContent(
  `<svg width="0" height="0" xmlns="http://www.w3.org/2000/svg">${jobs
    .map((j, i) => `<g id="m${i}">${j.art}</g>`)
    .join("")}</svg>`,
);
const boxes = await page.evaluate((n) =>
  Array.from({ length: n }, (_, i) => {
    const b = document.getElementById(`m${i}`).getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }),
  jobs.length,
);
await browser.close();

const out = jobs.map((j, i) => {
  const b = boxes[i];
  const scale = TARGET / Math.max(b.w, b.h);
  const tx = 50 - scale * (b.x + b.w / 2);
  const ty = 50 - scale * (b.y + b.h / 2);
  const t = `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(4)})`;
  return {
    id: j.id,
    body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${j.label}">\n<g transform="${t}"><g data-halo="1" fill="#fff">${halo(j.art, scale)}</g><g data-art="1">${j.art}</g></g>\n</svg>`,
    scale,
  };
});

if (process.argv.includes("--check")) {
  const drift = out.filter((o) => fs.readFileSync(path.join(DIR, `${o.id}.svg`), "utf8") !== o.body);
  console.log(drift.length ? `desatualizados: ${drift.map((d) => d.id).join(", ")}` : "tudo atualizado");
  process.exit(drift.length ? 1 : 0);
}

for (const o of out) {
  const before = fs.readFileSync(path.join(DIR, `${o.id}.svg`), "utf8");
  if (before !== o.body) fs.writeFileSync(path.join(DIR, `${o.id}.svg`), o.body);
}
const scales = out.map((o) => o.scale).sort((a, b) => a - b);
console.log(
  `${out.length} marcas · escala ${scales[0].toFixed(2)}–${scales[scales.length - 1].toFixed(2)} (mediana ${scales[Math.floor(scales.length / 2)].toFixed(2)})`,
);
