import { useTactics } from "../contexts/TacticsContext.jsx";
import { useGame } from "../contexts/GameContext.jsx";
import { PlayerLink } from "../components/shared/PlayerLink.jsx";
import { MatchIcon } from "../components/match/shared/MatchIcon.jsx";
import { MatchBriefing } from "../components/live/MatchBriefing.jsx";
import { WaitingCoachesModal } from "../components/modals/WaitingCoachesModal.jsx";
import { socket } from "../socket.js";
import { TACTIC_FORMATIONS, MAX_BENCH_SIZE } from "../constants/index.js";

/** Cores por posição */
const POS_COLORS = {
  GR: {
    bg: "bg-yellow-500",
    ring: "ring-yellow-400",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
    hex: "#eab308",
  },
  DEF: {
    bg: "bg-blue-500",
    ring: "ring-blue-400",
    text: "text-blue-400",
    dot: "bg-blue-400",
    hex: "#3b82f6",
  },
  MED: {
    bg: "bg-emerald-500",
    ring: "ring-emerald-400",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    hex: "#10b981",
  },
  ATA: {
    bg: "bg-rose-500",
    ring: "ring-rose-400",
    text: "text-rose-400",
    dot: "bg-rose-400",
    hex: "#f43f5e",
  },
};


/**
 * Familiaridade táctica — barra de 5 segmentos que preenche o espaço disponível.
 * @param {Object} props
 * @param {number} props.stars Estrelas (0-5) calculadas no servidor (score 0..100)
 * @param {boolean} [props.fill=false] Estica a barra até à largura total do contentor
 * @returns {JSX.Element}
 */
