import { useTactics } from "../contexts/TacticsContext.jsx";
import { useGame } from "../contexts/GameContext.jsx";
import { PlayerLink } from "../components/shared/PlayerLink.jsx";
import { WaitingCoachesModal } from "../components/modals/WaitingCoachesModal.jsx";
import { socket } from "../socket.js";
import { TACTIC_FORMATIONS } from "../constants/index.js";

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


const TIER_COLORS = {
  Mestre: {
    bar: "bg-amber-400",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
  },
  Dominante: {
    bar: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  Consolidada: {
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  Familiar: { bar: "bg-sky-400", text: "text-sky-300", bg: "bg-sky-500/10" },
  "Ganhando rotina": {
    bar: "bg-sky-500",
    text: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  "A familiarizar": {
    bar: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-500/10",
  },
};
const MAX_COUNT = 21;

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
              (player.resistance ?? 0) >= 85
                ? "text-green-400"
                : (player.resistance ?? 0) >= 60
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

        {/* Q (Skill) */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[7px] uppercase tracking-widest text-gray-500 font-bold leading-none">
            Q
          </span>
          <span
            className={`text-[13px] font-black tabular-nums leading-none ${
              player.skill >= 85
                ? "text-green-400"
                : player.skill >= 60
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {player.skill}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

const WEATHER_LABELS = {
  sol: "Sol",
  chuva: "Chuva",
  vento: "Vento",
  chuva_forte: "Tempestade",
  frio: "Frio",
  nevoeiro: "Nevoeiro",
  neve: "Neve",
};

/**
 * Gera odds (1 X 2) a partir dos dados do próximo jogo.
 * @param {{ position: number|null }} team
 * @param {{ position: number|null }} opponent
 * @param {string} venue - "Casa" | "Fora"
 * @param {number} seed
 * @returns {{ home: string, draw: string, away: string }}
 */
function computeOdds(team, opponent, venue, seed) {
  const teamPos = team?.position ?? 8;
  const oppPos = opponent?.position ?? 8;
  const numTeams = 10;
  // Base probabilities
  let pHome = (numTeams + 1 - (venue === "Casa" ? teamPos : oppPos)) / numTeams;
  let pAway = (numTeams + 1 - (venue === "Casa" ? oppPos : teamPos)) / numTeams;
  // Home advantage boost
  pHome *= venue === "Casa" ? 1.18 : 0.85;
  pAway *= venue === "Fora" ? 1.18 : 0.85;
  // Draw probability roughly ~0.28, adjusted
  let pDraw = 0.28 + ((seed % 7) - 3) * 0.01;
  // Normalize
  const total = pHome + pAway + pDraw;
  pHome /= total;
  pAway /= total;
  pDraw /= total;
  // Apply bookmaker margin ~5%
  const margin = 1.05;
  const toOdds = (p) =>
    p > 0.01 ? (Math.round((1 / (p * margin)) * 100) / 100).toFixed(2) : "—";
  return { home: toOdds(pHome), draw: toOdds(pDraw), away: toOdds(pAway) };
}

/**
 * Card de análise do próximo confronto — inclui árbitro, tempo e odds.
 * @param {{ nextMatchSummary: Object, teamInfo: Object|null }} props
 * @returns {JSX.Element|null}
 */
function NextMatchCard({ nextMatchSummary, teamInfo }) {
  if (!nextMatchSummary || !nextMatchSummary.opponent) return null;
  const s = nextMatchSummary;
  const opp = s.opponent;
  const isHome = s.venue === "Casa";
  const myPts = teamInfo?.points ?? 0;
  const ptsDiff = myPts - (opp.points ?? 0);
  const ptsDiffLabel =
    ptsDiff > 0 ? `+${ptsDiff}` : ptsDiff < 0 ? `${ptsDiff}` : "=";
  const ptsDiffColor =
    ptsDiff > 0
      ? "text-green-400"
      : ptsDiff < 0
        ? "text-red-400"
        : "text-gray-400";
  const competition = s.isCup
    ? (s.cupRoundName ?? "Taça")
    : `Jornada ${s.matchweek}`;

  // Último confronto
  const lc = opp.lastConfrontation;
  const lcResult = lc
    ? (() => {
        const weWereHome =
          lc.home_team_id === s.team?.id || lc.home_team_id === teamInfo?.id;
        const ourScore = weWereHome ? lc.home_score : lc.away_score;
        const theirScore = weWereHome ? lc.away_score : lc.home_score;
        const venue = weWereHome ? "Casa" : "Fora";
        const comp = lc.competition === "Cup" ? "Taça" : "Liga";
        const season = lc.season ? `Época ${lc.season}` : null;
        return { ourScore, theirScore, venue, comp, season };
      })()
    : null;

  // Odds
  const seed = (s.matchweek ?? 1) + (s.team?.id ?? 0) + (opp.id ?? 0);
  const odds = computeOdds(s.team, opp, s.venue, seed);
  const homeTeamName = isHome ? (s.team?.name ?? "Casa") : (opp.name ?? "Visitado");
  const awayTeamName = isHome ? (opp.name ?? "Visitante") : (s.team?.name ?? "Visitante");

  // Tempo
  const wf = s.weatherForecast;
  const weatherLabel = wf
    ? (WEATHER_LABELS[wf.condition] ?? wf.condition)
    : null;

  // Árbitro
  const ref = s.referee;

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
      {/* Cabeçalho: competição + venue */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          {s.isCup ? (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              🏆 Taça
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">
              ⚽ Liga
            </span>
          )}
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
            {competition}
          </span>
        </div>
        <span
          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isHome ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}
        >
          {isHome ? "Casa" : "Fora"}
        </span>
      </div>

      {/* Corpo */}
      <div className="px-4 py-3 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-start sm:divide-x sm:divide-[#1e1e1e]">
        {/* — Secção principal: VS + stats — */}
        <div className="sm:flex-1 sm:pr-4 flex flex-col gap-2.5">
          {/* VS row */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wide">
              VS
            </span>
            <span className="text-sm font-black text-white truncate">
              {opp.name}
            </span>
            {opp.position && (
              <span className="shrink-0 text-[9px] text-gray-600 font-bold">
                {opp.position}º
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            {s.team?.position && (
              <div className="flex flex-col items-center">
                <span className="text-[7px] uppercase tracking-wide text-gray-700 font-bold">
                  Posição
                </span>
                <span className="text-[11px] font-black text-white">
                  {s.team.position}º
                </span>
              </div>
            )}
            <div className="w-px h-6 bg-[#222]" />
            <div className="flex flex-col items-center">
              <span className="text-[7px] uppercase tracking-wide text-gray-700 font-bold">
                Pts Adv.
              </span>
              <span
                className={`text-[11px] font-black tabular-nums ${ptsDiffColor}`}
              >
                {ptsDiffLabel}
              </span>
            </div>
            <div className="w-px h-6 bg-[#222]" />
            <div className="flex flex-col items-center">
              <span className="text-[7px] uppercase tracking-wide text-gray-700 font-bold">
                GM / GS
              </span>
              <span className="text-[11px] font-black text-white tabular-nums">
                {opp.goalsFor ?? 0}/{opp.goalsAgainst ?? 0}
              </span>
            </div>

            {/* Últimos 5 do adversário */}
            {opp.last5 &&
              typeof opp.last5 === "string" &&
              opp.last5.length > 0 && (
                <>
                  <div className="w-px h-6 bg-[#222]" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[7px] uppercase tracking-wide text-gray-700 font-bold">
                      Últimos 5
                    </span>
                    <div className="flex gap-0.5">
                      {opp.last5.split("").map((r, i) => (
                        <span
                          key={i}
                          className={`w-3.5 h-3.5 rounded-sm text-[8px] font-black flex items-center justify-center ${r === "V" ? "bg-green-500/20 text-green-400" : r === "D" ? "bg-red-500/20 text-red-400" : "bg-gray-700/40 text-gray-500"}`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>

        {/* — Último confronto — */}
        <div className="sm:flex-1 sm:px-4 flex flex-col gap-1">
          <span className="text-[7px] uppercase tracking-widest text-gray-700 font-bold">
            Último confronto
          </span>
          {lcResult ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-white tabular-nums leading-none">
                  {lcResult.ourScore}–{lcResult.theirScore}
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${lcResult.ourScore > lcResult.theirScore ? "bg-green-500/15 text-green-400" : lcResult.ourScore < lcResult.theirScore ? "bg-red-500/15 text-red-400" : "bg-gray-700/30 text-gray-500"}`}
                >
                  {lcResult.ourScore > lcResult.theirScore
                    ? "Vitória"
                    : lcResult.ourScore < lcResult.theirScore
                      ? "Derrota"
                      : "Empate"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-gray-600 uppercase font-bold">
                  {lcResult.venue}
                </span>
                <span className="text-[9px] text-gray-700">·</span>
                <span className="text-[9px] text-gray-600 font-bold">
                  {lcResult.comp}
                </span>
                {lcResult.season && (
                  <>
                    <span className="text-[9px] text-gray-700">·</span>
                    <span className="text-[9px] text-gray-600">
                      {lcResult.season}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <span className="text-[10px] text-gray-700 font-bold italic">
              Sem histórico
            </span>
          )}
        </div>

        {/* — Odds + Árbitro + Tempo — */}
        <div className="sm:flex-1 sm:pl-4 flex flex-col gap-2.5">
          {/* Odds */}
          <div>
            <span className="text-[7px] uppercase tracking-widest text-gray-700 font-bold block mb-1.5">
              Apostas
            </span>
            <div className="flex gap-1.5">
              {[
                {
                  label: homeTeamName,
                  value: odds.home,
                  color: "text-sky-400",
                  bg: "bg-sky-500/10",
                },
                {
                  label: "Empate",
                  value: odds.draw,
                  color: "text-gray-400",
                  bg: "bg-gray-700/20",
                },
                {
                  label: awayTeamName,
                  value: odds.away,
                  color: "text-amber-400",
                  bg: "bg-amber-500/10",
                },
              ].map(({ label, value, color, bg }) => (
                <div
                  key={label}
                  className={`flex-1 ${bg} rounded-lg px-1.5 py-1.5 flex flex-col items-center gap-0.5`}
                >
                  <span className="text-[8px] text-gray-600 font-black uppercase">
                    {label}
                  </span>
                  <span
                    className={`text-[12px] font-black tabular-nums ${color}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Árbitro + Tempo em linha */}
          <div className="flex items-start gap-3">
            {ref && (
              <div className="flex-1 min-w-0">
                <span className="text-[7px] uppercase tracking-widest text-gray-700 font-bold block mb-0.5">
                  Árbitro
                </span>
                <span className="text-[10px] font-bold text-gray-400 truncate block">
                  {ref.name}
                </span>
                <div className="mt-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden relative">
                  <div
                    className="absolute inset-y-0 left-0 rounded-l-full"
                    style={{
                      width: `${ref.balance}%`,
                      background: teamInfo?.color_primary || "#16a34a",
                      opacity: 0.9,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 rounded-r-full"
                    style={{
                      width: `${100 - ref.balance}%`,
                      background: opp?.color_primary || "#dc2626",
                      opacity: 0.9,
                    }}
                  />
                </div>
              </div>
            )}
            {wf && (
              <div className="shrink-0 flex flex-col items-center gap-0.5">
                <span className="text-[7px] uppercase tracking-widest text-gray-700 font-bold">
                  Tempo
                </span>
                <span className="text-xl leading-none">{wf.emoji}</span>
                <span className="text-[8px] text-gray-600 font-bold">
                  {weatherLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
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
  const subsFull = subCount >= 5;
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
    showHalftimePanel,
    isPlayingMatch,
    disconnected,
    isCupMatch,
  } = useTactics();

  const { lockedCoaches } = useGame();

  const getBestForFormation = (formation) => {
    const styles = ["OFENSIVO", "DEFENSIVO", "EQUILIBRADO"];
    let best = null;
    for (const s of styles) {
      const entry = allTacticFamiliarity[`${formation}|${s}`];
      if (entry && (!best || entry.count > best.count)) best = entry;
    }
    return best;
  };

  const myReady = players.find((p) => p.name === me?.name)?.ready;
  const isHalftime = showHalftimePanel && !isPlayingMatch;
  const isEliminatedCupSpectator =
    nextMatchSummary?.isCup && !nextMatchOpponent;
  const canPlay = isEliminatedCupSpectator || isHalftime || isLineupComplete;
  const playLabel = myReady
    ? "⏳ A aguardar..."
    : isEliminatedCupSpectator
      ? "Avançar para Taça"
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

      {nextMatchSummary && nextMatchOpponent && (
        <NextMatchCard
          nextMatchSummary={nextMatchSummary}
          teamInfo={teamInfo}
        />
      )}

      {nextMatchSummary?.isCup && !nextMatchOpponent ? (
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
        <div className="flex flex-col lg:flex-row gap-3 items-start">
          {/* COL 1 — FORMAÇÃO + MENTALIDADE */}
          <div className={`lg:w-57.5 shrink-0 flex flex-col gap-2 ${!isLineupComplete && !myReady ? "animate-heartbeat-border rounded-2xl" : ""}`}>
            {/* Proximo jogo — mobile: moral + mentality side by side */}
            <div className="flex gap-2 lg:hidden">
              {nextMatchSummary && (
                <div className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                  {(() => {
                    const morale = teamInfo?.morale ?? 75;
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
                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
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
              <div className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                <div className="px-3 py-2">
                  {(() => {
                    const STYLES = ["Defensive", "Balanced", "Offensive"];
                    const LABELS = {
                      Defensive: "DEF",
                      Balanced: "NEU",
                      Offensive: "ATK",
                    };
                    const idx = STYLES.indexOf(tactic.style ?? "Balanced");
                    const safeIdx = idx < 0 ? 1 : idx;
                    return (
                      <div className="relative flex bg-[#161616] rounded-full p-0.5">
                        <div
                          className="absolute inset-y-0.5 rounded-full transition-all duration-200 pointer-events-none"
                          style={{
                            left: `calc(${safeIdx * 33.333}% + 2px)`,
                            width: "calc(33.333% - 4px)",
                            background:
                              "linear-gradient(135deg, rgba(74,222,128,0.22), rgba(74,222,128,0.08))",
                            border: "1px solid rgba(74,222,128,0.35)",
                          }}
                        />
                        {STYLES.map((val) => (
                          <button
                            key={val}
                            onClick={() => updateTactic({ style: val })}
                            className={`relative z-10 flex-1 py-1.5 text-[9px] font-black uppercase tracking-wide rounded-full transition-colors ${tactic.style === val ? "text-[#4ade80]" : "text-gray-500 hover:text-gray-300"}`}
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
              <div className="px-3 py-2 flex flex-wrap gap-1.5">
                {TACTIC_FORMATIONS.map(({ value, label }) => {
                  const isAvailable =
                    formationAvailabilityByValue[value] === true;
                  const isActive =
                    titulares.length > 0 && tactic.formation === value;
                  return (
                    <button
                      key={value}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && handleAutoPick(value)}
                      className={`px-3 py-1.5 text-[11px] font-black rounded-xl transition-all active:scale-95 ${
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
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proximo jogo — desktop only */}
            {nextMatchSummary && (
              <div className="hidden lg:block bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
                {(() => {
                  const morale = teamInfo?.morale ?? 75;
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
                  const colors = best
                    ? TIER_COLORS[best.label] || TIER_COLORS["A familiarizar"]
                    : null;
                  const pct = best
                    ? Math.min(100, Math.round((best.count / MAX_COUNT) * 100))
                    : 0;
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
                      {best ? (
                        <div
                          className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl ${colors.bg}`}
                        >
                          <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${colors.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span
                            className={`text-[8px] font-black uppercase shrink-0 ${colors.text}`}
                          >
                            {best.label}
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1 px-2 py-1.5 rounded-xl bg-[#161616]/60">
                          <div className="h-1 bg-[#1a1a1a] rounded-full" />
                        </div>
                      )}
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
          <div className="flex-1 flex flex-row gap-2 min-w-0">
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
                    <span className="text-gray-700">/5</span>
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
      )}

      {/* Mobile FAB */}
      {(() => {
        const fabHalftime = showHalftimePanel && !isPlayingMatch;
        const fabCupSpec = nextMatchSummary?.isCup && !nextMatchOpponent;
        if (myReady) return null;
        if (!fabHalftime && !fabCupSpec && !isLineupComplete) return null;
        const fabIcon = fabHalftime
          ? "skip_next"
          : fabCupSpec
            ? "arrow_forward"
            : "play_arrow";
        return (
          <button
            onClick={fabHalftime ? handleHalftimeReady : handleReady}
            className={`lg:hidden fixed bottom-28 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 duration-200 ${!myReady ? "animate-heartbeat" : ""}`}
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
      <WaitingCoachesModal
        players={players}
        visible={
          myReady &&
          !isPlayingMatch &&
          !showHalftimePanel &&
          lockedCoaches.length >= 2
        }
        onCancel={handleReady}
      />
    </div>
  );
}
