/**
 * Regression test — histórico de skill preserva a época em jogos com várias épocas.
 *
 * Root cause: o handler `requestPlayerHistory` (socketSessionHandlers.ts)
 * descartava a coluna `season` dos `player_skill_snapshots` ao mapear para o
 * cliente. Como o `matchweek` é por época (1..14), o gráfico frontend
 * (SkillLineChart) ordenava/posicionava por matchweek apenas → os pontos da
 * época actual caíam nos mesmos X da época 1 (linha em zigzag, últimos
 * registos invisíveis).
 *
 * Fix: `buildSkillHistory()` em coreHelpers.ts preserva `season` em cada ponto
 * e anexa o valor actual com a época actual (dedupe por season+matchweek).
 *
 * Run: cd server && npm run test:skillhistory
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildSkillHistory } = require("../coreHelpers.ts") as {
  buildSkillHistory: typeof import("../coreHelpers").buildSkillHistory;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── 1. Season preservada no mapping ─────────────────────────────────────────
const history = buildSkillHistory(
  [
    { matchweek: 1, season: 1, skill: 30 },
    { matchweek: 14, season: 1, skill: 35 },
    { matchweek: 1, season: 2, skill: 36 },
    { matchweek: 5, season: 2, skill: 40 },
  ],
  { matchweek: 6, season: 2, skill: 41 },
);

assert(history.length === 5, "5 pontos (4 snapshots + 1 actual)");
assert(
  JSON.stringify(history[2]) === JSON.stringify({ matchweek: 1, season: 2, skill: 36 }),
  "season 2 preservada nos snapshots (não colapsa com a época 1)",
);
assert(
  JSON.stringify(history[history.length - 1]) ===
    JSON.stringify({ matchweek: 6, season: 2, skill: 41 }),
  "ponto actual anexado com season 2, matchweek 6",
);

// ── 2. Dedupe por (season, matchweek) — não duplica o snapshot actual ───────
const deduped = buildSkillHistory(
  [{ matchweek: 5, season: 2, skill: 40 }],
  { matchweek: 5, season: 2, skill: 40 },
);
assert(deduped.length === 1, "mesmo (season, matchweek) não duplica");

// Mas o MESMO matchweek numa OUTRA época NÃO é duplicado
const crossSeason = buildSkillHistory(
  [{ matchweek: 5, season: 1, skill: 33 }],
  { matchweek: 5, season: 2, skill: 40 },
);
assert(
  crossSeason.length === 2 && crossSeason[1].season === 2,
  "matchweek 5 da época 2 NÃO é dedupe do matchweek 5 da época 1",
);

// ── 3. Sem snapshots — só o ponto actual ────────────────────────────────────
const empty = buildSkillHistory([], { matchweek: 3, season: 1, skill: 32 });
assert(
  empty.length === 1 &&
    empty[0].season === 1 &&
    empty[0].matchweek === 3 &&
    empty[0].skill === 32,
  "sem snapshots → apenas o ponto actual com a sua época",
);

console.log("\nTodos os testes passaram ✔");
