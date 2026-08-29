import { useEffect, useState } from "react";
import { socket } from "../../socket.js";

/**
 * Global banner shown when the app is offline or the socket is disconnected.
 * Subscribes to navigator online/offline events and socket connect/disconnect.
 */
export function OfflineBanner() {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const showBanner = !browserOnline || !socketConnected;

  if (!showBanner) return null;

  const isBrowserOffline = !browserOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[99998] bg-amber-500 text-black text-center text-xs font-semibold py-1.5 px-3 tracking-wide"
    >
      {isBrowserOffline ? "📡 Sem ligação" : "🔄 A reconectar…"}
    </div>
  );
}
