import { useState } from "react";
import { useTactics } from "../contexts/TacticsContext.jsx";
import { useGame } from "../contexts/GameContext.jsx";
import { PlayerLink } from "../components/shared/PlayerLink.jsx";
import { MatchIcon } from "../components/match/shared/MatchIcon.jsx";
import { TacticsButtons } from "../components/match/shared/TacticsButtons.jsx";
import { OrdersCard } from "../components/shared/OrdersCard.jsx";
import { PrepStepper } from "../components/live/briefing/index.js";
import { WaitingCoachesModal } from "../components/modals/WaitingCoachesModal.jsx";
import { socket, queueEmit } from "../socket.js";
import { TACTIC_FORMATIONS, MAX_BENCH_SIZE, PRESSURE_OPTIONS } from "../constants/index.js";
import { WEATHER_LABELS } from "../components/match/matchConstants.js";
import { getMoraleLabel, getMoraleClasses } from "../utils/morale.js";
import { isPostMatchQueueActive } from "../utils/postMatchFlow.js";
import { PlayerAvatar as PlayerAvatarSVG } from "../components/shared/PlayerAvatar.jsx";
import { TransferHeader } from "../components/transfers/TransferChrome.jsx";
import { TURF_BACKGROUND, TURF_OVERLAY_CLASS } from "../components/match/shared/PitchFormation.jsx";
import { BadgeSkills } from "../components/shared/BadgeSkills.jsx";

/** Cores por posição */
const POS_COLORS = {
  GR: {
    bg: "bg-yellow-500",
    ring: "ring-yellow-400",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
    hex: "#eab308",
    soft: "rgba(234,179,8,0.08)",
  },
  DEF: {
    bg: "bg-blue-500",
    ring: "ring-blue-400",
    text: "text-blue-400",
    dot: "bg-blue-400",
    hex: "#3b82f6",
    soft: "rgba(59,130,246,0.08)",
  },
  MED: {
    bg: "bg-emerald-500",
    ring: "ring-emerald-400",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    hex: "#10b981",
    soft: "rgba(16,185,129,0.08)",
  },
  ATA: {
    bg: "bg-rose-500",
    ring: "ring-rose-400",
    text: "text-rose-400",
    dot: "bg-rose-400",
    hex: "#f43f5e",
    soft: "rgba(244,63,94,0.08)",
  },
};

/** Cor do selo de cada pendor tático (attack/defense/balanced). */
const FORMATION_EDGE_TEXT = {
  attack: "text-rose-400",
  defense: "text-blue-400",
  balanced: "text-gray-500",
};

/** Valores de mentalidade e metadados partilhados pelos cartões mobile/desktop. */
const STYLE_ORDER = ["Defensive", "Balanced", "Offensive"];
const STYLE_META = {
  Defensive: {
    short: "DEF",
    icon: "phase-start",
    label: "Defensivo",
    blurb: "Bloco baixo, sair a contragolpe.",
    chip: "bg-blue-500/15 border-blue-500/40 text-blue-400",
    pillBg: "rgba(59,130,246,0.28)",
    pillBorder: "rgba(59,130,246,0.6)",
    text: "text-blue-400",
  },
  Balanced: {
    short: "NEU",
    icon: "form-flat",
    label: "Neutro",
    blurb: "Equilíbrio no meio, sem extremos.",
    chip: "bg-[#4ade80]/15 border-[#4ade80]/35 text-[#4ade80]",
    pillBg: "rgba(74,222,128,0.28)",
    pillBorder: "rgba(74,222,128,0.55)",
    text: "text-[#4ade80]",
  },
  Offensive: {
    short: "ATC",
    icon: "form-up",
    label: "Ofensivo",
    blurb: "Pressão alta, campo todo a favor.",
    chip: "bg-rose-500/15 border-rose-500/40 text-rose-400",
    pillBg: "rgba(244,63,94,0.28)",
    pillBorder: "rgba(244,63,94,0.6)",
    text: "text-rose-400",
  },
};

/**
 * Melhor entrada de familiaridade (por estilo) para uma formação.
 * @param {Object} allTacticFamiliarity Mapa "formação|ESTILO" → { stars, ... }
 * @param {string} formation Valor da formação (ex. "4-4-2")
 * @returns {Object|null}
 */
function getBestForFormation(allTacticFamiliarity, formation) {
  const styles = ["OFENSIVO", "DEFENSIVO", "EQUILIBRADO"];
  let best = null;
  for (const s of styles) {
    const entry = allTacticFamiliarity[`${formation}|${s}`];
    if (entry && (!best || entry.stars > best.stars)) best = entry;
  }
  return best;
}

/**
 * Estado de indisponibilidade de um jogador — fonte única usada por
 * PlayerRow e pelo campo. Presume player.isUnavailable.
 * @param {Object} player
 * @param {number|null} calendarIndex
 * @param {number|null} matchweekCount
 * @returns {{ emoji: string, left?: number }} left apenas para castigo/lesão
 */
