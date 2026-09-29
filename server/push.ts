/**
 * Web Push — Fase 1: infraestrutura inerte atrás de ENABLE_PUSH.
 *
 * Com a flag desligada (`false`/ausente) nada faz: as rotas de index.ts
 * devolvem 404 antes de cá chegar e o `notifyUser` sai sem tocar na rede.
 * O `notifyUser` nunca rebenta — qualquer falha é log e segue (o jogo
 * continua mesmo com o push partido).
 */

const webpush = require("web-push");
const auth = require("./auth");
import { requiredTeamIds } from "./roomStateHelpers";
import type { ActiveGame } from "./types";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export function isPushEnabled(): boolean {
  return process.env.ENABLE_PUSH === "true";
}

// fingerprint da config ativa — evita VAPID stale se o .env mudar sem restart.
let vapidFor = "";

function ensureVapid(): boolean {
  if (!isPushEnabled()) return false;
  const pub = process.env.VAPID_PUBLIC || "";
  const priv = process.env.VAPID_PRIVATE || "";
  const subject = process.env.VAPID_SUBJECT || "";
  if (!pub || !priv || !subject) return false;
  if (vapidFor === `${subject}|${pub}`) return true;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    vapidFor = `${subject}|${pub}`;
    return true;
  } catch (err: any) {
    console.error("[push] VAPID inválido:", err?.message || err);
    return false;
  }
}

export async function saveSubscription(
  coachName: string,
  endpoint: string,
  keys: unknown,
): Promise<boolean> {
  if (!isPushEnabled()) return false;
  return auth.savePushSubscription(coachName, endpoint, keys);
}

export async function removeSubscription(
  coachName: string,
  endpoint: string,
): Promise<boolean> {
  return auth.removePushSubscription(coachName, endpoint);
}

/** Envia a todos os browsers subscritos; subscrição expirada (410) é apagada. */
export async function notifyUser(
  coachName: string,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!ensureVapid()) return;
    const subs: Array<{ endpoint: string; keys: string }> =
      await auth.getPushSubscriptions(coachName);
    if (!subs || subs.length === 0) return;
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
    });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: JSON.parse(sub.keys || "{}") },
            body,
          );
        } catch (err: any) {
          if (err?.statusCode === 410) {
            await auth.removePushSubscription(coachName, sub.endpoint);
          } else {
            console.error(
              "[push] Falha ao notificar",
              coachName + ":",
              err?.message || err,
            );
          }
        }
      }),
    );
  } catch (err: any) {
    console.error("[push] notifyUser:", err?.message || err);
  }
}

// Último aviso por treinador (throttle Fase 2: 1 a cada 5 minutos; em
// memória — um restart limpa, aceitável enquanto não há repetição).
const lastPushAt = new Map<string, number>();
const PUSH_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Gatilho do Passo 2: se no lobby faltar exatamente um treinador, avisa-o.
 * Leitura pura + fire-and-forget — corre antes do gate de presença do
 * `checkAllReady` porque o em-falta está tipicamente ausente (browser
 * fechado). Nunca bloqueia nem rebenta o avanço do jogo.
 */
export function maybeNotifyLastMissing(game: ActiveGame): void {
  void doMaybeNotify(game).catch((err: any) =>
    console.error("[push] maybeNotify:", err?.message || err),
  );
}

async function doMaybeNotify(game: ActiveGame): Promise<void> {
  if (!isPushEnabled()) return;
  if (game.gamePhase !== "lobby") return;
  const required = requiredTeamIds(game);
  if (required.size < 2) return;
  const waiting = Object.values(game.seats).filter(
    (s) => s.status === "member" && s.teamId != null && required.has(s.teamId),
  );
  const missing = waiting.filter((s) => !s.intent.ready);
  if (missing.length !== 1) return;
  const name = missing[0].name;
  const key = name.toLowerCase();
  if (Date.now() - (lastPushAt.get(key) || 0) < PUSH_COOLDOWN_MS) return;
  const subs = await auth.getPushSubscriptions(name);
  if (!subs || subs.length === 0) return;
  lastPushAt.set(key, Date.now());
  await notifyUser(name, {
    title: "CashBall",
    body: "Todos prontos. Falta a tua tática!",
    url: "/",
  });
}
