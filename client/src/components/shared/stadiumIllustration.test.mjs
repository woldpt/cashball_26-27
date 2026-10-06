// Self-check do StadiumIllustration: geometria sem NaN e orçamento de pontos.
// Run: cd client && npm run test:stadium   (SVG_OUT=dir grava os SVG)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { transformWithOxc } from "vite";
import assert from "node:assert";

const src = readFileSync(new URL("./StadiumIllustration.jsx", import.meta.url), "utf8")
  .replace("../../constants/index.js", new URL("../../constants/index.js", import.meta.url).href);
const { code } = await transformWithOxc(src, "s.jsx", { jsx: { runtime: "automatic" } });
// Ficheiro temporário dentro de node_modules para resolver "react".
const tmp = new URL("../../../node_modules/.cache/stadium-check.mjs", import.meta.url);
mkdirSync(new URL(".", tmp), { recursive: true });
writeFileSync(tmp, code);
const { StadiumIllustration } = await import(tmp.href);
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");

const out = process.env.SVG_OUT;
if (out) mkdirSync(out, { recursive: true });
for (const capacity of [0, 3000, 5000, 10000, 15000, 30000, 50000, 80000, 120000, NaN]) {
  for (const [mood, seed] of [[10, null], [30, null], [50, null], [30, 1], [30, 2], [30, 3], [30, 8], [30, 12], [50, "x"]]) {
    const svg = renderToStaticMarkup(
      createElement(StadiumIllustration, { capacity, mood, seed, primary: "#c8102e", secondary: "#ffffff" }),
    );
    assert(!svg.includes("NaN"), `NaN cap=${capacity} mood=${mood} seed=${seed}`);
    const dots = (svg.match(/<circle/g) || []).length;
    assert(dots <= 1300, `pontos=${dots} cap=${capacity} mood=${mood}`);
    if (out) writeFileSync(`${out}/s-${capacity}-${mood}${seed == null ? "" : `-${seed}`}.svg`, svg);
  }
}
for (const weather of ["sol", "chuva", "chuva_forte", "vento", "frio", "nevoeiro", "neve", "x"]) {
  const svg = renderToStaticMarkup(createElement(StadiumIllustration, { capacity: 30000, weather }));
  assert(!svg.includes("NaN"), `NaN weather=${weather}`);
  if (out) writeFileSync(`${out}/w-${weather}.svg`, svg);
}
console.log("ok");