function unavailableMark(player, calendarIndex, matchweekCount) {
  const susp = player.suspension_until_matchweek || 0;
  const inj = player.injury_until_matchweek || 0;
  const cooldown = player.transfer_cooldown_until_matchweek || 0;
  const nowIdx = calendarIndex ?? matchweekCount ?? 0;
  const isSusp = susp > nowIdx;
  if (!isSusp && !(inj > nowIdx) && cooldown > 0 && cooldown > nowIdx)
    return { emoji: "✈️" };
  return { emoji: isSusp ? "🟥" : "🩹", left: (isSusp ? susp : inj) - nowIdx };
}

/** Meteo dura (resistência pesa mais) e limiar de "resistência muito baixa" (escala 1–50). */
const HARSH_WEATHER = new Set(["chuva", "vento", "chuva_forte", "frio", "neve"]);
const LOW_RESISTANCE = 15;

/** Selo inline de indisponibilidade (versão PlayerRow, com jornadas restantes). */
function UnavailableMark({ player, calendarIndex, matchweekCount }) {
  const mark = unavailableMark(player, calendarIndex, matchweekCount);
  if (!mark) return null;
  if (mark.left === undefined)
    return <span className="text-[10px] ml-0.5">{mark.emoji}</span>;
  return (
    <span className="text-[9px] ml-0.5 text-red-400">
      {mark.emoji}({mark.left})
    </span>
  );
}

/**
 * Props de drag-and-drop partilhadas por todas as linhas de jogador
 * (Titulares, Suplentes, Não Convocados e campo).
 * @param {Object} t Valor de useTactics()
 * @param {Object} player
 * @param {boolean} [stopOver=false] stopPropagation no dragOver (campo)
 * @returns {Object} Spread direto em PlayerRow ou no wrapper do campo
 */
function rowDragProps(t, player, stopOver = false) {
  return {
    draggable: !player.isJunior,
    onDragStart: t.handleDragStart,
    onDragOver: (e) => {
      e.preventDefault();
      if (stopOver) e.stopPropagation();
      t.setDragOverPlayerId(player.id);
    },
    onDragLeave: () => t.setDragOverPlayerId(null),
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (t.dragPlayerId && t.dragPlayerId !== player.id)
        t.handleSwapPlayerStatuses(t.dragPlayerId, player.id);
      else {
        t.setDragOverPlayerId(null);
        t.setDragPlayerId(null);
      }
      t.setDragOverSection(null);
    },
    onDragEnd: () => {
      t.setDragOverPlayerId(null);
      t.setDragPlayerId(null);
    },
    isOver: t.dragOverPlayerId === player.id && t.dragPlayerId !== player.id,
    isDragging: t.dragPlayerId === player.id,
  };
}

/**
 * Familiaridade táctica — 5 estrelas SVG com contorno.
 * @param {Object} props
 * @param {number} props.stars Estrelas (0-5) calculadas no servidor (score 0..100)
 * @param {boolean} [props.fill=false] Estica a fila até à largura total do contentor
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
      <div className="flex justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) =>
          i <= value ? (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className="h-3.5 flex-1 max-w-4 transition-all duration-300"
              stroke="#fde68a"
              strokeWidth="1"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(251,191,36,0.45))" }}
            >
              <path d="M12 2.5l2.9 6.3 6.6.6-5 4.4 1.5 6.5L12 16.9 6 20.3l1.5-6.5-5-4.4 6.6-.6z" fill="#fbbf24" />
            </svg>
          ) : (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className="h-3.5 flex-1 max-w-4 transition-all duration-300"
              fill="rgba(55,65,81,0.35)"
              stroke="#4b5563"
              strokeWidth="1.2"
              strokeLinejoin="round"
            >
              <path d="M12 2.5l2.9 6.3 6.6.6-5 4.4 1.5 6.5L12 16.9 6 20.3l1.5-6.5-5-4.4 6.6-.6z" />
            </svg>
          ),
        )}
      </div>
      {full && <div className="fam-shimmer" />}
    </div>
  );
}

/**
 * Avatar circular — foto com contorno (2px) na cor da posição ou
 * avatar SVG procedural partilhado quando não há foto (ou a foto falha).
 * @param {{ player: Object, size?: string }} props
 * @returns {JSX.Element}
 */
