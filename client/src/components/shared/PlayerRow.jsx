/**
 * PlayerRow — linha/card de jogador unificada (STYLE.md §4).
 *
 * Resultado da fusão de `SquadRow` (PlayersTab) e `TeamSquadCard`
 * (TeamSquadView/TeamSquadModal). Propriedades opcionais ativam o
 * comportamento de cada contexto:
 *  - `onOpenPlayerHistory`: torna a linha clicável (histórico do jogador);
 *  - `showContractBadges`: mostra "Renovado" / "À venda" (só na própria equipa);
 *  - `showProposalCol`: coluna de proposta para equipas NPC.
 */
import { AggBadge } from "./AggBadge.jsx";
import { PlayerAvatar } from "./PlayerAvatar.jsx";
import { PlayerLink } from "./PlayerLink.jsx";
import { PlayerStatusBadges, StarMark } from "./PlayerStatusBadges.jsx";
import {
  FLAG_TO_COUNTRY,
  POSITION_TEXT_CLASS,
  POSITION_BORDER_CLASS,
  POSITION_LABEL_MAP,
  POSITION_BAR_CLASS,
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  TRANSFER_CLAUSE_MULT,
} from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";
import { getPlayerStat } from "../../utils/playerHelpers.js";

/**
 * @param {{
 *   player: object,
 *   matchweekCount: number,
 *   season?: number,
 *   onOpenPlayerHistory?: (player: object) => void,
 *   dim?: boolean,
 *   showContractBadges?: boolean,
 *   showProposalCol?: boolean,
 *   myBudget?: number,
 *   onProposal?: (data: { player: object, suggestedPrice: number }) => void,
 *   actions?: import("react").ReactNode,
 *   subtitle?: string,
 * }} props
 */
