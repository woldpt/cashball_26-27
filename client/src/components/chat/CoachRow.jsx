import { memo } from "react";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { InviteControls } from "./InviteControls.jsx";

// Objetos estáticos: devolvem referência sem alocar por linha.
const STATUS = {
  offline: {
    label: "Offline",
    chip: "bg-surface-bright/40 text-on-surface-variant border-outline-variant/20",
    dot: "bg-surface-bright",
  },
  ready: {
    label: "Pronto ⚡",
    chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  thinking: {
    label: "A pensar 🧠",
    chip: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
  },
};
const CHIP =
  "shrink-0 rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-widest";

/**
 * Linha de um coach na lista da sala (faixa da cor do clube, avatar, estado, convite, kick).
 * Memoizada: só re-renderiza quando as props desta linha mudam.
 * @param {Object} props
 * @param {{name: string, online?: boolean, submitted?: boolean}} props.coach
 * @param {{name: string, color_primary?: string}|null} props.coachTeam
 * @param {string} props.seed - Seed do avatar.
 * @param {Object} props.coachAvatars
 * @param {string} props.backendUrl
 * @param {boolean} props.isMe
 * @param {boolean} props.isAdmin
 * @param {boolean} props.canKick
 * @param {boolean} props.canInvite
 * @param {{status: string, msg?: string}} [props.invite]
 * @param {function(string): void} props.onInvite
 * @param {function(string): void} props.onKick
 * @returns {JSX.Element}
 */
export const CoachRow = memo(function CoachRow({
  coach,
  coachTeam,
  seed,
  coachAvatars,
  backendUrl,
  isMe,
  isAdmin,
  canKick,
  canInvite,
  invite,
  onInvite,
  onKick,
}) {
  const status = !coach.online
    ? STATUS.offline
    : coach.submitted
      ? STATUS.ready
      : STATUS.thinking;
  return (
    <div
      className={`group relative flex items-center gap-2 py-2 pl-3.5 pr-2 ${
        coach.online ? "" : "opacity-70"
      }`}
    >
      {/* Faixa lateral na cor do clube */}
      <span
        className="absolute inset-y-1 left-0 w-1 rounded-r bg-outline-variant/30"
        style={
          coachTeam?.color_primary
            ? { backgroundColor: coachTeam.color_primary }
            : undefined
        }
      />
      <div className="relative shrink-0">
        <CoachAvatar
          name={coach.name}
          seed={seed}
          teamColor={coachTeam?.color_primary}
          size="w-8 h-8"
          coachAvatars={coachAvatars}
          backendUrl={backendUrl}
        />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-container-low ${status.dot}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1 text-xs font-black text-on-surface">
          <span className="truncate">{coach.name}</span>
          {isMe && (
            <span className="shrink-0 text-[10px] font-bold text-on-surface-variant">
              (tu)
            </span>
          )}
          {isAdmin && (
            <span
              title="Admin da sala"
              className="shrink-0 text-[10px] leading-none text-amber-400"
            >
              ★
            </span>
          )}
        </p>
        <p
          className="text-[10px] truncate text-on-surface-variant"
          style={
            coachTeam?.color_primary ? { color: coachTeam.color_primary } : undefined
          }
        >
          {coachTeam ? coachTeam.name : "Sem equipa"}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {canInvite ? (
            <>
              <span
                className={`${CHIP} border-amber-500/30 bg-amber-500/10 text-amber-400`}
              >
                Noutra sala
              </span>
              <InviteControls
                coachName={coach.name}
                invite={invite}
                onInvite={onInvite}
                hoverReveal
              />
            </>
          ) : (
            <span className={`${CHIP} ${status.chip}`}>{status.label}</span>
          )}
        </div>
      </div>
      {canKick && (
        <button
          onClick={() => onKick(coach.name)}
          aria-label={`Expulsar ${coach.name}`}
          title={`Expulsar ${coach.name}`}
          className="shrink-0 grid place-items-center size-6 rounded-md text-rose-400 bg-rose-400/10 hover:bg-rose-400/25 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <span className="material-symbols-outlined text-[16px] leading-none">
            person_remove
          </span>
        </button>
      )}
    </div>
  );
});
