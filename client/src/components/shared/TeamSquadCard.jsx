import { AggBadge } from "./AggBadge.jsx";
import { PlayerAvatar } from "./PlayerAvatar.jsx";
import { PlayerLink } from "./PlayerLink.jsx";
import {
  FLAG_TO_COUNTRY,
  POSITION_TEXT_CLASS,
  POSITION_BORDER_CLASS,
  POSITION_LABEL_MAP,
} from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";
import { getPlayerStat } from "../../utils/playerHelpers.js";

const POSITION_GLOW = {
  GR: "hover:border-amber-400/70 hover:shadow-amber-400/30",
  DEF: "hover:border-blue-400/70 hover:shadow-blue-400/30",
  MED: "hover:border-emerald-400/70 hover:shadow-emerald-400/30",
  ATA: "hover:border-rose-400/70 hover:shadow-rose-400/30",
};

const POSITION_BAR = {
  GR: "from-amber-300 via-amber-400 to-amber-600",
  DEF: "from-blue-300 via-blue-400 to-blue-600",
  MED: "from-emerald-300 via-emerald-400 to-emerald-600",
  ATA: "from-rose-300 via-rose-400 to-rose-600",
};

const POSITION_BG_GRADIENT = {
  GR: "from-amber-500/8",
  DEF: "from-blue-500/8",
  MED: "from-emerald-500/8",
  ATA: "from-rose-500/8",
};

/**
 * @param {{
 *   player: object,
 *   matchweekCount: number,
 *   showProposalCol: boolean,
 *   myBudget: number,
 *   onProposal: (data: { player: object, suggestedPrice: number }) => void,
 * }} props
 */
