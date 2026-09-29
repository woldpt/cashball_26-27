/**
 * Regression test — camisolas fixas (client/public/kits).
 *
 * Regras em causa:
 *  - Um SVG por clube (60), viewBox 100x100, molde único (clipPath id="k").
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

// SVGs em disco: 60 válidos, molde único
const dir = path.join(import.meta.dirname, "..", "..", "client", "public", "kits");
let ok = 0;
for (const t of TEAMS) {
  const p = path.join(dir, `${t.slug}.svg`);
  const body = fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
  const valid =
    body.includes('viewBox="0 0 100 100"') &&
    body.includes('<clipPath id="k">') &&
    !body.includes("<text") &&
    !body.includes("<image");
  if (valid) ok++;
  else console.error(`FAIL: camisola em falta/inválida: ${t.slug}`);
}
assertEq(ok, TEAMS.length, "camisolas SVG válidas (molde único, sem texto/imagem)");

console.log("\nPASS test:kit");
