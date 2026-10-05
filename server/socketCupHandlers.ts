import type { ActiveGame, PlayerSession } from "./types";
import { getCupExemptTeamIds, serializeRoomTask } from "./coreHelpers";
import { CUP_ROUND_NAMES, CUP_FINAL_ROUND, SEASON_CALENDAR, cupWeekFriendlyRound } from "./gameConstants";

type AnyRow = Record<string, any>;
type RunAll = <T extends AnyRow = AnyRow>(db: any, sql: string, params?: any[]) => Promise<T[]>;

interface CupHandlerDeps {
  io: any;
  getGameBySocket: (socketId: string) => ActiveGame | null;
  getPlayerBySocket: (game: ActiveGame, socketId: string) => PlayerSession | null;
  getPlayerList: (game: ActiveGame) => PlayerSession[];
  saveGameState: (game: ActiveGame) => void;
  checkAllReady: (game: ActiveGame) => Promise<void>;
  runAll: RunAll;
}

/**
 * Rondas da Taça (ainda por jogar, sem a final) em que a equipa folga e pode
 * marcar amigável: todas as restantes se já foi eliminada; a ronda 1 se é
 * isenta dos 32 avos.
 */
async function getCupFriendlyRounds(game: ActiveGame, teamId: number, runAll: RunAll): Promise<number[]> {
  const upcoming = SEASON_CALENDAR.filter(
    (e: any) =>
      e.type === "cup" &&
      e.round !== CUP_FINAL_ROUND &&
      (e.calendarIndex > game.calendarIndex ||
        (e.calendarIndex === game.calendarIndex && game.gamePhase === "lobby" && !game.currentFixtures?.length)),
  ).map((e: any) => e.round as number);
  if (!upcoming.length) return [];
  const lost = await runAll(
    game.db,
    `SELECT id FROM cup_matches WHERE season = ? AND round > 0 AND played = 1
       AND (home_team_id = ? OR away_team_id = ?) AND winner_team_id IS NOT NULL AND winner_team_id <> ?`,
    [game.season, teamId, teamId, teamId],
  );
  if (lost.length > 0) return upcoming;
  if (upcoming.includes(1) && (await getCupExemptTeamIds(game.db)).includes(teamId)) return [1];
  return [];
}

/**
 * Amigáveis das semanas da Taça para quem já não está na Taça.
 * `cupRound`/`signedUp` = a 1.ª semana livre (`nextWeek` = é já a seguir — dica do adjunto); `rounds` =
 * todas as semanas em que ainda se pode marcar (sem amigável já marcado).
 */
export async function getCupWeekFriendlyStatus(
  game: ActiveGame,
  teamId: number | null | undefined,
  runAll: RunAll,
): Promise<{ cupRound: number; roundName: string; signedUp: boolean; nextWeek: boolean; rounds: number[] } | null> {
  if (!teamId) return null;
  const free = await getCupFriendlyRounds(game, Number(teamId), runAll);
  if (!free.length) return null;
  const signedRows = await runAll<{ round: number }>(
    game.db,
    "SELECT round FROM cup_matches WHERE season = ? AND round < 0 AND (home_team_id = ? OR away_team_id = ?)",
    [game.season, teamId, teamId],
  );
  const signed = new Set(signedRows.map((r) => -Number(r.round)));
  const rounds = free.filter((r) => !signed.has(r));
  const cupRound = free[0];
  const next = SEASON_CALENDAR[game.calendarIndex + 1] as any;
  const nextWeek = game.gamePhase === "lobby" && next?.type === "cup" && next.round === cupRound;
  return { cupRound, roundName: CUP_ROUND_NAMES[cupRound] || `Ronda ${cupRound}`, signedUp: signed.has(cupRound), nextWeek, rounds };
}

/**
 * Marca o amigável da semana da ronda `round` já com adversário: junta-se a
 * uma inscrição sem par (outro humano) ou escolhe uma equipa NPC que também
 * folga nessa semana. Sem candidatos fica em aberto (emparelha no fecho).
 */
