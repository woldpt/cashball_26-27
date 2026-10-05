/**
 * Web Push — avisos no telemóvel de quem não está a ver o jogo.
 *
 * Quatro tipos (`PushType`), sempre só para treinadores ausentes, com cooldown
 * de 5 min por (treinador, tipo, sala) na BD e preferências por tipo. Com a
 * flag `ENABLE_PUSH` desligada (`false`/ausente) nada faz: as rotas de index.ts
 * devolvem 404 antes de cá chegar e o `notifyUser` sai sem tocar na rede.
 * Nada aqui rebenta ou bloqueia o jogo — qualquer falha é log e segue, e todos
 * os gatilhos são fire-and-forget.
 */

const webpush = require("web-push");
// `auth` carrega-se à primeira utilização (não no import): meia dúzia de
// módulos de jogo importam este ficheiro, e o auth abre a accounts.db no
// load — não vale a pena abrir a BD a quem nunca chega a avisar ninguém
// (testes, audits, salas sem push ligado).
const auth = () => require("./auth");
import {
  computeAbsentees,
  isSeatPresent,
  requiredTeamIds,
} from "./roomStateHelpers";
import { getStandingsRows } from "./coreHelpers";
import type { ActiveGame } from "./types";

export type PushType = "waiting" | "auction" | "matchday" | "invite";

// Fonte única dos tipos: validação das rotas e defaults das preferências.
export const PUSH_TYPES: PushType[] = [
  "waiting",
  "auction",
  "matchday",
  "invite",
];

export function isKnownPushType(value: unknown): value is PushType {
  return PUSH_TYPES.includes(value as PushType);
}

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
 * empilhar no centro de notificações (o antigo `cashball-ready` fixo deixava
 * os avisos de salas diferentes todos lado a lado).
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
  return auth().savePushSubscription(coachName, endpoint, keys);
}

export async function removeSubscription(
  coachName: string,
  endpoint: string,
): Promise<boolean> {
  return auth().removePushSubscription(coachName, endpoint);
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

// ── Robustez de envio (Fase 5) ───────────────────────────────────────────────

// Contadores desde o arranque do processo (expostos em /health): dizem se o
// push está saudável sem ter de esperar por um relatório de erros.
const counters = { sent: 0, failed: 0, removed: 0, retried: 0 };

export function getPushStats(): Record<string, number | boolean> {
  return { enabled: isPushEnabled(), ...counters };
}

// Atraso da 2.ª tentativa (PUSH_RETRY_DELAY_MS existe para os testes correrem
// sem esperar 1,5 s por caso).
const RETRY_DELAY_MS = Number(process.env.PUSH_RETRY_DELAY_MS) || 1500;
const RETRY_DELAY_MAX_MS = 5000;

/** Falha que vale a pena repetir: rede, 429 ou 5xx (um 4xx é definitivo). */
function isTransient(err: any): boolean {
  const status = Number(err?.statusCode);
  if (!Number.isFinite(status) || status === 0) return true;
  return status === 429 || status >= 500;
}

/** Respeita o Retry-After (segundos) quando existe, com tecto curto. */
function retryDelayMs(err: any): number {
  const retryAfter = Number(err?.headers?.["retry-after"]);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, RETRY_DELAY_MAX_MS);
  }
  return RETRY_DELAY_MS;
}

/**
 * Uma tentativa extra (curta) para falhas transitórias. Nunca para 4xx: uma
 * subscrição inválida ou um payload recusado não melhoram por repetir.
 */
