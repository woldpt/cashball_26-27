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

export type PushType = "waiting" | "auction" | "matchday" | "invite";

export interface PushPayload {
  type: PushType;
  title: string;
  body: string;
  url?: string;
  /** Agrupador do aviso no SO: mesma tag substitui em vez de empilhar. */
  tag?: string;
  roomCode?: string;
}

// Tag dos avisos sem tag própria (compatibilidade com clientes antigos).
const DEFAULT_TAG = "cashball-ready";

/**
 * Agrupador do aviso: avisos do mesmo tipo e sala substituem-se em vez de
 * empilhar no centro de notificações (o antigo `cashball-ready` fixo fazia
 * um aviso de cada sala ficar todos lado a lado).
 */
export function pushTag(type: PushType, roomCode?: string): string {
  return roomCode ? `${type}:${roomCode}` : type;
}

/**
 * Deep link do aviso: o App semeia o formulário com o código da sala
 * (`?room=`) antes de limpar o query string — sem isto o toque no aviso
 * abria a app no ecrã inicial sem saber de que sala se tratava.
 */
export function pushUrl(roomCode?: string): string {
  return roomCode ? `/?room=${encodeURIComponent(roomCode)}` : "/";
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

/**
 * Subscrição morta sob as chaves VAPID atuais: o FCM devolve 403 quando a
 * subscrição foi criada com outras chaves (ex. chaves rodadas no servidor).
 * Nunca vai passar — apaga-se como no 410. O match ao corpo é estreito de
 * propósito: um 403 genérico (avaria transitória do FCM) não apaga nada.
 */
function isDeadSubscription(err: any): boolean {
  return (
    err?.statusCode === 403 &&
    typeof err?.body === "string" &&
    err.body.includes("do not correspond to the credentials used to create")
  );
}

/**
 * Envia a todos os browsers subscritos; subscrição morta/expirada é apagada.
 * Devolve quantos browsers receberam (0 = nada entregue, o chamador não deve
 * gastar o cooldown por uma tentativa falhada).
 */
export async function notifyUser(
  coachName: string,
  payload: PushPayload,
  preloadedSubs?: Array<{ endpoint: string; keys: string }>,
): Promise<number> {
  try {
    if (!ensureVapid()) return 0;
    const subs: Array<{ endpoint: string; keys: string }> =
      preloadedSubs || (await auth.getPushSubscriptions(coachName));
    if (!subs || subs.length === 0) return 0;
    const body = JSON.stringify({
      type: payload.type,
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      tag: payload.tag || DEFAULT_TAG,
      roomCode: payload.roomCode,
    });
    let sent = 0;
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: JSON.parse(sub.keys || "{}") },
            body,
            // Nudge sensível ao tempo: sem urgência o FCM adia com o ecrã
            // apagado; sem TTL curto um «falta a tua tática» chegava horas
            // depois, fora de contexto.
            { urgency: "high", TTL: 2 * 60 * 60 },
          );
          sent += 1;
        } catch (err: any) {
          if (err?.statusCode === 410 || isDeadSubscription(err)) {
            await auth.removePushSubscription(coachName, sub.endpoint);
          } else {
            console.error(
              "[push] Falha ao notificar",
              coachName + ":",
              "status=" + err?.statusCode,
              (typeof err?.body === "string" && err.body.slice(0, 160)) ||
                err?.message ||
                err,
            );
          }
        }
      }),
    );
    return sent;
  } catch (err: any) {
    console.error("[push] notifyUser:", err?.message || err);
    return 0;
  }
}

/**
 * Um aviso a um treinador: subs, tag e deep link derivados do tipo + sala.
 * Devolve quantos browsers receberam (0 = nada entregue). Nunca rebenta.
 */
export async function sendToCoach(
  coachName: string,
  opts: { type: PushType; title: string; body: string; roomCode?: string },
): Promise<number> {
  const subs: Array<{ endpoint: string; keys: string }> =
    await auth.getPushSubscriptions(coachName);
  if (!subs || subs.length === 0) return 0;
  return notifyUser(
    coachName,
    {
      type: opts.type,
      title: opts.title,
      body: opts.body,
      roomCode: opts.roomCode,
      tag: pushTag(opts.type, opts.roomCode),
      url: pushUrl(opts.roomCode),
    },
    subs,
  );
}

// Último aviso por treinador (throttle Fase 2: 1 a cada 5 minutos; em
// memória — um restart limpa, aceitável enquanto não há repetição).
const lastPushAt = new Map<string, number>();
const PUSH_COOLDOWN_MS = 5 * 60 * 1000;

/** Poda as entradas já fora do cooldown (inúteis) — o mapa não cresce sem fim. */
function pruneLastPushAt(now: number): void {
  for (const [key, at] of lastPushAt) {
    if (now - at >= PUSH_COOLDOWN_MS) lastPushAt.delete(key);
  }
}

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
  const now = Date.now();
  if (now - (lastPushAt.get(key) || 0) < PUSH_COOLDOWN_MS) return;
  pruneLastPushAt(now);
  const sent = await sendToCoach(name, {
    type: "waiting",
    title: "CashBall",
    body: `Sala ${game.roomCode} · Falta a tua tática!`,
    roomCode: game.roomCode,
  });
  // Só depois de entregar: uma falha de rede não pode calar os próximos 5 min.
  if (sent > 0) lastPushAt.set(key, Date.now());
}
