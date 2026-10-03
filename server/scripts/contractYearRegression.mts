/**
 * Regression test — designação de fim de contrato.
 *
 * A designação antiga ("J{n} da época {s}" / "J{n} · E{s}") foi substituída
 * por "{ano}, {semana}", com o ano = 2025 + época (época 1 começa em 2026 —
 * invariante do servidor: `game.year = 2025 + game.season`). A semana vem do
 * slot do calendário (1..20) via `contractWeekLabel` → "Semana N" — o contrato
 * expira num slot do calendário, não numa jornada da liga (que se repete nas
 * semanas de Taça).
 *
 * Guardas:
 *   1. `seasonToYear()` mapeia época → ano civil (2025 + época).
 *   2. `contractEndInfo()` devolve época/slot/label coerentes com a epoch do
 *      contrato (`contract_start_epoch + CONTRACT_LENGTH_WEEKS`).
 *   3. Nenhum texto VISÍVEL (comentários fora) guarda a designação antiga, nos
 *      ficheiros que a produzem — servidor e cliente.
 *   4. Os sítios-chave compõem a designação nova a partir do produto
 *      (`seasonToYear(...)` + `contractWeekLabel(...)`/`end.label`).
 *
 * Run: cd server && npm run test:contractyear
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { seasonToYear, contractEndInfo } = require("../coreHelpers.ts") as {
  seasonToYear: (season: number) => number;
  contractEndInfo: (player: { contract_start_epoch?: number }) => {
    season: number;
    slot: number;
    matchweek: number;
    label: string;
  };
};

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
  console.log(`ok  - ${msg} (${JSON.stringify(actual)})`);
}

// ── 1. Época → ano civil ───────────────────────────────────────────────────
assertEq(seasonToYear(1), 2026, "seasonToYear(1) === 2026");
assertEq(seasonToYear(2), 2027, "seasonToYear(2) === 2027");

// ── 2. Designação nova a partir de contractEndInfo (valores do produto) ────
// Contrato assinado no slot 1 da época 1 (epoch 1) dura 20 semanas → acaba no
// slot 1 da época 2: "2027, Semana 1".
const end1 = contractEndInfo({ contract_start_epoch: 1 });
assertEq(end1.season, 2, "epoch 1 termina na época 2");
assertEq(end1.slot, 1, "epoch 1 termina no slot 1");
assertEq(end1.label, "Semana 1", "rótulo do produto: 'Semana N' (slot do calendário)");
assertEq(
  `${seasonToYear(end1.season)}, ${end1.label}`,
  "2027, Semana 1",
  "designação final montada como no servidor",
);

// Contrato assinado no slot 5 (epoch 5) → termina no slot 5 da época 2.
const end5 = contractEndInfo({ contract_start_epoch: 5 });
assertEq(
  `${seasonToYear(end5.season)}, ${end5.label}`,
  "2027, Semana 5",
  "designação de um contrato a meio da época",
);

// Sem contrato (epoch 0): travessão, nunca "NaN" nem ano 2025.
const end0 = contractEndInfo({ contract_start_epoch: 0 });
assertEq(end0.label, "—", "sem contrato a designação é um travessão");

// ── 3. Designação antiga eliminada dos ficheiros visíveis ──────────────────
// (texto VISÍVEL: os comentários são ignorados — um comentário que diga
// "histórico de transferências da época atual" não é designação de contrato.)
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const files = [
  "../../client/src/components/modals/PlayerHistoryModal.jsx",
  "../../client/src/hooks/socket/helpers.js",
  "../../client/src/hooks/socket/market.js",
  "../socketTransferHandlers.ts",
  "../auctionHelpers.ts",
].map((f) => path.join(__dirname, f));

for (const f of files) {
  const src = stripComments(readFileSync(f, "utf8"));
  assert(
    !src.includes("da época"),
    `${path.basename(f)}: sem "da época" (designação antiga)`,
  );
  assert(
    !/J\$\{[^}]*\} · E\$\{/.test(src),
    `${path.basename(f)}: sem a estatística 'J..·E..' (designação antiga)`,
  );
}

// ── 4. A designação nova é composta nos sítios-chave ───────────────────────
const read = (rel: string) => readFileSync(path.join(__dirname, rel), "utf8");
const serverLabel = (rel: string) =>
  read(rel).includes("seasonToYear(end.season)") && read(rel).includes("end.label");

assert(
  serverLabel("../socketTransferHandlers.ts"),
  "socketTransferHandlers: mensagem usa seasonToYear(end.season) + end.label",
);
assert(
  serverLabel("../auctionHelpers.ts"),
  "auctionHelpers: mensagem usa seasonToYear(end.season) + end.label",
);

const clientHelpers = read("../../client/src/hooks/socket/helpers.js");
assert(
  clientHelpers.includes("seasonToYear(contractEndSeason)") &&
    clientHelpers.includes("contractWeekLabel("),
  "cliente (helpers): seasonToYear + contractWeekLabel",
);
const clientModal = read("../../client/src/components/modals/PlayerHistoryModal.jsx");
assert(
  clientModal.includes("seasonToYear(contractEndSeason)") &&
    clientModal.includes("contractWeekLabel("),
  "PlayerHistoryModal: seasonToYear + contractWeekLabel",
);

console.log("\n✅ contractYearRegression: all checks passed");