export function PlayerRow({
  player,
  matchweekCount,
  season = 1,
  onOpenPlayerHistory,
  dim = false,
  showContractBadges = false,
  showProposalCol = false,
  myBudget = 0,
  onProposal,
  actions,
  subtitle,
}) {
  const star =
    !!player.is_star &&
    (player.position === "MED" || player.position === "ATA");

  const form = player.form || 32;
  const formArrow = form >= 41 ? "💪" : form <= 22 ? "😩" : "👍";
  const formColor =
    form >= 41
      ? "text-emerald-400"
      : form <= 22
        ? "text-rose-400"
        : "text-zinc-400";

  const skillDelta =
    player.prev_skill != null && player.prev_skill !== player.skill
      ? player.skill - player.prev_skill
      : 0;

  const bar = POSITION_BAR_CLASS[player.position] || "from-zinc-500 to-zinc-600";
  const glow = POSITION_GLOW_CLASS[player.position] || "";
  const bgGrad =
    POSITION_BG_GRADIENT_CLASS[player.position] || "from-zinc-500/4";
  const posText = POSITION_TEXT_CLASS[player.position] || "text-zinc-300";
  const posBorder =
    POSITION_BORDER_CLASS[player.position] || "border-zinc-500";

  const isClickable = !!onOpenPlayerHistory;

  return (
    <div
      onClick={() => isClickable && onOpenPlayerHistory(player)}
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${glow} shadow-sm shadow-black/30 ${
        dim || player.isUnavailable ? "opacity-65 saturate-50" : ""
      } ${isClickable ? "cursor-pointer" : ""}`}
    >
      {/* Faixa lateral da posição */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${bar}`} />

      {/* Coluna principal: linha superior (avatar→salário) + info extra em mobile */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center min-w-0 flex-1">
      {/* Avatar mini com chip de posição */}
      <div className="relative shrink-0 self-center pl-2 py-1.5">
        <PlayerAvatar
          seed={player.id}
          position={player.position}
          nationality={player.nationality}
          size="mdR"
        />
        <span
          className={`absolute bottom-0.5 -right-1 px-1 py-px bg-surface-container border-l-2 ${posBorder} ${posText} text-[8px] font-black rounded-sm shadow-md shadow-black/50 tracking-wider`}
        >
          {POSITION_LABEL_MAP[player.position] || player.position}
        </span>
      </div>

      {/* Nome + flag + badges (cresce para preencher) */}
      <div className="flex-1 min-w-0 self-center px-2 sm:px-3 py-2">
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
            {star && <StarMark />}
          </p>
          {subtitle && (
            <p className="text-[10px] text-on-surface-variant/70 truncate mt-0.5">
              {subtitle}
            </p>
          )}
          <PlayerStatusBadges
            player={player}
            matchweekCount={matchweekCount}
            showContractBadges={showContractBadges}
            season={season}
          />
        </div>
      </div>

      {/* Qualidade - número grande com delta */}
      <div className="shrink-0 self-center flex items-center justify-center px-1.5 sm:px-2 min-w-[48px] sm:min-w-14">
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

      {/* CTA de proposta compacto — mobile only, equipas NPC.
          Em md+ a ação vive na coluna dedicada à direita. */}
      {showProposalCol && (
        <div className="md:hidden shrink-0 self-center flex items-center px-1.5">
          {player.isJunior || player.contract_start_epoch > 0 ? (
            <span title="Contrato ativo" className="text-[13px] leading-none opacity-70">
              🔒
            </span>
          ) : Math.round((player.value || 0) * TRANSFER_CLAUSE_MULT) <= myBudget ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onProposal?.({
                  player,
                  suggestedPrice: Math.round(
                    (player.value || 0) * TRANSFER_CLAUSE_MULT,
                  ),
                });
              }}
              title="Fazer proposta"
              aria-label={`Fazer proposta a ${player.name}`}
              className="w-8 h-8 rounded-md flex items-center justify-center overflow-hidden bg-emerald-700/90 hover:bg-emerald-600 text-white border border-emerald-500 transition-colors"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{
                  fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 15',
                }}
              >
                money
              </span>
            </button>
          ) : (
            <span
              title="Sem saldo para a cláusula"
              className="text-zinc-600 flex items-center justify-center w-8 h-8 overflow-hidden"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{
                  fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 15',
                }}
              >
                block
              </span>
            </span>
          )}
        </div>
      )}

      {/* Atributos primários (Agr / Res / For) */}
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

      {/* Stats inline (Jogos / Golos / Verm / Lesões - época / carreira) */}
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

      {/* Ordenado + Valor (omitido em mobile) */}
      <div className="hidden md:flex shrink-0 self-stretch flex items-center px-3 border-l">
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

        </div>

        {/* Linha extra em mobile: atributos + golos + salário (escondidos ≥md) */}
        <div className="md:hidden flex items-center justify-between gap-2 px-2 py-1.5 border-t border-outline-variant/10">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex flex-col items-center">
              <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
                Agr
              </span>
              <AggBadge value={player.aggressiveness} />
            </span>
            <span className="flex flex-col items-center">
              <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
                Res
              </span>
              <span className="text-cyan-400 font-black text-[12px] leading-none">
                {player.resistance ?? "—"}
              </span>
            </span>
            <span className="flex flex-col items-center">
              <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
                For
              </span>
              <span className={`text-[12px] font-black leading-none ${formColor}`}>
                {formArrow}
              </span>
            </span>
            <span className="flex flex-col items-center">
              <span className="text-[8px] uppercase tracking-widest text-zinc-600 font-black mb-0.5">
                Golos
              </span>
              <span className="text-emerald-400 font-black text-[12px] leading-none">
                {getPlayerStat(player, ["goals"])}
              </span>
            </span>
          </div>
          <span className="shrink-0 flex flex-col items-end">
            <span className="font-headline font-black text-xs tabular-nums text-on-surface">
              {formatCurrency(player.wage || 0)}
            </span>
            <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">
              /sem
            </span>
          </span>
        </div>
      </div>

      {/* Coluna de proposta (equipas NPC; em mobile o CTA vive na linha extra,
          à direita — ver bloco md:hidden abaixo) */}
      {showProposalCol && (
        <div className="hidden md:flex shrink-0 self-stretch items-center px-3 border-l">
          {player.isJunior || player.contract_start_epoch > 0 ? (
            <span className="text-[10px] text-zinc-600 font-bold uppercase whitespace-nowrap">
              🔒 Contrato
            </span>
          ) : Math.round((player.value || 0) * TRANSFER_CLAUSE_MULT) <=
            myBudget ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onProposal?.({
                  player,
                  suggestedPrice: Math.round(
                    (player.value || 0) * TRANSFER_CLAUSE_MULT,
                  ),
                });
              }}
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

      {/* Coluna de ações custom (página Scout) */}
      {actions != null && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 self-stretch flex items-center px-3 border-l"
        >
          {actions}
        </div>
      )}
    </div>
  );
}
