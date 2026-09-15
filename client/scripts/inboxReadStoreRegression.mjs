/**
 * Regression — badge do Jornal: as leituras têm de ser partilhadas.
 *
 * O badge vive no `GameLayout` (que nunca desmonta) e a leitura acontece no
 * `JournalTab`: cada `useInbox()` tem a sua subscrição do store, por isso o
 * contrato que este teste codifica é o do store, não o do componente.
 *
 *   R1 — ler num consumidor chega a todos (aviso aos subscritores) e o snapshot
 *        muda de referência só quando muda de conteúdo;
 *   R2 — chaves diferentes (sala/treinador) não se contaminam;
 *   R3 — persistência: um "reload" (módulo novo) recupera as leituras;
 *   R4 — marcar o que já está lido não escreve nem avisa (evita render/escrita
 *        em ciclo — o `GameLayout` re-renderiza a cada aviso);
 *   R5 — teto de 400: os mais antigos saem primeiro;
 *   R6 — snapshot estável entre leituras sem alterações — é o contrato do
 *        `useSyncExternalStore`; uma referência nova a cada chamada = render
 *        infinito no badge.
 *
 * Run: cd client && npm run test:inboxreads
 */

// localStorage falso: o store tem de funcionar e persistir sem browser.
const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};

const {
  inboxReadKey,
  markInboxRead,
  markInboxReadMany,
  readIdsFor,
  subscribeInboxReads,
} = await import("../src/utils/inboxReadStore.js");

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log(`  ok   — ${msg}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${msg}`);
  }
}

const A = inboxReadKey("ROOM1", "ana");
const B = inboxReadKey("ROOM1", "rui");

console.log("R1 ler avisa os consumidores e só muda de referência ao mudar");
{
  const key = A;
  let notified = 0;
  const unsubscribe = subscribeInboxReads(() => notified++);
  const before = readIdsFor(key);
  markInboxRead(key, "news-1");
  const after = readIdsFor(key);
  check(notified === 1, `um aviso por leitura (${notified})`);
  check(after !== before, "referência nova depois de ler (React vê a mudança)");
  check(after.has("news-1"), "id marcado está no snapshot");
  check(!before.has("news-1"), "snapshot antigo não foi mutado no lugar");
  unsubscribe();
  markInboxRead(key, "news-2");
  check(notified === 1, "após unsubscribe já não é avisado");
}

console.log("R2 chaves diferentes não se contaminam");
{
  check(!readIdsFor(B).has("news-1"), "outro treinador não herda as leituras");
  markInboxRead(B, "news-9");
  check(readIdsFor(B).has("news-9"), "leitura do segundo treinador ficou lá");
  check(!readIdsFor(A).has("news-9"), "e não vazou para o primeiro");
}

console.log("R3 persistência sobrevive a um reload");
{
  const key = inboxReadKey("ROOM1", "ana");
  const persisted = JSON.parse(mem.get(key));
  check(
    Array.isArray(persisted) && persisted.includes("news-1"),
    `localStorage tem as leituras (${persisted?.length})`,
  );
  const fresh = await import("../src/utils/inboxReadStore.js?reload=1");
  check(
    fresh.readIdsFor(key).has("news-1"),
    "módulo novo (reload) recupera as leituras do localStorage",
  );
  check(
    fresh.readIdsFor(key).size === readIdsFor(key).size,
    "e recupera exatamente as mesmas",
  );
}

console.log("R4 reler o que já está lido não escreve nem avisa");
{
  const key = inboxReadKey("ROOM2", "ana");
  markInboxRead(key, "x");
  let notified = 0;
  const unsubscribe = subscribeInboxReads(() => notified++);
  const snapshot = readIdsFor(key);
  markInboxRead(key, "x");
  markInboxReadMany(key, ["x", "x", null, undefined, ""]);
  check(notified === 0, `nenhum aviso (${notified})`);
  check(readIdsFor(key) === snapshot, "e nenhuma referência nova");
  unsubscribe();
}

console.log("R5 teto de 400 leituras, os mais antigos primeiro");
{
  const key = inboxReadKey("ROOM3", "ana");
  const ids = Array.from({ length: 450 }, (_, i) => `n${i}`);
  markInboxReadMany(key, ids);
  const set = readIdsFor(key);
  check(set.size === 400, `guardadas 400 (${set.size})`);
  check(!set.has("n0") && !set.has("n49"), "as 50 mais antigas saíram");
  check(set.has("n50") && set.has("n449"), "as mais recentes ficaram");
}

console.log("R6 snapshot estável sem alterações (contrato do useSyncExternalStore)");
{
  const key = inboxReadKey("ROOM4", "ana");
  const a = readIdsFor(key);
  const b = readIdsFor(key);
  check(a === b, "chamadas seguidas devolvem a MESMA referência");
  check(
    readIdsFor(inboxReadKey("ROOM4", "outro")) !== a,
    "e chaves diferentes dão referências diferentes",
  );
}

if (failures > 0) {
  console.error(`\n❌ inbox-read-store: ${failures} falha(s)`);
  process.exit(1);
}
console.log("\n✅ inbox-read-store: leituras partilhadas, estáveis e persistidas");
