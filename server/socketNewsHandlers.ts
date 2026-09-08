/**
 * Jornal Global — socket handlers.
 *
 * `getGlobalNews` devolve o agregado da época atual para a tab "Jornal":
 *   - news:    club_news de todos os clubes + transfer_history da época,
 *              fundidos e ordenados (jornada desc, created_at desc, id desc), cap 200.
 *   - results: todas as partidas jogadas da época (Liga + Taça) com o MOM
 *              de cada equipa (match_moms).
 *
 * `globalNewsUpdated` (emit do servidor em weeklyFlow/cupFlow/recordTransfer)
 * dispara o refetch no cliente — o handler aqui só responde ao pedido.
 */
import type { ActiveGame } from "./types";

interface NewsHandlerDeps {
  getGameBySocket: (socketId: string) => ActiveGame | null;
}

const NEWS_LIMIT = 200;

export function registerNewsSocketHandlers(
  socket: any,
  deps: NewsHandlerDeps,
) {
  const { getGameBySocket } = deps;

  socket.on("getGlobalNews", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const season = game.season || 1;
    const year = game.year || 0;

    const fail = () => socket.emit("globalNews", { news: [], results: [] });

    try {
      // ── Notícias da época: club_news + transfer_history (fundidos) ────
      game.db.all(
        `SELECT cn.id, cn.type, 'club' AS source, cn.title, cn.description,
                cn.player_id, cn.player_name,
                cn.related_team_id, cn.related_team_name,
                cn.amount, cn.matchweek, cn.year, cn.created_at,
                t.name AS team_name, t.division
         FROM club_news cn
         LEFT JOIN teams t ON t.id = cn.team_id
         WHERE cn.year = ?`,
        [year],
        (newsErr: Error | null, clubRows: any[] | null) => {
          if (newsErr || !clubRows) {
            if (newsErr)
              console.warn(
                `[getGlobalNews] news query failed (${game.roomCode}):`,
                newsErr.message,
              );
            return fail();
          }

          // Transferências da época (mercado + leilões + cláusulas + NPC).
          // Mesma forma de linha da club_news, com source='transfer'.
          game.db.all(
            `SELECT th.id, th.source AS type, 'transfer' AS source,
                    th.player_name || ' · ' || th.seller_team_name || ' → ' || th.buyer_team_name AS title,
                    th.position AS description,
                    th.player_id, th.player_name,
                    th.buyer_team_id AS related_team_id, th.buyer_team_name AS related_team_name,
                    th.amount, th.matchweek, th.year, th.created_at,
                    th.buyer_team_name AS team_name, NULL AS division
             FROM transfer_history th
             WHERE th.year = ?`,
            [year],
            (trErr: Error | null, transferRows: any[] | null) => {
              if (trErr) {
                console.warn(
                  `[getGlobalNews] transfers query failed (${game.roomCode}):`,
                  trErr.message,
                );
                return fail();
              }
              const newsRows = [...(clubRows || []), ...(transferRows || [])].sort(
                (a, b) =>
                  (b.matchweek || 0) - (a.matchweek || 0) ||
                  String(b.created_at || "").localeCompare(
                    String(a.created_at || ""),
                  ) ||
                  (b.id || 0) - (a.id || 0),
              );

              emitNews(newsRows);
            },
          );
        },
      );

      const emitNews = (newsRows: any[]) => {
          // ── MOMs da época (uma única query) ───────────────────────────
          game.db.all(
            `SELECT mm.competition, mm.matchweek, mm.round, mm.team_id,
                    mm.player_id, mm.player_name, mm.score
             FROM match_moms mm
             WHERE mm.season = ?`,
            [season],
            (momErr: Error | null, momRows: any[] | null) => {
              if (momErr) {
                console.warn(
                  `[getGlobalNews] moms query failed (${game.roomCode}):`,
                  momErr.message,
                );
                return fail();
              }
              const momsByKey: Record<string, any> = {};
              for (const m of momRows || []) {
                const key = `${m.competition}|${m.matchweek ?? ""}|${m.round ?? ""}|${m.team_id}`;
                momsByKey[key] = {
                  playerId: m.player_id,
                  playerName: m.player_name,
                  score: m.score,
                };
              }

              // ── Resultados: Liga ──────────────────────────────────────
              game.db.all(
                `SELECT 'League' AS competition, m.matchweek, NULL AS round,
                        m.home_team_id, m.away_team_id, m.home_score, m.away_score,
                        th.name AS home_name, ta.name AS away_name,
                        th.division AS home_division, ta.division AS away_division
                 FROM matches m
                 JOIN teams th ON th.id = m.home_team_id
                 JOIN teams ta ON ta.id = m.away_team_id
                 WHERE m.season = ? AND m.played = 1
                 ORDER BY m.matchweek DESC`,
                [season],
                (leagErr: Error | null, leagueRows: any[] | null) => {
                  if (leagErr) {
                    console.warn(
                      `[getGlobalNews] league results failed (${game.roomCode}):`,
                      leagErr.message,
                    );
                    return fail();
                  }
                  // ── Resultados: Taça ────────────────────────────────────
                  game.db.all(
                    `SELECT 'Cup' AS competition, NULL AS matchweek, cm.round,
                            cm.home_team_id, cm.away_team_id, cm.home_score, cm.away_score,
                            th.name AS home_name, ta.name AS away_name,
                            th.division AS home_division, ta.division AS away_division
                     FROM cup_matches cm
                     JOIN teams th ON th.id = cm.home_team_id
                     JOIN teams ta ON ta.id = cm.away_team_id
                     WHERE cm.season = ? AND cm.played = 1
                     ORDER BY cm.round DESC`,
                    [season],
                    (cupErr: Error | null, cupRows: any[] | null) => {
                      if (cupErr) {
                        console.warn(
                          `[getGlobalNews] cup results failed (${game.roomCode}):`,
                          cupErr.message,
                        );
                        return fail();
                      }
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
                            momHome: momsByKey[homeKey] ?? null,
                            momAway: momsByKey[awayKey] ?? null,
                          };
                        });
                      socket.emit("globalNews", {
                        news: newsRows.slice(0, NEWS_LIMIT),
                        results: [...(leagueRows || []), ...(cupRows || [])].map(
                          mkResults,
                        ),
                        year,
                        season,
                      });
                    },
                  );
                },
              );
            },
          );
      };
    } catch (err: any) {
      console.error(`[getGlobalNews] unexpected error (${game.roomCode}):`, err);
      fail();
    }
  });
}
