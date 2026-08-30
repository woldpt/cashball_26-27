import { memo, useState } from "react";
import { PlayerAvatar } from "./PlayerAvatar.jsx";
import { AVATAR_SIZE_MAP } from "./avatarSizes.js";

/**
 * Avatar de coach para uso na sala (RoomHub, WaitingCoachesModal, TeamSquadView,
 * Definições). Se o coach tem imagem carregada (`coachAvatars[name]` traz a
 * versão/timestamp), mostra o `<img>` circular; caso contrário usa o avatar
 * procedural existente (PlayerAvatar) com o seed determinístico.
 *
 * `seed` é sempre calculado pelo chamador via `coachAvatarSeed(...)` para
 * manter a convenção partilhada do seed procedural.
 */
function CoachAvatarInner({
  name,
  seed,
  teamColor,
  size = "md",
  className = "",
  coachAvatars,
  backendUrl,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const version = name ? coachAvatars?.[name] : null;

  if (version != null && !imgFailed) {
    const sizeClass = AVATAR_SIZE_MAP[size] ?? size;
    return (
      <img
        src={`${backendUrl}/auth/avatar?name=${encodeURIComponent(
          name,
        )}&v=${version}`}
        alt={name}
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full shadow-lg object-cover shrink-0 ${className}`.trim()}
      />
    );
  }

  return (
    <PlayerAvatar
      seed={seed}
      teamColor={teamColor}
      size={size}
      className={className}
    />
  );
}

export const CoachAvatar = memo(
  CoachAvatarInner,
  (prev, next) =>
    prev.name === next.name &&
    prev.seed === next.seed &&
    prev.teamColor === next.teamColor &&
    prev.size === next.size &&
    prev.className === next.className &&
    prev.coachAvatars === next.coachAvatars &&
    prev.backendUrl === next.backendUrl,
);
