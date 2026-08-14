import { getMatchLastEventText } from "../../utils/playerHelpers.js";
import { FLASH_COLOR, isFlashing, isGoalType } from "./liveHelpers.js";

/* ── LiveFixtureRow — card de jogo ao vivo (3 contextos: divisão, outras
 *    divisões, taça) ─────────────────────────────────────────────────────
 *
 * Card único para todas as listas de jogos ao vivo: dot de cor + nome +
 * treinador (amber), placar central com flash de golo, últimos eventos no
 * rodapé. Substitui as 3 implementações copy-paste do GameLayout.
 */

/**
 * @param {Object} props
 * @param {Object} props.match  - fixture do jogo
 * @param {Array} props.teams
 * @param {Array} props.players - treinadores humanos
 * @param {Object} props.me
 * @param {number} props.liveMinute
 * @param {Object} props.goalFlashRef
 * @param {Function} props.onOpenDetail
 */
export function LiveFixtureRow({
  match,
  teams,
  players,
  liveMinute,
  goalFlashRef,
  onOpenDetail,
}) {
  const hInfo = teams.find((t) => t.id === match.homeTeamId);
  const aInfo = teams.find((t) => t.id === match.awayTeamId);
  const matchEvents = match.events || [];
  const homeGoals = matchEvents.filter(
    (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "home",
  );
  const awayGoals = matchEvents.filter(
    (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "away",
  );
  const homeHuman = players.some((p) => p.teamId === match.homeTeamId);
  const awayHuman = players.some((p) => p.teamId === match.awayTeamId);
  const isHumanMatch = homeHuman || awayHuman;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const homeFlashing = isFlashing(goalFlashRef, match.homeTeamId, match.awayTeamId, "home", now);
  const awayFlashing = isFlashing(goalFlashRef, match.homeTeamId, match.awayTeamId, "away", now);
  const lastHomeEvent = getMatchLastEventText(matchEvents, liveMinute, "home");
  const lastAwayEvent = getMatchLastEventText(matchEvents, liveMinute, "away");
  const homeCoach = players.find((p) => p.teamId === match.homeTeamId);
  const awayCoach = players.find((p) => p.teamId === match.awayTeamId);

  return (
    <button
      onClick={onOpenDetail}
      className={`group w-full text-left rounded-lg overflow-hidden transition-all border ${
        isHumanMatch
          ? "bg-primary-container/10 border-l-2 border-primary/60"
          : "bg-surface-container hover:bg-surface-bright border-outline-variant/15"
      } hover:-translate-y-px hover:shadow-lg hover:shadow-black/30`}
    >
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <span className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
          <span
            className="w-2 h-2 rounded-full shrink-0 transition-shadow"
            style={{
              background: hInfo?.color_primary || "#555",
              boxShadow: homeFlashing ? `0 0 8px ${FLASH_COLOR}` : "none",
            }}
          />
          <span className="flex flex-col min-w-0">
            <span
              className={`text-[10px] sm:text-[11px] font-black truncate ${
                homeHuman ? "text-primary" : "text-on-surface/80"
              }`}
            >
              {hInfo?.name}
            </span>
            {homeCoach && (
              <span className="text-[9px] text-amber-400 font-bold truncate leading-none">
                {homeCoach.name}
              </span>
            )}
          </span>
        </span>

        <span className="font-headline font-black text-xs sm:text-sm tabular-nums shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface/60">
          <span
            style={{
              color: homeFlashing ? FLASH_COLOR : undefined,
              transition: homeFlashing ? "none" : "color 1.25s ease",
            }}
          >
            {homeGoals.length}
          </span>
          <span className="text-on-surface-variant/30 text-xs">-</span>
          <span
            style={{
              color: awayFlashing ? FLASH_COLOR : undefined,
              transition: awayFlashing ? "none" : "color 1.25s ease",
            }}
          >
            {awayGoals.length}
          </span>
        </span>

        <span className="flex items-center gap-1.5 flex-1 min-w-0 pl-1 justify-end">
          <span className="flex flex-col min-w-0 items-end">
            <span
              className={`text-[10px] sm:text-[11px] font-black truncate ${
                awayHuman ? "text-primary" : "text-on-surface/80"
              }`}
            >
              {aInfo?.name}
            </span>
            {awayCoach && (
              <span className="text-[9px] text-amber-400 font-bold truncate leading-none">
                {awayCoach.name}
              </span>
            )}
          </span>
          <span
            className="w-2 h-2 rounded-full shrink-0 transition-shadow"
            style={{
              background: aInfo?.color_primary || "#555",
              boxShadow: awayFlashing ? `0 0 8px ${FLASH_COLOR}` : "none",
            }}
          />
        </span>
      </div>

      {(lastHomeEvent || lastAwayEvent) && (
        <div className="flex px-3 pb-1.5 gap-1">
          <span className="flex-1 text-[9px] text-on-surface-variant/40 truncate">
            {lastHomeEvent}
          </span>
          <span className="flex-1 text-[9px] text-on-surface-variant/40 truncate text-right">
            {lastAwayEvent}
          </span>
        </div>
      )}
    </button>
  );
}
