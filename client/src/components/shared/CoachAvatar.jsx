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
  photo,
}) {
  // Cadeia de prioridade: 1) foto enviada pelo utilizador, 2) foto real do
  // zerozero (coach_photo), 3) avatar procedural. Cada fonte tem a sua própria
  // flag de erro para permitir fallback em cascata sem saltar para o avatar
  // procedural quando a primeira imagem falha.
  const [uploadFailed, setUploadFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const version = name ? coachAvatars?.[name] : null;

  if (version != null && !uploadFailed) {
    const sizeClass = AVATAR_SIZE_MAP[size] ?? size;
    return (
      <img
        src={`${backendUrl}/auth/avatar?name=${encodeURIComponent(
          name,
        )}&v=${version}`}
        alt={name}
        onError={() => setUploadFailed(true)}
        className={`${sizeClass} rounded-full shadow-lg object-cover shrink-0 ${className}`.trim()}
      />
    );
  }

  if (photo && !photoFailed) {
    const sizeClass = AVATAR_SIZE_MAP[size] ?? size;
    return (
      <img
        src={photo}
        alt={name}
        loading="lazy"
        onError={() => setPhotoFailed(true)}
        className={`${sizeClass} rounded-full object-cover object-top shrink-0 bg-white border border-slate-200 shadow-lg ${className}`.trim()}
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
    prev.backendUrl === next.backendUrl &&
    prev.photo === next.photo,
);