function FamiliarityStars({ stars, fill = false }) {
  const value = Math.max(0, Math.min(5, stars || 0));
  const full = value === 5;
  return (
    <div
      className={`relative overflow-hidden ${
        fill ? "w-full" : "w-16 mx-auto"
      } ${full ? "animate-fam-glow rounded-full" : ""}`}
      title={
        full
          ? "5/5 — táctica dominada!"
          : `${value}/5 estrelas de familiaridade táctica`
      }
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              i <= value
                ? "bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500"
                : "bg-gray-700/40"
            }`}
            style={
              i <= value
                ? {
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.35), 0 0 6px rgba(251,191,36,0.35)",
                  }
                : undefined
            }
          />
        ))}
      </div>
      {full && <div className="fam-shimmer" />}
    </div>
  );
}

/**
 * Avatar circular com inicial + cor de posicao
 * @param {{ player: Object, size?: string }} props
 * @returns {JSX.Element}
 */
const POS_INITIAL = { GR: "G", DEF: "D", MED: "M", ATA: "A" };

function PlayerAvatar({ player, size = "w-7 h-7" }) {
  const pos = POS_COLORS[player.position] || { bg: "bg-gray-600" };
  return (
    <div
      className={`${size} rounded-full ${pos.bg} flex items-center justify-center shrink-0 font-black text-white shadow-md`}
      style={{ fontSize: "11px" }}
    >
      {POS_INITIAL[player.position] ?? "?"}
    </div>
  );
}

/**
 * Linha de jogador — estilo screenshot
 * @param {Object} props
 * @returns {JSX.Element}
 */
function PlayerRow({
  player,
  matchweekCount,
  onClick,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isOver,
  isDragging,
  children,
}) {
  const f = player.form ?? 100;
  const formIcon = f >= 115 ? "💪" : f <= 85 ? "😩" : "👍";
  return (
    <div
      draggable={draggable}
      data-player-id={player.id}
      data-player-status={player.status ?? ""}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all select-none
${isDragging ? "opacity-30 scale-95" : ""}
${isOver ? "bg-white/5 ring-1 ring-[#4ade80]/40" : "hover:bg-white/5"}
${player.isUnavailable ? "opacity-50" : ""}
${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
`}
    >
      <PlayerAvatar player={player} />
      <span className="flex-1 min-w-0 text-xs font-semibold text-[#e8e8e8] truncate leading-none">
        {onClick ? (
          <PlayerLink playerId={player.id}>{player.name}</PlayerLink>
        ) : (
          player.name
        )}
        {!!player.is_star &&
          (player.position === "MED" || player.position === "ATA") && (
            <span className="text-amber-400 text-[9px] ml-0.5">★</span>
          )}
        {player.isUnavailable &&
          (() => {
            const susp = player.suspension_until_matchweek || 0;
            const inj = player.injury_until_matchweek || 0;
            const cooldown = player.transfer_cooldown_until_matchweek || 0;
            const isSusp = susp > matchweekCount;
            const isCooldown =
              !isSusp &&
              !(inj > matchweekCount) &&
              cooldown > 0 &&
              cooldown > matchweekCount;
            if (isCooldown)
              return <span className="text-[10px] ml-0.5">✈️</span>;
            const left = isSusp ? susp - matchweekCount : inj - matchweekCount;
            return (
              <span className="text-[9px] ml-0.5 text-red-400">
                {isSusp ? "🟥" : "🩹"}({left})
              </span>
            );
          })()}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Resistência */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[7px] uppercase tracking-widest text-gray-500 font-bold leading-none">
            RES
          </span>
          <span
            className={`text-[13px] font-black tabular-nums leading-none ${
              (player.resistance ?? 0) >= 4
                ? "text-green-400"
                : (player.resistance ?? 0) >= 3
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {player.resistance ?? "–"}
          </span>
        </div>
        <div className="w-px h-5 bg-gray-700/60" />

        {/* Forma */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[7px] uppercase tracking-widest text-gray-500 font-bold leading-none">
            FORMA
          </span>
          <span className="text-[13px] leading-none">{formIcon}</span>
        </div>
        <div className="w-px h-5 bg-gray-700/60" />

        {/* Skill */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[7px] uppercase tracking-widest text-gray-500 font-bold leading-none">
            Qualidade
          </span>
          <span
            className={`text-[15px] font-black tabular-nums leading-none px-2 py-0.5 rounded-lg border ${
              player.skill >= 40
                ? "bg-green-500/15 text-green-300 border-green-500/30"
                : player.skill >= 25
                  ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                  : "bg-red-500/15 text-red-300 border-red-500/30"
            }`}
            style={{
              textShadow: player.skill >= 40
                ? "0 0 10px rgba(34,197,94,0.3)"
                : player.skill >= 25
                  ? "0 0 10px rgba(234,179,8,0.3)"
                  : "0 0 10px rgba(239,68,68,0.3)",
            }}
          >
            {player.skill}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}


/**
 * Pagina de Tacticas — totalmente auto-contida via useTactics().
 * @returns {JSX.Element}
 */
/**
 * StatusPicker — popup de seleção de estado do jogador.
 * Extraído para fora do componente TacticsView para evitar re-criação
 * da definição a cada render (prevenindo remount/flickering).
 */
function StatusPicker({
  player,
  above = false,
  openStatusPickerId,
  tacticPositions,
  annotatedSquad,
  handleSetPlayerStatus,
}) {
  if (openStatusPickerId !== player.id) return null;
  const subCount = Object.entries(tacticPositions).filter(
    ([id, s]) => s === "Suplente" && Number(id) !== player.id,
  ).length;
  const titCount = Object.entries(tacticPositions).filter(
    ([id, s]) => s === "Titular" && Number(id) !== player.id,
  ).length;
  const subsFull = subCount >= MAX_BENCH_SIZE;
  const titularesFull = titCount >= 11;
  const posCount =
    player.position !== "GR"
      ? Object.entries(tacticPositions).filter(([id, s]) => {
          if (s !== "Titular" || Number(id) === player.id) return false;
          const p = annotatedSquad.find((x) => x.id === Number(id));
          return p?.position === player.position;
        }).length
      : 0;
  const posFull = posCount >= 5;
  return (
    <div
      className={`absolute right-0 ${above ? "bottom-full mb-1" : "top-full mt-1"} z-50 bg-[#111] border border-[#222] rounded-2xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-38.75`}
      onClick={(e) => e.stopPropagation()}
    >
      {[
        ["Titular", "🟢", "Titular"],
        ["Suplente", "🟡", "Suplente"],
        ["Excluído", "⚫", "Não convocado"],
      ].map(([status, emoji, label]) => {
        const unavail =
          player.isUnavailable &&
          (status === "Titular" || status === "Suplente");
        const disabled =
          unavail ||
          (status === "Titular" &&
            titularesFull &&
            player.status !== "Titular") ||
          (status === "Titular" && posFull && player.status !== "Titular") ||
          (status === "Suplente" && subsFull && player.status !== "Suplente");
        return (
          <button
            key={status}
            onClick={() =>
              !disabled && handleSetPlayerStatus(player.id, status)
            }
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 text-left transition-colors
${disabled ? "opacity-30 cursor-not-allowed text-gray-500" : player.status === status ? "bg-white/10 text-white" : "hover:bg-white/5 text-gray-400 hover:text-white"}`}
          >
            {emoji} {label}
          </button>
        );
      })}
    </div>
  );
}

export function TacticsView() {
  const {
    tactic,
    allTacticFamiliarity,
    annotatedSquad,
    titulares,
    formationAvailabilityByValue,
    isLineupComplete,
    nextMatchOpponent,
    openStatusPickerId,
    dragOverPlayerId,
    setDragOverPlayerId,
    dragPlayerId,
    setDragPlayerId,
    dragOverSection,
    setDragOverSection,
    updateTactic,
    handleClearTactic,
    handleAutoPick,
    handleSetPlayerStatus,
    handleSwapPlayerStatuses,
    handleDropToSection,
    handleDragStart,
    handleReady,
    handleHalftimeReady,
    matchweekCount,
    teamInfo,
    nextMatchSummary,
    players,
    me,
    activeTab,
    showHalftimePanel,
    isPlayingMatch,
    disconnected,
    isCupMatch,
    prepPhase,
    setPrepPhase,
  } = useTactics();

  const { lockedCoaches, liveMinute, isCupExtraTime, mobileSubMenu } = useGame();

  const getBestForFormation = (formation) => {
    const styles = ["OFENSIVO", "DEFENSIVO", "EQUILIBRADO"];
    let best = null;
    for (const s of styles) {
      const entry = allTacticFamiliarity[`${formation}|${s}`];
      if (entry && (!best || entry.stars > best.stars)) best = entry;
    }
    return best;
  };

  const myReady = players.find((p) => p.name === me?.name)?.ready;
  const isHalftime = showHalftimePanel && !isPlayingMatch;
  const isPreExtraTime = isHalftime && isCupMatch && (liveMinute ?? 0) >= 90 && !isCupExtraTime;
  const isEliminatedCupSpectator =
    nextMatchSummary?.isCup && !nextMatchOpponent;
  // Fase 1 — Briefing. Saltado em situações de jogo ativo (intervalo, espectador, a jogar).
  const showBriefing =
    prepPhase === "briefing" &&
    !isHalftime &&
    !isEliminatedCupSpectator &&
    !isPlayingMatch &&
    !!nextMatchSummary;
  const canPlay = isEliminatedCupSpectator || isHalftime || isLineupComplete;
  const showBackToBriefing =
    prepPhase === "tactics" &&
    !isHalftime &&
    !isEliminatedCupSpectator &&
    !isPlayingMatch;
  const playLabel = myReady
    ? "⏳ A aguardar..."
    : isEliminatedCupSpectator
      ? "Avançar para Taça"
      : isPreExtraTime
        ? "Ir para prolongamento"
        : isHalftime && isCupMatch
          ? "2ª Parte — Taça"
          : isHalftime
            ? "2ª Parte"
            : "Jogar Jornada";

  const titCount = annotatedSquad.filter((p) => p.status === "Titular").length;
  const subCount = annotatedSquad.filter(
    (p) => p.status === "Suplente" && !p.isUnavailable,
  ).length;
  const notCalledCount = annotatedSquad.filter(
    (p) =>
      !p.isJunior &&
      (p.isUnavailable || (p.status !== "Titular" && p.status !== "Suplente")),
  ).length;

  return (
    <div className="space-y-3">
      {disconnected && (
        <div className="px-4 py-2 text-red-400 text-[10px] font-bold text-center bg-red-500/10 border border-red-500/20 rounded-2xl">
          ⚠️ Desligado — a reconectar...
        </div>
      )}

      {showBriefing && <MatchBriefing />}

      {showBackToBriefing && (
        <button
          onClick={() => setPrepPhase("briefing")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 bg-[#111] border border-[#1e1e1e] hover:text-white hover:border-[#333] transition-colors"
        >
          <span className="text-sm leading-none">←</span> Voltar ao Briefing
        </button>
      )}

      {!showBriefing &&
        (nextMatchSummary?.isCup && !nextMatchOpponent ? (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl flex flex-col items-center gap-4 py-10 text-center px-6">
          <p className="text-5xl">🏆</p>
          <p className="text-[#666] font-bold text-sm leading-relaxed">
            Já foste eliminado desta ronda da Taça.
            <br />
            Avança para observar os jogos e seguir em frente.
          </p>
          <button
            onClick={handleReady}
            disabled={!!myReady}
            className={`mt-2 px-10 py-3.5 font-black rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 ${myReady ? "bg-[#1a1a1a] text-[#444] cursor-not-allowed" : "text-green-950 shadow-xl shadow-green-500/20 hover:brightness-110"}`}
            style={
              myReady
                ? {}
                : { background: "linear-gradient(135deg, #4ade80, #22c55e)" }
            }
          >
            {myReady ? "⏳ A aguardar..." : "Ver jogos da Taça"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-3 items-stretch md:items-start">
          {/* COL 1 — FORMAÇÃO + MENTALIDADE */}
          <div className={`lg:w-57.5 shrink-0 flex flex-col gap-2 ${!isLineupComplete && !myReady ? "animate-heartbeat-border rounded-2xl" : ""}`}>
            {/* Proximo jogo — mobile: moral + mentality side by side */}
            <div className="flex gap-2 lg:hidden">
              {nextMatchSummary && (
                <div className="flex-1 min-w-0 flex flex-col bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                  {(() => {
                    const morale = teamInfo?.morale ?? 50;
                    const fillColor =
                      morale > 75
                        ? "bg-green-500"
                        : morale >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500";
                    const textColor =
                      morale > 75
                        ? "text-green-400"
                        : morale >= 50
                          ? "text-yellow-400"
                          : "text-red-400";
                    const label =
                      morale > 75 ? "Alta" : morale >= 50 ? "Média" : "Baixa";
                    return (
                      <>
                        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
                          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                            Moral
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase ${textColor}`}
                          >
                            {label}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-4 pb-3">
                          <span
                            className={`text-[38px] leading-none font-black tabular-nums ${textColor}`}
                          >
                            {morale}
                          </span>
                          <div className="h-2 w-full bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${fillColor}`}
                              style={{ width: `${morale}%` }}
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden flex flex-col">
                <div className="shrink-0 px-3 py-2 border-b border-[#1a1a1a]">
                  <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                    Mentalidade
                  </span>
                </div>
                {(() => {
                  const STYLES = ["Defensive", "Balanced", "Offensive"];
                  const LABELS = {
                    Defensive: "DEF",
                    Balanced: "NEU",
                    Offensive: "ATC",
                  };
                  const ICONS = {
                    Defensive: "phase-start",
                    Balanced: "form-flat",
                    Offensive: "form-up",
                  };
                  const ACTIVE_STYLES = {
                    Defensive: "bg-blue-500/15 border-blue-500/40 text-blue-400",
                    Balanced:
                      "bg-[#4ade80]/15 border-[#4ade80]/35 text-[#4ade80]",
                    Offensive: "bg-rose-500/15 border-rose-500/40 text-rose-400",
                  };
                  return (
                    <div className="flex flex-1 items-stretch gap-1 p-1.5">
                      {STYLES.map((val) => {
                        const isActive = tactic.style === val;
                        return (
                          <button
                            key={val}
                            onClick={() => updateTactic({ style: val })}
                            className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-0.5 py-1.5 transition-all active:scale-95 ${isActive ? ACTIVE_STYLES[val] : "border-transparent bg-[#161616] text-gray-500 hover:text-gray-300"}`}
                          >
                            <MatchIcon
                              name={ICONS[val]}
                              className={`h-3.5 w-3.5 shrink-0 ${isActive ? "" : "opacity-70"}`}
                            />
                            <span className="text-[9px] font-black uppercase tracking-wide">
                              {LABELS[val]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Formação mobile — chips horizontais */}
            <div className={`lg:hidden bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden ${!isLineupComplete && !myReady ? "animate-heartbeat-border" : ""}`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                  Formação
                </span>
                <button
                  onClick={handleClearTactic}
                  className="text-[9px] text-gray-600 uppercase hover:text-red-400 transition-colors font-bold"
                >
                  Limpar
                </button>
              </div>
              <div className="p-2 grid grid-cols-4 gap-1.5">
                {TACTIC_FORMATIONS.map(({ value, label }) => {
                  const isAvailable =
                    formationAvailabilityByValue[value] === true;
                  const isActive =
                    titulares.length > 0 && tactic.formation === value;
                  const best = getBestForFormation(value);
                  return (
                    <button
                      key={value}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && handleAutoPick(value)}
                      className={`w-full px-1 py-1.5 text-[11px] font-black rounded-xl transition-all active:scale-95 ${
                        !isAvailable
                          ? "bg-[#161616] text-gray-700 cursor-not-allowed"
                          : isActive
                            ? "text-[#0a1a0a] shadow-lg shadow-green-500/20"
                            : "bg-[#1a1a1a] text-gray-300 hover:bg-[#222]"
                      }`}
                      style={
                        isActive
                          ? {
                              background:
                                "linear-gradient(135deg,#4ade80,#22c55e)",
                            }
                          : {}
                      }
                    >
                      <span className="flex flex-col items-center gap-0.5">
                        {label}
                        <FamiliarityStars stars={best?.stars ?? 0} fill />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proximo jogo — desktop only */}
            {nextMatchSummary && (
              <div className="hidden lg:block bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                {(() => {
                  const morale = teamInfo?.morale ?? 50;
                  const fillColor =
                    morale > 75
                      ? "bg-green-500"
                      : morale >= 50
                        ? "bg-yellow-500"
                        : "bg-red-500";
                  const textColor =
                    morale > 75
                      ? "text-green-400"
                      : morale >= 50
                        ? "text-yellow-400"
                        : "text-red-400";
                  const label =
                    morale > 75 ? "Alta" : morale >= 50 ? "Média" : "Baixa";
                  return (
                    <div className="px-4 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">
                          Moral
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase ${textColor}`}
                        >
                          {label}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${fillColor}`}
                          style={{ width: `${morale}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Formação — desktop only */}
            <div className="hidden lg:block bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                  Formação
                </span>
                <button
                  onClick={handleClearTactic}
                  className="text-[9px] text-gray-600 uppercase tracking-wider hover:text-red-400 transition-colors font-bold"
                >
                  Limpar
                </button>
              </div>

              {/* Lista formacoes */}
              <div className="px-3 py-2.5 space-y-1">
                {TACTIC_FORMATIONS.map(({ value, label }) => {
                  const isAvailable =
                    formationAvailabilityByValue[value] === true;
                  const isActive =
                    titulares.length > 0 && tactic.formation === value;
                  const best = getBestForFormation(value);
                  return (
                    <div key={value} className="flex items-center gap-2">
                      <button
                        disabled={!isAvailable}
                        title={
                          isAvailable
                            ? undefined
                            : "Indisponível: faltam jogadores aptos"
                        }
                        onClick={() => isAvailable && handleAutoPick(value)}
                        className={`shrink-0 w-21 px-2 py-1.5 text-[11px] font-black rounded-xl text-center transition-all active:scale-95
${
  !isAvailable
    ? "bg-[#161616] text-gray-700 cursor-not-allowed"
    : isActive
      ? "text-[#0a1a0a] shadow-lg shadow-green-500/20"
      : "bg-[#1a1a1a] text-gray-300 hover:bg-[#222] hover:text-white"
}`}
                        style={
                          isActive
                            ? {
                                background:
                                  "linear-gradient(135deg,#4ade80,#22c55e)",
                              }
                            : {}
                        }
                      >
                        {label}
                      </button>
                      <div className="flex-1 flex items-center px-2.5 py-2 rounded-xl bg-[#161616]/60">
                        <FamiliarityStars stars={best?.stars ?? 0} fill />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mentalidade — desktop only */}
            <div className="hidden lg:block bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#1a1a1a]">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                  Mentalidade
                </span>
              </div>
              <div className="px-3 py-3">
                {(() => {
                  const STYLES = ["Defensive", "Balanced", "Offensive"];
                  const LABELS = {
                    Defensive: "Defensivo",
                    Balanced: "Neutro",
                    Offensive: "Ofensivo",
                  };
                  const PILL_COLORS = {
                    Defensive: "rgba(59,130,246,0.22)",
                    Balanced: "rgba(74,222,128,0.22)",
                    Offensive: "rgba(244,63,94,0.22)",
                  };
                  const PILL_BORDERS = {
                    Defensive: "rgba(59,130,246,0.45)",
                    Balanced: "rgba(74,222,128,0.35)",
                    Offensive: "rgba(244,63,94,0.45)",
                  };
                  const TEXT_COLORS = {
                    Defensive: "text-blue-400",
                    Balanced: "text-[#4ade80]",
                    Offensive: "text-rose-400",
                  };
                  const idx = STYLES.indexOf(tactic.style ?? "Balanced");
                  const safeIdx = idx < 0 ? 1 : idx;
                  const activeStyle = tactic.style ?? "Balanced";
                  return (
                    <div className="relative flex bg-[#161616] rounded-full p-0.5">
                      {/* Pill deslizante */}
                      <div
                        className="absolute inset-y-0.5 rounded-full transition-all duration-200 pointer-events-none"
                        style={{
                          left: `calc(${safeIdx * 33.333}% + 2px)`,
                          width: "calc(33.333% - 4px)",
                          background: `linear-gradient(135deg, ${PILL_COLORS[activeStyle]}, rgba(0,0,0,0))`,
                          border: `1px solid ${PILL_BORDERS[activeStyle]}`,
                        }}
                      />
                      {STYLES.map((val) => (
                        <button
                          key={val}
                          onClick={() => updateTactic({ style: val })}
                          className={`relative z-10 flex-1 py-2 text-[9px] font-black uppercase tracking-wide rounded-full transition-colors ${
                            tactic.style === val
                              ? TEXT_COLORS[val]
                              : "text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {LABELS[val]}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* COL 2 — TITULARES (esq) + SUPLENTES/NÃO CONV. (dir) */}
          <div className="flex-1 flex flex-col md:flex-row gap-2 min-w-0">
            {/* Titulares */}
            <div
              className={`flex-1 min-w-0 bg-[#111] border rounded-2xl overflow-hidden transition-colors ${dragOverSection === "Titular" ? "border-[#4ade80]/30 bg-[#4ade80]/2" : "border-[#1e1e1e]"}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragPlayerId) setDragOverSection("Titular");
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  setDragOverSection(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragPlayerId) handleDropToSection(dragPlayerId, "Titular");
                setDragOverSection(null);
              }}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                  Titulares
                </span>
                <span className="text-[10px] font-black">
                  <span
                    className={
                      titCount === 11 ? "text-[#4ade80]" : "text-white"
                    }
                  >
                    {titCount}
                  </span>
                  <span className="text-gray-700">/11</span>
                </span>
              </div>
              <div className="px-2 py-1 space-y-0.5">
                {annotatedSquad
                  .filter((p) => p.status === "Titular")
                  .map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      matchweekCount={matchweekCount}
                      onClick
                      draggable={!player.isJunior}
                      onDragStart={handleDragStart}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverPlayerId(player.id);
                      }}
                      onDragLeave={() => setDragOverPlayerId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragPlayerId && dragPlayerId !== player.id)
                          handleSwapPlayerStatuses(dragPlayerId, player.id);
                        else {
                          setDragOverPlayerId(null);
                          setDragPlayerId(null);
                        }
                        setDragOverSection(null);
                      }}
                      onDragEnd={() => {
                        setDragOverPlayerId(null);
                        setDragPlayerId(null);
                      }}
                      isOver={
                        dragOverPlayerId === player.id &&
                        dragPlayerId !== player.id
                      }
                      isDragging={dragPlayerId === player.id}
                    >
                      {!player.isJunior && (
                        <StatusPicker
                          player={player}
                          openStatusPickerId={openStatusPickerId}
                          tacticPositions={tactic.positions}
                          annotatedSquad={annotatedSquad}
                          handleSetPlayerStatus={handleSetPlayerStatus}
                        />
                      )}
                    </PlayerRow>
                  ))}
                {titCount === 0 && (
                  <p className="py-6 text-center text-[11px] text-gray-700 font-bold">
                    Nenhum titular designado
                  </p>
                )}
              </div>
            </div>

            {/* Suplentes + Nao convocados (coluna direita) */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {/* Suplentes */}
              <div
                className={`bg-[#111] border rounded-2xl overflow-hidden transition-colors ${dragOverSection === "Suplente" ? "border-yellow-500/30 bg-yellow-500/2" : "border-[#1e1e1e]"}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragPlayerId) setDragOverSection("Suplente");
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    setDragOverSection(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragPlayerId)
                    handleDropToSection(dragPlayerId, "Suplente");
                  setDragOverSection(null);
                }}
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
                  <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                    Suplentes
                  </span>
                  <span className="text-[10px] font-black">
                    <span className="text-yellow-400">{subCount}</span>
                    <span className="text-gray-700">/{MAX_BENCH_SIZE}</span>
                  </span>
                </div>
                <div className="px-2 py-1 space-y-0.5">
                  {annotatedSquad
                    .filter((p) => p.status === "Suplente" && !p.isUnavailable)
                    .map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        matchweekCount={matchweekCount}
                        onClick
                        draggable={!player.isJunior}
                        onDragStart={handleDragStart}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverPlayerId(player.id);
                        }}
                        onDragLeave={() => setDragOverPlayerId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragPlayerId && dragPlayerId !== player.id)
                            handleSwapPlayerStatuses(dragPlayerId, player.id);
                          else {
                            setDragOverPlayerId(null);
                            setDragPlayerId(null);
                          }
                          setDragOverSection(null);
                        }}
                        onDragEnd={() => {
                          setDragOverPlayerId(null);
                          setDragPlayerId(null);
                        }}
                        isOver={
                          dragOverPlayerId === player.id &&
                          dragPlayerId !== player.id
                        }
                        isDragging={dragPlayerId === player.id}
                      >
                        {!player.isJunior && (
                          <StatusPicker
                            player={player}
                            openStatusPickerId={openStatusPickerId}
                            tacticPositions={tactic.positions}
                            annotatedSquad={annotatedSquad}
                            handleSetPlayerStatus={handleSetPlayerStatus}
                          />
                        )}
                      </PlayerRow>
                    ))}
                  {subCount === 0 && (
                    <p className="py-4 text-center text-[11px] text-gray-700 font-bold">
                      Nenhum suplente
                    </p>
                  )}
                </div>

                {/* Nao convocados */}
                {notCalledCount > 0 && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragPlayerId) setDragOverSection("Excluído");
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget))
                        setDragOverSection(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragPlayerId)
                        handleDropToSection(dragPlayerId, "Excluído");
                      setDragOverSection(null);
                    }}
                    className={`border-t transition-colors ${dragOverSection === "Excluído" ? "border-gray-500/30" : "border-[#1a1a1a]"}`}
                  >
                    <div className="px-4 py-2">
                      <span className="text-[9px] uppercase tracking-widest text-gray-700 font-bold">
                        Não Convocados
                      </span>
                    </div>
                    <div className="px-2 pb-1 space-y-0.5 opacity-40">
                      {annotatedSquad
                        .filter(
                          (p) =>
                            !p.isJunior &&
                            (p.isUnavailable ||
                              (p.status !== "Titular" &&
                                p.status !== "Suplente")),
                        )
                        .map((player) => (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            matchweekCount={matchweekCount}
                            draggable
                            onDragStart={handleDragStart}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverPlayerId(player.id);
                            }}
                            onDragLeave={() => setDragOverPlayerId(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragPlayerId && dragPlayerId !== player.id)
                                handleSwapPlayerStatuses(
                                  dragPlayerId,
                                  player.id,
                                );
                              else {
                                setDragOverPlayerId(null);
                                setDragPlayerId(null);
                              }
                              setDragOverSection(null);
                            }}
                            onDragEnd={() => {
                              setDragOverPlayerId(null);
                              setDragPlayerId(null);
                            }}
                            isOver={
                              dragOverPlayerId === player.id &&
                              dragPlayerId !== player.id
                            }
                            isDragging={dragPlayerId === player.id}
                          >
                            <StatusPicker
                              player={player}
                              above
                              openStatusPickerId={openStatusPickerId}
                              tacticPositions={tactic.positions}
                              annotatedSquad={annotatedSquad}
                              handleSetPlayerStatus={handleSetPlayerStatus}
                            />
                          </PlayerRow>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* fim coluna direita */}
          </div>

          {/* COL 3 — CAMPO + JOGAR (desktop only — mobile usa FAB) */}
          <div className="max-lg:hidden lg:w-72.5 shrink-0 flex flex-col gap-2">
            {/* Botao JOGAR — desktop */}
            <div className="max-lg:hidden">
              <button
                onClick={isHalftime ? handleHalftimeReady : handleReady}
                disabled={myReady || !canPlay}
                className={`w-full py-4 font-black rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 relative overflow-hidden ${canPlay && !myReady ? "animate-heartbeat" : ""}
${myReady ? "bg-[#161616] text-[#333] cursor-not-allowed" : !canPlay ? "bg-[#161616] text-gray-700 cursor-not-allowed" : "text-green-950 shadow-xl shadow-green-500/20 hover:brightness-110"}`}
                style={
                  myReady || !canPlay
                    ? {}
                    : {
                        background:
                          "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
                      }
                }
              >
                {!myReady && canPlay && (
                  <span className="absolute inset-0 bg-linear-to-r from-white/10 to-transparent pointer-events-none" />
                )}
                {playLabel}
              </button>
              {!canPlay && !myReady && (
                <p className="text-[10px] font-bold text-red-400/70 mt-1.5 text-center">
                  Faltam titulares: 1 GR + 10 de campo
                </p>
              )}
              {canPlay && !myReady && (
                <p className="text-[9px] text-center text-gray-700 mt-1">
                  A jornada avança quando todos clicarem.
                </p>
              )}
            </div>

            {/* Campo de futebol */}
            <div
              className={`relative w-full rounded-2xl overflow-hidden transition-all duration-200 ${dragPlayerId && dragOverSection === "Titular" && annotatedSquad.find((p) => p.id === dragPlayerId)?.status !== "Titular" ? "ring-2 ring-[#4ade80]/40 shadow-lg shadow-[#4ade80]/10" : ""}`}
              style={{
                aspectRatio: "9/12",
                background:
                  "radial-gradient(ellipse at 50% 25%, #1f5c1a 0%, #123a0d 50%, #09200a 100%)",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragPlayerId) setDragOverSection("Titular");
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  setDragOverSection(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragPlayerId) handleDropToSection(dragPlayerId, "Titular");
                setDragOverSection(null);
              }}
            >
              {/* Linhas do campo SVG */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 9 12"
                preserveAspectRatio="none"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.065"
              >
                <rect x="0.45" y="0.45" width="8.1" height="11.1" rx="0.05" />
                <line x1="0.45" y1="6" x2="8.55" y2="6" />
                <circle cx="4.5" cy="6" r="1.2" />
                <rect x="1.9" y="8.9" width="5.2" height="2.65" />
                <rect x="3.1" y="10.2" width="2.8" height="1.35" />
                <rect x="1.9" y="0.45" width="5.2" height="2.65" />
                <rect x="3.1" y="0.45" width="2.8" height="1.35" />
                <circle
                  cx="4.5"
                  cy="9.8"
                  r="0.07"
                  fill="rgba(255,255,255,0.2)"
                  stroke="none"
                />
                <circle
                  cx="4.5"
                  cy="2.2"
                  r="0.07"
                  fill="rgba(255,255,255,0.2)"
                  stroke="none"
                />
                <circle
                  cx="4.5"
                  cy="6"
                  r="0.07"
                  fill="rgba(255,255,255,0.2)"
                  stroke="none"
                />
              </svg>

              <div className="absolute inset-0 bg-linear-to-b from-black/5 via-transparent to-black/25 pointer-events-none" />

              {/* Jogadores no campo */}
              {(() => {
                const tits = annotatedSquad.filter(
                  (p) => p.status === "Titular",
                );
                const rows = [
                  tits.filter((p) => p.position === "ATA"),
                  tits.filter((p) => p.position === "MED"),
                  tits.filter((p) => p.position === "DEF"),
                  tits.filter((p) => p.position === "GR"),
                ];
                const rowYs = ["6%", "27%", "52%", "75%"];
                return rows.map((rowPlayers, ri) =>
                  rowPlayers.length > 0 ? (
                    <div
                      key={ri}
                      className="absolute w-full flex justify-evenly items-start px-3"
                      style={{ top: rowYs[ri] }}
                    >
                      {rowPlayers.map((player) => {
                        const pos = POS_COLORS[player.position] || {
                          hex: "#6b7280",
                        };
                        const isDraggingThis = dragPlayerId === player.id;
                        const isOverThis =
                          dragOverPlayerId === player.id &&
                          dragPlayerId !== player.id;
                        return (
                          <div
                            key={player.id}
                            className={`flex flex-col items-center transition-all duration-150 ${isDraggingThis ? "opacity-20 scale-90" : ""} ${isOverThis ? "scale-110" : ""}`}
                            style={{ maxWidth: "58px" }}
                            draggable
                            data-player-id={player.id}
                            data-player-status="Titular"
                            onDragStart={handleDragStart}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverPlayerId(player.id);
                            }}
                            onDragLeave={() => setDragOverPlayerId(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragPlayerId && dragPlayerId !== player.id)
                                handleSwapPlayerStatuses(
                                  dragPlayerId,
                                  player.id,
                                );
                              else {
                                setDragOverPlayerId(null);
                                setDragPlayerId(null);
                              }
                              setDragOverSection(null);
                            }}
                            onDragEnd={() => {
                              setDragOverPlayerId(null);
                              setDragPlayerId(null);
                            }}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm relative cursor-grab active:cursor-grabbing ${player.isUnavailable ? "opacity-50" : ""}`}
                              style={{
                                background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.28) 0%, transparent 65%), ${pos.hex}`,
                                boxShadow: `0 4px 16px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.22)`,
                              }}
                            >
                              {player.name?.charAt(0)?.toUpperCase() ?? "?"}
                              {player.isUnavailable && (
                                <span className="absolute -top-1 -right-1 text-[9px] bg-black/60 rounded-full px-0.5 leading-none">
                                  {(player.suspension_until_matchweek || 0) >
                                  matchweekCount
                                    ? "🟥"
                                    : (player.injury_until_matchweek || 0) >
                                        matchweekCount
                                      ? "🩹"
                                      : "✈️"}
                                </span>
                              )}
                            </div>
                            <button
                              className="mt-1 text-[8px] font-bold text-white/80 hover:text-[#4ade80] transition-colors leading-none px-1.5 py-0.5 rounded-lg bg-black/40"
                              style={{
                                maxWidth: "56px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              onClick={() =>
                                socket.emit("requestPlayerHistory", {
                                  playerId: player.id,
                                })
                              }
                            >
                              {player.name.split(" ").pop()}
                            </button>
                            <span
                              className="text-[9px] font-black mt-0.5 leading-none"
                              style={{
                                color: pos.hex,
                                textShadow: "0 1px 5px rgba(0,0,0,0.95)",
                              }}
                            >
                              {player.skill}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null,
                );
              })()}

              {/* Drop overlay */}
              {dragPlayerId &&
                dragOverSection === "Titular" &&
                annotatedSquad.find((p) => p.id === dragPlayerId)?.status !==
                  "Titular" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 bg-[#4ade80]/4">
                    <div className="bg-black/55 border border-[#4ade80]/35 px-4 py-2.5 rounded-2xl backdrop-blur-sm">
                      <p className="text-[#4ade80] font-black text-xs uppercase tracking-widest animate-pulse">
                        ↓ Soltar para entrada
                      </p>
                    </div>
                  </div>
                )}

              {!tactic.formation && titulares.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white/30 text-xs font-bold text-center px-8 leading-relaxed">
                    Arrasta jogadores para o campo ou escolhe uma formação
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )
      )}

      {/* Mobile FAB */}
      {(() => {
        const fabHalftime = showHalftimePanel && !isPlayingMatch;
        const fabCupSpec = nextMatchSummary?.isCup && !nextMatchOpponent;
        if (showBriefing) return null;
        if (myReady) return null;
        if (activeTab !== "tactic") return null;
        if (mobileSubMenu) return null; // não sobrepor o fly-up do menu mobile
        if (!fabHalftime && !fabCupSpec && !isLineupComplete) return null;
        const fabIcon = fabHalftime
          ? "skip_next"
          : fabCupSpec
            ? "arrow_forward"
            : "play_arrow";
        return (
          <button
            onClick={fabHalftime ? handleHalftimeReady : handleReady}
            className={`lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 duration-200 ${!myReady ? "animate-heartbeat" : ""}`}
            style={{
              background:
                "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3) 0%, transparent 70%), #22c55e",
              boxShadow:
                "0 0 40px 8px rgba(34,197,94,0.4), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <span className="absolute inset-0 rounded-full bg-[#4ade80]/25 animate-ping" />
            <span className="material-symbols-outlined text-[28px] text-white drop-shadow-lg relative z-10 leading-none">
              {fabIcon}
            </span>
          </button>
        );
      })()}

      {/* Modal de espera multiplayer — aparece após confirmar táctica */}
      {/* Espectador eliminado da Taça: só precisa de ficar ready para avançar;
          cancelar bloquearia o lobby (todos os humanos têm de estar ready). */}
      <WaitingCoachesModal
        players={players}
        visible={
          myReady &&
          !isPlayingMatch &&
          !showHalftimePanel &&
          lockedCoaches.length >= 2
        }
        onCancel={handleReady}
        canCancel={!isEliminatedCupSpectator}
      />
    </div>
  );
}
