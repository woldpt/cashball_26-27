import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { socket } from "../socket.js";

/**
 * Inicializa push notifications no Capacitor.
 * - Pede permissão ao utilizador
 * - Regista o token no backend (endpoint a criar)
 * - Ao receber um push em foreground/background, força reconnect do socket
 */
let initialized = false;

export async function initPushNotifications() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  try {
    const permissionStatus = await PushNotifications.requestPermissions({
      notifications: true,
      alert: true,
      badge: true,
      sound: true,
    });

    if (permissionStatus.notifications === "granted") {
      await PushNotifications.register();
    } else {
      console.warn("[push] Permissão negada pelo utilizador");
      return;
    }

    // Registar token no backend (o endpoint /api/push/token ainda não existe — criar em server/)
    const token = await PushNotifications.getToken();
    if (token) {
      console.log("[push] Token registrado:", token.value);
      // TODO: POST /api/push/token com o token e o roomCode para o backend associar ao utilizador
    }

    // Ao receber push, força reconnect imediato
    PushNotifications.addListener("notificationReceived", (notification) => {
      console.log("[push] Notificação recebida:", notification);
      forceReconnectOnPush();
    });

    PushNotifications.addListener("registration", (tokenResult) => {
      console.log("[push] Token atualizado:", tokenResult.value);
    });
  } catch (err) {
    console.error("[push] Erro ao inicializar push:", err);
  }
}

function forceReconnectOnPush() {
  if (!socket.connected && !socket.connecting) {
    console.log("[push] Forçando reconnect após push");
    socket.connect();
  }
}
