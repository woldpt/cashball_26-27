import { memo } from "react";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { InviteControls } from "./InviteControls.jsx";

// Objetos estáticos: devolvem referência sem alocar por linha.
const STATUS = {
  offline: {
    label: "Offline",
    color: "text-on-surface-variant/40",
    dotColor: "bg-surface-bright",
  },
  ready: {
    label: "Vamos! ⚡",
    color: "text-emerald-400",
    dotColor: "bg-emerald-400",
  },
  thinking: {
    label: "Queimando neurónios 🧠",
    color: "text-amber-400",
    dotColor: "bg-amber-400",
  },
};

/**
 * Linha de um coach na lista da sala (avatar, estado, convite, kick).
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
    <div className="flex items-center gap-2 px-3 py-2">
      {/* Avatar mini do coach + dot de estado sobreposto */}
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
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-container-low ${status.dotColor}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[10px] font-black truncate ${
            coach.online ? "text-on-surface" : "text-on-surface-variant"
          }`}
        >
          {coach.name}
          {isMe && (
            <span className="ml-1 text-[8px] font-bold text-on-surface-variant">
              (tu)
            </span>
          )}
          {isAdmin && (
            <span className="ml-1 text-[7px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded shrink-0">
              Admin
            </span>
          )}
        </p>
        {coachTeam && (
          <p
            className="text-[9px] truncate"
            style={{ color: coachTeam.color_primary || "#71717a" }}
          >
            {coachTeam.name}
          </p>
        )}
        {/* Estado de readiness: offline / táticas submetidas / a pensar */}
        <p className={`text-[8px] font-bold leading-tight ${status.color}`}>
          {status.label}
        </p>
        {/* Convite: membro desta sala a jogar noutra sala */}
        {canInvite && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <InviteControls
              coachName={coach.name}
              invite={invite}
              onInvite={onInvite}
            />
          </div>
        )}
      </div>
      {canKick && (
        <button
          onClick={() => onKick(coach.name)}
          className="shrink-0 text-[8px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 bg-rose-400/10 hover:bg-rose-400/20 px-1 py-0.5 rounded transition-colors"
          title={`Expulsar ${coach.name}`}
        >
          Kick
        </button>
      )}
    </div>
  );
});
