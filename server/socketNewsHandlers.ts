/**
 * Jornal Global — socket handlers.
 *
 * `getGlobalNews` devolve as notícias da equipa do treinador actual para a tab
 * "Jornal":
 *   - news:    club_news da equipa + transferências em que ela participa,
 *              de TODAS as épocas (o Jornal pagina por época no cliente),
 *              fundidas e ordenadas (ano desc, jornada desc, created_at desc, id desc), cap 600.
 *   - results: todas as partidas jogadas da época (Liga + Taça) com o MOM
 *              de cada equipa (match_moms).
 *
 * `globalNewsUpdated` (emit do servidor em weeklyFlow/cupFlow/recordTransfer)
 * dispara o refetch no cliente — o handler aqui só responde ao pedido.
 */
import type { ActiveGame } from "./types";

type AnyRow = Record<string, any>;
type RunAll = <T extends AnyRow = AnyRow>(
  db: any,
  sql: string,
  params?: any[],
) => Promise<T[]>;

interface NewsHandlerDeps {
  getGameBySocket: (socketId: string) => ActiveGame | null;
  runAll: RunAll;
}

const NEWS_LIMIT = 600;

export function registerNewsSocketHandlers(
  socket: any,
  deps: NewsHandlerDeps,
) {
  const { getGameBySocket, runAll } = deps;

  socket.on("getGlobalNews", async () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const season = game.season || 1;
    const year = game.year || 0;

    const fail = (error?: string) =>
      socket.emit(
        "globalNews",
        error ? { news: [], results: [], error } : { news: [], results: [] },
      );

    // Um só lookup: nome e equipa vêm da mesma entrada (antes eram dois scans).
    const entry = Object.entries(game.playersByName || {}).find(
      ([, player]: [string, any]) => player.socketId === socket.id,
    );
    const coachName = (entry && entry[0]) || null;
    const teamId = (entry?.[1] as any)?.teamId ?? null;
    if (teamId == null || !coachName) return fail();

    try {
      // ── Notícias da equipa: club_news + transfer_history ──────────────
      const clubRows = await runAll(
        game.db,
        `SELECT cn.id, cn.type, 'club' AS source, cn.title, cn.description,
                cn.team_id, cn.player_id, cn.player_name,
                p.photo AS player_photo, p.position AS player_position,
                cn.related_team_id, cn.related_team_name,
                cn.amount, cn.matchweek, cn.slot, cn.year, cn.created_at,
                t.name AS team_name, t.division
         FROM club_news cn
         LEFT JOIN teams t ON t.id = cn.team_id
         LEFT JOIN players p ON p.id = cn.player_id
         WHERE cn.team_id = ?
           AND cn.type NOT IN ('weekly_income', 'wages', 'stadium_upkeep', 'ticket_revenue')`,
        [teamId],
      );

      // Transferências da época (mercado + leilões + cláusulas + NPC).
      // Mesma forma de linha da club_news, com source='transfer'.
      const transferRows = await runAll(
        game.db,
        `SELECT th.id, th.source AS type, 'transfer' AS source,
                th.player_name || ' · ' || th.seller_team_name || ' → ' || th.buyer_team_name AS title,
                th.position AS description,
                th.player_id, th.player_name, th.photo AS player_photo,
                th.position AS player_position, th.skill, th.is_star,
                th.seller_team_id, th.seller_team_name,
                th.buyer_team_id AS related_team_id, th.buyer_team_name AS related_team_name,
                th.buyer_team_id AS team_id, th.buyer_team_name AS buyer_team_name,
                th.amount, th.matchweek, th.slot, th.year, th.created_at,
                th.buyer_team_name AS team_name, NULL AS division
         FROM transfer_history th
         WHERE th.seller_team_id = ? OR th.buyer_team_id = ?`,
        [teamId, teamId],
      );

      const newsRows = [...(clubRows || []), ...(transferRows || [])].sort(
        (a, b) =>
          (b.year || 0) - (a.year || 0) ||
          // Semana do calendário: o matchweek repete-se nas semanas de Taça.
          ((b.slot ?? b.matchweek) || 0) -
            ((a.slot ?? a.matchweek) || 0) ||
          String(b.created_at || "").localeCompare(
            String(a.created_at || ""),
          ) ||
          (b.id || 0) - (a.id || 0),
      );

      // ── MOMs da época (uma única query) ───────────────────────────────
      const momRows = await runAll(
        game.db,
        `SELECT mm.competition, mm.matchweek, mm.round, mm.team_id,
                mm.player_id, mm.player_name, mm.score
         FROM match_moms mm
         WHERE mm.season = ?`,
        [season],
      );
      const momsByKey: Record<string, any> = {};
      for (const m of momRows || []) {
        const key = `${m.competition}|${m.matchweek ?? ""}|${m.round ?? ""}|${m.team_id}`;
        momsByKey[key] = {
          playerId: m.player_id,
          playerName: m.player_name,
          score: m.score,
        };
      }

      // ── Resultados: Liga + Taça + Amigável ────────────────────────────
      const leagueRows = await runAll(
        game.db,
        `SELECT 'League' AS competition, m.matchweek, NULL AS round,
                m.home_team_id, m.away_team_id, m.home_score, m.away_score,
                m.attendance, th.stadium_capacity AS home_capacity,
                th.name AS home_name, ta.name AS away_name,
                th.division AS home_division, ta.division AS away_division
         FROM matches m
         JOIN teams th ON th.id = m.home_team_id
         JOIN teams ta ON ta.id = m.away_team_id
         WHERE m.season = ? AND m.played = 1
         ORDER BY m.matchweek DESC`,
        [season],
      );
      const cupRows = await runAll(
        game.db,
        `SELECT 'Cup' AS competition, NULL AS matchweek, cm.round,
                cm.home_team_id, cm.away_team_id, cm.home_score, cm.away_score,
                cm.attendance, th.stadium_capacity AS home_capacity,
                th.name AS home_name, ta.name AS away_name,
                th.division AS home_division, ta.division AS away_division
         FROM cup_matches cm
         JOIN teams th ON th.id = cm.home_team_id
         JOIN teams ta ON ta.id = cm.away_team_id
         WHERE cm.season = ? AND cm.round > 0 AND cm.played = 1
         ORDER BY cm.round DESC`,
        [season],
      );
      const friRows = await runAll(
        game.db,
        `SELECT 'Friendly' AS competition, NULL AS matchweek, cm.round,
                cm.home_team_id, cm.away_team_id, cm.home_score, cm.away_score,
                cm.attendance, th.stadium_capacity AS home_capacity,
                th.name AS home_name, ta.name AS away_name,
                th.division AS home_division, ta.division AS away_division
         FROM cup_matches cm
         JOIN teams th ON th.id = cm.home_team_id
         JOIN teams ta ON ta.id = cm.away_team_id
         WHERE cm.season = ? AND cm.round = 0 AND cm.played = 1
         ORDER BY cm.id`,
        [season],
      );

      const mkResults = (rows: any[]) =>
        rows.map((r) => {
          const homeKey = `${r.competition}|${r.matchweek ?? ""}|${r.round ?? ""}|${r.home_team_id}`;
          const awayKey = `${r.competition}|${r.matchweek ?? ""}|${r.round ?? ""}|${r.away_team_id}`;
          return {
            competition: r.competition,
            matchweek: r.matchweek ?? null,
            round: r.round ?? null,
            homeTeamId: r.home_team_id,
            awayTeamId: r.away_team_id,
            homeName: r.home_name,
            awayName: r.away_name,
            homeDivision: r.home_division,
            awayDivision: r.away_division,
            homeScore: r.home_score,
            awayScore: r.away_score,
            attendance: r.attendance ?? null,
            homeCapacity: r.home_capacity ?? null,
            momHome: momsByKey[homeKey] ?? null,
            momAway: momsByKey[awayKey] ?? null,
          };
        });

      // Leituras do treinador (fonte da verdade na BD;
      // o cliente usa-as para hidratar a cache local).
      const readRows = await runAll(
        game.db,
        `SELECT news_key FROM inbox_reads WHERE room_code = ? AND coach_name = ?`,
        [game.roomCode, coachName],
      );

      socket.emit("globalNews", {
        news: newsRows.slice(0, NEWS_LIMIT),
        results: mkResults([
          ...(leagueRows || []),
          ...(cupRows || []),
          ...(friRows || []),
        ]),
        reads: (readRows || [])
          .map((r) => r.news_key)
          .filter((k) => typeof k === "string"),
        year,
        season,
      });
    } catch (err: any) {
      console.error(`[getGlobalNews] (${game.roomCode}):`, err?.message || err);
      fail("Erro ao carregar o Jornal.");
    }
  });

  socket.on("markInboxRead", (data: any) => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const keys = Array.isArray(data?.keys)
      ? data.keys.filter((k: any) => typeof k === "string").slice(0, 400)
      : [];
    if (keys.length === 0) return;
    const entry = Object.entries(game.playersByName || {}).find(
      ([, player]: [string, any]) => player.socketId === socket.id,
    );
    const coachName = (entry && entry[0]) || null;
    if (!coachName) return;
    for (const key of keys) {
      game.db.run(
        `INSERT OR IGNORE INTO inbox_reads (room_code, coach_name, news_key) VALUES (?, ?, ?)`,
        [game.roomCode, coachName, key],
        () => {},
      );
    }
  });
}
