import type { PlayerRow } from "../types";
import { getEffectiveSkill } from "./playerUtils";
import { MATCH_TUNING } from "../gameConstants";
import type { Rng } from "./matchCalculations";

/**
 * Escolhe o batedor do desempate por skill, sem repetir enquanto houver
 * estreantes. Exportado para teste (U6) — a volta reinicia quando todos já
 * marcaram, mas o escolhido é SEMPRE marcado como usado (inclusive ao
 * reiniciar): senão o melhor batedor repetia em chutes seguidos de morte
 * súbita longa.
 */
export function pickShootoutTaker(
  squad: PlayerRow[],
  usedIds: Set<number>,
): PlayerRow | null {
  let available = squad.filter((p) => !usedIds.has(p.id));
  if (available.length === 0) {
    // Cycle through again if all have taken a penalty
    usedIds.clear();
    available = [...squad];
  }
  // Pick by skill
  available.sort((a, b) => getEffectiveSkill(b) - getEffectiveSkill(a));
  const taker = available[0] || null;
  if (taker) usedIds.add(taker.id);
  return taker;
}

// ─── PENALTY SHOOTOUT ─────────────────────────────────────────────────────────
// Simulates a penalty shootout between two squads.
// Returns { homeGoals, awayGoals, kicks: [{team, playerName, scored}] }
export function simulatePenaltyShootout(
  homeSquad: PlayerRow[],
  awaySquad: PlayerRow[],
  rng: Rng = Math.random,
) {
  const kicks = [];
  let homeGoals = 0;
  let awayGoals = 0;

  const homeUsed = new Set<number>();
  const awayUsed = new Set<number>();
  const homeGK = homeSquad.find((p) => p.position === "GR") || homeSquad[0];
  const awayGK = awaySquad.find((p) => p.position === "GR") || awaySquad[0];

  const calcScoredChance = (taker, gk) => {
    const takerSkill = taker ? getEffectiveSkill(taker) || 10 : 10;
    const gkSkill = gk ? getEffectiveSkill(gk) || 10 : 10;
    return Math.max(
      MATCH_TUNING.shootoutMin,
      Math.min(
        MATCH_TUNING.shootoutMax,
        MATCH_TUNING.shootoutBase +
          (takerSkill - gkSkill) / MATCH_TUNING.shootoutSkillDivisor,
      ),
    );
  };

  // Chutes alternados (ordem real: casa → fora em cada ronda). A decisão é
  // verificada após CADA chute — o segundo batedor joga a saber o resultado
  // do primeiro, como no futebol real (antes os dois chutavam em
  // "simultâneo" e só se verificava no fim da ronda).
  let homeTaken = 0;
  let awayTaken = 0;
  const takeKick = (side: "home" | "away", suddenDeath = false) => {
    const squad = side === "home" ? homeSquad : awaySquad;
    const used = side === "home" ? homeUsed : awayUsed;
    // O GR que defende é o da equipa adversária.
    const gk = side === "home" ? awayGK : homeGK;
    const taker = pickShootoutTaker(squad, used);
    const scored = rng() < calcScoredChance(taker, gk);
    if (scored) {
      if (side === "home") homeGoals++;
      else awayGoals++;
    }
    if (side === "home") homeTaken++;
    else awayTaken++;
    kicks.push({
      team: side,
      playerName: taker ? taker.name : "?",
      scored,
      ...(suddenDeath ? { suddenDeath: true } : {}),
    });
  };
  // Decisão regulamentar: a equipa em desvantagem já não chega ao empate
  // mesmo marcando todos os chutes que lhe restam (5 - já marcados).
  const regulationDecided = () =>
    homeGoals > awayGoals + (5 - awayTaken) ||
    awayGoals > homeGoals + (5 - homeTaken);

  // 5 regulation rounds
  for (let round = 0; round < 5; round++) {
    takeKick("home");
    if (regulationDecided()) break;
    takeKick("away");
    if (regulationDecided()) break;
  }

  // Sudden death if still tied
  let sdRound = 0;
  while (homeGoals === awayGoals && sdRound < MATCH_TUNING.shootoutSuddenDeathCap) {
    sdRound++;
    // Na morte súbita a decisão só é possível com igual nº de chutes —
    // o chute da casa nunca decide sozinho, mas o de fora sim.
    takeKick("home", true);
    takeKick("away", true);

    if (homeGoals !== awayGoals) break; // One scored, other didn't → winner decided
  }

  // Failsafe do desempate: após 20 rondas de morte súbita ainda empatado
  // (probabilidade ínfima), sorteio imparcial em vez de favorecer a casa.
  if (homeGoals === awayGoals) {
    if (rng() < MATCH_TUNING.shootoutFailsafeHome) homeGoals++;
    else awayGoals++;
  }

  return { homeGoals, awayGoals, kicks };
}
