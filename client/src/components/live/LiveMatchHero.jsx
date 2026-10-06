import { createPortal } from "react-dom";
import { DIVISION_NAMES, CUP_FINAL_STADIUM } from "../../constants/index.js";
import { PlayerLink } from "../shared/PlayerLink.jsx";
import { OddsBadge } from "../shared/OddsBadge.jsx";
import { LivePitchStrip } from "./LivePitchStrip.jsx";
import { usePhaseAnnounce, PreMatchIntro, FinalWhistleStamp, WeatherOverlay } from "../match/shared/index.js";
import { TeamCrest } from "./TeamCrest.jsx";
import { TeamKit } from "../shared/TeamKit.jsx";
import { useKitClash } from "../../hooks/useKitClash.js";
import { Button } from "../shared/Button.jsx";
import { FLASH_COLOR, isFriendlyMatch, isFlashing, isGoalType, isDrawnAt90, liveFeed, liveScore, matchEventIcon, parseOdds, resolveEventSide, teamTextColor } from "./liveHelpers.js";

/* Texto do banner de pausa por tipo de decisão (visível aos outros coaches) */
const PAUSE_TEXT = {
  user_substitution: "está a fazer substituições...",
  injury: "está a tratar uma lesão...",
  penalty: "vai marcar um penálti...",
  emergency_gk: "está a reorganizar a equipa...",
  gk_red_card: "está a reorganizar a equipa...",
};

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
  own_goal: { className: "text-orange-400/90", effect: "pop" },
  var_disallowed: { className: "text-amber-400/90", effect: "shake" },
  red: { className: "text-red-400/90", effect: "shake" },
  penalty_miss: { className: "text-amber-400/80", effect: "pulse", pulseColor: "rgba(251, 191, 36, 0.5)" },
  near_miss: { className: "text-sky-400/80", effect: "pulse", pulseColor: "rgba(56, 189, 248, 0.45)" },
  chance: { effect: "pulse" },
};

/* Lances que ficam sob o marcador, por equipa. */
const SCORER_TYPES = ["goal", "penalty_goal", "own_goal", "var_disallowed", "var_goal_pending", "red"];

/* ── LiveMatchHero — painel do meu jogo (marcador estilo broadcast) ──────
 *
 * Hierarquia: meta strip (competição) → info strip (estádio · clima · odds)
 * → broadcast bar (equipas + marcador + fase/minuto) → marcadores de golos
 * → cronómetro → botão Pausa →
 * feed de lances → pre-match intros.
 */

/**
 * @param {Object} props
 * @param {Object|null} props.myMatch
 * @param {Object|null} props.mom  - {home, away} do "Jogador do Jogo" (pós-jogo)
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
 * @param {Object|null} [props.finalWhistle] - selo do apito final ({outcome, myGoals, oppGoals}).
 * @param {Function} props.onScoreClick
 * @param {boolean} [props.readOnly] - modo só-visualização (final sem o
 *   utilizador): o marcador não é clicável nem pede substituições.
 * @param {boolean} [props.hideScoreboard] - esconde a meta strip e a barra
 *   broadcast (emblemas + marcador); usado na Final fundida, onde o
 *   `CupFinalStage` já mostra o frente-a-frente com o marcador ao centro.
 * @param {import("react").Ref<HTMLDivElement>} [props.scoreRef] - ref do
 *   marcador (a LiveView observa-o para mostrar o marcador fixo no topo).
 */