function PlayerAvatar({ player, size = "w-7 h-7" }) {
  const pos = POS_COLORS[player.position] || { hex: "#6b7280" };
  const [imgFailed, setImgFailed] = useState(false);
  if (player.photo && !imgFailed) {
    return (
      <img
        src={player.photo}
        alt=""
        loading="lazy"
        className={`${size} rounded-full object-cover object-top shrink-0 bg-white border border-white/20`}
        style={{ boxShadow: `0 0 0 2px ${pos.hex}` }}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <PlayerAvatarSVG
      seed={player.id}
      position={player.position}
      nationality={player.nationality}
      size={size}
    />
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
  calendarIndex,
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
  const pos = POS_COLORS[player.position] || { soft: "rgba(107,114,128,0.08)" };
  const weather = useTactics().nextMatchSummary?.weatherForecast?.condition;
  const weatherRisk =
    HARSH_WEATHER.has(weather) && (player.resistance ?? 99) <= LOW_RESISTANCE;
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
      style={{ "--pos-soft": pos.soft }}
      className={`relative flex items-center gap-2 short:gap-1.5 px-2 short:px-1.5 py-1.5 short:py-1 rounded-xl transition-all select-none bg-[var(--pos-soft)]
${isDragging ? "opacity-30 scale-95" : ""}
${isOver ? "ring-1 ring-[#4ade80]/40" : "hover:bg-white/5"}
${player.isUnavailable ? "opacity-50" : ""}
${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
`}
    >
      <span
        className={`w-5 shrink-0 text-center rounded-md py-0.5 text-[9px] font-black leading-none text-black/80 ${pos.bg ?? "bg-gray-500"}`}
      >
        {player.position[0]}
      </span>
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
        {player.isUnavailable && (
          <UnavailableMark
            player={player}
            calendarIndex={calendarIndex}
            matchweekCount={matchweekCount}
          />
        )}
      </span>
      <BadgeSkills
        size="sm"
        skill={player.skill}
        resistance={player.resistance}
        form={player.form}
        morale={player.morale}
        aggressiveness={player.aggressiveness}
        prevSkill={player.prev_skill}
        resWarning={
          weatherRisk
            ? `Resistência baixa para ${WEATHER_LABELS[weather] ?? weather}`
            : undefined
        }
      />
      {children}
    </div>
  );
}

/**
 * StatusPicker — popup de seleção de estado do jogador.
 * Extraído para fora do componente TacticsView para evitar re-criação
 * da definição a cada render (prevenindo remount/flickering).
 * @param {{ player: Object, above?: boolean }} props
 * @returns {JSX.Element|null}
 */
function StatusPicker({ player, above = false }) {
  const {
    openStatusPickerId,
    tactic,
    annotatedSquad,
    handleSetPlayerStatus,
  } = useTactics();
  if (openStatusPickerId !== player.id) return null;
  const subCount = Object.entries(tactic.positions).filter(
    ([id, s]) => s === "Suplente" && Number(id) !== player.id,
  ).length;
  const titCount = Object.entries(tactic.positions).filter(
    ([id, s]) => s === "Titular" && Number(id) !== player.id,
  ).length;
  const subsFull = subCount >= MAX_BENCH_SIZE;
  const titularesFull = titCount >= 11;
  const posCount =
    player.position !== "GR"
      ? Object.entries(tactic.positions).filter(([id, s]) => {
          if (s !== "Titular" || Number(id) === player.id) return false;
          const p = annotatedSquad.find((x) => x.id === Number(id));
          return p?.position === player.position;
        }).length
      : 0;
  const posFull = posCount >= 5;
  return (
    <div
      className={`absolute right-0 ${above ? "bottom-full mb-1" : "top-full mt-1"} z-50 bg-surface-container border border-outline-variant/25 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-38.75`}
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

/**
 * MoraleCard — cartão de moral do treinador.
 * @param {{ glow?: boolean }} props glow = variante desktop (texto com brilho);
 *   ausente = variante mobile compacta (etiqueta no cabeçalho).
 * @returns {JSX.Element}
 */
function MoraleCard({ glow = false }) {
  const { teamInfo } = useTactics();
  const morale = teamInfo?.morale ?? 25;
  const { text: textColor, bar: fillColor } = getMoraleClasses(morale);
  const label = getMoraleLabel(morale);
  if (glow) {
    return (
      <div className="border-b border-outline-variant/15">
        <div className="px-4 short:px-3 py-2 border-b border-outline-variant/15">
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
            Moral
          </span>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 px-6 short:px-4 py-3">
          <div className={`flex w-full flex-col items-center gap-2 ${textColor}`}>
            <span
              title={`Moral ${morale}`}
              className="text-lg leading-none font-black"
              style={{ textShadow: "0 0 14px currentColor" }}
            >
              {label}
            </span>
            <div
              className="h-2.5 w-full bg-surface-container-low/60 rounded-full overflow-hidden"
              style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
            >
              <div
                className={`h-full rounded-full transition-all duration-700 ${fillColor}`}
                style={{ width: `${morale * 2}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-outline-variant/15">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
          Moral
        </span>
        <span className={`min-w-0 truncate text-[9px] font-black uppercase ${textColor}`}>
          {label}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-4 pb-3">
        <span
          title={`Moral ${morale}`}
          className={`text-xl leading-none font-black text-center truncate w-full ${textColor}`}
        >
          {label}
        </span>
        <div className="h-2 w-full bg-surface-container-low/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${fillColor}`}
            style={{ width: `${morale * 2}%` }}
          />
        </div>
      </div>
    </>
  );
}

/**
 * MentalityChips — seletor de mentalidade mobile (3 botões com ícone).
 * @returns {JSX.Element}
 */
function MentalityChips() {
  const { tactic, updateTactic } = useTactics();
  return (
    <div className="flex flex-1 items-stretch gap-1 p-1.5">
      {STYLE_ORDER.map((val) => {
        const isActive = tactic.style === val;
        const meta = STYLE_META[val];
        return (
          <button
            key={val}
            onClick={() => updateTactic({ style: val })}
            className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-0.5 py-1.5 transition-all active:scale-95 ${isActive ? meta.chip : "border-transparent bg-surface-container-low/60 text-gray-500 hover:text-gray-300"}`}
          >
            <MatchIcon
              name={meta.icon}
              className={`h-3.5 w-3.5 shrink-0 ${isActive ? "" : "opacity-70"}`}
            />
            <span className="text-[9px] font-black uppercase tracking-wide">
              {meta.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * MentalityPills — seletor de mentalidade desktop (pill deslizante + blurb).
 * @returns {JSX.Element}
 */
function MentalityPills() {
  const { tactic, updateTactic } = useTactics();
  const activeStyle = tactic.style ?? "Balanced";
  const idx = STYLE_ORDER.indexOf(activeStyle);
  const safeIdx = idx < 0 ? 1 : idx;
  return (
    <>
      <div className="relative flex bg-surface-container-low/60 rounded-full p-0.5">
        {/* Pill deslizante */}
        <div
          className="absolute inset-y-0.5 rounded-full transition-all duration-200 pointer-events-none"
          style={{
            left: `calc(${safeIdx * 33.333}% + 2px)`,
            width: "calc(33.333% - 4px)",
            background: STYLE_META[activeStyle].pillBg,
            border: `1px solid ${STYLE_META[activeStyle].pillBorder}`,
          }}
        />
        {STYLE_ORDER.map((val) => (
          <button
            key={val}
            onClick={() => updateTactic({ style: val })}
            className={`relative z-10 flex-1 py-2 text-[9px] font-black uppercase tracking-wide rounded-full transition-colors ${
              tactic.style === val
                ? STYLE_META[val].text
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {STYLE_META[val].label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-gray-500 font-semibold leading-snug">
        {STYLE_META[activeStyle].blurb}
      </p>
    </>
  );
}

/**
 * DuelHint — o teu onze (linhas reais) contra a formação provável do
 * adversário: quem ganha o meio-campo e a sobra de defesas de cada lado.
 * @returns {JSX.Element|null}
 */
function DuelHint() {
  const { titulares, nextMatchSummary } = useTactics();
  const opp = nextMatchSummary?.opponent?.probableFormation;
  const [oDef, oMed, oAta] = String(opp || "").split("-").map(Number);
  if (!opp || titulares.length === 0 || ![oDef, oMed, oAta].every(Number.isFinite)) return null;
  const count = (pos) => titulares.filter((p) => p.position === pos).length;
  const [def, med, ata] = [count("DEF"), count("MED"), count("ATA")];
  // Sobra de defesas: 2 é o normal; 0–1 = perigo, 3+ = sobra (ver motor).
  const spareTxt = (spare) => (spare <= 1 ? "perigo" : spare >= 3 ? "folga" : "normal");
  const midCls = med > oMed ? "text-[#4ade80]" : med < oMed ? "text-rose-400" : "text-gray-300";
  return (
    <p className="px-4 short:px-3 pt-2 text-[9px] text-gray-500 font-semibold leading-snug">
      <span className="uppercase tracking-widest font-black text-gray-400">Duelo vs {opp}</span>{" "}—{" "}
      meio-campo <span className={`font-black ${midCls}`}>{med}×{oMed}</span>
      {" · "}ataque {ata} contra {oDef} defesas ({spareTxt(oDef - ata)})
      {" · "}defesa {def} contra {oAta} avançados ({spareTxt(def - oAta)})
    </p>
  );
}

/**
 * PressureCard — pressão (alta: mais bola e faltas, cansa; bloco baixo:
 * compacto, poupa pernas). Escreve `tactic.pressure`.
 * @param {Object} props
 * @param {boolean} [props.bare=false] Linha com etiqueta, sem cartão (dentro de outro cartão)
 * @returns {JSX.Element}
 */
function PressureCard({ bare = false }) {
  const { tactic, updateTactic } = useTactics();
  const body = (
    <TacticsButtons
      className="w-full"
      options={PRESSURE_OPTIONS}
      field="pressure"
      value={tactic.pressure ?? "MEDIA"}
      onChange={updateTactic}
    />
  );
  if (bare)
    return (
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[9px] uppercase tracking-widest text-gray-500 font-black">Pressão</span>
        <div className="flex-1 min-w-0">{body}</div>
      </div>
    );
  return (
    <div className="bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-outline-variant/15">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Pressão</span>
      </div>
      <div className="p-1.5">{body}</div>
    </div>
  );
}

/**
 * FormationCard — grelha de formações (partilhada mobile/desktop).
 * @param {Object} props
 * @param {string} [props.className] Classes extra do contentor (layout do pai)
 * @param {boolean} [props.desktop=false] Adiciona a linha de blurb da formação ativa
 * @param {boolean} [props.dataTour=false] Alvo do tour (`data-tour="tactic-lineup"`)
 * @param {boolean} [props.heartbeat=false] Pulso quando o 11 incompleto bloqueia
 * @returns {JSX.Element}
 */
function FormationCard({ className = "", desktop = false, dataTour = false, heartbeat = false }) {
  const {
    tactic,
    titulares,
    formationAvailabilityByValue,
    allTacticFamiliarity,
    handleClearTactic,
    handleAutoPick,
  } = useTactics();
  const activeProfile = TACTIC_FORMATIONS.find(
    (f) => f.value === tactic.formation,
  );
  return (
    <div
      data-tour={dataTour ? "tactic-lineup" : undefined}
      className={`bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden ${className} ${heartbeat ? "animate-heartbeat-border" : ""}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/15">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
          Formação
        </span>
        <button
          onClick={handleClearTactic}
          className="text-[9px] text-gray-600 uppercase hover:text-red-400 transition-colors font-bold"
        >
          Limpar
        </button>
      </div>
      {desktop && titulares.length > 0 && activeProfile && (
        <p className="px-4 short:px-3 pt-2 text-[9px] text-gray-500 font-semibold leading-snug">
          <span
            className={`uppercase tracking-widest font-black ${FORMATION_EDGE_TEXT[activeProfile.edge] ?? "text-gray-400"}`}
          >
            {activeProfile.badge}
          </span>{" "}— {activeProfile.blurb}
        </p>
      )}
      <DuelHint />
      <div className="p-2 short:p-1.5 grid grid-cols-4 gap-1.5 short:gap-1">
        {TACTIC_FORMATIONS.map(({ value, label, badge, edge }) => {
          const isAvailable =
            formationAvailabilityByValue[value] === true;
          const isActive =
            titulares.length > 0 && tactic.formation === value;
          const best = getBestForFormation(allTacticFamiliarity, value);
          return (
            <button
              key={value}
              disabled={!isAvailable}
              onClick={() => isAvailable && handleAutoPick(value)}
              className={`w-full px-1 py-1.5 text-[11px] font-black rounded-xl transition-all active:scale-95 ${
                !isAvailable
                  ? "bg-surface-container-low/60 text-gray-700 cursor-not-allowed"
                  : isActive
                    ? "text-[#0a1a0a] shadow-lg shadow-green-500/20"
                    : "bg-surface-container-low/60 text-gray-300 hover:bg-white/5"
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
                <span
                  className={`text-[8px] font-black uppercase tracking-widest leading-none ${isActive ? "text-green-950/70" : (FORMATION_EDGE_TEXT[edge] ?? "text-gray-500")}`}
                >
                  {badge}
                </span>
                <FamiliarityStars stars={best?.stars ?? 0} fill />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * LineStrength — força média do onze por linha (ATA/MED/DEF/GR), em barras.
 * @returns {JSX.Element}
 */
function LineStrength() {
  const { annotatedSquad } = useTactics();
  const tits = annotatedSquad.filter((p) => p.status === "Titular");
  const avg = (list) =>
    list.length ? list.reduce((n, p) => n + (p.skill || 0), 0) / list.length : 0;
  const lines = [
    ["ATA", "Ataque"],
    ["MED", "Meio-campo"],
    ["DEF", "Defesa"],
    ["GR", "Guarda-redes"],
  ].map(([pos, label]) => ({ pos, label, v: avg(tits.filter((p) => p.position === pos)) }));
  return (
    <div className="bg-surface-container border border-outline-variant/25 rounded-2xl px-4 py-3 short:py-1.5 flex flex-col justify-between gap-1.5 flex-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
          Força do onze
        </span>
        <span className="text-lg font-black text-white">{avg(tits).toFixed(1)}</span>
      </div>
      {lines.map(({ pos, label, v }) => (
        <div key={pos} className="flex items-center gap-2" title={`${label}: ${v.toFixed(1)}`}>
          <span className={`w-6 text-[9px] font-black ${POS_COLORS[pos].text}`}>{pos}</span>
          <div className="flex-1 h-2.5 bg-surface-container-low/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${POS_COLORS[pos].bg}`}
              style={{ width: `${Math.min(100, (v / 50) * 100)}%` }}
            />
          </div>
          <span className="w-7 text-right text-[10px] font-black text-gray-300">{v ? v.toFixed(1) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Pitch — campo de futebol (desktop only; mobile usa o FAB e a lista de
 * Titulares). Grelha SVG, avatares por linha e overlays de drag.
 * @returns {JSX.Element}
 */
function Pitch() {
  const t = useTactics();
  const { calendarIndex } = useGame();
  const {
    annotatedSquad,
    titulares,
    dragPlayerId,
    dragOverSection,
    dragOverPlayerId,
    matchweekCount,
  } = t;
  const tits = annotatedSquad.filter((p) => p.status === "Titular");
  const rows = [
    tits.filter((p) => p.position === "ATA"),
    tits.filter((p) => p.position === "MED"),
    tits.filter((p) => p.position === "DEF"),
    tits.filter((p) => p.position === "GR"),
  ];
  const rowYs = ["6%", "27%", "52%", "75%"];
  return (
    <div className="max-xl:hidden xl:w-72.5 shrink-0 flex flex-col gap-2 short:gap-1.5">
      <div
        className={`relative w-full rounded-2xl overflow-hidden transition-all duration-200 short:max-h-[38dvh] ${dragPlayerId && dragOverSection === "Titular" && annotatedSquad.find((p) => p.id === dragPlayerId)?.status !== "Titular" ? "ring-2 ring-[#4ade80]/40 shadow-lg shadow-[#4ade80]/10" : ""}`}
        style={{
          aspectRatio: "9/12",
          background: TURF_BACKGROUND,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragPlayerId) t.setDragOverSection("Titular");
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget))
            t.setDragOverSection(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragPlayerId) t.handleDropToSection(dragPlayerId, "Titular");
          t.setDragOverSection(null);
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

        <div className={`absolute inset-0 pointer-events-none ${TURF_OVERLAY_CLASS}`} />

        {/* Jogadores no campo */}
        {rows.map((rowPlayers, ri) =>
          rowPlayers.length > 0 ? (
            <div
              key={ri}
              className="absolute w-full flex justify-evenly items-start px-3"
              style={{ top: rowYs[ri] }}
            >
              {rowPlayers.map((player) => {
                const pos = POS_COLORS[player.position] || { hex: "#6b7280" };
                const isDraggingThis = dragPlayerId === player.id;
                const isOverThis =
                  dragOverPlayerId === player.id && dragPlayerId !== player.id;
                return (
                  <div
                    key={player.id}
                    className={`flex flex-col items-center transition-all duration-150 ${isDraggingThis ? "opacity-20 scale-90" : ""} ${isOverThis ? "scale-110" : ""}`}
                    style={{ maxWidth: "58px" }}
                    {...rowDragProps(t, player, true)}
                    draggable
                    data-player-id={player.id}
                    data-player-status="Titular"
                  >
                    <div
                      className={`relative cursor-grab active:cursor-grabbing ${player.isUnavailable ? "opacity-50" : ""}`}
                    >
                      <PlayerAvatar player={player} size="w-10 h-10" />
                      {player.isUnavailable && (
                        <span className="absolute -top-1 -right-1 text-[9px] bg-black/60 rounded-full px-0.5 leading-none">
                          {
                            unavailableMark(
                              player,
                              calendarIndex,
                              matchweekCount,
                            ).emoji
                          }
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
        )}

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

        {titulares.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/30 text-xs font-bold text-center px-8 leading-relaxed">
              Arrasta jogadores para o campo ou escolhe uma formação
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Página de Táticas — totalmente auto-contida via useTactics().
 * Sub-componentes locais (MoraleCard, FormationCard, MentalityChips/Pills,
 * Pitch, StatusPicker) consomem o contexto diretamente; o TacticsView mantém
 * só a derivação de estado e a composição do layout.
 * @returns {JSX.Element}
 */
export function TacticsView() {
  const t = useTactics();
  const {
    annotatedSquad,
    isLineupComplete,
    nextMatchOpponent,
    dragPlayerId,
    dragOverSection,
    handleReady,
    handleHalftimeReady,
    matchweekCount,
    nextMatchSummary,
    players,
    me,
    showHalftimePanel,
    isPlayingMatch,
    isCupMatch,
  } = t;
  const {
    lockedCoaches,
    liveMinute,
    calendarIndex,
    isCupExtraTime,
    seasonEndModal,
    cupPenaltyPopup,
    postMatchMood,
    boardWarning,
    dismissalModal,
    jobOfferModal,
    matchResults,
    navigateTab,
  } = useGame();

  const myReady = players.find((p) => p.name === me?.name)?.ready;
  const isHalftime = showHalftimePanel && !isPlayingMatch;
  const isFriendlyNext = !!nextMatchSummary?.isFriendly;
  const isPreExtraTime = isHalftime && isCupMatch && !isFriendlyNext && (liveMinute ?? 0) >= 90 && !isCupExtraTime;
  const isEliminatedCupSpectator =
    nextMatchSummary?.isCup && !nextMatchOpponent;
  // Sem jogo neste gate (eliminado, ou fora do prolongamento por já ter ganho):
  // não tem Pronto que dar — estado de espera, nunca uma ação que não faz nada.
  // Sem resultados conhecidos assume-se que joga (fail-open para o consentimento).
  const myTeamId = me?.teamId;
  const myFixture = matchResults?.results?.find(
    (fx) => fx.homeTeamId === myTeamId || fx.awayTeamId === myTeamId,
  );
  const myGateFixture =
    isPreExtraTime &&
    myFixture &&
    myFixture.finalHomeGoals !== myFixture.finalAwayGoals
      ? null
      : myFixture;
  const awaitingOthers = isHalftime && !!matchResults?.results && !myGateFixture;
  const settled = myReady || awaitingOthers;
  const canPlay = isEliminatedCupSpectator || isHalftime || isLineupComplete;
  const missingWarning =
    !isHalftime && !myReady && !canPlay ? (
      <div className="rounded-2xl border border-red-400/25 bg-red-400/5 px-3 py-2.5 short:py-1.5 flex items-start gap-2">
        <span aria-hidden className="material-symbols-outlined text-[18px] leading-none text-red-400/80">
          error
        </span>
        <p className="text-[10px] font-bold leading-snug text-red-400/80">
          {`Faltam: 11 titulares (1 GR + 10) + ${MAX_BENCH_SIZE} suplentes (1 GR)`}
        </p>
      </div>
    ) : null;
  const showBackToBriefing =
    !isHalftime &&
    !isEliminatedCupSpectator &&
    !isPlayingMatch;
  const playLabel = settled
    ? "⏳ A aguardar..."
    : isPreExtraTime
      ? "Ir para prolongamento"
      : isHalftime && isCupMatch && !isFriendlyNext
        ? "2ª Parte — Taça"
        : isHalftime
          ? "2ª Parte"
          : isEliminatedCupSpectator
            ? "Avançar para Taça"
            : "Jogar Jornada";
  const heartbeat = !isLineupComplete && !myReady;

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
    <div className="space-y-3 short:space-y-1.5 pb-20 short:pb-4 xl:pb-0">
      {showBackToBriefing && (
        <TransferHeader
          icon="strategy"
          kicker={
            nextMatchSummary?.isCup
              ? (nextMatchSummary?.cupRoundName ?? "Taça")
              : `Jornada ${nextMatchSummary?.matchweek ?? "—"}`
          }
          title="Tática"
          valueLabel="Titulares"
          valueClass={titCount === 11 ? "text-emerald-400" : "text-amber-400"}
          budget={titCount}
          format={(n) => `${Math.round(n)}/11`}
          chips={[
            { label: "suplentes", value: `${subCount}/${MAX_BENCH_SIZE}`, tone: "neutral" },
            { label: "fora", value: notCalledCount, tone: notCalledCount ? "warn" : "neutral" },
          ]}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigateTab("briefing")}
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">arrow_back</span> Voltar ao Briefing
            </button>
            <PrepStepper current="tactics" />
          </div>
        </TransferHeader>
      )}

      {isEliminatedCupSpectator ? (
          <div className="bg-surface-container border border-outline-variant/25 rounded-2xl flex flex-col items-center gap-4 py-10 text-center px-6">
            <p className="text-5xl">🏆</p>
            <p className="text-gray-300 font-bold text-sm leading-relaxed">
              Já foste eliminado desta ronda da Taça.
              <br />
              Avança para observar os jogos e seguir em frente.
            </p>
            <button
              onClick={handleReady}
              disabled={!!myReady}
              className={`mt-2 px-10 py-3.5 font-black rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 ${myReady ? "bg-surface-container-low/60 text-gray-600 cursor-not-allowed" : "text-green-950 shadow-xl shadow-green-500/20 hover:brightness-110"}`}
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
          <div className="flex flex-col gap-3 short:gap-1.5">
            {/* COL 1 — só mobile; em desktop os controlos vivem na faixa de topo em linha */}
            <div className="xl:hidden flex flex-col gap-2 short:gap-1.5">
              {/* Próximo jogo — mobile: moral + mentality side by side */}
              <div className="flex gap-2 xl:hidden">
                {nextMatchSummary && (
                  <div className="flex-1 min-w-0 flex flex-col bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
                    <MoraleCard />
                  </div>
                )}
                <div className="flex-1 bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden flex flex-col">
                  <div className="shrink-0 px-3 py-2 border-b border-outline-variant/15">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
                      Mentalidade
                    </span>
                  </div>
                  <MentalityChips />
                </div>
              </div>

              {/* Formação mobile — chips horizontais */}
              <FormationCard className="xl:hidden" dataTour heartbeat={heartbeat} />
              {missingWarning}
              <PressureCard />
              <OrdersCard tactic={t.tactic} onUpdateTactic={t.updateTactic} />
            </div>

            {/* TOPO desktop — controlos em linha, 1 cartão por coluna */}
            <div className="hidden xl:flex gap-3 short:gap-1.5">
              {/* TOPO 1 — Formação (sobre Titulares) */}
              <div className="flex-1 min-w-0 flex flex-col gap-2 short:gap-1.5">
                <FormationCard className="flex-1" desktop dataTour heartbeat={heartbeat} />
                {missingWarning}
              </div>

              {/* TOPO 2 — Moral + Mentalidade (sobre Suplentes) */}
              <div className="flex-1 min-w-0 flex flex-col bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
                {nextMatchSummary && <MoraleCard glow />}
                <div className="px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
                  <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
                    Mentalidade
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2 px-3 short:px-2 py-3 short:py-1.5">
                  <MentalityPills />
                  <PressureCard bare />
                </div>
              </div>

              {/* TOPO 3 — Jogar (sobre Pitch) */}
              <div className="xl:w-72.5 shrink-0 flex flex-col gap-2 short:gap-1.5">
                {/* O JOGAR vive no cabeçalho ("Continuar" → "Jogar!");
                    aqui só o estado da táctica. No intervalo mantém-se o botão. */}
                {isHalftime ? (
                  <button
                    onClick={handleHalftimeReady}
                    disabled={settled}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-4 short:py-2.5 font-black rounded-2xl text-sm short:text-xs uppercase tracking-widest transition-all active:scale-95 ${settled ? "bg-surface-container-low/60 text-gray-600 cursor-not-allowed" : "text-green-950 shadow-xl shadow-green-500/20 hover:brightness-110 animate-heartbeat"}`}
                    style={settled ? {} : { background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)" }}
                  >
                    {playLabel}
                  </button>
                ) : null}
                {!isHalftime && <LineStrength />}
                <OrdersCard tactic={t.tactic} onUpdateTactic={t.updateTactic} />
              </div>
            </div>

            {/* LINHA DE BAIXO — Titulares | Suplentes | Pitch */}
            <div className="flex-1 flex flex-col md:flex-row gap-2 short:gap-1.5 xl:gap-3 min-w-0 xl:items-start">
              {/* Titulares */}
              <div
                data-tour="tactic-titulares"
                className={`flex-1 min-w-0 bg-surface-container border rounded-2xl overflow-hidden transition-colors ${dragOverSection === "Titular" ? "border-[#4ade80]/30 bg-[#4ade80]/2" : "border-outline-variant/25"}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragPlayerId) t.setDragOverSection("Titular");
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    t.setDragOverSection(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragPlayerId)
                    t.handleDropToSection(dragPlayerId, "Titular");
                  t.setDragOverSection(null);
                }}
              >
                <div className="flex items-center justify-between px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
                  <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
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
                <div className="px-2 short:px-1.5 py-1 short:py-0.5 space-y-0.5">
                  {annotatedSquad
                    .filter((p) => p.status === "Titular")
                    .map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        matchweekCount={matchweekCount}
                        calendarIndex={calendarIndex}
                        onClick
                        {...rowDragProps(t, player)}
                      >
                        {!player.isJunior && (
                          <StatusPicker player={player} />
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

              {/* Suplentes + Não convocados (coluna direita) */}
              <div className="flex-1 min-w-0 flex flex-col gap-2 short:gap-1.5">
                {/* Suplentes */}
                <div
                  className={`bg-surface-container border rounded-2xl overflow-hidden transition-colors ${dragOverSection === "Suplente" ? "border-yellow-500/30 bg-yellow-500/2" : "border-outline-variant/25"}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragPlayerId) t.setDragOverSection("Suplente");
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget))
                      t.setDragOverSection(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragPlayerId)
                      t.handleDropToSection(dragPlayerId, "Suplente");
                    t.setDragOverSection(null);
                  }}
                >
                  <div className="flex items-center justify-between px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
                      Suplentes
                    </span>
                    <span className="text-[10px] font-black">
                      <span className="text-yellow-400">{subCount}</span>
                      <span className="text-gray-700">/{MAX_BENCH_SIZE}</span>
                    </span>
                  </div>
                  <div className="px-2 short:px-1.5 py-1 short:py-0.5 space-y-0.5">
                    {annotatedSquad
                      .filter((p) => p.status === "Suplente" && !p.isUnavailable)
                      .map((player) => (
                        <PlayerRow
                          key={player.id}
                          player={player}
                          matchweekCount={matchweekCount}
                          calendarIndex={calendarIndex}
                          onClick
                          {...rowDragProps(t, player)}
                        >
                          {!player.isJunior && (
                            <StatusPicker player={player} />
                          )}
                        </PlayerRow>
                      ))}
                    {subCount === 0 && (
                      <p className="py-4 text-center text-[11px] text-gray-700 font-bold">
                        Nenhum suplente
                      </p>
                    )}
                  </div>

                  {/* Não convocados */}
                  {notCalledCount > 0 && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragPlayerId) t.setDragOverSection("Excluído");
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget))
                          t.setDragOverSection(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragPlayerId)
                          t.handleDropToSection(dragPlayerId, "Excluído");
                        t.setDragOverSection(null);
                      }}
                      className={`border-t transition-colors ${dragOverSection === "Excluído" ? "border-gray-500/30" : "border-outline-variant/15"}`}
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
                              calendarIndex={calendarIndex}
                              {...rowDragProps(t, player)}
                            >
                              <StatusPicker player={player} above />
                            </PlayerRow>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* fim coluna direita */}

              {/* COL 3 — CAMPO (desktop only — mobile usa FAB) */}
              <Pitch />
            </div>
          </div>
        )}

      {/* Modal de espera multiplayer — aparece após confirmar táctica */}
      {/* Espectador eliminado da Taça: só precisa de ficar ready para avançar;
          cancelar bloquearia o lobby (todos os humanos têm de estar ready). */}
      <WaitingCoachesModal
        players={players}
        visible={
          myReady &&
          !isPlayingMatch &&
          !showHalftimePanel &&
          lockedCoaches.length >= 2 &&
          // Disciplina pós-jogo: a espera só revela com a fila drenada.
          !isPostMatchQueueActive({
            seasonEndModal,
            cupPenaltyPopup,
            postMatchMood,
            boardWarning,
            dismissalModal,
            jobOfferModal,
          })
        }
        // Unilateral (não o toggle handleReady): duplo clique no Cancelar
        // emitia false e logo true, religando e reabrindo o modal em loop.
        onCancel={() => queueEmit("setReady", false)}
        canCancel={!isEliminatedCupSpectator}
      />
    </div>
  );
}
