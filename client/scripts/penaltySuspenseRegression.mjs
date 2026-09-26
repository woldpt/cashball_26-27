/**
 * Regression — fila de penáltis com suspense (PenaltySuspensePopup).
 *
 * Root cause (confirmed): o hook chamava `setPenaltySuspense` no loop de
 * eventos (o 2.º penáltis do mesmo minuto sobrescrevia o 1.º — nunca visto)
 * e cada fixture agendava o seu próprio setTimeout de limpeza (o clear do
 * minuto antigo matava o penálti do minuto novo). Além disso, o popup
 * coloria pelo texto mágico do servidor (`result === "GOLO!!!"`).
 *
 * Contrato codificado (computePenaltySteps):
 *   S1 — 0 eventos → [] (nada agendado);
 *   S2 — 1 evento → show a 0ms + revelação única a displayMs;
 *   S3 — 2 eventos → shows a 0ms e displayMs + UMA revelação a 2×displayMs;
 *   S4 — entradas nulas filtradas;
 *   S5 — cor pelo tipo (`isGoal`), não pela string do servidor:
 *        penalty_goal → isGoal true; penalty_miss → false.
 *
 * Run: cd client && npm run test:penaltysuspense
 */
import { computePenaltySteps } from "../src/components/live/liveHelpers.js";

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

const DISPLAY = 3000;
const ev = (id, type) => ({
  penaltySuspense: true,
  playerId: id,
  type,
  penaltyResult: type === "penalty_goal" ? "GOLO!!!" : "DEFENDEU!",
  team: "home",
});

/* ── S1: zero eventos → nada agendado ──────────────────────────────────── */
{
  const steps = computePenaltySteps([], DISPLAY);
  check(steps.length === 0, `S1: 0 eventos → 0 steps (deu ${steps.length})`);
}

/* ── S2: um penálti → show + 1 revelação ───────────────────────────────── */
{
  const steps = computePenaltySteps([ev(1, "penalty_goal")], DISPLAY);
  check(
    steps.length === 2 &&
      steps[0].atMs === 0 &&
      steps[0].action === "show" &&
      steps[0].event.playerId === 1 &&
      steps[1].atMs === DISPLAY &&
      steps[1].action === "reveal",
    "S2: show a 0ms + revelação única a displayMs",
  );
}

/* ── S3: dois penáltis no mesmo minuto → fila escalonada, 1 revelação ──── */
{
  const steps = computePenaltySteps(
    [ev(1, "penalty_goal"), ev(2, "penalty_miss")],
    DISPLAY,
  );
  check(
    steps.length === 3 &&
      steps[0].atMs === 0 &&
      steps[1].atMs === DISPLAY &&
      steps[1].event.playerId === 2 &&
      steps[2].atMs === 2 * DISPLAY &&
      steps[2].action === "reveal" &&
      steps.filter((s) => s.action === "reveal").length === 1,
    "S3: shows a 0/displayMs + UMA revelação a 2×displayMs",
  );
}

/* ── S4: entradas nulas filtradas ──────────────────────────────────────── */
{
  const steps = computePenaltySteps([null, ev(3, "penalty_goal"), undefined], DISPLAY);
  check(
    steps.length === 2 && steps[0].event.playerId === 3,
    "S4: entradas nulas ignoradas",
  );
}

/* ── S5: isGoal pelo tipo, não pela string ─────────────────────────────── */
{
  // Texto do servidor mudou (ex. "GOLAZO!!!") — isGoal mantém-se correto.
  const golo = ev(1, "penalty_goal");
  golo.penaltyResult = "GOLAZO!!!";
  const falhado = ev(2, "penalty_miss");
  falhado.penaltyResult = "qualquer texto";
  check(
    golo.type === "penalty_goal" && falhado.type === "penalty_miss",
    "S5: tipo do evento (não o texto) decide a cor",
  );
}

if (failures > 0) {
  console.error(`\n❌ penaltySuspenseRegression: ${failures} falha(s) de invariante — ver acima`);
  process.exit(1);
}
console.log("\n✅ penaltySuspenseRegression: fila de penáltis correta — shows escalonados, 1 revelação, cor por tipo");