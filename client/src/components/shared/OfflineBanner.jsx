import { useEffect, useState } from "react";
import { socket, subscribeOutbox, getOutboxPending } from "../../socket.js";

/**
 * Global banner shown when the app is offline or the socket is disconnected.
 * Subscribes to navigator online/offline events and socket connect/disconnect.
 * Mostra ainda as ações em fila (tática, pronto, lances) e um botão para
 * forçar a reconexão — sem esperar pelo backoff automático.
 */
export function OfflineBanner() {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [pending, setPending] = useState(getOutboxPending());

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    const unsubscribe = subscribeOutbox(({ pending }) => setPending(pending));

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      unsubscribe();
    };
  }, []);

  const showBanner = !browserOnline || !socketConnected;

  if (!showBanner) return null;

  const isBrowserOffline = !browserOnline;
  const pendingLabel =
    pending > 0 ? ` · ${pending} em fila` : "";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[99998] bg-amber-500 text-black text-center text-xs font-semibold py-1.5 px-3 tracking-wide flex items-center justify-center gap-2"
    >
      <span>
        {isBrowserOffline
          ? `📡 Sem ligação${pendingLabel}`
          : `🔄 A reconectar…${pendingLabel}`}
      </span>
      {!isBrowserOffline && (
        <button
          type="button"
          onClick={() => socket.connect()}
          className="underline underline-offset-2 font-bold"
        >
          Tentar agora
        </button>
      )}
    </div>
  );
}
