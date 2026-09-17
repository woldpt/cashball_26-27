import { useEffect, useState } from "react";
import { socket, subscribeOutbox, getOutboxPending } from "../../socket.js";
import { ModalShell } from "./ModalShell.jsx";

/**
 * Popup global quando a app está offline ou o socket desligou.
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

  const showPopup = !browserOnline || !socketConnected;
  const isBrowserOffline = !browserOnline;
  const pendingLabel = pending > 0 ? ` · ${pending} em fila` : "";

  return (
    <ModalShell visible={showPopup} z={99998} variant="card">
      <div
        role="status"
        aria-live="polite"
        className="px-6 py-5 text-center"
      >
        <span
          aria-hidden
          className="material-symbols-outlined animate-spin text-2xl leading-none text-primary"
        >
          sync
        </span>
        <p className="mt-1 text-sm font-bold text-on-surface">
          {isBrowserOffline
            ? `📡 Sem ligação${pendingLabel}`
            : `🔄 A reconectar…${pendingLabel}`}
        </p>
        {!isBrowserOffline && (
          <button
            type="button"
            onClick={() => socket.connect()}
            className="mt-2 underline underline-offset-2 font-bold text-primary"
          >
            Tentar agora
          </button>
        )}
      </div>
    </ModalShell>
  );
}
