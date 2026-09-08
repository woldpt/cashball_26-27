import { memo, useMemo } from "react";
import { getMatchLastEventText } from "../../utils/playerHelpers.js";
import { FLASH_COLOR, isFlashing, isGoalType } from "./liveHelpers.js";

/* ── LiveFixtureRow — card de jogo ao vivo (3 contextos: divisão, outras
 *    divisões, taça) ─────────────────────────────────────────────────────
 *
 * Card único para todas as listas de jogos ao vivo: faixa de treinador
 * humano + nomes com dot de cor, marcador central com flash de golo e
 * últimos eventos no rodapé. Sem relógio: todos os jogos são simulados
 * em simultâneo, por isso o minuto vive só no hero do próprio jogo.
 */

/**
 * @param {Object} props
 * @param {Object} props.match - fixture do jogo
 * @param {Array} props.teams
 * @param {Array} props.players - treinadores humanos
 * @param {number} props.liveMinute
 * @param {Object} props.goalFlashRef
 * @param {Function} props.onOpenDetail
 */
function LiveFixtureRowInner({
  match,
  teams,
  players,
  liveMinute,
  goalFlashRef,
  onOpenDetail,
}) {
  const homeTeamId = match.homeTeamId;
  const awayTeamId = match.awayTeamId;
  const matchEvents = useMemo(() => match.events ?? [], [match.events]);

  // Lookups memorizados: as refs de teams/players são estáveis entre ticks
  // do liveMinute, por isso isto só recalcula quando os dados mudam.
  const homeTeam = useMemo(
    () => teams.find((t) => t.id === homeTeamId),
    [teams, homeTeamId],
  );
  const awayTeam = useMemo(
    () => teams.find((t) => t.id === awayTeamId),
    [teams, awayTeamId],
  );
  const homeCoach = useMemo(
    () => players.find((p) => p.teamId === homeTeamId),
    [players, homeTeamId],
  );
  const awayCoach = useMemo(
    () => players.find((p) => p.teamId === awayTeamId),
    [players, awayTeamId],
  );
  const isHumanMatch = homeCoach != null || awayCoach != null;

  // Contagem de golos num só passe (evita 2× filter por render).
  const { homeGoals, awayGoals } = useMemo(() => {
    let home = 0;
    let away = 0;
    for (const e of matchEvents) {
      if ((e.minute ?? -1) > liveMinute || !isGoalType(e.type)) continue;
      if (e.team === "home") home += 1;
      else if (e.team === "away") away += 1;
    }
    return { homeGoals: home, awayGoals: away };
  }, [matchEvents, liveMinute]);

  const { lastHomeEvent, lastAwayEvent } = useMemo(
    () => ({
      lastHomeEvent: getMatchLastEventText(matchEvents, liveMinute, "home"),
      lastAwayEvent: getMatchLastEventText(matchEvents, liveMinute, "away"),
    }),
    [matchEvents, liveMinute],
  );

  const homeFlashing = isFlashing(
    goalFlashRef,
    homeTeamId,
    awayTeamId,
    "home",
  );
  const awayFlashing = isFlashing(
    goalFlashRef,
    homeTeamId,
    awayTeamId,
    "away",
  );

  const homeName = homeTeam?.name ?? "—";
  const awayName = awayTeam?.name ?? "—";
  const coachStrip =
    homeCoach && awayCoach
      ? `${homeCoach.name} vs ${awayCoach.name}`
      : (homeCoach ?? awayCoach)?.name;

  return (
    <button
      type="button"
      onClick={onOpenDetail}
      aria-label={`Ver detalhes: ${homeName} ${homeGoals}-${awayGoals} ${awayName}`}
      className={`group w-full text-left rounded-lg overflow-hidden transition-colors border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
        isHumanMatch
          ? "bg-gradient-to-b from-amber-500/10 via-surface-container to-surface-container border-l-2 border-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.08)] hover:shadow-[0_0_20px_rgba(251,191,36,0.16)]"
          : "bg-surface-container hover:bg-surface-bright border-outline-variant/15"
      }`}
    >
      {/* Faixa única do treinador humano (o nome já não se repete por equipa) */}
      {isHumanMatch && (
        <div className="flex items-center justify-between gap-2 px-3 py-1 bg-amber-500/10 border-b border-amber-400/20">
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-400 shrink-0">
            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
            Treinador humano
          </span>
          <span
            className="text-[9px] font-bold text-amber-300/80 truncate"
            title={coachStrip}
          >
            {coachStrip}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <span className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0 transition-shadow"
            style={{
              background: homeTeam?.color_primary || "#555",
              boxShadow: homeFlashing ? `0 0 8px ${FLASH_COLOR}` : "none",
            }}
          />
          <span
            className={`text-[11px] sm:text-xs font-black truncate ${
              homeCoach ? "text-amber-300" : "text-on-surface/80"
            }`}
            title={homeName}
          >
            {homeName}
          </span>
        </span>

        <span
          role="status"
          className="font-headline font-black text-xs sm:text-sm tabular-nums shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface/60"
        >
          <span
            style={{
              color: homeFlashing ? FLASH_COLOR : undefined,
              transition: homeFlashing ? "none" : "color 1.25s ease",
            }}
          >
            {homeGoals}
          </span>
          <span className="text-on-surface-variant/30 text-xs">-</span>
          <span
            style={{
              color: awayFlashing ? FLASH_COLOR : undefined,
              transition: awayFlashing ? "none" : "color 1.25s ease",
            }}
          >
            {awayGoals}
          </span>
        </span>

        <span className="flex items-center gap-1.5 flex-1 min-w-0 pl-1 justify-end">
          <span
            className={`text-[11px] sm:text-xs font-black truncate text-right ${
              awayCoach ? "text-amber-300" : "text-on-surface/80"
            }`}
            title={awayName}
          >
            {awayName}
          </span>
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0 transition-shadow"
            style={{
              background: awayTeam?.color_primary || "#555",
              boxShadow: awayFlashing ? `0 0 8px ${FLASH_COLOR}` : "none",
            }}
          />
        </span>
      </div>

      {(lastHomeEvent || lastAwayEvent) && (
        <div className="flex px-3 pb-1.5 gap-1">
          <span
            className="flex-1 min-w-0 text-[10px] text-on-surface-variant/60 truncate"
            title={lastHomeEvent}
          >
            {lastHomeEvent}
          </span>
          <span
            className="flex-1 min-w-0 text-[10px] text-on-surface-variant/60 truncate text-right"
            title={lastAwayEvent}
          >
            {lastAwayEvent}
          </span>
        </div>
      )}
    </button>
  );
}

export const LiveFixtureRow = memo(LiveFixtureRowInner);
