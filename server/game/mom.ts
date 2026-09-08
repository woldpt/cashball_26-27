/**
 * MOM — "Jogador do Jogo" por equipa e partida.
 *
 * Função pura: pontua cada jogador a partir dos eventos da partida que o
 * engine já emite (golos, falhanças, cartões, lesões, GR de emergência…) e
 * escolhe o melhor de cada lado. Sem estado, sem DB — quem persiste o
 * resultado é o helper de gravação (liga/Taça).
 *
 * Juniores (IDs negativos) são excluídos — não têm linha na DB.
 */

export interface MomPlayer {
  playerId: number;
  playerName: string;
  score: number;
}

export interface MomResult {
  home: MomPlayer | null;
  away: MomPlayer | null;
}

/**
 * Pesos por tipo de evento. Valores deliberadamente conservadores para o
 * MOM "rápido": um golo domina, cartões/lesões penalizam, falhanças e o
 * GR de emergência dão um bónus modesto.
 */
const MOM_WEIGHTS: Record<string, number> = {
  goal: 30,
  penalty_goal: 30,
  near_miss: 8,
  emergency_gk: 5,
  own_goal: -15,
  penalty_miss: -5,
  yellow: -10,
  red: -25,
  gk_red_card: -25,
  injury: -5,
};

interface LineupPlayer {
  id: number;
  name?: string;
}

interface MomEvent {
  minute?: number;
  type?: string;
  team?: string | null;
  playerId?: number | null;
  playerName?: string | null;
}

interface PlayerAccumulator {
  playerId: number;
  playerName: string;
  score: number;
  goals: number;
  cards: number;
}

function buildAccumulators(
  events: MomEvent[],
  side: string,
  lineup: LineupPlayer[],
): Map<number, PlayerAccumulator> {
  const byId = new Map<number, PlayerAccumulator>();
  const lineupName = new Map<number, string>();
  for (const p of lineup) {
    if (p && p.id > 0) lineupName.set(p.id, p.name ?? "");
  }

  for (const e of events) {
    if (!e || e.team !== side) continue;
    const weight = MOM_WEIGHTS[e.type ?? ""];
    if (weight === undefined) continue;
    const id = e.playerId;
    if (typeof id !== "number" || id <= 0) continue; // juniores / sem jogador
    let acc = byId.get(id);
    if (!acc) {
      acc = {
        playerId: id,
        playerName: e.playerName || lineupName.get(id) || "Jogador",
        score: 0,
        goals: 0,
        cards: 0,
      };
      byId.set(id, acc);
    }
    acc.score += weight;
    if (e.type === "goal" || e.type === "penalty_goal") acc.goals += 1;
    if (e.type === "yellow" || e.type === "red" || e.type === "gk_red_card")
      acc.cards += 1;
  }
  return byId;
}

function pickMom(accs: Map<number, PlayerAccumulator>): MomPlayer | null {
  if (accs.size === 0) return null;
  const best = [...accs.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.cards !== a.cards) return a.cards - b.cards; // menos cartões
    return a.playerId - b.playerId; // determinístico
  })[0];
  return { playerId: best.playerId, playerName: best.playerName, score: best.score };
}

/**
 * Calcula o MOM de cada equipa a partir dos eventos da partida.
 * `events` = fixture.events; `homeLineup`/`awayLineup` = plantel em campo
 * (usada só para fallback de nomes).
 */
export function computeMoms(
  events: MomEvent[],
  homeLineup: LineupPlayer[],
  awayLineup: LineupPlayer[],
): MomResult {
  const evs = Array.isArray(events) ? events : [];
  return {
    home: pickMom(buildAccumulators(evs, "home", homeLineup ?? [])),
    away: pickMom(buildAccumulators(evs, "away", awayLineup ?? [])),
  };
}
