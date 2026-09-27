import { useEffect, useState } from "react";
import { subscribeRoomPause } from "../../socket.js";

/**
 * Aviso de sala congelada: um treinador com equipa em jogo está ausente e o
 * jogo parou (nada avança nem é decidido por ele). Substitui o comportamento
 * antigo, em que a lesão/substituição do ausente era resolvida sozinha e a
 * jornada seguinte chegava-lhe já jogada.
 *
 * Mostra a hora do início da pausa (não um contador a cada segundo — a hora
 * vem do servidor e não obriga a re-renderizar o cliente).
 */
export function RoomPauseBanner() {
  const [pause, setPause] = useState({ paused: false });

  useEffect(() => subscribeRoomPause(setPause), []);

  return <RoomPauseBar pause={pause} />;
}

/** Apresentação pura (testável sem socket — ver roompause-resp-test.jsx). */
export function RoomPauseBar({ pause }) {
  if (!pause?.paused) return null;

  const coaches = Array.isArray(pause.coaches) ? pause.coaches : [];
  const who = coaches.length > 0 ? coaches.join(", ") : "um treinador";
  let since = "";
  try {
    since = pause.since
      ? new Date(pause.since).toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  } catch {
    /* ignore */
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[99997] bg-rose-600 text-white text-center text-[13px] font-extrabold uppercase tracking-widest py-2.5 px-3 shadow-lg flex items-center justify-center gap-2"
    >
      <span aria-hidden className="material-symbols-outlined text-[18px] leading-none shrink-0">
        pause_circle
      </span>
      <span className="break-words">
        Sala em pausa — à espera de {who}
        {since ? ` desde as ${since}` : ""}. A semana só avança quando voltar.
      </span>
    </div>
  );
}
