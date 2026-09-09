import { memo } from "react";
import { TeamCrest } from "../TeamCrest.jsx";

/**
 * Slot de equipa no hero VS (emblema + nome clicável + posição).
 * @param {{ slot: { id: number|null, team: Object|null, name: string, isMine: boolean }, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
const VersusSlot = memo(function VersusSlot({ slot, onOpenTeamSquad }) {
  const position = slot.team?.position ? `${slot.team.position}º` : "—";
  return (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
      <TeamCrest team={slot.team} size="md" isMine={slot.isMine} />
      <button
        type="button"
        onClick={() => slot.team && onOpenTeamSquad?.(slot.team)}
        className="text-xs font-black text-white truncate max-w-full hover:text-emerald-400 hover:underline transition-colors"
        title={`Ver plantel de ${slot.name}`}
        aria-label={`Ver plantel de ${slot.name}`}
      >
        {slot.name}
      </button>
      <span className="text-[9px] text-gray-600 font-bold">{position}</span>
    </div>
  );
});

/**
 * VersusHero — frente a frente das duas equipas pela ordem do local do
 * jogo (casa à esquerda). Recebe os slots já ordenados do view-model.
 * @param {{ slots: Array<{ id: number|null, team: Object|null, name: string, isMine: boolean }>, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
export const VersusHero = memo(function VersusHero({ slots, onOpenTeamSquad }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {slots.map((slot, i) => (
        <div key={slot.id ?? `slot-${i}`} className="contents">
          {i === 1 && (
            <span
              aria-hidden
              className="shrink-0 text-[10px] font-black text-gray-600 px-2 py-1 rounded-full border border-outline-variant/25 bg-surface-container-low"
            >
              VS
            </span>
          )}
          <VersusSlot slot={slot} onOpenTeamSquad={onOpenTeamSquad} />
        </div>
      ))}
    </div>
  );
});
