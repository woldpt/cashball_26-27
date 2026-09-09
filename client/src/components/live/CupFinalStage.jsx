import { motion } from "framer-motion";
import { CUP_FINAL_STADIUM } from "../../constants/index.js";
import { LiveMatchHero } from "./LiveMatchHero.jsx";
import { TeamCrest } from "./TeamCrest.jsx";
import { FLASH_COLOR, isFlashing, isGoalType } from "./liveHelpers.js";

/* ── CupFinalStage — palco de gala da Final da Taça ───────────────────────
 *
 * A final é um jogo especial e merece moldura especial: faixa cerimonial
 * (troféu, Estádio do Jamor), frente-a-frente das finalistas com os
 * treinadores, e o jogo ao vivo em destaque via `LiveMatchHero`.
 *
 * Dois regimes, mesma gala:
 *   - participas (`readOnly` falso) → marcador com intervenção normal
 *     (substituições/detalhe);
 *   - és espetador (`readOnly` true) → marcador em modo só-visualização.
 *
 * O frente-a-frente inclui o marcador ao centro (bloco único fundido);
 * o `LiveMatchHero` é renderizado sem a barra broadcast (`hideScoreboard`)
 * para não duplicar emblemas e nomes.
 *
 * O brilho da equipa do utilizador (isMine no crest) é automático.
 */

/**
 * @param {Object} props
 * @param {Object|null} props.finalFixture - fixture da final (a tua ou neutra)
 * @param {Object|null} props.mom - {home, away} do "Jogador do Jogo" (pós-jogo)
 * @param {Array} props.teams
 * @param {Array} props.players - treinadores humanos
 * @param {Object} props.me
 * @param {number} props.liveMinute
 * @param {boolean} props.isPlayingMatch
 * @param {boolean} props.isMatchActionPending
 * @param {string|undefined} props.cupMatchRoundName
 * @param {Object|null} props.substitutionPause
 * @param {Object} props.goalFlashRef
 * @param {boolean} props.isCupExtraTime
 * @param {Object|null} props.matchResults
 * @param {boolean} props.readOnly - só-visualização (não participas)
 * @param {Function} [props.onScoreClick] - intervenção (só quando participas)
 */
