/**
 * Regression — "nem sempre festeja o golo" (GoalFlashOverlay).
 *
 * Root cause (confirmed): o overlay consumia um único timestamp máximo
 * (`bestTs`) por render e o produtor colapsava golos do mesmo lado na mesma
 * chave (`fixture_lado`). Dois golos no mesmo minuto — mesmo de lados
 * opostos — geravam um único festejo; o outro golo entrava em silêncio.
 *
 * Contrato codificado:
 *   S1 — 1 golo → 1 momento; segunda leitura sem golos novos → 0 (sem replay);
 *   S2 — 2 golos de lados opostos no mesmo minuto → 2 momentos;
 *   S3 — 2 golos do MESMO lado no mesmo minuto (contador n 0→2) → 2 momentos;
 *   S4 — timestamp velho (>2200ms) → 0 (golos fora do direto não festejam);
 *   S5 — formato legado (número) continua a dar 1 momento e o flash numérico
 *        (`isFlashing`) funciona nos dois formatos;
 *   S6 — reutilização da chave noutra jornada (n monótono, ts novo) → só os
 *        golos novos festejam.
 *
 * Run: cd client && npm run test:goalflash
 */
import {
  isFlashing,
  readGoalFlashEntry,
  freshGoalFlashes,
} from "../src/components/live/liveHelpers.js";

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok  - ${msg}`);
  }
}

const NOW = 1_700_000_000_000;
const freshConsumed = () => ({ home: { ts: 0, n: 0 }, away: { ts: 0, n: 0 } });

/* ── S1: um golo festeja uma vez, sem replay ───────────────────────────── */
{
  const consumed = freshConsumed();
  const ref = { "1_2_home": { ts: NOW, n: 1 } };
  const first = freshGoalFlashes(ref, 1, 2, consumed, NOW);
  check(
    first.length === 1 && first[0].side === "home" && first[0].ts === NOW,
    "S1: 1 golo → 1 momento (lado + ts certos)",
  );
  const second = freshGoalFlashes(ref, 1, 2, consumed, NOW + 500);
  check(second.length === 0, "S1: sem golos novos → 0 momentos (sem replay)");
}

/* ── S2: dois golos, lados opostos, mesmo minuto ───────────────────────── */
{
  const consumed = freshConsumed();
  const ref = {
    "1_2_home": { ts: NOW, n: 1 },
    "1_2_away": { ts: NOW, n: 1 }, // mesmo ms: Date.now() nem os distingue
  };
  const moments = freshGoalFlashes(ref, 1, 2, consumed, NOW);
  check(
    moments.length === 2,
    `S2: 2 golos (casa+fora) no mesmo minuto → 2 momentos (deu ${moments.length})`,
  );
  check(
    moments.some((m) => m.side === "home") && moments.some((m) => m.side === "away"),
    "S2: um momento por lado",
  );
}

/* ── S3: dois golos do mesmo lado no mesmo minuto ──────────────────────── */
{
  const consumed = freshConsumed();
  // Estado final após dois setGoalFlashRef batched na mesma chave.
  const ref = { "1_2_home": { ts: NOW, n: 2 } };
  const moments = freshGoalFlashes(ref, 1, 2, consumed, NOW);
  check(
    moments.length === 2 && moments.every((m) => m.side === "home"),
    `S3: 2 golos do mesmo lado no mesmo minuto → 2 momentos (deu ${moments.length})`,
  );
}

/* ── S4: golos velhos não festejam ─────────────────────────────────────── */
{
  const consumed = freshConsumed();
  const ref = { "1_2_home": { ts: NOW - 5000, n: 1 } };
  check(
    freshGoalFlashes(ref, 1, 2, consumed, NOW).length === 0,
    "S4: timestamp com >2200ms → 0 momentos",
  );
}

/* ── S5: formato legado + flash numérico ───────────────────────────────── */
{
  const consumed = freshConsumed();
  const ref = { "1_2_away": NOW }; // número (pré-contador)
  const moments = freshGoalFlashes(ref, 1, 2, consumed, NOW);
  check(
    moments.length === 1 && moments[0].side === "away",
    "S5: entrada legada (número) → 1 momento",
  );
  check(
    readGoalFlashEntry(NOW).ts === NOW && readGoalFlashEntry(NOW).n === 1,
    "S5: readGoalFlashEntry normaliza número → { ts, n: 1 }",
  );
  check(
    isFlashing({ "1_2_home": { ts: NOW, n: 3 } }, 1, 2, "home", NOW + 1000),
    "S5: isFlashing OK com objeto dentro da janela",
  );
  check(
    isFlashing({ "1_2_home": NOW }, 1, 2, "home", NOW + 1000),
    "S5: isFlashing OK com número legado dentro da janela",
  );
  check(
    !isFlashing({ "1_2_home": { ts: NOW, n: 3 } }, 1, 2, "home", NOW + 1600),
    "S5: isFlashing apaga após 1500ms",
  );
}

/* ── S6: chave reutilizada noutra jornada ──────────────────────────────── */
{
  const consumed = { home: { ts: NOW - 1_000_000, n: 2 }, away: { ts: 0, n: 0 } };
  const ref = { "1_2_home": { ts: NOW, n: 3 } }; // +1 golo desde então
  const moments = freshGoalFlashes(ref, 1, 2, consumed, NOW);
  check(
    moments.length === 1,
    `S6: só o golo novo festeja (deu ${moments.length})`,
  );
}

if (failures > 0) {
  console.error(`\n❌ goalFlashQueueRegression: ${failures} falha(s) de invariante — ver acima`);
  process.exit(1);
}
console.log("\n✅ goalFlashQueueRegression: um festejo por golo, mesmo no mesmo minuto");
