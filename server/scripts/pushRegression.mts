/**
 * Regression — Web Push: entrega, subscrição morta e gatilho do lobby.
 *
 * Sem servidor, sem rede e sem BD: `web-push` e `auth` são substituídos por
 * mocks (o `auth` real abre a BD no import). O que este teste tranca:
 *
 *   P1 — flag desligada: nada toca na rede (nem uma query de subscrições)
 *   P2 — 410 e 403-VAPID apagam a subscrição; 403 genérico, 500 e erro de
 *        rede NÃO apagam (uma avaria transitória não pode perder o browser)
 *   P3 — o cooldown só é gasto depois de ≥1 entrega: uma falha não cala os
 *        5 minutos seguintes, e um envio com sucesso cala-os
 *   P4 — as subscrições são lidas UMA vez por aviso (não duas)
 *   P5 — maybeNotifyLastMissing: dispara com exactamente 1 em falta, fica
 *        quieto com 0 ou ≥2, e ignora espectadores/sem-equipa
 *   P6 — tag e deep link: derivam do tipo + sala (avisos de salas diferentes
 *        não se substituem entre si)
 *   P7 — throttle por (treinador, tipo, sala): um aviso de uma sala não cala
 *        o da outra, e um aviso travado nem chega a ler as subscrições
 *
 * Run: cd server && npm run test:push
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ── Mocks ───────────────────────────────────────────────────────────────────
type Sent = { endpoint: string; body: any; opts: any };
const sent: Sent[] = [];
const removed: string[] = [];
// `${treinador}|${tipo}|${sala}` → quando foi entregue (só deste teste).
const throttle = new Map<string, number>();
let queries = 0;
let nextError: any = null;
let subsFor: () => Array<{ endpoint: string; keys: string }> = () => [];

const webpushMock = {
  setVapidDetails() {},
  async sendNotification(sub: any, body: string, opts: any) {
    if (nextError) {
      const err = nextError;
      nextError = null;
      throw err;
    }
    sent.push({ endpoint: sub.endpoint, body: JSON.parse(body), opts });
  },
};

const authMock = {
  async getPushSubscriptions() {
    queries += 1;
    return subsFor();
  },
  async removePushSubscription(_name: string, endpoint: string) {
    removed.push(endpoint);
    return true;
  },
  async savePushSubscription() {
    return true;
  },
  // Throttle falso em memória (a chave é a mesma da tabela real).
  async getPushThrottle(name: string) {
    const out: Array<{ type: string; roomCode: string; sentAt: number }> = [];
    for (const [key, sentAt] of throttle) {
      const [coach, type, room] = key.split("|");
      if (coach === name.toLowerCase()) out.push({ type, roomCode: room, sentAt });
    }
    return out;
  },
  async markPushSent(name: string, type: string, roomCode: string) {
    throttle.set(`${name.toLowerCase()}|${type}|${roomCode}`, Date.now());
    return true;
  },
  async purgePushThrottle(before: number) {
    let n = 0;
    for (const [key, sentAt] of throttle) {
      if (sentAt < before) {
        throttle.delete(key);
        n += 1;
      }
    }
    return n;
  },
};

const Module = require("module");
const origLoad = Module._load;
Module._load = function (request: string, parent: any, ...rest: any[]) {
  if (request === "web-push") return webpushMock;
  const fromPush =
    typeof parent?.filename === "string" && /push\.(ts|js)$/.test(parent.filename);
  if (fromPush && (request === "./auth" || request === "./auth.js")) return authMock;
  return origLoad.call(this, request, parent, ...rest);
};

process.env.ENABLE_PUSH = "true";
process.env.VAPID_PUBLIC = "test-public";
process.env.VAPID_PRIVATE = "test-private";
process.env.VAPID_SUBJECT = "mailto:test@example.com";

const { notifyUser, maybeNotifyLastMissing, sendToCoach, pushTag, pushUrl } =
  require("../push.ts");

const SUB = (endpoint: string) => ({
  endpoint,
  keys: JSON.stringify({ p256dh: "p256dh-key", auth: "auth-key" }),
});

function reset(): void {
  sent.length = 0;
  removed.length = 0;
  queries = 0;
  nextError = null;
  subsFor = () => [SUB("https://push.example/one")];
}

/** Deixa correr as promessas fire-and-forget do maybeNotifyLastMissing. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

function makeLobby(
  seats: Array<{ name: string; teamId: number | null; ready: boolean; status?: string }>,
) {
  const map: any = {};
  for (const s of seats) {
    map[s.name] = {
      name: s.name,
      teamId: s.teamId,
      status: s.status || "member",
      intent: { ready: s.ready },
      seatEpoch: 0,
      deviceId: null,
      lastSeenAt: 0,
    };
  }
  return {
    roomCode: "ABCD",
    gamePhase: "lobby",
    seats: map,
    playersByName: {},
    lockedCoaches: new Set<string>(),
    currentFixtures: [],
    db: null,
  } as any;
}

test("P1 — flag desligada: nada toca na rede", async () => {
  reset();
  process.env.ENABLE_PUSH = "false";
  const n = await notifyUser("Ana", { type: "waiting", title: "x", body: "y" });
  process.env.ENABLE_PUSH = "true";
  assert.equal(n, 0);
  assert.equal(sent.length, 0);
  assert.equal(queries, 0, "nem as subscrições foram lidas");
});

test("P2 — subscrição morta é apagada; falha transitória não", async () => {
  const cases: Array<{ label: string; err: any; remove: boolean }> = [
    { label: "410 Gone", err: { statusCode: 410 }, remove: true },
    {
      label: "403 VAPID (chaves trocadas)",
      err: {
        statusCode: 403,
        body: '{"error":{"status":"PERMISSION_DENIED","message":"the credentials used to create this subscription do not correspond to the credentials used to create"}}',
      },
      remove: true,
    },
    {
      label: "403 genérico",
      err: {
        statusCode: 403,
        body: '{"error":{"status":"PERMISSION_DENIED","message":"avaria transitória"}}',
      },
      remove: false,
    },
    { label: "500", err: { statusCode: 500 }, remove: false },
    { label: "erro de rede", err: { code: "ECONNRESET" }, remove: false },
  ];

  for (const c of cases) {
    reset();
    nextError = c.err;
    const n = await notifyUser("Ana", { type: "waiting", title: "x", body: "y" });
    assert.equal(n, 0, `${c.label}: nada entregue`);
    assert.equal(
      removed.length,
      c.remove ? 1 : 0,
      `${c.label}: removeu=${removed.length} (esperado ${c.remove ? 1 : 0})`,
    );
  }
});

test("P3/P4 — o cooldown só é gasto depois de entregar, e as subs lêem-se uma vez", async () => {
  reset();
  const game = makeLobby([
    { name: "Ana", teamId: 10, ready: true },
    { name: "Beto", teamId: 20, ready: false },
  ]);

  // 1.ª tentativa: o FCM devolve 500 → nada entregue.
  nextError = { statusCode: 500 };
  maybeNotifyLastMissing(game);
  await flush();
  assert.equal(sent.length, 0);

  // Sem cooldown gasto, a tentativa seguinte volta a sair (e agora entrega).
  maybeNotifyLastMissing(game);
  await flush();
  assert.equal(sent.length, 1, "uma falha não pode calar os 5 minutos seguintes");
  assert.equal(queries, 2, "uma leitura de subscrições por aviso");
  assert.deepEqual(sent[0].body, {
    type: "waiting",
    title: "CashBall",
    body: "Sala ABCD · Falta a tua tática!",
    url: "/?room=ABCD",
    tag: "waiting:ABCD",
    roomCode: "ABCD",
  });
  assert.equal(sent[0].opts.urgency, "high");

  // Com a entrega feita, o cooldown trava o aviso seguinte.
  maybeNotifyLastMissing(game);
  await flush();
  assert.equal(sent.length, 1, "cooldown de 5 min após entrega");
});

test("P5 — dispara com 1 em falta, cala-se com 0 ou ≥2, ignora espectadores", async () => {
  // Nomes próprios deste teste: o cooldown em memória (por treinador) fica
  // marcado no teste anterior — sem isto, o aviso legítimo seria travado.
  // 0 em falta.
  reset();
  maybeNotifyLastMissing(
    makeLobby([
      { name: "Nina", teamId: 10, ready: true },
      { name: "Rui", teamId: 20, ready: true },
    ]),
  );
  await flush();
  assert.equal(sent.length, 0);

  // ≥2 em falta.
  reset();
  maybeNotifyLastMissing(
    makeLobby([
      { name: "Nina", teamId: 10, ready: false },
      { name: "Rui", teamId: 20, ready: false },
    ]),
  );
  await flush();
  assert.equal(sent.length, 0);

  // Exactamente 1 em falta, com um espectador e um assento sem equipa pelo
  // meio (nenhum dos dois conta como «em falta»).
  reset();
  maybeNotifyLastMissing(
    makeLobby([
      { name: "Nina", teamId: 10, ready: true },
      { name: "Rui", teamId: 20, ready: false },
      { name: "Sara", teamId: 30, ready: false, status: "left" },
      { name: "Tomás", teamId: null, ready: false },
    ]),
  );
  await flush();
  assert.equal(sent.length, 1, "espectadores não contam para o «em falta»");

  // O mesmo espectador como membro passa a contar: 2 em falta, sem aviso.
  reset();
  maybeNotifyLastMissing(
    makeLobby([
      { name: "Vera", teamId: 10, ready: true },
      { name: "Zé", teamId: 20, ready: false },
      { name: "Rita", teamId: 30, ready: false },
    ]),
  );
  await flush();
  assert.equal(sent.length, 0);
});

test("P6 — tag e deep link derivam do tipo e da sala", () => {
  assert.equal(pushTag("waiting", "ABCD"), "waiting:ABCD");
  assert.equal(pushTag("waiting"), "waiting");
  assert.equal(pushUrl("ABCD"), "/?room=ABCD");
  assert.equal(pushUrl(), "/");
  // Salas diferentes não partilham tag: um aviso não substitui o outro.
  assert.notEqual(pushTag("auction", "ABCD"), pushTag("auction", "EFGH"));
});

test("P7 — o cooldown é por (treinador, tipo, sala)", async () => {
  const coach = "Hugo";
  const opts = { title: "t", body: "b" } as const;

  reset();
  assert.equal(
    await sendToCoach(coach, { ...opts, type: "waiting", roomCode: "ABCD" }),
    1,
  );
  assert.equal(queries, 1, "uma leitura de subscrições por aviso entregue");

  // Mesmo tipo, mesma sala: calado — e sem chegar a tocar na BD de subs.
  assert.equal(
    await sendToCoach(coach, { ...opts, type: "waiting", roomCode: "ABCD" }),
    0,
  );
  assert.equal(queries, 1, "travado pelo cooldown: nem lê as subscrições");

  // Outra sala: passa (o aviso de uma sala não cala o da outra).
  assert.equal(
    await sendToCoach(coach, { ...opts, type: "waiting", roomCode: "EFGH" }),
    1,
  );
  // Outro tipo na mesma sala: passa.
  assert.equal(
    await sendToCoach(coach, { ...opts, type: "auction", roomCode: "ABCD" }),
    1,
  );
  assert.equal(sent.length, 3);
});
