/**
 * Regression — sequenciador dos modais pós-jogo (postMatchFlow).
 *
 * Contrato codificado (computePostMatchFlow + isPostMatchQueueActive):
 *   S1 — fila vazia → nada visível; espera multiplayer ativa;
 *   S2 — só penáltis → visível; resto falso; espera suprimida;
 *   S3 — penáltis + despedimento → despedimento oculto (aguarda fecho),
 *        fim de época oculto;
 *   S4 — despedimento + fim de época → despedimento primeiro, fim de
 *        época oculto até fila drenar;
 *   S5 — só fim de época → visível (é sempre o ÚLTIMO); espera suprimida;
 *   S6 — fila drenada + waitingWantsShow → espera ativa;
 *   S7 — isPostMatchQueueActive é o espelho exato da fila (negado de
 *        showWaiting com waitingWantsShow=true, para os mesmos inputs).
 *
 * Run: cd client && npm run test:postmatchflow
 */
import {
  computePostMatchFlow,
  isPostMatchQueueActive,
} from "../src/utils/postMatchFlow.js";

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

/* ── S1: fila vazia ────────────────────────────────────────────────────── */
{
  const out = computePostMatchFlow({
    seasonEndModal: null,
    cupPenaltyPopup: null,
    dismissalModal: null,
    waitingWantsShow: true,
  });
  check(
    !out.showDismissal && !out.showSeasonEnd && out.showWaiting,
    "S1: fila vazia → espera multiplayer ativa",
  );
}

/* ── S2: só penáltis ──────────────────────────────────────────────────── */
{
  const out = computePostMatchFlow({
    seasonEndModal: null,
    cupPenaltyPopup: { kick: 1 },
    dismissalModal: null,
    waitingWantsShow: true,
  });
  check(
    !out.showDismissal && !out.showSeasonEnd && !out.showWaiting,
    "S2: penáltis visível em exclusivo; espera suprimida",
  );
}

/* ── S3: penáltis + despedimento (despedimento aguarda) ───────────────── */
{
  const out = computePostMatchFlow({
    seasonEndModal: null,
    cupPenaltyPopup: { kick: 1 },
    dismissalModal: { reason: "x" },
    waitingWantsShow: true,
  });
  check(
    !out.showDismissal && !out.showSeasonEnd && !out.showWaiting,
    "S3: despedimento oculto atrás dos penáltis; fim de época oculto",
  );
}

/* ── S4: despedimento + fim de época (fim de época é sempre o ÚLTIMO) ─── */
{
  const out = computePostMatchFlow({
    seasonEndModal: { season: 3 },
    cupPenaltyPopup: null,
    dismissalModal: { reason: "x" },
    waitingWantsShow: true,
  });
  check(
    out.showDismissal && !out.showSeasonEnd && !out.showWaiting,
    "S4: despedimento primeiro; fim de época e espera ocultos",
  );
}

/* ── S5: só fim de época ──────────────────────────────────────────────── */
{
  const out = computePostMatchFlow({
    seasonEndModal: { season: 3 },
    cupPenaltyPopup: null,
    dismissalModal: null,
    waitingWantsShow: true,
  });
  check(
    !out.showDismissal && out.showSeasonEnd && !out.showWaiting,
    "S5: fim de época visível em exclusivo; espera suprimida",
  );
}

/* ── S6: fila drenada → espera revela ─────────────────────────────────── */
{
  const out = computePostMatchFlow({
    seasonEndModal: null,
    cupPenaltyPopup: null,
    dismissalModal: null,
    waitingWantsShow: false,
  });
  check(
    !out.showWaiting,
    "S6: waitingWantsShow=false → espera nunca aparece",
  );
}

/* ── S7: isPostMatchQueueActive = negação exata de showWaiting ────────── */
const cases = [
  { seasonEndModal: null, cupPenaltyPopup: null, dismissalModal: null },
  { seasonEndModal: { s: 1 }, cupPenaltyPopup: null, dismissalModal: null },
  { seasonEndModal: null, cupPenaltyPopup: { kick: 1 }, dismissalModal: null },
  { seasonEndModal: null, cupPenaltyPopup: null, dismissalModal: { r: "x" } },
  { seasonEndModal: { s: 1 }, cupPenaltyPopup: { kick: 1 }, dismissalModal: { r: "x" } },
];
let coerente = true;
for (const inputs of cases) {
  const out = computePostMatchFlow({ ...inputs, waitingWantsShow: true });
  if (isPostMatchQueueActive(inputs) === out.showWaiting) coerente = false;
}
check(
  coerente,
  "S7: isPostMatchQueueActive ≡ !showWaiting (fila é o primitivo único)",
);

if (failures > 0) {
  console.error(
    `\n❌ postMatchFlowRegression: ${failures} falha(s) de invariante — ver acima`,
  );
  process.exit(1);
}
console.log(
  "\n✅ postMatchFlowRegression: ordem pós-jogo correta — penáltis → despedimento → fim de época, espera só com fila drenada",
);