export function LiveMatchHero({
  myMatch,
  mom,
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
  finalWhistle = null,
  readOnly = false,
  hideScoreboard = false,
  scoreRef,
}) {
  const hInfo = myMatch ? teams.find((t) => t.id === myMatch.homeTeamId) : null;
  const aInfo = myMatch ? teams.find((t) => t.id === myMatch.awayTeamId) : null;
  // Empate de camisolas de casa: a equipa de fora veste a sua de fora.
  const clash = useKitClash(hInfo?.crest, aInfo?.crest);
  const phaseAnnounce = usePhaseAnnounce(liveMinute, isPlayingMatch);
  if (!myMatch) return null;
  // Amigável (ronda 0): sem prefixo "Taça ·" nem estética de taça.
  // Amigável (pré-época ou dos eliminados na semana da Taça): sem estética de taça.
  const isFriendly = isFriendlyMatch(myMatch) || /amigável/i.test(cupMatchRoundName || "");
  const roundLabel = isFriendly && !/amigável/i.test(cupMatchRoundName || "") ? "Amigável" : cupMatchRoundName;
  const isCupFinal = isCupMatch && !isFriendly && cupMatchRoundName === "Final";
  const stadiumName = isCupFinal ? CUP_FINAL_STADIUM : hInfo?.stadium_name;
  // Cores das equipas para a cenografia de luz (fallbacks estáveis).
  const hCol = hInfo?.color_primary || "#3b82f6";
  const aCol = aInfo?.color_primary || "#f43f5e";
  const matchEvents = myMatch.events || [];
  const weatherEvent = matchEvents.find((e) => e.type === "weather");
  const bettingEvt = matchEvents.find((e) => e.type === "betting");
  const odds = parseOdds(bettingEvt?.text);

  // If ET is running for other fixtures but my match was decided at 90', hide this block
  if (isCupExtraTime && !isDrawnAt90(myMatch)) return null;

  const score = liveScore(matchEvents, liveMinute);
  const maxMinute = isCupExtraTime ? 120 : 90;
  const progress = Math.min(100, (liveMinute / maxMinute) * 100);

  // Lado em vantagem (para a aura de liderança do marcador).
  const diffGoals = score.home - score.away;
  const leadSide = diffGoals > 0 ? "home" : diffGoals < 0 ? "away" : null;
  const leadColor =
    leadSide === "home" ? hCol : leadSide === "away" ? aCol : null;

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

  // Determina o lado de cada evento: por defeito a equipa real do jogador
  // (via lineups), exceto auto-golos que seguem SEMPRE `e.team` (beneficiada).
  const lineupSideById = new Map();
  (myMatch.homeLineup || []).forEach((p) => lineupSideById.set(p.id, "home"));
  (myMatch.awayLineup || []).forEach((p) => lineupSideById.set(p.id, "away"));
  const resolveSide = (e) => resolveEventSide(e, lineupSideById);

  // Sob o marcador só golos e vermelhos (o resto do jogo vive no feed).
  const sideEvents = (side) =>
    matchEvents
      .filter(
        (e) =>
          e.minute <= liveMinute &&
          SCORER_TYPES.includes(e.type) &&
          resolveSide(e) === side,
      )
      .sort((a, b) => a.minute - b.minute);
  const homeEvents = sideEvents("home");
  const awayEvents = sideEvents("away");

  const canSub = isPlayingMatch && !isMatchActionPending;

  return (
    <div className="relative overflow-hidden rounded-lg bg-surface-container-low border border-outline-variant/10 lg:h-full">
      {/* Campo em perspetiva no espaço livre do fundo (desktop) */}
      <LivePitchStrip inline emoji={weatherEvent?.emoji} />
      {/* ── Luz das equipas: casa à esquerda · fora à direita (estática) ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            `radial-gradient(120% 130% at 0% 0%, ${hCol}2b 0%, transparent 55%)`,
            `radial-gradient(120% 130% at 100% 0%, ${aCol}24 0%, transparent 55%)`,
          ].join(", "),
        }}
      />
      {/* Ecrã inteiro só com o jogo vivo: depois do apito passava por trás
          dos modais pós-jogo (sorteio da Taça) através do fundo translúcido. */}
      {weatherEvent && (isPlayingMatch || finalWhistle) && (
        <WeatherOverlay emoji={weatherEvent.emoji} fullscreen />
      )}

      <div className="relative z-10 flex flex-col items-center px-4 pt-5 pb-4">
        {/* ── Meta strip (oculta na Final fundida — a faixa cerimonial já a mostra) ── */}
        {!hideScoreboard && (
        <div className="flex items-center justify-between w-full mb-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/70 font-black">
            {isCupMatch
              ? isFriendly ? roundLabel : `Taça · ${cupMatchRoundName}`
              : `${DIVISION_NAMES[hInfo?.division] || ""} · Jornada ${matchResults?.matchweek ?? "—"}`}
          </span>
          <div className="flex items-center gap-2">
            {!isPlayingMatch && isCupMatch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                {isFriendly ? "🤝" : "🏆"} {roundLabel}
              </span>
            )}
          </div>
        </div>
        )}

        {/* Banner de pausa de decisão — visível aos outros treinadores */}
        {substitutionPause && (
          <div className="w-full mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[16px] shrink-0">
              pause_circle
            </span>
            <span>
              {substitutionPause.coachName} {PAUSE_TEXT[substitutionPause.type] || PAUSE_TEXT.user_substitution}
            </span>
          </div>
        )}

        {/* ── Info strip: estádio · clima · odds ── */}
        {(myMatch.attendance || weatherEvent || odds) && (
          <div className="flex items-center justify-center gap-2 flex-wrap mb-4 text-[11px] text-on-surface-variant/70">
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
                hName={hInfo?.name}
                aName={aInfo?.name}
              />
            )}
          </div>
        )}

        {/* ── Broadcast scoreboard (oculta na Final fundida — o marcador vive no frente-a-frente) ── */}
        {!hideScoreboard && (
        <div ref={scoreRef} className="relative w-full max-w-2xl">
          {/* Aura da equipa em vantagem (pulso suave de liderança) */}
          {leadColor && (
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl"
              style={{
                boxShadow: `0 0 28px ${leadColor}59`,
                animation: "scoreLeadGlow 2s ease-in-out infinite",
              }}
            />
          )}
          <div className="relative w-full rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container shadow-lg shadow-black/30">
            {/* Hairline de luz no topo (broadcast on-air) */}
            <div aria-hidden className="top-light" />
            <div className="flex items-stretch">
            {/* Home side */}
            <div
              className="flex-1 flex flex-col sm:flex-row items-center gap-3 px-2.5 sm:px-5 py-3 min-w-0"
              style={{
                background: `linear-gradient(100deg, ${hInfo?.color_primary || "#333"}2e 0%, transparent 90%)`,
              }}
            >
              <ScoreKit team={hInfo} isMine={homeIsMine} coach={homeCoach} />
              <div className="flex flex-col min-w-0 w-full sm:w-auto">
                <span className="text-[11px] sm:text-sm font-black font-headline uppercase tracking-tight text-on-surface truncate text-center sm:text-left">
                  {hInfo?.name}
                </span>
              </div>
            </div>

            {/* Center score — clique para substituição/detalhe (só-visualização na final neutra) */}
            <button
              onClick={readOnly ? undefined : onScoreClick}
              data-goal-anchor={`${myMatch.homeTeamId}_${myMatch.awayTeamId}`}
              title={
                readOnly
                  ? "Final da Taça"
                  : isPlayingMatch && !isMatchActionPending
                    ? "Pedir substituição"
                    : "Ver detalhes da partida"
              }
              aria-disabled={readOnly || undefined}
              tabIndex={readOnly ? -1 : undefined}
              className={`shrink-0 flex flex-col items-center justify-center px-1.5 min-[430px]:px-2.5 sm:px-6 py-2 bg-surface/80 border-x border-outline-variant/15 ${readOnly ? "cursor-default" : "cursor-pointer group"}`}
            >
              {phaseAnnounce ? (
                <div
                  key={`announce-${phaseAnnounce}`}
                  className="phase-announce font-headline font-black text-sm min-[430px]:text-base sm:text-2xl tracking-[0.15em] uppercase whitespace-nowrap flex items-center gap-1.5 sm:gap-2 py-1 sm:py-2"
                >
                  <span>⚽</span>
                  {phaseAnnounce}
                </div>
              ) : (
              <div key={`${score.home}-${score.away}`} className="goal-shake font-headline font-black text-2xl min-[430px]:text-3xl sm:text-5xl tracking-tighter tabular-nums flex items-center gap-1 min-[430px]:gap-1.5 sm:gap-2 whitespace-nowrap">
                <span style={flashStyle(myHomeFlashing)}>{score.home}</span>
                <span className="text-on-surface/20 text-xl sm:text-3xl">:</span>
                <span style={flashStyle(myAwayFlashing)}>{score.away}</span>
              </div>
              )}
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70 mt-1 tabular-nums truncate max-w-full">
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
              </div>
              <ScoreKit team={aInfo} isMine={awayIsMine} coach={awayCoach} away={clash} />
            </div>
            </div>
          </div>
        </div>
        )}

        {/* ── Marcadores: golos e vermelhos de cada lado ── */}
        {(homeEvents.length > 0 || awayEvents.length > 0) && (
          <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mt-3 px-1">
            <TeamEvents events={homeEvents} align="left" />
            <TeamEvents events={awayEvents} align="right" />
          </div>
        )}

        {/* ── Jogador do Jogo (pós-jogo) ── */}
        {mom && !isPlayingMatch && (mom.home || mom.away) && (
          <div className="w-full max-w-2xl mt-3 rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1.5">
              ⭐ Jogador do Jogo
            </p>
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-left text-xs font-bold text-on-surface">
                {mom.home ? mom.home.playerName : "—"}
              </span>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                vs
              </span>
              <span className="flex-1 min-w-0 truncate text-right text-xs font-bold text-on-surface">
                {mom.away ? mom.away.playerName : "—"}
              </span>
            </div>
          </div>
        )}

        {/* ── Barra de cronómetro (sob o marcador) ── */}
        <div className="w-full max-w-2xl mt-3 px-1">
          <div className="relative h-2 rounded-full bg-black/40 border border-outline-variant/25 shadow-inner shadow-black/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-300 to-primary transition-all duration-1000"
              style={{
                width: `${progress}%`,
                boxShadow: "0 0 12px rgb(var(--color-primary) / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.35)",
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/15 via-transparent to-black/25" />
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
                      className="block w-2 h-2 rounded-full border border-black/60"
                      style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}, 0 0 2px ${dotColor}` }}
                    />
                  </span>
                );
              })}
          </div>
        </div>

        {/* ── Ação principal ── (desktop: a Pausa vive no header, onde está o JOGAR) */}
        {!readOnly && (() => {
          const pauseSlot = canSub ? document.getElementById("match-pause-slot") : null;
          const btn = (cls) => (
            <Button
              variant={canSub ? "primary" : "secondary"}
              onClick={onScoreClick}
              className={cls}
            >
              <span aria-hidden className="material-symbols-outlined text-[18px] leading-none">
                {canSub ? "swap_horiz" : "query_stats"}
              </span>
              {canSub ? "Pausa" : "Detalhes do jogo"}
            </Button>
          );
          return (
            <>
              {btn(`mt-3 min-h-11 rounded-full px-5 ${pauseSlot ? "lg:hidden" : ""}`)}
              {pauseSlot && createPortal(btn("h-9 min-h-0 rounded-lg px-4 text-xs font-black uppercase tracking-widest"), pauseSlot)}
            </>
          );
        })()}

        {/* ── Feed de lances (mais recente em cima) ── */}
        <LiveFeed
          feed={liveFeed(matchEvents, liveMinute).slice(0, 2)}
          resolveSide={resolveSide}
          hInfo={hInfo}
          aInfo={aInfo}
        />

        <PreMatchIntro matchEvents={matchEvents} liveMinute={liveMinute} isPlayingMatch={isPlayingMatch} />
        {/* ── Apito final: selo transitório do GameContext (só no meu jogo) ── */}
        {finalWhistle && (
          <FinalWhistleStamp
            whistle={finalWhistle}
            hColor={hInfo?.color_primary || "#6366f1"}
            aColor={aInfo?.color_primary || "#f43f5e"}
          />
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

/* ── ScoreKit — camisola no placar + badge do treinador ───────────────────
 * Troca o brasão pela camisola (`TeamKit`); sem kit válido cai para o
 * `TeamCrest` quadrado. Badge âmbar/primary igual ao anterior. */
export function ScoreKit({ team, isMine, coach, away = false }) {
  const hasKit = team?.crest?.includes("/logos/");
  return (
    <div className="relative shrink-0">
      {hasKit ? (
        <TeamKit team={team} className="h-10 sm:h-14" away={away} />
      ) : (
        <TeamCrest team={team} isMine={isMine} size="sm" />
      )}
      {coach && (
        <span
          className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-sm font-black text-[9px] tracking-widest uppercase whitespace-nowrap shadow-lg ${
            isMine ? "bg-primary text-on-primary" : "bg-amber-500 text-zinc-950"
          }`}
        >
          {coach.name}
        </span>
      )}
    </div>
  );
}