async function bookCupWeekFriendly(game: ActiveGame, teamId: number, round: number, runAll: RunAll) {
  const dbRound = cupWeekFriendlyRound(round);
  const open = await runAll<{ id: number }>(
    game.db,
    "SELECT id FROM cup_matches WHERE season = ? AND round = ? AND played = 0 AND away_team_id IS NULL AND home_team_id <> ? ORDER BY id LIMIT 1",
    [game.season, dbRound, teamId],
  );
  if (open.length) {
    await runAll(game.db, "UPDATE cup_matches SET away_team_id = ? WHERE id = ?", [teamId, open[0].id]);
    return;
  }
  const humans = new Set<number>();
  for (const seat of Object.values(game.seats || {})) if (seat.teamId != null) humans.add(Number(seat.teamId));
  const exempt = round === 1 ? await getCupExemptTeamIds(game.db) : [];
  // Folgam na ronda: eliminadas (perderam um jogo da Taça) ou isentas dos 32 avos.
  const candidates = await runAll<{ id: number }>(
    game.db,
    `SELECT t.id FROM teams t
      WHERE t.id <> ?
        AND (t.id IN (${exempt.map(() => "?").join(",") || "NULL"}) OR EXISTS (
          SELECT 1 FROM cup_matches c WHERE c.season = ? AND c.round > 0 AND c.played = 1
            AND (c.home_team_id = t.id OR c.away_team_id = t.id)
            AND c.winner_team_id IS NOT NULL AND c.winner_team_id <> t.id))
        AND NOT EXISTS (
          SELECT 1 FROM cup_matches f WHERE f.season = ? AND f.round = ?
            AND (f.home_team_id = t.id OR f.away_team_id = t.id))`,
    [teamId, ...exempt, game.season, game.season, dbRound],
  );
  const pool = candidates.filter((c) => !humans.has(Number(c.id)));
  const ai = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
  await runAll(
    game.db,
    "INSERT INTO cup_matches (season, round, home_team_id, away_team_id) VALUES (?, ?, ?, ?)",
    [game.season, dbRound, teamId, ai],
  );
}

