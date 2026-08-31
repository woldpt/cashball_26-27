import { DIVISION_NAMES, CUP_FINAL_STADIUM } from "../../constants/index.js";
import { PlayerLink } from "../shared/PlayerLink.jsx";
import { OddsBadge } from "../shared/OddsBadge.jsx";
import { PreMatchIntro, KickoffBadge } from "../match/shared/index.js";
import { TeamCrest } from "./TeamCrest.jsx";
import { FLASH_COLOR, isFlashing, isGoalType, isDrawnAt90, matchEventIcon, parseOdds } from "./liveHelpers.js";

const WEATHER_LABELS = {
  "☀️": "Sol",
  "🌧️": "Chuva",
  "⛈️": "Chuva forte",
  "💨": "Vento",
  "🥶": "Frio",
  "🌫️": "Nevoeiro",
  "❄️": "Neve",
};

/* ── Commentary tier styles — efeitos visuais subtis para eventos-chave ── */
const COMMENTARY_EFFECTS = {
  goal: { className: "text-emerald-400/90", effect: "pop" },
  penalty_goal: { className: "text-emerald-400/90", effect: "pop" },
  var_disallowed: { className: "text-amber-400/90", effect: "shake" },
  red: { className: "text-red-400/90", effect: "shake" },
  penalty_miss: { className: "text-amber-400/80", effect: "pulse", pulseColor: "rgba(251, 191, 36, 0.5)" },
  near_miss: { className: "text-sky-400/80", effect: "pulse", pulseColor: "rgba(56, 189, 248, 0.45)" },
};

/* ── LiveMatchHero — painel do meu jogo (scoreboard estilo broadcast) ────
 *
 * Hierarquia: meta strip (competição + LIVE) → info strip (estádio ·
 * clima · odds) → broadcast bar (equipas + placar central + fase/minuto) →
 * colunas de eventos → timeline + comentário → pre-match intros.
 */

/**
 * @param {Object} props
 * @param {Object|null} props.myMatch
 * @param {Array} props.teams
 * @param {Array} props.players
 * @param {Object} props.me
 * @param {number} props.liveMinute
 * @param {boolean} props.isPlayingMatch
 * @param {boolean} props.isMatchActionPending
 * @param {boolean} props.isCupMatch
 * @param {string|undefined} props.cupMatchRoundName
 * @param {boolean} props.cupPreMatch
 * @param {Object|null} props.substitutionPause
 * @param {Object} props.goalFlashRef
 * @param {boolean} props.isCupExtraTime
 * @param {Object|null} props.matchResults
 * @param {Function} props.onScoreClick
 */
