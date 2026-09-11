/**
 * PlayerStatusBadges — conjunto de badges de estado de um jogador.
 *
 * Deriva automaticamente os estados (júnior, renovado, à venda, cooldown
 * de transferência, suspensão, lesão) a partir do objeto do jogador.
 * Substitui as implementações inline duplicadas em SquadRow/TeamSquadCard
 * e noutros pontos da app (STYLE.md §5).
 */
import { useContext } from "react";
import { Badge } from "./Badge.jsx";
import { GameContext } from "../../contexts/GameContext.jsx";
import { slotLabel } from "../../utils/slotLabel.js";

/**
 * @param {{
 *   player: object,
 *   matchweekCount: number,
 *   showContractBadges?: boolean,
 *   season?: number,
 * }} props
 */
export function PlayerStatusBadges({
  player,
  matchweekCount = 0,
  showContractBadges = false,
  season = 1,
}) {
  // Relógio único: slot 0-based do contexto; fora do provider (harnesses)
  // cai no matchweekCount como antes.
  const ctxIdx = useContext(GameContext)?.calendarIndex;
  const nowIdx = ctxIdx ?? matchweekCount;
  const susp = player.suspension_until_matchweek || 0;
  const inj = player.injury_until_matchweek || 0;
  const cooldown = player.transfer_cooldown_until_matchweek || 0;
  const isSuspended = susp > nowIdx;
  const isInjured = inj > nowIdx;
  const isCooldown =
    !isSuspended && !isInjured && cooldown > 0 && cooldown > nowIdx;

  const contractStart = player.contract_start_epoch || 0;
  const currentEpoch = (Math.max(1, season) - 1) * 20 + Math.min(20, nowIdx + 1);
  const isLocked = contractStart > 0 && currentEpoch < contractStart + 20;
  const isUnderContract = contractStart > 0;
  const isListed =
    player.transfer_status && player.transfer_status !== "none";
  const isPendingRenewal = !!player.contract_request_pending;

  return (
    <>
      {player.isJunior && <Badge variant="junior">🎓 Jr</Badge>}
      {showContractBadges && isPendingRenewal && (
        <Badge variant="cooldown" title="O agente quer falar contigo">
          📝 Renovação
        </Badge>
      )}
      {showContractBadges && isLocked && (
        <Badge variant="cooldown" title="Contrato em vigor — não transferível">
          🔒 Contrato
        </Badge>
      )}
      {showContractBadges && isListed && !isUnderContract && (
        <Badge variant="sold">À venda</Badge>
      )}
      {isCooldown && (
        <Badge variant="cooldown" title="Em viagem — disponível na próxima semana">
          ✈️ 1J
        </Badge>
      )}
      {isSuspended && (
        <Badge variant="suspended" title={`Suspenso até ${slotLabel(susp + 1)}`}>
          🟥 {susp - nowIdx + 1}J
        </Badge>
      )}
      {isInjured && (
        <Badge variant="injured" title={`Lesionado até ${slotLabel(inj + 1)}`}>
          🩹 {inj - nowIdx + 1}J
        </Badge>
      )}
    </>
  );
}

/**
 * Estrela de "Craque" — renderizada junto ao nome do jogador.
 * @param {{ className?: string }} props
 */
export function StarMark({ className = "" }) {
  return (
    <span className={`ml-1 text-amber-400 font-black ${className}`} title="Craque">
      ★
    </span>
  );
}
