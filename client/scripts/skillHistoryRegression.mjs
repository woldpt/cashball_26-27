/**
 * Regression test — gráfico de evolução da skill em jogos com várias épocas.
 *
 * Root cause: o `matchweek` nos snapshots é POR ÉPOCA (1..14 em cada época).
 * O backend descartava a `season` no mapping e o SkillLineChart ordenava e
 * posicionava o eixo X apenas por `matchweek` — em jogos com várias épocas os
 * pontos da época actual caíam nos mesmos X dos pontos da época 1
 * (linha em zigzag, "últimos registos" invisíveis/sobrepostos).
 *
 * Fix: usar epoch global `(season - 1) * 14 + matchweek` para ordenar e
 * posicionar cronologicamente (mesma convenção de `contractEpoch()` no
 * servidor).
 *
 * Run: cd client && node scripts/skillHistoryRegression.mjs
 */
import {
  skillEpoch,
  buildSkillChartPoints,
  skillLabel,
  MATCHWEEKS_PER_SEASON,
} from "../src/utils/skillHistory.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── 1. skillEpoch — epoch global cronológico ────────────────────────────────
assert(skillEpoch(1, 1) === 1, "skillEpoch(1,1) === 1");
assert(skillEpoch(1, 14) === 14, "skillEpoch(1,14) === 14");
assert(skillEpoch(2, 1) === 15, "skillEpoch(2,1) === 15 (época 2 começa no epoch 15)");
assert(skillEpoch(3, 5) === 2 * MATCHWEEKS_PER_SEASON + 5, "skillEpoch(3,5) === 33");
assert(skillEpoch(undefined, 7) === 7, "season omissa ⇒ época 1");
assert(skillEpoch(2, 0) === 15, "matchweek 0 clamped para 1");
assert(skillEpoch(2, 99) === 28, "matchweek 99 clamped para 14");

// ── 2. buildSkillChartPoints — ordenação cronológica multi-época ────────────
// História: época 1 completa (J1..J14) + época 2 até J5.
const history = [
  { matchweek: 3, season: 2, skill: 38 },
  { matchweek: 14, season: 1, skill: 35 },
  { matchweek: 1, season: 1, skill: 30 },
  { matchweek: 5, season: 2, skill: 40 },
  { matchweek: 1, season: 2, skill: 36 },
];
const points = buildSkillChartPoints(history);

assert(points.length === 5, "5 pontos válidos");
assert(
  points.map((p) => p.epoch).join(",") === "1,14,15,17,19",
  `epochs ordenados cronologicamente: ${points.map((p) => p.epoch).join(",")}`,
);
assert(points[0].season === 1 && points[0].matchweek === 1, "primeiro ponto = E1 J1");
assert(
  points[points.length - 1].season === 2 && points[points.length - 1].matchweek === 5,
  "último ponto = E2 J5 (o registo mais recente fica no fim, não perdido)",
);

// Pontos inválidos são filtrados
const withInvalid = buildSkillChartPoints([
  { matchweek: 1, season: 1, skill: 30 },
  { matchweek: 2, season: 1, skill: null },
  { matchweek: null, season: 1, skill: 32 },
]);
assert(withInvalid.length === 1, "pontos com skill/matchweek nulos são filtrados");

// ── 3. skillLabel — distingue jornadas repetidas entre épocas ───────────────
assert(skillLabel({ season: 1, matchweek: 5 }, false) === "J5", "1 época: rótulo simples J5");
assert(
  skillLabel({ season: 2, matchweek: 5 }, true) === "2027·J5",
  "multi-época: rótulo com ano (2025 + época) → 2027·J5",
);

console.log("\nTodos os testes passaram ✔");