export function LiveMatchHero({
  myMatch,
  teams,
  players,
  me,
  liveMinute,
  isPlayingMatch,
  isMatchActionPending,
  isCupMatch,
  cupMatchRoundName,
  substitutionPause,
  goalFlashRef,
  isCupExtraTime,
  matchResults,
  onScoreClick,
}) {
  if (!myMatch) return null;

  const hInfo = teams.find((t) => t.id === myMatch.homeTeamId);
  const aInfo = teams.find((t) => t.id === myMatch.awayTeamId);
  const isCupFinal = isCupMatch && cupMatchRoundName === "Final";
  const stadiumName = isCupFinal ? CUP_FINAL_STADIUM : hInfo?.stadium_name;
  const matchEvents = myMatch.events || [];
  const weatherEvent = matchEvents.find((e) => e.type === "weather");
  const bettingEvt = matchEvents.find((e) => e.type === "betting");
  const odds = parseOdds(bettingEvt?.text);

  // If ET is running for other fixtures but my match was decided at 90', hide this block
  if (isCupExtraTime && !isDrawnAt90(myMatch)) return null;

  const homeGoals = matchEvents.filter(
    (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "home",
  );
  const awayGoals = matchEvents.filter(
    (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "away",
  );
  const maxMinute = isCupExtraTime ? 120 : 90;
  const progress = Math.min(100, (liveMinute / maxMinute) * 100);

  // eslint-disable-next-line react-hooks/purity
  const nowTs = Date.now();
  const myHomeFlashing = isFlashing(goalFlashRef, myMatch.homeTeamId, myMatch.awayTeamId, "home", nowTs);
  const myAwayFlashing = isFlashing(goalFlashRef, myMatch.homeTeamId, myMatch.awayTeamId, "away", nowTs);

  const homeCoach = players.find((p) => p.teamId === myMatch.homeTeamId);
  const awayCoach = players.find((p) => p.teamId === myMatch.awayTeamId);
  const homeIsMine = myMatch.homeTeamId === me?.teamId;
  const awayIsMine = myMatch.awayTeamId === me?.teamId;

  const phaseLabel = liveMinute > 90 ? "Prolongamento" : liveMinute > 45 ? "2ª Parte" : "1ª Parte";
  const flashStyle = (flashing) => ({
    color: flashing ? FLASH_COLOR : undefined,
    textShadow: flashing ? `0 0 22px ${FLASH_COLOR}90` : "none",
    transform: flashing ? "scale(1.12)" : "scale(1)",
    transition: flashing ? "none" : "color 1.25s ease, text-shadow 1.25s ease, transform 1.25s ease",
    display: "inline-block",
  });

  // Determina o lado de cada evento pelo jogador real (via lineups) — os eventos
  // ficam sempre por baixo da equipa a que o jogador pertence, mesmo que o campo
  // `team` chegue com o lado trocado (defensivo contra dados divergentes).
  const lineupSideById = new Map();
  (myMatch.homeLineup || []).forEach((p) => lineupSideById.set(p.id, "home"));
  (myMatch.awayLineup || []).forEach((p) => lineupSideById.set(p.id, "away"));
  const resolveSide = (e) => {
    if (e.playerId != null && lineupSideById.has(e.playerId)) {
      return lineupSideById.get(e.playerId);
    }
    return e.team;
  };

  const homeEvents = matchEvents
    .filter(
      (e) =>
        e.minute <= liveMinute &&
        resolveSide(e) === "home" &&
        [
          "goal", "penalty_goal", "own_goal", "var_disallowed", "var_goal_pending",
          "yellow", "red", "injury", "substitution", "halftime_sub",
        ].includes(e.type),
    )
    .sort((a, b) => a.minute - b.minute);
  const awayEvents = matchEvents
    .filter(
      (e) =>
        e.minute <= liveMinute &&
        resolveSide(e) === "away" &&
        [
          "goal", "penalty_goal", "own_goal", "var_disallowed", "var_goal_pending",
          "yellow", "red", "injury", "substitution", "halftime_sub",
        ].includes(e.type),
    )
    .sort((a, b) => a.minute - b.minute);

  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-container-low border border-outline-variant/10">
      {/* Stadium radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 90% 50% at 50% 0%, ${hInfo?.color_primary || "#333"}18 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-4 pt-5 pb-4">
        {/* ── Meta strip ── */}
        <div className="flex items-center justify-between w-full mb-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/50 font-black">
            {isCupMatch
              ? `Taça · ${cupMatchRoundName}`
              : `${DIVISION_NAMES[hInfo?.division] || ""} · Jornada ${matchResults?.matchweek ?? "—"}`}
          </span>
          <div className="flex items-center gap-2">
            {isPlayingMatch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/30 text-error text-[9px] font-black uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                AO VIVO
              </span>
            )}
            {!isPlayingMatch && isCupMatch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-widest">
                🏆 {cupMatchRoundName}
              </span>
            )}
          </div>
        </div>

        {/* Banner de pausa de substituição — visível aos outros treinadores */}
        {substitutionPause && (
          <div className="w-full mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[16px] shrink-0">
              pause_circle
            </span>
            <span>
              {substitutionPause.coachName} está a fazer substituições...
            </span>
          </div>
        )}

        {/* ── Info strip: estádio · clima · odds ── */}
        {(myMatch.attendance || weatherEvent || odds) && (
          <div className="flex items-center justify-center gap-2 flex-wrap mb-4 text-[10px] text-on-surface-variant/60">
            {myMatch.attendance && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high/60 border border-outline-variant/15">
                <span className="material-symbols-outlined text-[13px] leading-none">
                  stadium
                </span>
                {stadiumName ? `${stadiumName} · ` : ""}
                {myMatch.attendance.toLocaleString("pt-PT")} adeptos
              </span>
            )}
            {weatherEvent && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-400/10 border border-sky-400/20 text-sky-300/90">
                <span>{weatherEvent.emoji}</span>
                {WEATHER_LABELS[weatherEvent.emoji] || ""}
              </span>
            )}
            {odds && (
              <OddsBadge
                odds={odds}
                hColor={hInfo?.color_primary}
                aColor={aInfo?.color_primary}
              />
            )}
          </div>
        )}

        {/* ── Broadcast scoreboard ── */}
        <div className="w-full max-w-2xl rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container shadow-lg shadow-black/30">
          <div className="flex items-stretch">
            {/* Home side */}
            <div
              className="flex-1 flex flex-col sm:flex-row items-center gap-3 px-2.5 sm:px-5 py-3 min-w-0"
              style={{
                background: `linear-gradient(100deg, ${hInfo?.color_primary || "#333"}2e 0%, transparent 90%)`,
              }}
            >
              <TeamCrest team={hInfo} isMine={homeIsMine} coach={homeCoach} size="sm" />
              <div className="flex flex-col min-w-0 w-full sm:w-auto">
                <span className="text-[11px] sm:text-sm font-black font-headline uppercase tracking-tight text-on-surface truncate text-center sm:text-left">
                  {hInfo?.name}
                </span>
                {homeCoach && (
                  <span className="hidden sm:block text-[9px] font-bold text-amber-400 truncate">
                    {homeCoach.name}
                  </span>
                )}
              </div>
            </div>

            {/* Center score — clique para substituição/detalhe */}
            <button
              onClick={onScoreClick}
              title={
                isPlayingMatch && !isMatchActionPending
                  ? "Pedir substituição"
                  : "Ver detalhes da partida"
              }
              className="shrink-0 flex flex-col items-center justify-center px-1.5 min-[430px]:px-2.5 sm:px-6 py-2 bg-surface/80 border-x border-outline-variant/15 cursor-pointer group"
            >
              <div className="font-headline font-black text-2xl min-[430px]:text-3xl sm:text-5xl tracking-tighter tabular-nums flex items-center gap-1 min-[430px]:gap-1.5 sm:gap-2 whitespace-nowrap">
                <span style={flashStyle(myHomeFlashing)}>{homeGoals.length}</span>
                <span className="text-on-surface/20 text-xl sm:text-3xl">:</span>
                <span style={flashStyle(myAwayFlashing)}>{awayGoals.length}</span>
              </div>
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mt-1 tabular-nums truncate max-w-full">
                {liveMinute > 90 ? "Prol. " : ""}
                {liveMinute < 1 ? "A começar…" : `${liveMinute}' · ${phaseLabel}`}
              </span>
            </button>

            {/* Away side */}
            <div
              className="flex-1 flex flex-col-reverse sm:flex-row items-center justify-center sm:justify-end gap-3 px-2.5 sm:px-5 py-3 min-w-0"
              style={{
                background: `linear-gradient(260deg, ${aInfo?.color_primary || "#333"}2e 0%, transparent 90%)`,
              }}
            >
              <div className="flex flex-col min-w-0 w-full sm:w-auto">
                <span className="text-[11px] sm:text-sm font-black font-headline uppercase tracking-tight text-on-surface truncate text-center sm:text-right">
                  {aInfo?.name}
                </span>
                {awayCoach && (
                  <span className="hidden sm:block text-[9px] font-bold text-amber-400 truncate text-right">
                    {awayCoach.name}
                  </span>
                )}
              </div>
              <TeamCrest team={aInfo} isMine={awayIsMine} coach={awayCoach} size="sm" />
            </div>
          </div>
        </div>

        {/* ── Team events columns ── */}
        <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mt-5 px-1">
          <TeamEvents events={homeEvents} align="left" />
          <TeamEvents events={awayEvents} align="right" />
        </div>

        {/* ── Timeline + attendance ── */}
        <div className="w-full max-w-2xl mt-5 space-y-1.5">
          <div className="relative h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
            {matchEvents
              .filter(
                (e) =>
                  e.minute <= liveMinute &&
                  ["goal", "penalty_goal", "own_goal", "red", "penalty_miss"].includes(e.type),
              )
              .map((e, i) => {
                const isHomeEvent = e.team === "home";
                const dotColor =
                  isGoalType(e.type) || e.type === "own_goal"
                    ? isHomeEvent
                      ? hInfo?.color_primary || "#fff"
                      : aInfo?.color_primary || "#aaa"
                    : e.type === "red"
                      ? "#ef4444"
                      : "#a855f7";
                return (
                  <span
                    key={`${e.minute}-${e.type}-${e.playerId || i}`}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                    style={{
                      left: `${Math.min(98, Math.max(2, (e.minute / maxMinute) * 100))}%`,
                    }}
                  >
                    <span
                      className="block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
                    />
                  </span>
                );
              })}
          </div>
          <div className="flex justify-between text-[14px] text-on-surface-variant/30 tabular-nums">
            <span>0'</span>
            <span className="font-bold text-primary/60">{liveMinute}'</span>
            <span>{isCupExtraTime ? "120'" : "90'"}</span>
          </div>

          {/* ── Commentary phrase ── */}
          {(() => {
            const latestWithText = [...matchEvents]
              .filter((e) => e.minute <= liveMinute && e.text)
              .sort((a, b) => b.minute - a.minute)[0];
            if (!latestWithText) return null;
            const phrase = latestWithText.text
              .replace(/^\[(?:\d+'|HT)\]\s*\S*\s*/, "")
              .trim();
            if (!phrase) return null;
            const tier = COMMENTARY_EFFECTS[latestWithText.type] || null;
            const effectCls = tier?.effect
              ? `commentary-effect commentary-effect--${tier.effect}`
              : "";
            const phraseStyle = {
              fontFamily: "Georgia, 'Times New Roman', serif",
              animationDuration:
                tier?.effect === "pulse"
                  ? "1.4s"
                  : tier?.effect
                    ? "0.6s"
                    : undefined,
            };
            if (tier?.effect === "pulse" && tier.pulseColor) {
              phraseStyle["--pulse-color"] = tier.pulseColor;
            }
            return (
              <div
                key={`${latestWithText.minute}-${latestWithText.type}`}
                className="w-full text-center pt-3 pb-0.5 px-2"
                style={{ animation: "commentaryFadeIn 0.6s ease" }}
              >
                <p
                  className={`text-[11px] sm:text-[16px] leading-snug italic font-medium tracking-wide line-clamp-2 ${effectCls} ${
                    tier?.className || "text-on-surface-variant/55"
                  }`}
                  style={phraseStyle}
                >
                  "{phrase}"
                </p>
              </div>
            );
          })()}
        </div>

        {/* ── Pre-match intros (5s pause) + kickoff moments ── */}
        <PreMatchIntro
          matchEvents={matchEvents}
          liveMinute={liveMinute}
          isPlayingMatch={isPlayingMatch}
          hInfo={hInfo}
          aInfo={aInfo}
        />
        {isPlayingMatch && (liveMinute === 45 || liveMinute === 90) && (
          <KickoffBadge
            label={liveMinute === 45 ? "2ª PARTE" : "PROLONGAMENTO"}
            hColor={hInfo?.color_primary || "#6366f1"}
            aColor={aInfo?.color_primary || "#f43f5e"}
          />
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function TeamEvents({ events, align }) {
  // Nota: nunca devolver `null` aqui — o pai é uma `grid grid-cols-2` e um child
  // vazio tem de ocupar a sua coluna, senão o grid desloca a coluna seguinte
  // para a esquerda (eventos de fora apareciam sob a equipa da casa).
  const isRight = align === "right";
  return (
    <div className={`flex flex-col gap-0.5 ${isRight ? "items-end" : "items-start"}`}>
      {events.map((e, i) => {
        const isSub = e.type === "substitution" || e.type === "halftime_sub";
        const subOutName = e.type === "halftime_sub" ? e.outPlayerName : null;
        const name = e.playerName || e.player_name || e.player || "?";
        const minuteLabel = e.type === "halftime_sub" ? "HT" : `${e.minute}'`;
        const isGoal = isGoalType(e.type);
        const nameCls = `font-bold truncate min-w-0 ${
          isGoal
            ? "text-primary"
            : e.type === "own_goal"
              ? "text-orange-400"
              : e.type === "var_disallowed"
                ? "text-amber-400/60 line-through"
                : e.type === "red"
                  ? "text-red-400"
                  : isSub
                    ? "text-emerald-400/80"
                    : "text-on-surface-variant/70"
        }`;
        const icon = <span className="shrink-0">{matchEventIcon(e.type)}</span>;
        const minuteEl = (
          <span className="text-on-surface-variant/40 tabular-nums shrink-0">
            {minuteLabel}
          </span>
        );
        const nameEl = (
          <span className={`flex items-center gap-1 min-w-0 ${nameCls}`}>
            <span className="truncate min-w-0">
              {isSub && subOutName ? (
                <span className="opacity-60 line-through mr-0.5">{subOutName}</span>
              ) : null}
              <PlayerLink playerId={e.playerId}>{name}</PlayerLink>
            </span>
            {e.type === "penalty_goal" && (
              <span className="shrink-0 text-[8px] font-black uppercase px-1 py-px rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest">
                Pen.
              </span>
            )}
          </span>
        );
        return (
          <div
            key={`${e.minute}-${e.type}-${e.playerId || name}-${i}`}
            className={`flex items-center gap-1 text-[9px] leading-tight w-full ${isRight ? "justify-end" : "justify-start"}`}
          >
            {isRight ? [nameEl, icon, minuteEl] : [minuteEl, icon, nameEl]}
          </div>
        );
      })}
    </div>
  );
}
