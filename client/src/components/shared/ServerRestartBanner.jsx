import { useEffect, useState } from "react";
import { subscribeServerRestart } from "../../socket.js";

/**
 * Banner manual após restart do servidor. O resync automático já repôs o
 * estado; o botão oferece uma recarga limpa quando o utilizador quiser, sem
 * a corrida do reload automático (que falhava na janela de arranque).
 * Não bloqueia o jogo e dispensa com o ✕.
 */
export function ServerRestartBanner() {
  const [restarted, setRestarted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(
    () =>
      subscribeServerRestart(() => {
        setRestarted(true);
        setDismissed(false);
      }),
    [],
  );

  if (!restarted || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[99997] bg-primary text-zinc-950 text-center text-xs font-bold py-1.5 px-3 tracking-wide flex items-center justify-center gap-2"
    >
      <span>🔄 Servidor reiniciado — estado ressincronizado</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="underline underline-offset-2 font-black"
      >
        Recarregar
      </button>
      <button
        type="button"
        aria-label="Dispensar aviso de reinício"
        onClick={() => setDismissed(true)}
        className="font-black px-1"
      >
        ✕
      </button>
    </div>
  );
}