/* ── LiveFeed — todos os lances, mais recente em cima (~6 visíveis) ───── */
/**
 * @param {Object} props
 * @param {Array<{key:string, icon:string, phrase:string, event:Object}>} props.feed
 * @param {(event: Object) => string} props.resolveSide
 * @param {Object|undefined} props.hInfo
 * @param {Object|undefined} props.aInfo
 * @returns {JSX.Element|null}
 */
function LiveFeed({ feed, resolveSide, hInfo, aInfo }) {
  if (!feed.length) return null;
  return (
    <ol
      aria-label="Lances do jogo"
      aria-live="polite"
      className="w-full max-w-2xl mt-4 flex flex-col gap-1"
    >
      {feed.map((row, i) => {
        const e = row.event;
        const side = resolveSide(e);
        const team = side === "home" ? hInfo : side === "away" ? aInfo : null;
        const teamColor = team ? teamTextColor(team) : null;
        const tier = COMMENTARY_EFFECTS[e.type] || null;
        const isGoal = isGoalType(e.type);
        const latest = i === 0;
        const pulseColor =
          tier?.pulseColor ||
          (teamColor ? `color-mix(in srgb, ${teamColor} 45%, transparent)` : undefined);
        return (
          <li
            key={row.key}
            className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 border-l-2 ${
              isGoal ? "bg-primary/10" : "bg-black/20"
            }`}
            style={{
              borderLeftColor: teamColor || "transparent",
              animation: "commentaryFadeIn 0.6s ease",
            }}
          >
            <span className="shrink-0 w-7 text-[11px] leading-5 font-black tabular-nums text-on-surface-variant/70">
              {e.minute}&apos;
            </span>
            <span aria-hidden className="shrink-0 w-5 text-center text-[13px] leading-5">
              {row.icon}
            </span>
            <p
              className={`min-w-0 flex-1 leading-5 ${
                latest ? "text-[13px] sm:text-[15px] italic" : "text-[12px]"
              } ${isGoal ? "font-bold" : ""} ${
                tier?.className || (latest ? "text-on-surface" : "text-on-surface-variant")
              } ${latest && tier?.effect ? `commentary-effect commentary-effect--${tier.effect}` : ""}`}
              style={
                latest
                  ? {
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      animationDuration: tier?.effect === "pulse" ? "1.4s" : "0.6s",
                      "--pulse-color": pulseColor,
                    }
                  : undefined
              }
            >
              {row.phrase}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

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
              : e.type === "penalty_miss"
                ? "text-amber-400/80"
              : e.type === "var_disallowed"
                ? "text-amber-400/60 line-through"
                : e.type === "red"
                  ? "text-red-400"
                  : isSub
                    ? "text-emerald-400/80"
                    : "text-on-surface-variant/70"
        }`;
        const icon =
          e.type === "var_disallowed" ? (
            <span className="shrink-0 rounded px-1 text-[10px] font-black leading-4 tracking-wider bg-zinc-700 text-zinc-100">
              VAR
            </span>
          ) : e.type === "own_goal" ? (
            <span className="shrink-0 inline-flex items-center gap-0.5">
              ⚽
              <span className="rounded px-1 text-[10px] font-black leading-4 tracking-wider bg-red-700 text-white">
                AG
              </span>
            </span>
          ) : (
            <span className="shrink-0">{matchEventIcon(e.type)}</span>
          );
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
              <span className="shrink-0 text-[9px] font-black uppercase px-1 py-px rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest">
                Pen.
              </span>
            )}
          </span>
        );
        return (
          <div
            key={`${e.minute}-${e.type}-${e.playerId || name}-${i}`}
            className={`flex items-center gap-1 text-[11px] leading-tight w-full ${isRight ? "justify-end" : "justify-start"}`}
          >
            {isRight ? [nameEl, icon, minuteEl] : [minuteEl, icon, nameEl]}
          </div>
        );
      })}
    </div>
  );
}
