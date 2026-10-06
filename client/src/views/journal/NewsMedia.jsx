/**
 * Imagens editoriais do artigo seleccionado (jogador, equipas,
 * percurso de transferência).
 */
import { PlayerAvatar } from "../../components/shared/PlayerAvatar.jsx";
import { TeamCrest } from "../../components/live/TeamCrest.jsx";
import { teamFromRef } from "./utils.jsx";

/**
 * Imagens editoriais do artigo seleccionado.
 * @param {{ media?: object, teams: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function }} props
 * @returns {JSX.Element|null}
 */
export function NewsMedia({ media, teams, onOpenTeamSquad, onOpenPlayerHistory }) {
  if (!media?.player && !media?.teams?.length) return null;
  const transferFrom = media.transfer?.from;
  const transferTo = media.transfer?.to;
  const isTransfer = Boolean(media.transfer);
  const renderTransferTeam = (ref, label) => {
    if (!ref) return null;
    const team = teamFromRef(teams, ref);
    return (
      <button
        key={`${label}-${ref.id}`}
        type="button"
        aria-label={`${label}: ${ref.label}`}
        className="flex min-w-24 max-w-36 flex-col items-center gap-1.5 rounded border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-center shadow-sm shadow-black/30 hover:bg-surface-container-high transition-colors"
        onClick={() => team?.id && onOpenTeamSquad?.(team)}
        disabled={!team?.id || !onOpenTeamSquad}
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        <TeamCrest team={team} size="md" />
        <span className="w-full truncate text-xs font-black text-primary">
          {ref.label}
        </span>
      </button>
    );
  };

  return (
    <div
      className={`mt-4 flex ${
        isTransfer ? "flex-col items-start gap-2" : "flex-wrap items-center gap-3"
      }`}
    >
      {media.player && (
        <button
          type="button"
          className="flex items-center gap-3 rounded border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-left shadow-sm shadow-black/30 hover:bg-surface-container-high transition-colors"
          onClick={() => onOpenPlayerHistory?.(media.player)}
        >
          <PlayerAvatar
            seed={media.player.id}
            position={media.player.position}
            photo={media.player.photo}
            size="md"
          />
          <span className="max-w-48 truncate text-sm font-black text-primary">
            {media.player.label}
          </span>
        </button>
      )}
      {isTransfer ? (
        <div
          className="flex items-center gap-2"
          aria-label="Percurso da transferência"
        >
          {renderTransferTeam(transferFrom, "Origem")}
          {transferFrom && transferTo && (
            <span
              aria-hidden="true"
              className="text-xl font-black leading-none text-tertiary"
            >
              →
            </span>
          )}
          {renderTransferTeam(transferTo, "Destino")}
        </div>
      ) : (
        media.teams?.map((ref) => {
          const team = teamFromRef(teams, ref);
          return (
            <button
              key={ref.id}
              type="button"
              className="flex items-center gap-3 rounded border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-left shadow-sm shadow-black/30 hover:bg-surface-container-high transition-colors"
              onClick={() => team?.id && onOpenTeamSquad?.(team)}
              disabled={!team?.id || !onOpenTeamSquad}
            >
              <TeamCrest team={team} size="md" />
              <span className="max-w-48 truncate text-sm font-black text-primary">
                {ref.label}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
