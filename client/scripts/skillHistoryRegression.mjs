/**
 * Regression test — histórico de skill: epoch global, janela e rótulos.
 *
 * Contexto: o `matchweek` nos snapshots é o slot de calendário (1..20:
 * amigável + 14 jornadas + 5 rondas da Taça). O eixo X do gráfico é o epoch
 * global `(season - 1) * 20 + slot`, senão os pontos de épocas diferentes
 * caem nos mesmos X (linha em zigzag, últimos registos sobrepostos).
 *
 * Este script é o check do `utils/skillHistory.js`: o `SkillLineChart` só
 * desenha o que sai daqui (`x`, `y`, `label`), por isso as três coisas que
 * podem partir o gráfico estão cobertas — epoch/ordem, pontos inválidos e
 * janela de uma temporada.
 *
 * Run: cd client && npm run test:skillhistory
 */
import {
  skillEpoch,
  buildSkillChartPoints,
  skillLabel,
} from "../src/utils/skillHistory.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── 1. skillEpoch — epoch global cronológico ────────────────────────────────
assert(skillEpoch({ season: 1, matchweek: 1 }) === 1, "skillEpoch(E1 slot 1) === 1");
assert(skillEpoch({ season: 1, matchweek: 20 }) === 20, "slot 20 fecha a época 1");
assert(
  skillEpoch({ season: 2, matchweek: 1 }) === 21,
  "skillEpoch(E2 slot 1) === 21 (época 2 começa no epoch 21)",
);
assert(
  skillEpoch({ season: 3, matchweek: 5 }) === 45,
  "skillEpoch(E3 slot 5) === 45 (2 épocas × 20 slots + 5)",
);
assert(skillEpoch({ matchweek: 7 }) === 7, "season omissa ⇒ época 1");
assert(skillEpoch({}) === 1, "ponto vazio ⇒ epoch 1");
assert(skillEpoch({ season: 2, matchweek: 0 }) === 21, "slot 0 clamped para 1");
assert(skillEpoch({ season: 2, matchweek: 99 }) === 40, "slot 99 clamped para 20");

// ── 2. buildSkillChartPoints — ordem, dedupe e forma do ponto ───────────────
// História baralhada: época 1 (slots 1, 14 e 20) + época 2 (slots 1, 3 e 5).
const history = [
  { matchweek: 3, season: 2, skill: 38 },
  { matchweek: 14, season: 1, skill: 35 },
  { matchweek: 1, season: 1, skill: 30 },
  { matchweek: 5, season: 2, skill: 40 },
  { matchweek: 1, season: 2, skill: 36 },
  { matchweek: 20, season: 1, skill: 37 },
];
const points = buildSkillChartPoints(history, 2);

assert(points.length === 6, "6 pontos válidos");
assert(
  points.map((p) => p.x).join(",") === "1,14,20,21,23,25",
  `epochs ordenados cronologicamente: ${points.map((p) => p.x).join(",")}`,
);
assert(
  points.every((p) => typeof p.y === "number" && typeof p.label === "string"),
  "cada ponto traz x (epoch), y (skill), label e skill",
);
assert(points[0].label === "2026·Pré", 'época anterior → rótulo com ano ("2026·Pré")');
assert(points[5].label === "T1", "época atual → rótulo do calendário sem ano (slot 5 = Taça)");

// Dois registos no mesmo slot: fica o último (mais recente), não duplica o X.
const deduped = buildSkillChartPoints(
  [
    { matchweek: 4, season: 1, skill: 30 },
    { matchweek: 4, season: 1, skill: 34 },
  ],
  1,
);
assert(deduped.length === 1 && deduped[0].y === 34, "epoch repetido: fica o mais recente");

// Pontos inválidos: sem skill (daria NaN no SVG) ou sem slot.
const withInvalid = buildSkillChartPoints(
  [
    { matchweek: 1, season: 1, skill: 30 },
    { matchweek: 2, season: 1, skill: null },
    { matchweek: null, season: 1, skill: 32 },
  ],
  1,
);
assert(withInvalid.length === 1, "pontos com skill/matchweek nulos são filtrados");

// ── 3. Janela: só a última temporada (20 slots do calendário) ───────────────
const twoSeasons = [];
for (let season = 1; season <= 2; season++) {
  for (let slot = 1; slot <= 20; slot++) {
    twoSeasons.push({ season, matchweek: slot, skill: 30 + slot / 10 });
  }
}
const windowed = buildSkillChartPoints(twoSeasons, 2);
assert(windowed.length === 20, "janela = 20 slots (uma temporada)");
assert(windowed[0].x === 21 && windowed[19].x === 40, "janela = época mais recente (epochs 21..40)");
assert(
  windowed.every((p) => p.label.startsWith("J") || p.label.startsWith("T") || p.label === "Pré"),
  "rótulos do calendário (J / T / Pré)",
);
assert(
  windowed.find((p) => p.x === 25)?.label === "T1",
  "slot 5 é a Taça (16 avos) → rótulo T1",
);

// ── 4. skillLabel — ano só para épocas anteriores à atual ───────────────────
assert(skillLabel({ season: 2, matchweek: 6 }, 2) === "J4", "época atual: J4 (slot 6 = jornada 4)");
assert(
  skillLabel({ season: 2, matchweek: 6 }, 3) === "2027·J4",
  "época anterior: ano do calendário (2026 + época - 1) → 2027·J4",
);
assert(skillLabel({ season: 1, matchweek: 1 }, 1) === "Pré", "slot 1 é o amigável de pré-época");

console.log("\nTodos os testes passaram ✔");
