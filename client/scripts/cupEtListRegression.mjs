/**
 * Regression test — "Equipas com coach humano, após vencerem na taça, por
 * vezes aparecem na lista de jogos do prolongamento."
 *
 * Root cause (confirmed by repro): a lista de jogos de Taça durante o
 * prolongamento (GameLayout cup multiview) e o hero do meu jogo
 * (LiveMatchHero) decidiam se um jogo "foi a prolongamento" contando APENAS
 * eventos com `type === "goal"`. Golos de penálti (`penalty_goal`)
 * incrementam o resultado real (finalHomeGoals/finalAwayGoals) mas não eram
 * contados — um jogo decidido na regulamentação com penáltis (ex.: 1-0 de
 * penálti, ou 2-1 com 1-1 em lances corridos e um penálti) era tratado como
 * empatado aos 90' e aparecia na lista de prolongamento. O placar
 * (LiveFixtureRow) usa `isGoalType` (goal | penalty_goal) — daí a
 * inconsistência visível: o jogo mostrava 1-0 mas ficava na lista de ET.
 *
 * Fix: helper `isDrawnAt90` (liveHelpers.js) conta golos regulamentares
 * (minute <= 90) com o mesmo critério do placar e é usado por GameLayout e
 * LiveMatchHero.
 *
 * Run: cd client && npm run test:cupetlist
 */
import { isDrawnAt90 } from "../src/components/live/liveHelpers.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

// ── O comportamento antigo (bug) — documentado para provar que o teste
// ── apanha a regressão. Era o filtro inline em GameLayout.jsx.
function oldGoalOnlyDrawnAt90(match) {
  const goals90Home = (match.events || []).filter(
    (e) => e.minute <= 90 && e.type === "goal" && e.team === "home",
  ).length;
  const goals90Away = (match.events || []).filter(
    (e) => e.minute <= 90 && e.type === "goal" && e.team === "away",
  ).length;
  return goals90Home === goals90Away;
}

const penaltyWin = {
  homeTeamId: 1,
  awayTeamId: 2,
  finalHomeGoals: 1,
  finalAwayGoals: 0,
  events: [{ minute: 30, type: "penalty_goal", team: "home", playerId: 11 }],
};
const mixedWin = {
  homeTeamId: 1,
  awayTeamId: 2,
  finalHomeGoals: 2,
  finalAwayGoals: 1,
  events: [
    { minute: 20, type: "goal", team: "away", playerId: 21 },
    { minute: 40, type: "goal", team: "home", playerId: 12 },
    { minute: 70, type: "penalty_goal", team: "home", playerId: 11 },
  ],
};
const normalWin = {
  homeTeamId: 1,
  awayTeamId: 2,
  finalHomeGoals: 1,
  finalAwayGoals: 0,
  events: [{ minute: 40, type: "goal", team: "home", playerId: 12 }],
};
const realDraw = {
  homeTeamId: 1,
  awayTeamId: 2,
  finalHomeGoals: 0,
  finalAwayGoals: 0,
  events: [],
};
const drawWithGoals = {
  homeTeamId: 1,
  awayTeamId: 2,
  finalHomeGoals: 2,
  finalAwayGoals: 2,
  events: [
    { minute: 10, type: "goal", team: "home", playerId: 12 },
    { minute: 30, type: "goal", team: "away", playerId: 21 },
    { minute: 55, type: "goal", team: "home", playerId: 14 },
    { minute: 80, type: "goal", team: "away", playerId: 23 },
  ],
};
// Empate aos 90' resolvido NO prolongamento — o golo de ET (min 95) não pode contar.
const decidedInET = {
  homeTeamId: 1,
  awayTeamId: 2,
  finalHomeGoals: 2,
  finalAwayGoals: 1,
  events: [
    { minute: 30, type: "goal", team: "home", playerId: 12 },
    { minute: 60, type: "goal", team: "away", playerId: 21 },
    { minute: 95, type: "goal", team: "home", playerId: 14 },
  ],
};
// Empate aos 90' com penálti marcado no ET (min 100) — também não conta.
const drawWithETPenalty = {
  homeTeamId: 1,
  awayTeamId: 2,
  finalHomeGoals: 1,
  finalAwayGoals: 0,
  events: [
    { minute: 100, type: "penalty_goal", team: "home", playerId: 11 },
  ],
};

// ── Prova que o filtro antigo tinha o bug (apanhava penáltis como empate) ──
assert(
  oldGoalOnlyDrawnAt90(penaltyWin) === true,
  "pré-condição: o filtro antigo (goal-only) tratava 1-0 de penálti como empate aos 90' — era o bug",
);
assert(
  oldGoalOnlyDrawnAt90(mixedWin) === true,
  "pré-condição: o filtro antigo (goal-only) tratava 2-1 com penálti como empate aos 90' — era o bug",
);

// ── Contrato: jogos decididos na regulamentação NÃO estão em ET ──
assert(isDrawnAt90(penaltyWin) === false, "1-0 decidido por penálti não pode aparecer na lista de prolongamento");
assert(isDrawnAt90(mixedWin) === false, "2-1 (1-1 em lances corridos + penálti) não pode aparecer na lista de prolongamento");
assert(isDrawnAt90(normalWin) === false, "1-0 normal não aparece na lista de prolongamento");

// ── Contrato: jogos empatados aos 90' ESTÃO em ET ──
assert(isDrawnAt90(realDraw) === true, "0-0 aos 90' tem de estar na lista de prolongamento");
assert(isDrawnAt90(drawWithGoals) === true, "2-2 aos 90' tem de estar na lista de prolongamento");
assert(isDrawnAt90(decidedInET) === true, "jogo decidido no ET (empate aos 90') tem de estar na lista durante o ET");
assert(isDrawnAt90(drawWithETPenalty) === true, "empate aos 90' com penálti só no ET tem de estar na lista durante o ET");

console.log("✓ cupEtListRegression — todos os casos passam (isDrawnAt90 corrigido).");
