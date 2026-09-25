/**
 * ratings — classificação 0–10 (com meias) de cada jogador numa partida.
 *
 * Estilo Hattrick: a base é o CONTRIBUTO — skill efetiva (com fadiga, do
 * snapshot do lineup) × forma (fator individual form/32, clamp 0,75–1,35,
 * a mesma curva do motor) × posição (1,0 na origem, 0,7 fora dela) —
 * dividida por 5 (skill 50 → 10; skill 40 neutro → 8; skill 10 neutro → 2).
 * Os eventos da partida temperam sem dominar (golo +1, amarelo −0,5,
 * vermelho/lesão −2): um skill 10 que marca continua mediano e um skill
 * 40 apagado continua alto. O MOM (`mom.ts`) continua por eventos, intocado.
 *
 * Arredonda a meias (0,5) com clamp 0–10. Juniores (IDs negativos)
 * excluídos — sem linha na DB.
 *
 * Cálculo puro; `persistLastRatings` recebe o `db` por chamada (sem factory).
 * Idempotente (sempre o mesmo resultado para o mesmo jogo) → seguro no
 * replay de crash-restart.
 */
import { FORM_NEUTRAL } from "../gameConstants";

export interface RatingRow {
  id: number;
  name: string;
  position: string;
  /** 0–10 com meias (ex. 7,5). */
  stars: number;
  /** true = no XI que entra em campo (snapshot do lineup); false = suplente entrado. */
  starter: boolean;
  /** Foto real do jogador (null → o cliente desenha o avatar SVG). */
  photo: string | null;
}

/** Skill 50 com forma neutra na posição de origem = 10. */
const SKILL_DIVISOR = 5;
/** Fator de quem joga fora da posição de origem (ex. GR improvisado). */
const OUT_OF_POSITION_FACTOR = 0.7;
/** Clamp do fator de forma — a mesma curva do motor (`matchCalculations`). */
const FORM_MIN = 0.75;
const FORM_MAX = 1.35;
/**
 * Temperos por evento — pequenos de propósito, nunca anulam o fosso de
 * skill. Pesos próprios (o MOM usa os seus em `mom.ts`).
 */
const RATING_EVENT_ADJ: Record<string, number> = {
  goal: 1,
  penalty_goal: 1,
  near_miss: 0.5,
  emergency_gk: 0.5,
  own_goal: -1,
  penalty_miss: -0.5,
  yellow: -0.5,
  red: -2,
  gk_red_card: -2,
  injury: -2,
};
/** Subs dentro: `substitution` (em jogo/lesão/GR vermelho) e `halftime_sub`. */
const SUB_EVENTS = new Set(["substitution", "halftime_sub"]);

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function contributionBase(
  skill: number,
  form: number,
  naturalPos: string | null,
  playedPos: string | null,
): number {
  const formFactor = Math.max(
    FORM_MIN,
    Math.min(FORM_MAX, form / FORM_NEUTRAL),
  );
  const posFactor =
    naturalPos && playedPos && naturalPos !== playedPos
      ? OUT_OF_POSITION_FACTOR
      : 1;
  return ((skill ?? 0) * formFactor * posFactor) / SKILL_DIVISOR;
}

function starsFromValue(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value * 2) / 2));
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
 *
 * A skill efetiva vem do snapshot do lineup (já com fadiga à altura do
 * snapshot); a forma e a posição de origem vêm do roster (`SELECT * FROM
 * players`). Sem roster, cai para os campos do snapshot e depois para o
 * neutro — nunca falha, só perde precisão.
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
  const lineupById = new Map<number, any>();
  for (const p of lineup || []) if (p && p.id > 0) lineupById.set(p.id, p);
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
  const adj = new Map<number, number>();
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
    const delta = RATING_EVENT_ADJ[e.type];
    if (delta === undefined) continue;
    const id = e.playerId;
    if (typeof id !== "number" || id <= 0) continue;
    adj.set(id, (adj.get(id) ?? 0) + delta);
  }
  for (const [id, row] of players) {
    const l = lineupById.get(id);
    const r = rosterById.get(id);
    const skill = num(l?.skill) ?? num(r?.skill) ?? 0;
    const form = num(r?.form) ?? num(l?.form) ?? FORM_NEUTRAL;
    const natural = r?.position ?? l?.position ?? row.position ?? null;
    row.stars = starsFromValue(
      contributionBase(skill, form, natural, row.position || null) +
        (adj.get(id) ?? 0),
    );
  }
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
 * Grava `last_rating` dos participantes (UPDATEs agrupados por nota, no
 * máximo 21 valores distintos por equipa na escala de meias).
 * Quem não joga mantém a classificação anterior.
 */
export function persistLastRatings(db: any, fixture: any): void {
  const { home, away } = computeMatchRatings(fixture);
  for (const rows of [home, away]) {
    const byStars = new Map<number, number[]>();
    for (const r of rows) {
      const ids = byStars.get(r.stars);
      if (ids) ids.push(r.id);
      else byStars.set(r.stars, [r.id]);
    }
    for (const [stars, ids] of byStars) {
      db.run(
        `UPDATE players SET last_rating = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
        [stars, ...ids],
      );
    }
  }
}
