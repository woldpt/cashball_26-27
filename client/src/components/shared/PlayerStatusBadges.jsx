/**
 * PlayerStatusBadges — conjunto de badges de estado de um jogador.
 *
 * Deriva automaticamente os estados (júnior, renovado, à venda, cooldown
 * de transferência, suspensão, lesão) a partir do objeto do jogador.
 * Substitui as implementações inline duplicadas em SquadRow/TeamSquadCard
 * e noutros pontos da app (STYLE.md §5).
 */
import { Badge } from "./Badge.jsx";

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
  const susp = player.suspension_until_matchweek || 0;
  const inj = player.injury_until_matchweek || 0;
  const cooldown = player.transfer_cooldown_until_matchweek || 0;
  const isSuspended = susp > matchweekCount;
  const isInjured = inj > matchweekCount;
  const isCooldown =
    !isSuspended && !isInjured && cooldown > 0 && cooldown > matchweekCount;

  const contractStart = player.contract_start_epoch || 0;
  const currentEpoch = (Math.max(1, season) - 1) * 14 + Math.min(14, matchweekCount + 1);
  const isLocked = contractStart > 0 && currentEpoch < contractStart + 14;
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
        <Badge variant="cooldown" title="Em viagem — disponível na próxima jornada">
          ✈️ 1J
        </Badge>
      )}
      {isSuspended && (
        <Badge variant="suspended" title={`Suspenso até jornada ${susp + 1}`}>
          🟥 {susp - matchweekCount + 1}J
        </Badge>
      )}
      {isInjured && (
        <Badge variant="injured" title={`Lesionado até jornada ${inj + 1}`}>
          🩹 {inj - matchweekCount + 1}J
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