export function TeamSquadCard({
  player,
  matchweekCount,
  showProposalCol = false,
  myBudget = 0,
  onProposal,
}) {
  const star =
    !!player.is_star &&
    (player.position === "MED" || player.position === "ATA");

  const form = player.form || 100;
  const formArrow = form >= 115 ? "💪" : form <= 85 ? "😩" : "👍";
  const formColor =
    form >= 115
      ? "text-emerald-400"
      : form <= 85
        ? "text-rose-400"
        : "text-zinc-400";

  const susp = player.suspension_until_matchweek || 0;
  const inj = player.injury_until_matchweek || 0;
  const cooldown = player.transfer_cooldown_until_matchweek || 0;
  const isSuspended = susp > matchweekCount;
  const isInjured = inj > matchweekCount;
  const isCooldown =
    !isSuspended && !isInjured && cooldown > 0 && cooldown > matchweekCount;

  const skillDelta =
    player.prev_skill != null && player.prev_skill !== player.skill
      ? player.skill - player.prev_skill
      : 0;

  const bar = POSITION_BAR[player.position] || "from-zinc-500 to-zinc-600";
  const glow = POSITION_GLOW[player.position] || "";
  const bgGrad =
    POSITION_BG_GRADIENT[player.position] || "from-zinc-500/4";
  const posText = POSITION_TEXT_CLASS[player.position] || "text-zinc-300";
  const posBorder =
    POSITION_BORDER_CLASS[player.position] || "border-zinc-500";

  return (
    <div
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${glow} shadow-sm shadow-black/30`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${bar}`} />

      <div className="relative shrink-0 self-center pl-2 py-1.5">
        <PlayerAvatar
          seed={player.id}
          position={player.position}
          nationality={player.nationality}
          size="md"
        />
        <span
          className={`absolute bottom-0.5 -right-1 px-1 py-px bg-surface-container border-l-2 ${posBorder} ${posText} text-[8px] font-black rounded-sm shadow-md shadow-black/50 tracking-wider`}
        >
          {POSITION_LABEL_MAP[player.position] || player.position}
        </span>
      </div>

      <div className="flex-1 min-w-0 self-center px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-base shrink-0 leading-none"
            title={
              FLAG_TO_COUNTRY[player.nationality] ||
              player.nationality ||
              "—"
            }
          >
            {player.nationality || "—"}
          </span>
          <p className="font-black font-headline text-sm leading-tight uppercase tracking-tight text-on-surface truncate">
            <PlayerLink playerId={player.id}>{player.name}</PlayerLink>
            {star && (
              <span
                className="ml-1 text-amber-400 font-black"
                title="Craque"
              >
                ★
              </span>
            )}
          </p>
          {player.isJunior && (
            <span className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 tracking-widest">
              🎓 Jr
            </span>
          )}
          {isCooldown && (
            <span
              className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 tracking-widest"
              title="Em viagem — disponível na próxima jornada"
            >
              ✈️ 1J
            </span>
          )}
          {isSuspended && (
            <span
              className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-error-container/60 text-error border border-error/30 tracking-widest whitespace-nowrap"
              title={`Suspenso até jornada ${susp + 1}`}
            >
              🟥 {susp - matchweekCount + 1}J
            </span>
          )}
          {isInjured && (
            <span
              className="text-[9px] font-black uppercase px-1.5 py-px rounded bg-amber-900/30 text-amber-400 border border-amber-700/30 tracking-widest whitespace-nowrap"
              title={`Lesionado até jornada ${inj + 1}`}
            >
              🩹 {inj - matchweekCount + 1}J
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 self-center flex items-center justify-center px-2 min-w-14">
        <div className="flex items-baseline gap-0.5">
          {skillDelta !== 0 && (
            <span
              className={`text-[10px] font-black ${skillDelta > 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {skillDelta > 0 ? "▲" : "▼"}
            </span>
          )}
          <div
            className={`text-2xl font-black font-headline tabular-nums leading-none ${posText}`}
            style={{ textShadow: "0 0 10px currentColor" }}
          >
            {player.skill}
          </div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 shrink-0 self-center px-2 border-l border-outline-variant/15 ml-1">
        <div className="flex flex-col items-center justify-center w-10">
          <div className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
            Agr
          </div>
          <AggBadge value={player.aggressiveness} />
        </div>
        <div className="flex flex-col items-center justify-center w-10">
          <div className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
            Res
          </div>
          {player.resistance != null ? (
            <span className="text-cyan-400 font-black text-[12px]">
              {player.resistance}
            </span>
          ) : (
            <span className="text-zinc-600 text-xs">—</span>
          )}
        </div>
        <div className="flex flex-col items-center justify-center w-10">
          <div className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
            For
          </div>
          <span className={`font-black text-[12px] ${formColor}`}>{formArrow}</span>
        </div>
      </div>

      <div className="hidden xl:flex items-center gap-3 shrink-0 self-center px-2 border-l border-outline-variant/15 ml-1 text-[10px] tabular-nums">
        <span title="Jogos: época / carreira" className="flex flex-col items-center min-w-12">
          <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
            Jog
          </span>
          <span className="text-zinc-300 font-black">
            {getPlayerStat(player, ["games_played"])}
            <span className="text-zinc-600 font-normal">
              /{getPlayerStat(player, ["career_games"])}
            </span>
          </span>
        </span>
        <span title="Golos: época / carreira" className="flex flex-col items-center min-w-12">
          <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
            Gol
          </span>
          <span className="text-emerald-400 font-black">
            ⚽{getPlayerStat(player, ["goals"])}
            <span className="text-zinc-600 font-normal">
              /{getPlayerStat(player, ["career_goals"])}
            </span>
          </span>
        </span>
        <span title="Cartões vermelhos: época / carreira" className="flex flex-col items-center min-w-10">
          <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
            Vrm
          </span>
          <span className="text-red-400 font-black">
            🟥{getPlayerStat(player, ["red_cards"])}
            <span className="text-zinc-600 font-normal">
              /{getPlayerStat(player, ["career_reds"])}
            </span>
          </span>
        </span>
        <span title="Lesões: época / carreira" className="flex flex-col items-center min-w-10">
          <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
            Les
          </span>
          <span className="text-orange-400 font-black">
            🩹{getPlayerStat(player, ["injuries"])}
            <span className="text-zinc-600 font-normal">
              /{getPlayerStat(player, ["career_injuries"])}
            </span>
          </span>
        </span>
      </div>

      <div className="hidden md:flex shrink-0 self-stretch items-center px-3 border-l">
        <div className="relative flex flex-col items-end justify-center gap-0.5 min-w-22">
          <div className="flex items-baseline gap-1">
            <span className="font-headline font-black text-sm tabular-nums text-on-surface">
              {formatCurrency(player.wage || 0)}
            </span>
            <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">
              /sem
            </span>
          </div>
          <span className="font-headline font-black text-[12px] tabular-nums text-emerald-400/90">
            ≈ {formatCurrency(player.value || 0)}
          </span>
        </div>
      </div>

      {showProposalCol && (
        <div className="shrink-0 self-stretch flex items-center px-3 border-l">
          {!player.isJunior &&
          Math.round((player.value || 0) * 1.35) <= myBudget ? (
            <button
              onClick={() =>
                onProposal?.({
                  player,
                  suggestedPrice: Math.round(
                    (player.value || 0) * 1.35,
                  ),
                })
              }
              className="px-3 py-1.5 rounded text-xs font-black uppercase bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500 transition-colors whitespace-nowrap"
            >
              Proposta
            </button>
          ) : (
            <span className="text-[10px] text-zinc-600 font-bold uppercase whitespace-nowrap">
              Sem saldo
            </span>
          )}
        </div>
      )}
    </div>
  );
}