export function CupFinalStage({
  finalFixture,
  mom,
  teams,
  players,
  me,
  liveMinute,
  isPlayingMatch,
  isMatchActionPending,
  cupMatchRoundName,
  substitutionPause,
  goalFlashRef,
  isCupExtraTime,
  matchResults,
  readOnly,
  onScoreClick,
}) {
  if (!finalFixture) return null;

  const hInfo = teams.find((t) => t.id === finalFixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === finalFixture.awayTeamId);
  const hCol = hInfo?.color_primary || "#3b82f6";
  const aCol = aInfo?.color_primary || "#f43f5e";
  const homeCoach = players.find((p) => p.teamId === finalFixture.homeTeamId);
  const awayCoach = players.find((p) => p.teamId === finalFixture.awayTeamId);
  const homeIsMine = Number(finalFixture.homeTeamId) === Number(me?.teamId);
  const awayIsMine = Number(finalFixture.awayTeamId) === Number(me?.teamId);

  // Marcador fundido ao centro do frente-a-frente (mesma regra de golos do hero).
  const finalEvents = finalFixture.events || [];
  const homeGoals = finalEvents.filter(
    (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "home",
  );
  const awayGoals = finalEvents.filter(
    (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "away",
  );
  // eslint-disable-next-line react-hooks/purity
  const nowTs = Date.now();
  const homeFlashing = isFlashing(goalFlashRef, finalFixture.homeTeamId, finalFixture.awayTeamId, "home", nowTs);
  const awayFlashing = isFlashing(goalFlashRef, finalFixture.homeTeamId, finalFixture.awayTeamId, "away", nowTs);
  const phaseLabel = liveMinute > 90 ? "Prolongamento" : liveMinute > 45 ? "2ª Parte" : "1ª Parte";
  const flashStyle = (flashing) => ({
    color: flashing ? FLASH_COLOR : undefined,
    textShadow: flashing ? `0 0 22px ${FLASH_COLOR}90` : "none",
    transform: flashing ? "scale(1.12)" : "scale(1)",
    transition: flashing ? "none" : "color 1.25s ease, text-shadow 1.25s ease, transform 1.25s ease",
    display: "inline-block",
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-label="Final da Taça"
      className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-surface-container-low shadow-[0_0_40px_rgba(251,191,36,0.07)]"
    >
      {/* ── Cenografia de gala: ouro nas laterais, a convergir ao centro ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            `radial-gradient(90% 100% at 0% 0%, ${hCol}30 0%, transparent 55%)`,
            `radial-gradient(90% 100% at 100% 0%, ${aCol}2b 0%, transparent 55%)`,
            "radial-gradient(70% 45% at 50% 0%, rgba(251,191,36,0.10) 0%, transparent 65%)",
          ].join(", "),
        }}
      />
      {/* Marca de água do troféu */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-8 select-none text-[7rem] sm:text-[10rem] leading-none opacity-[0.07]"
      >
        🏆
      </div>

      {/* ── Faixa cerimonial ── */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-5 pb-1 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_16px_rgba(251,191,36,0.15)]">
          🏆 Final · Taça de Portugal
        </span>
        <p className="mt-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
          {CUP_FINAL_STADIUM}
          {readOnly ? "" : " · É a tua final"}
        </p>

        {/* ── Frente-a-frente das finalistas ── */}
        <div className="flex items-stretch justify-center gap-2 sm:gap-6 w-full max-w-2xl mt-4">
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
            <TeamCrest
              team={hInfo}
              isMine={homeIsMine}
              size="lg"
              rotate={8}
            />
            <span className="w-full truncate text-xs sm:text-sm font-black font-headline uppercase tracking-tight text-on-surface">
              {hInfo?.name}
            </span>
            {homeCoach && (
              <span className="truncate max-w-full text-[9px] sm:text-[10px] font-bold text-amber-400">
                {homeCoach.name}
              </span>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-center justify-center gap-1 px-1">
            <button
              onClick={readOnly ? undefined : onScoreClick}
              title={
                readOnly
                  ? "Final da Taça"
                  : isPlayingMatch && !isMatchActionPending
                    ? "Pedir substituição"
                    : "Ver detalhes da partida"
              }
              aria-disabled={readOnly || undefined}
              tabIndex={readOnly ? -1 : undefined}
              className={`flex flex-col items-center justify-center px-3 sm:px-4 py-2 rounded-xl bg-black/40 border border-amber-500/50 shadow-[0_0_14px_rgba(251,191,36,0.25)] ${readOnly ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="font-headline font-black text-xl sm:text-3xl tracking-tighter tabular-nums flex items-center gap-1.5 whitespace-nowrap">
                <span style={flashStyle(homeFlashing)}>{homeGoals.length}</span>
                <span className="text-on-surface/20 text-base sm:text-xl">:</span>
                <span style={flashStyle(awayFlashing)}>{awayGoals.length}</span>
              </span>
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-amber-300/80 tabular-nums text-center leading-tight">
                {liveMinute < 1 ? "Apito inicial…" : `${liveMinute}' · ${phaseLabel}`}
              </span>
            </button>
          </div>

          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
            <TeamCrest
              team={aInfo}
              isMine={awayIsMine}
              size="lg"
              rotate={-8}
            />
            <span className="w-full truncate text-xs sm:text-sm font-black font-headline uppercase tracking-tight text-on-surface">
              {aInfo?.name}
            </span>
            {awayCoach && (
              <span className="truncate max-w-full text-[9px] sm:text-[10px] font-bold text-amber-400">
                {awayCoach.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── O jogo em destaque ── */}
      <div className="relative z-10 px-3 sm:px-6 pt-2 pb-4 sm:pb-6">
        <LiveMatchHero
          myMatch={finalFixture}
          mom={mom}
          teams={teams}
          players={players}
          me={me}
          liveMinute={liveMinute}
          isPlayingMatch={isPlayingMatch}
          isMatchActionPending={isMatchActionPending}
          isCupMatch
          cupMatchRoundName={cupMatchRoundName}
          substitutionPause={substitutionPause}
          goalFlashRef={goalFlashRef}
          isCupExtraTime={isCupExtraTime}
          matchResults={matchResults}
          readOnly={readOnly}
          onScoreClick={onScoreClick}
          hideScoreboard
        />
      </div>
    </motion.section>
  );
}
