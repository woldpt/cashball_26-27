#!/usr/bin/env node
/**
 * sponsorSheet — folha de contacto das marcas de patrocinador para aceite visual.
 *
 * Desenha as 60 de `public/sponsors/` a 44px (com o id, para identificar) e a
 * 22px (o tamanho real do remendo na camisola, `TeamKit.jsx`) sobre as cores de
 * fundo que interessam: claro, creme, navy e escuro. Só a 22px se vê o que
 * falha — a marca que não se lê aí não serve, por muito boa que esteja a 96px.
 *
 * Uso:  node scripts/sponsorSheet.mjs [saida.png]
 *       (a partir de `client/`; precisa de playwright-core + chromium)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/sponsors");
const OUT = process.argv[2] || "/tmp/cashball-sponsor-sheet.png";
/** [fundo, descrição] — as cores de camisola e de página em que a marca aparece. */
const BGS = [
  ["#ffffff", "claro"],
  ["#f5f5dc", "creme"],
  ["#1e3a8a", "navy"],
  ["#111827", "escuro"],
];

const marks = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".svg"))
  .sort()
  .map((f) => ({ id: f.slice(0, -4), svg: fs.readFileSync(path.join(DIR, f), "utf8") }));

/** SVG inline na largura pedida (sub-recursos `file://` não carregam em `setContent`). */
const at = (m, size) => m.svg.replace("<svg ", `<svg width="${size}" height="${size}" `);

const labelled = (bg) =>
  `<div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;background:${bg};padding:8px">` +
  marks
    .map(
      (m) =>
        `<figure style="margin:0;text-align:center">${at(m, 44)}` +
        `<figcaption style="font:9px/1.2 system-ui;color:#888">${m.id}</figcaption></figure>`,
    )
    .join("") +
  `</div>`;

const strip = (bg) =>
  `<div style="display:flex;flex-wrap:wrap;gap:2px;background:${bg};padding:6px 8px">` +
  marks.map((m) => at(m, 22)).join("") +
  `</div>`;

const { chromium } = await import("playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
});
const page = await browser.newPage({ viewport: { width: 760, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(
  `<body style="margin:0;background:#e5e5e5">` +
    BGS.map(([bg, name]) => `<p style="font:11px system-ui;margin:6px 8px 0">${name} ${bg}</p>${strip(bg)}${labelled(bg)}`).join("") +
    `<p style="font:11px system-ui;margin:6px 8px 0">craft 96px</p>${labelled("#ffffff").replace(/width="44" height="44"/g, 'width="96" height="96"').replace(/repeat\(10,1fr\)/, "repeat(5,1fr)")}` +
    `</body>`,
);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log(`${marks.length} marcas → ${OUT}`);
