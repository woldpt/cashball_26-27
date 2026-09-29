/**
 * Regression test — camisolas fixas (client/public/kits).
 *
 * Regras em causa:
 *  - Um SVG de casa + um de fora por clube (120), viewBox 100x100, molde
 *    único (clipPath id="k"); a de fora só troca as cores (mesmo padrão).
 *  - Sem `<text>` nem `<image>` embutidos (o nome do patrocinador é escrito
 *    pelo TeamKit, não desenhado aqui).
 *  - kits.json cobre todos os clubes e só clubes.
 *
 * A paridade exata entre kits.json e os ficheiros em disco é o `--check` do
 * gerador (npx tsx scripts/generateKits.ts --check).
 *
 * Run: cd server && npm run test:kit
 */
import fs from "node:fs";
import path from "node:path";
import { TEAMS } from "./lib/teamsSource";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

function assertEq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${msg} — esperado ${expected}, obtido ${actual}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg} (${actual})`);
}

// kits.json: paridade com o plantel, padrões válidos
const kitsPath = path.join(import.meta.dirname, "..", "db", "fixtures", "kits.json");
const { kits } = JSON.parse(fs.readFileSync(kitsPath, "utf-8")) as { kits: Record<string, { pattern: string }> };
const PATTERNS = ["solid", "stripes", "hoops", "halves", "sash", "band", "shoulders"];
assertEq(Object.keys(kits).length, TEAMS.length, "kits.json com 60 clubes");
const unknown = Object.keys(kits).filter((slug) => !TEAMS.some((t) => t.slug === slug));
assert(!unknown.length, `kits.json só com clubes reais${unknown.length ? `: ${unknown.join(", ")}` : ""}`);
assert(TEAMS.every((t) => PATTERNS.includes(kits[t.slug]?.pattern)), "todos os padrões válidos");

// SVGs em disco: casa + fora por clube, válidos, e a de fora sempre distinta
const dir = path.join(import.meta.dirname, "..", "..", "client", "public", "kits");
const valid = (body: string) =>
  body.includes('viewBox="0 0 100 100"') &&
  body.includes('<clipPath id="k">') &&
  !body.includes("<text") &&
  !body.includes("<image");
const norm = (body: string) => body.replace(/aria-label="[^"]*"/g, "");
let ok = 0;
let sameAway = 0;
for (const t of TEAMS) {
  const home = path.join(dir, `${t.slug}.svg`);
  const awayF = path.join(dir, `${t.slug}_away.svg`);
  const hb = fs.existsSync(home) ? fs.readFileSync(home, "utf-8") : "";
  const ab = fs.existsSync(awayF) ? fs.readFileSync(awayF, "utf-8") : "";
  if (valid(hb) && valid(ab)) ok++;
  else console.error(`FAIL: camisola em falta/inválida: ${t.slug}`);
  if (norm(hb) === norm(ab)) {
    sameAway++;
    console.error(`FAIL: camisola de fora idêntica à de casa: ${t.slug}`);
  }
}
assertEq(ok, TEAMS.length, "camisolas casa+fora válidas (molde único, sem texto/imagem)");
assertEq(sameAway, 0, "nenhuma de fora idêntica à de casa");

console.log("\nPASS test:kit");
