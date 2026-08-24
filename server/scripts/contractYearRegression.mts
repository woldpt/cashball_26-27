/**
 * Regression test — designação de contratos "Ano 1, J1" → "2026, Jornada 1".
 *
 * A designação de fim de contrato ("J{n} da época {s}" / "J{n} · E{s}") é
 * substituída por "{ano}, Jornada {n}", onde ano = 2025 + época (a época 1
 * começa em 2026 — invariante do servidor: game.year = 2025 + game.season).
 *
 * Guardas:
 *   1. seasonToYear() mapeia época → ano civil (2025 + época).
 *   2. contractEndInfo() + seasonToYear() produzem a designação nova.
 *   3. Nenhuma string visível com a designação antiga ("da época", "J..·E..")
 *      sobrevive no cliente ou no servidor.
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
    matchweek: number;
  };
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── 1. Época → ano civil ───────────────────────────────────────────────────
assert(seasonToYear(1) === 2026, "seasonToYear(1) === 2026");
assert(seasonToYear(2) === 2027, "seasonToYear(2) === 2027");

// ── 2. Designação nova a partir de contractEndInfo ─────────────────────────
// Contrato iniciado na época 1 (epoch 1) termina 14 jornadas depois:
// época 2, Jornada 1 → "2027, Jornada 1".
const end = contractEndInfo({ contract_start_epoch: 1 });
const label = `${seasonToYear(end.season)}, Jornada ${end.matchweek}`;
assert(label === "2027, Jornada 1", `designação nova: "${label}"`);

// ── 3. Designação antiga eliminada dos ficheiros visíveis ──────────────────
const files = [
  "../../client/src/components/modals/PlayerHistoryModal.jsx",
  "../../client/src/hooks/useSocketListeners.js",
  "../socketTransferHandlers.ts",
  "../auctionHelpers.ts",
].map((f) => path.join(__dirname, f));

for (const f of files) {
  const src = readFileSync(f, "utf8");
  assert(
    !src.includes("da época"),
    `${path.basename(f)}: sem "da época" (designação antiga)`,
  );
}

const clientListeners = readFileSync(
  path.join(__dirname, "../../client/src/hooks/useSocketListeners.js"),
  "utf8",
);
assert(
  !/J\$\{[^}]*\} · E\$\{/.test(clientListeners),
  "useSocketListeners: sem estatística 'J..·E..' (designação antiga)",
);

// A nova designação está presente nos sítios-chave.
assert(
  clientListeners.includes(", Jornada "),
  "useSocketListeners: designação nova '{ano}, Jornada {n}' presente",
);
assert(
  readFileSync(
    path.join(__dirname, "../../client/src/components/modals/PlayerHistoryModal.jsx"),
    "utf8",
  ).includes(", Jornada "),
  "PlayerHistoryModal: designação nova presente",
);
assert(
  readFileSync(
    path.join(__dirname, "../socketTransferHandlers.ts"),
    "utf8",
  ).includes(", Jornada "),
  "socketTransferHandlers: designação nova presente",
);

console.log("\n✅ contractYearRegression: all checks passed");
