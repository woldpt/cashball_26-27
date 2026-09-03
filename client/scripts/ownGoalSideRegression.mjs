/**
 * Regression — "os autogolos estão a ser noticiados por baixo da equipa
 * errada" (colunas de eventos do LiveMatchHero).
 *
 * Root cause (confirmed): o `resolveSide` do LiveMatchHero derivava a coluna
 * do evento pela equipa real do JOGADOR (via lineups). Para um auto-golo o
 * `playerId` é o AUTOR — um defensor da equipa que SOFREU — enquanto `e.team`
 * é a equipa BENEFICIADA, o mesmo lado que o marcador conta em todo o lado
 * (`isGoalType(e.type) && e.team === side`). O evento de auto-golo era assim
 * noticiado por baixo da equipa que sofreu, em contradição com o placar
 * (que o próprio herói acerta via `e.team`).
 *
 * Este teste codifica o contrato:
 *   S1 — auto-golo (autor = defensor da casa, golo creditado ao fora) resolve
 *        para a equipa BENEFICIADA (fora), nunca a do autor (casa);
 *   S2 — golos normais continuam a resolver pela equipa real do marcador;
 *   S3 — evento sem playerId conhecido cai no fallback `e.team`;
 *   S4 — invariante do marcador: todo o evento-golo (goal / penalty_goal /
 *        own_goal / var_goal_pending) tem de aterrar na coluna == `e.team`,
 *        senão as colunas desmentem o placar;
 *   S5 — o split homeEvents/awayEvents do herói (filtro + tipos permitidos)
 *        coloca o auto-golo na coluna do fora e mantém o nº de golos por
 *        coluna igual ao que o marcador conta por `e.team`.
 *
 * Run: cd client && npm run test:owngoalside
 */
import { isGoalType, resolveEventSide } from "../src/components/live/liveHelpers.js";

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok  - ${msg}`);
  }
}

/* ── Cenário: a equipa da casa sofre um auto-golo ─────────────────────────
 * Autor: defensor da CASA (id 101) — o golo conta para o FORA (e.team). */
const lineupSideById = new Map([
  [101, "home"], // Carrasco (defensor da casa, autor do auto-golo)
  [102, "home"], // outro defensor da casa
  [105, "home"], // avançado da casa
  [201, "away"], // avançado do fora
  [205, "away"], // médio do fora
]);

const ownGoalEvt = {
  minute: 34,
  type: "own_goal",
  team: "away", // beneficiada
  playerId: 101, // autor — defensor da CASA
  playerName: "Carrasco",
};
const homeGoalEvt = {
  minute: 12,
  type: "goal",
  team: "home",
  playerId: 105,
  playerName: "Pontapé",
};
const awayGoalEvt = {
  minute: 55,
  type: "goal",
  team: "away",
  playerId: 201,
  playerName: "Matador",
};
const subEvt = {
  minute: 60,
  type: "substitution",
  team: "away",
  playerId: 999, // não está nas lineups (suplente fora do snapshot)
  playerName: "Desconhecido",
};

/* ── S1: auto-golo segue a equipa beneficiada ──────────────────────────── */
check(
  resolveEventSide(ownGoalEvt, lineupSideById) === "away",
  "S1: auto-golo de defensor da casa resolve para a equipa beneficiada (fora)",
);

/* ── S2: golos normais resolvem pela equipa real do marcador ───────────── */
check(
  resolveEventSide(homeGoalEvt, lineupSideById) === "home",
  "S2: golo de avançado da casa resolve para a casa",
);
check(
  resolveEventSide(awayGoalEvt, lineupSideById) === "away",
  "S2: golo de avançado do fora resolve para o fora",
);

/* ── S3: jogador desconhecido cai no fallback e.team ───────────────────── */
check(
  resolveEventSide(subEvt, lineupSideById) === "away",
  "S3: evento com playerId fora das lineups cai no fallback e.team",
);

/* ── S4: invariante do marcador — eventos-golo aterram na coluna e.team ── */
const goalTypeEvents = [ownGoalEvt, homeGoalEvt, awayGoalEvt];
let s4Ok = true;
for (const e of goalTypeEvents) {
  if (resolveEventSide(e, lineupSideById) !== e.team) {
    s4Ok = false;
    console.error(
      `FAIL: evento ${e.type} (${e.playerName}) coluna=${resolveEventSide(e, lineupSideById)} != e.team=${e.team}`,
    );
  }
}
check(s4Ok, "S4: todos os eventos-golo aterram na coluna == e.team (placar consistente)");

/* ── S5: split do hero — auto-golo na coluna do fora, contagem do placar ── */
const matchEvents = [ownGoalEvt, homeGoalEvt, awayGoalEvt, subEvt];
const EVENT_TYPES = [
  "goal", "penalty_goal", "own_goal", "var_disallowed", "var_goal_pending",
  "yellow", "red", "injury", "substitution", "halftime_sub",
];
const liveMinute = 90;
const split = (side) =>
  matchEvents
    .filter((e) => e.minute <= liveMinute && resolveEventSide(e, lineupSideById) === side && EVENT_TYPES.includes(e.type))
    .sort((a, b) => a.minute - b.minute);
const homeEvents = split("home");
const awayEvents = split("away");
check(
  awayEvents.some((e) => e.type === "own_goal"),
  "S5: auto-golo aparece na coluna do fora",
);
check(
  !homeEvents.some((e) => e.type === "own_goal"),
  "S5: auto-golo NÃO aparece na coluna da casa (equipa que sofreu)",
);
const homeGoalsByTeam = matchEvents.filter(
  (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "home",
).length;
const awayGoalsByTeam = matchEvents.filter(
  (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "away",
).length;
const homeGoalsInColumn = homeEvents.filter((e) => isGoalType(e.type)).length;
const awayGoalsInColumn = awayEvents.filter((e) => isGoalType(e.type)).length;
check(
  homeGoalsInColumn === homeGoalsByTeam && awayGoalsInColumn === awayGoalsByTeam,
  `S5: colunas ${homeGoalsInColumn}-${awayGoalsInColumn} == placar ${homeGoalsByTeam}-${awayGoalsByTeam}`,
);

if (failures > 0) {
  console.error(`\n❌ ownGoalSideRegression: ${failures} falha(s) de invariante — ver acima`);
  process.exit(1);
}
console.log("\n✅ ownGoalSideRegression: auto-golos sempre por baixo da equipa beneficiada");