async function sendWithRetry(
  sub: { endpoint: string; keys: string },
  body: string,
): Promise<{ ok: boolean; err?: any }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: JSON.parse(sub.keys || "{}") },
        body,
        // Nudge sensível ao tempo: sem urgência o FCM adia com o ecrã
        // apagado; sem TTL curto um «falta a tua tática» chegava horas
        // depois, fora de contexto.
        { urgency: "high", TTL: 2 * 60 * 60 },
      );
      return { ok: true };
    } catch (err: any) {
      if (attempt >= 2 || !isTransient(err)) return { ok: false, err };
      counters.retried += 1;
      await new Promise((r) => setTimeout(r, retryDelayMs(err)));
    }
  }
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
      preloadedSubs || (await auth().getPushSubscriptions(coachName));
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
        const { ok, err } = await sendWithRetry(sub, body);
        if (ok) {
          sent += 1;
          counters.sent += 1;
          return;
        }
        counters.failed += 1;
        if (err?.statusCode === 410 || isDeadSubscription(err)) {
          counters.removed += 1;
          await auth().removePushSubscription(coachName, sub.endpoint);
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
  if (!(await typeEnabled(coachName, opts.type))) return 0;
  const roomCode = opts.roomCode || "";
  if (!(await throttleAllows(coachName, opts.type, roomCode))) return 0;
  const subs: Array<{ endpoint: string; keys: string }> =
    await auth().getPushSubscriptions(coachName);
  if (!subs || subs.length === 0) return 0;
  const sent = await notifyUser(
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
  // Só depois de entregar: uma falha de rede não pode calar o cooldown todo.
  if (sent > 0) await auth().markPushSent(coachName, opts.type, roomCode, Date.now());
  return sent;
}

// Throttle por (treinador, tipo, sala) na BD: sobrevive a restart e a mais do
// que um processo (o Map antigo era por treinador — um aviso de uma sala calava
// o da outra — e perdia-se no restart).
const PUSH_COOLDOWN_MS = 5 * 60 * 1000;
// Retenção do throttle: mais velho que isto nunca decide nada.
const PUSH_THROTTLE_RETENTION_MS = 24 * 60 * 60 * 1000;
// Retenção das subscrições: o cliente re-regista a cada arranque da app, logo
// uma linha tão velha é de um browser que já não volta.
const PUSH_SUB_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Preferências do treinador com os defaults preenchidos (para a API e a UI).
 * Todos os tipos nascem ligados: o cooldown já limita cada um a 1 aviso a cada
 * 5 minutos por sala, por isso o interruptor é para quem quer silenciar um tipo
 * em concreto, não um escape de ruído por omissão.
 */
export async function getPushPrefsFor(
  coachName: string,
): Promise<Record<PushType, boolean>> {
  const rows: Array<{ type: string; enabled: number }> =
    await auth().getPushPrefs(coachName);
  const prefs = {} as Record<PushType, boolean>;
  for (const type of PUSH_TYPES) prefs[type] = true;
  for (const row of rows) {
    if (isKnownPushType(row.type)) prefs[row.type] = !!row.enabled;
  }
  return prefs;
}

/** Grava um interruptor (tipo fora da lista conhecida é rejeitado). */
export async function setPushPrefFor(
  coachName: string,
  type: unknown,
  enabled: unknown,
): Promise<boolean> {
  if (!isKnownPushType(type)) return false;
  return auth().setPushPref(coachName, type, !!enabled);
}

/** Este tipo está ligado para este treinador? Sem linha, está. */
async function typeEnabled(coachName: string, type: PushType): Promise<boolean> {
  const rows: Array<{ type: string; enabled: number }> =
    await auth().getPushPrefs(coachName);
  const row = rows.find((r) => r.type === type);
  return row ? !!row.enabled : true;
}

/**
 * O cooldown deste (tipo, sala) já passou? Sem leitura da BD (avaria) deixa
 * passar — o pior caso é um duplicado, nunca um aviso perdido.
 */
async function throttleAllows(
  coachName: string,
  type: PushType,
  roomCode: string,
): Promise<boolean> {
  const rows: Array<{ type: string; roomCode: string; sentAt: number }> =
    await auth().getPushThrottle(coachName);
  const row = rows.find(
    (r) => r.type === type && (r.roomCode || "") === roomCode,
  );
  return !row || Date.now() - row.sentAt >= PUSH_COOLDOWN_MS;
}

/**
 * Arranque: poda o throttle (linhas > 24h já não decidem nada) e diz no log
 * se a infraestrutura está pronta — a flag ligada com VAPID em falta era um
 * silêncio difícil de diagnosticar em produção.
 */
export function initPush(): void {
  if (!isPushEnabled()) {
    console.log("[push] desligado (ENABLE_PUSH != true)");
    return;
  }
  if (!ensureVapid()) {
    console.warn(
      "[push] ENABLE_PUSH=true mas VAPID_PUBLIC/VAPID_PRIVATE/VAPID_SUBJECT em falta — avisos desligados",
    );
  }
  auth()
    .purgePushThrottle(Date.now() - PUSH_THROTTLE_RETENTION_MS)
    .then((throttleRows: number) =>
      auth().purgePushSubscriptions(Date.now() - PUSH_SUB_RETENTION_MS).then(
        (subRows: number) =>
          console.log(
            `[push] pronto (podado: ${throttleRows || 0} linhas de throttle, ${subRows || 0} subscrições antigas) — contadores em /health`,
          ),
      ),
    )
    .catch((err: any) => console.error("[push] initPush:", err?.message || err));
}

/**
 * Gatilho do Passo 2: se no lobby faltar exatamente um treinador, avisa-o.
 * Leitura pura + fire-and-forget — corre antes do gate de presença do
 * `checkAllReady` porque o em-falta está tipicamente ausente (browser
 * fechado). Nunca bloqueia nem rebenta o avanço do jogo.
 */
export function maybeNotifyLastMissing(game: ActiveGame): void {
  fireAndForget("maybeNotify", doMaybeNotify(game));
}

/** Fire-and-forget com rede de segurança: o push nunca rebenta o jogo. */
function fireAndForget(label: string, p: Promise<unknown>): void {
  void p.catch((err: any) =>
    console.error(`[push] ${label}:`, err?.message || err),
  );
}

/** Treinador com equipa neste id (assento durável, mesmo desligado). */
function coachNameForTeam(game: ActiveGame, teamId: number): string | null {
  for (const seat of Object.values(game.seats || {})) {
    if (seat.status === "member" && seat.teamId === teamId) return seat.name;
  }
  return null;
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
  if (isSeatPresent(game, name)) return;
  await sendToCoach(name, {
    type: "waiting",
    title: "CashBall",
    body: `Sala ${game.roomCode} · Falta a tua tática!`,
    roomCode: game.roomCode,
  });
}

/**
 * Sala parada à espera de quem falta (meio de jogo: lesão, intervalo, decisão
 * pendente, substituição). Sem isto o treinador ausente só descobre que a sala
 * está congelada quando abre a app — e os outros esperam por ele.
 *
 * No lobby quem fala é o `maybeNotifyLastMissing` (só quando falta um): ali a
 * sala ainda não está a andar e avisar todos os ausentes seria ruído.
 */
export function maybeNotifyWaiting(game: ActiveGame): void {
  if (!isPushEnabled()) return;
  if (game.gamePhase === "lobby") return;
  const absent = computeAbsentees(game);
  if (absent.length === 0) return;
  for (const name of absent) {
    fireAndForget(
      "waiting",
      sendToCoach(name, {
        type: "waiting",
        title: "CashBall",
        body: `Sala ${game.roomCode} · A sala está parada à tua espera`,
        roomCode: game.roomCode,
      }),
    );
  }
}

/**
 * Ultrapassaram-no num leilão. Só a quem não está a ver a app (um treinador com
 * a janela aberta já viu o aviso no ecrã) e nunca a NPCs.
 */
export function maybeNotifyOutbid(
  game: ActiveGame,
  outbidTeamId: number | null,
  playerName: string | undefined,
  amount: number,
): void {
  if (!isPushEnabled()) return;
  if (outbidTeamId == null) return;
  const coach = coachNameForTeam(game, outbidTeamId);
  if (!coach || isSeatPresent(game, coach)) return;
  fireAndForget(
    "outbid",
    sendToCoach(coach, {
      type: "auction",
      title: "CashBall",
      body: `Sala ${game.roomCode} · Ultrapassaram-te no leilão de ${playerName || "um jogador"} (€${amount})`,
      roomCode: game.roomCode,
    }),
  );
}

/** Convite de sala a quem está offline (o socket só chega a quem está ligado). */
export function notifyRoomInvite(
  toCoach: string,
  fromName: string,
  roomCode: string,
): void {
  if (!isPushEnabled()) return;
  fireAndForget(
    "invite",
    sendToCoach(toCoach, {
      type: "invite",
      title: "CashBall",
      body: `${fromName} convidou-te para a sala ${roomCode}`,
      roomCode,
    }),
  );
}

/**
 * Fim de jornada: resultado do próprio jogo + posição na tabela, só a quem não
 * estava a ver (os outros viram o ecrã de resultados ao vivo).
 */
export function maybeNotifyMatchday(
  game: ActiveGame,
  fixtures: any[],
  matchweek: number,
): void {
  if (!isPushEnabled()) return;
  const absent = computeAbsentees(game);
  if (absent.length === 0) return;
  fireAndForget(
    "matchday",
    sendMatchdayPushes(game, fixtures, matchweek, absent),
  );
}

async function sendMatchdayPushes(
  game: ActiveGame,
  fixtures: any[],
  matchweek: number,
  absent: string[],
): Promise<void> {
  const position = await standingsPositionByTeam(game.db);
  for (const name of absent) {
    const seat = game.seats[name];
    const fixture = fixtures.find(
      (f) => f.homeTeamId === seat?.teamId || f.awayTeamId === seat?.teamId,
    );
    if (!fixture || seat?.teamId == null) continue;
    const home = fixture.homeTeamId === seat.teamId;
    const goalsFor = home ? fixture.finalHomeGoals : fixture.finalAwayGoals;
    const goalsAgainst = home ? fixture.finalAwayGoals : fixture.finalHomeGoals;
    const pos = position.get(seat.teamId);
    fireAndForget(
      "matchday",
      sendToCoach(name, {
        type: "matchday",
        title: "CashBall",
        body:
          `Sala ${game.roomCode} · Jornada ${matchweek}: ${goalsFor}-${goalsAgainst}` +
          (pos ? ` · ${pos}.º lugar` : ""),
        roomCode: game.roomCode,
      }),
    );
  }
}

/** Posição na própria divisão (mesma ordenação da tabela do Jornal). */
async function standingsPositionByTeam(db: any): Promise<Map<number, number>> {
  const rows: any[] = await new Promise((resolve) => {
    db.all(
      "SELECT id, division, name, points, goals_for, goals_against FROM teams",
      (err: any, list: any[]) => resolve(err || !list ? [] : list),
    );
  });
  const byDivision = new Map<number, any[]>();
  for (const row of rows) {
    const list = byDivision.get(row.division) || [];
    list.push(row);
    byDivision.set(row.division, list);
  }
  const position = new Map<number, number>();
  for (const list of byDivision.values()) {
    getStandingsRows(list).forEach((team, index) =>
      position.set(team.id, index + 1),
    );
  }
  return position;
}
