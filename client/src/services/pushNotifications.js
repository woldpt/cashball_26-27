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

/**
 * Converte a chave pública VAPID (base64url) para o formato do PushManager.
 * @param {string} base64 Chave pública em base64url.
 * @returns {Uint8Array} Chave como bytes.
 */
export function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Re-regista a subscrição Web Push no servidor, sem pedir nada ao utilizador.
 *
 * Cobre dois casos silenciosos: o servidor perdeu a linha (base nova, limpeza)
 * e o browser renovou/expirou a subscrição por conta própria. Só corre com a
 * permissão já dada — o pedido explícito continua a ser o botão "Activar
 * Avisos" em `PushSettings`.
 *
 * @param {Object} params
 * @param {string} params.backendUrl Base do backend.
 * @param {string} params.name Treinador autenticado.
 * @param {string} params.token Sessão do treinador.
 * @returns {Promise<boolean>} true se a subscrição ficou registada no servidor.
 */
export async function resubscribeWebPush({ backendUrl, name, token }) {
  if (!name || !token) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const keyRes = await fetch(`${backendUrl}/api/push/key`);
      if (!keyRes.ok) return false;
      const { key } = await keyRes.json();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    const json = sub.toJSON();
    const res = await fetch(`${backendUrl}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, token, endpoint: json.endpoint, keys: json.keys }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
