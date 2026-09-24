/**
 * ratings — classificação 1–5 estrelas de cada jogador numa partida.
 *
 * Base 3★ para quem entra em campo + pesos dos eventos MOM (`mom.ts`),
 * convertida a estrelas (1 golo → 5★, amarelo → 2★, vermelho → 1★) com
 * clamp 1–5. Juniores (IDs negativos) excluídos — sem linha na DB.
 *
 * Cálculo puro; `persistLastRatings` recebe o `db` por chamada (sem factory).
 * Idempotente (sempre o mesmo resultado para o mesmo jogo) → seguro no
 * replay de crash-restart.
 */
import { MOM_WEIGHTS } from "./mom";

export interface RatingRow {
  id: number;
  name: string;
  position: string;
  stars: number;
  /** true = no XI que entra em campo (snapshot do lineup); false = suplente entrado. */
  starter: boolean;
  /** Foto real do jogador (null → o cliente desenha o avatar SVG). */
  photo: string | null;
}

const BASE_STARS = 3;
/** Cada 15 pontos MOM = 1 estrela acima/abaixo da base. */
const SCORE_PER_STAR = 15;
/** Subs dentro: `substitution` (em jogo/lesão/GR vermelho) e `halftime_sub`. */
const SUB_EVENTS = new Set(["substitution", "halftime_sub"]);

function starsFromScore(score: number): number {
  return Math.min(5, Math.max(1, Math.round(BASE_STARS + score / SCORE_PER_STAR)));
}

/**
 * Classifica todos os jogadores de um lado (`home`/`away`) numa partida.
 * Participantes = XI ∪ suplentes entrados (∪ saídos ao intervalo, já fora
 * do snapshot) — cobre quem entrou em campo em qualquer momento, mesmo sem
 * eventos próprios. O banco que não entrou fica de fora (mantém o
 * `last_rating` anterior).
 *
 * O snapshot final é `[...em campo agora, ...banco restante]`: as trocas
 * substituem no lugar (o suplente herda o slot do titular, o saído some),
 * por isso o XI original se reconstrói com os eventos — os 11 primeiros do
 * snapshot, menos quem entrou, mais quem saiu. Marcar todos os membros do
 * snapshot como titulares colava o plantel inteiro no pitch do rescaldo.
 */
export function computeSideRatings(
  events: any[],
  lineup: any[],
  side: "home" | "away",
  roster?: any[],
): RatingRow[] {
  const cameOn = new Set<number>();
  for (const e of events || []) {
    if (e && e.team === side && SUB_EVENTS.has(e.type) && typeof e.playerId === "number" && e.playerId > 0)
      cameOn.add(e.playerId);
  }
  const players = new Map<number, RatingRow>();
  const rosterById = new Map<number, any>();
  for (const p of roster || []) if (p && p.id > 0) rosterById.set(p.id, p);
  let seen = 0;
  for (const p of lineup || []) {
    if (!p || p.id <= 0) continue;
    const inXI = seen < 11;
    seen += 1;
    if (!inXI && !cameOn.has(p.id)) continue; // banco que não entrou
    players.set(p.id, {
      id: p.id,
      name: p.name ?? rosterById.get(p.id)?.name ?? "Jogador",
      position: p.position ?? rosterById.get(p.id)?.position ?? "",
      stars: 0,
      starter: inXI && !cameOn.has(p.id),
      photo: p.photo ?? rosterById.get(p.id)?.photo ?? null,
    });
  }
  const score = new Map<number, number>();
  for (const e of events || []) {
    if (!e || e.team !== side) continue;
    if (SUB_EVENTS.has(e.type)) {
      const id = e.playerId;
      if (typeof id === "number" && id > 0 && !players.has(id)) {
        players.set(id, {
          id,
          name: e.playerName || rosterById.get(id)?.name || "Jogador",
          position: e.position || rosterById.get(id)?.position || "",
          stars: 0,
          starter: false,
          photo: rosterById.get(id)?.photo ?? null,
        });
      }
      const outId = e.outPlayerId;
      if (typeof outId === "number" && outId > 0 && !players.has(outId)) {
        players.set(outId, {
          id: outId,
          name: e.outPlayerName || rosterById.get(outId)?.name || "Jogador",
          position: rosterById.get(outId)?.position || "",
          stars: 0,
          starter: true,
          photo: rosterById.get(outId)?.photo ?? null,
        });
      }
      continue;
    }
    const weight = MOM_WEIGHTS[e.type];
    if (weight === undefined) continue;
    const id = e.playerId;
    if (typeof id !== "number" || id <= 0) continue;
    score.set(id, (score.get(id) ?? 0) + weight);
  }
  for (const [id, row] of players) row.stars = starsFromScore(score.get(id) ?? 0);
  return [...players.values()];
}

/** Classificação de ambas as equipas a partir do fixture finalizado. */
export function computeMatchRatings(fixture: any): {
  home: RatingRow[];
  away: RatingRow[];
} {
  const events = fixture?.events || [];
  const homeRoster = fixture?._homeFullRoster;
  const awayRoster = fixture?._awayFullRoster;
  return {
    home: computeSideRatings(events, fixture?.homeLineup || [], "home", homeRoster),
    away: computeSideRatings(events, fixture?.awayLineup || [], "away", awayRoster),
  };
}

/**
 * Grava `last_rating` dos participantes (5 UPDATEs agrupados por estrela).
 * Quem não joga mantém a classificação anterior.
 */
export function persistLastRatings(db: any, fixture: any): void {
  const { home, away } = computeMatchRatings(fixture);
  for (const rows of [home, away]) {
    for (let stars = 1; stars <= 5; stars++) {
      const ids = rows.filter((r) => r.stars === stars).map((r) => r.id);
      if (ids.length === 0) continue;
      db.run(
        `UPDATE players SET last_rating = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
        [stars, ...ids],
      );
    }
  }
}