export function registerCupSocketHandlers(socket: any, deps: CupHandlerDeps) {
  const { getGameBySocket, getPlayerBySocket, runAll } = deps;

  // ── Amigável da semana da Taça (inscrição na véspera, sem desmarcar) ─────
  socket.on("signupCupWeekFriendly", async (payload: any, ack?: (r: any) => void) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const game = getGameBySocket(socket.id);
    const player = game && getPlayerBySocket(game, socket.id);
    if (!game || !player?.teamId) return reply({ ok: false, error: "Sem equipa." });
    const teamId = Number(player.teamId);
    // Serializado por sala: duas inscrições em simultâneo não apanham o mesmo NPC.
    serializeRoomTask(game.roomCode, async () => {
      try {
        const status = await getCupWeekFriendlyStatus(game, teamId, runAll);
        const round = Number(payload?.round ?? status?.cupRound);
        if (!status?.rounds.includes(round)) return reply({ ok: false, error: "Já não é possível marcar o amigável." });
        await bookCupWeekFriendly(game, teamId, round, runAll);
        reply({ ok: true });
      } catch (err) {
        console.error(`[${game.roomCode}] signupCupWeekFriendly:`, err);
        reply({ ok: false, error: "Erro ao marcar o amigável." });
      }
    });
  });

  // ── Cup bracket data ─────────────────────────────────────────────────────
  socket.on("requestCupBracket", async () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    try {
      type CupRow = {
        id: number; round: number;
        home_team_id: number; away_team_id: number;
        home_score: number; away_score: number;
        home_et_score: number; away_et_score: number;
        home_penalties: number; away_penalties: number;
        winner_team_id: number | null; played: number;
        home_name: string | null; home_cp: string | null; home_cs: string | null; home_crest: string | null;
        away_name: string | null; away_cp: string | null; away_cs: string | null; away_crest: string | null;
      };
      const rows = await runAll<CupRow>(
        game.db,
        `SELECT cm.id, cm.round, cm.home_team_id, cm.away_team_id,
          cm.home_score, cm.away_score, cm.home_et_score, cm.away_et_score,
          cm.home_penalties, cm.away_penalties, cm.winner_team_id, cm.played,
          th.name AS home_name, th.color_primary AS home_cp, th.color_secondary AS home_cs, th.crest AS home_crest,
          ta.name AS away_name, ta.color_primary AS away_cp, ta.color_secondary AS away_cs, ta.crest AS away_crest
        FROM cup_matches cm
        LEFT JOIN teams th ON cm.home_team_id = th.id
        LEFT JOIN teams ta ON cm.away_team_id = ta.id
        WHERE cm.season = ? AND cm.round > 0
        ORDER BY cm.round, cm.id`,
        [game.season],
      );

      const roundMap = new Map<number, any[]>();
      for (const row of rows) {
        if (!roundMap.has(row.round)) roundMap.set(row.round, []);
        roundMap.get(row.round)!.push({
          id: row.id,
          homeTeam: row.home_name
            ? { id: row.home_team_id, name: row.home_name, color_primary: row.home_cp, color_secondary: row.home_cs, crest: row.home_crest }
            : null,
          awayTeam: row.away_name
            ? { id: row.away_team_id, name: row.away_name, color_primary: row.away_cp, color_secondary: row.away_cs, crest: row.away_crest }
            : null,
          homeScore: row.home_score,
          awayScore: row.away_score,
          homeEtScore: row.home_et_score,
          awayEtScore: row.away_et_score,
          homePenalties: row.home_penalties,
          awayPenalties: row.away_penalties,
          winnerId: row.winner_team_id,
          played: row.played === 1,
        });
      }

      const rounds = Array.from(roundMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([round, matches]) => ({
          round,
          roundName: CUP_ROUND_NAMES[round] || `Ronda ${round}`,
          matches,
        }));

      // Isentas dos 32 avos = quem não joga a ronda 1 (derivado, como no sorteio dos 16 avos).
      const exemptTeams = roundMap.has(1)
        ? await runAll(
            game.db,
            `SELECT id, name, color_primary, color_secondary, crest FROM teams
             WHERE id NOT IN (SELECT home_team_id FROM cup_matches WHERE season = ? AND round = 1
                              UNION SELECT away_team_id FROM cup_matches WHERE season = ? AND round = 1)
             ORDER BY division, name`,
            [game.season, game.season],
          )
        : [];

      socket.emit("cupBracketData", { season: game.season, rounds, exemptTeams });
    } catch (err) {
      console.error(`[${game.roomCode}] requestCupBracket error:`, err);
    }
  });

  // ── ET animation done ───────────────────────────────────────────────────────
  socket.on("cupExtraTimeDone", () => {
    const game = getGameBySocket(socket.id);
    if (!game || !game._cupETAnimHandler) return;
    // Só treinadores vinculados à sala alimentam o gate (acks de fora não contam).
    if (!getPlayerBySocket(game, socket.id)) return;
    game._cupETAnimHandler(socket.id);
  });

  // ── Cup draw acknowledged ───────────────────────────────────────────────────
  socket.on("cupDrawAcknowledged", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const name = game.socketToName[socket.id];
    if (name) {
      game.cupDrawSeenBy.add(name);
    }
  });

  // ── Legacy compat shims (no-ops) ────────────────────────────────────────────
  // Cup now uses the same lobby → setReady flow as league.
  // These events are kept so old clients don't throw errors, but do nothing.
  socket.on("cupKickOff", () => {});
  socket.on("cupHalfTimeReady", () => {});
  socket.on("cupSecondHalfDone", () => {});
  
  socket.on("leagueAnimDone", () => {});
}
