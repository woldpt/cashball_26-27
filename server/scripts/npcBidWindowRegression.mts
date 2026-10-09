/**
 * Regression — lances dos NPCs só na janela final do leilão, espaçados.
 *
 * Antes: os NPCs licitavam 2–18 s depois de cada lance, em rajada logo no início.
 * Agora: só nos últimos AUCTION_NPC_WINDOW_MS, com AUCTION_NPC_GAP_MIN_MS a
 * AUCTION_NPC_GAP_MAX_MS entre dois lances de NPCs, e nunca perto do fecho.
 *
 *   W1 — antes da janela, o próximo lance fica para o início da janela
 *   W2 — dentro da janela, o lance sai já (sem esperar)
 *   W3 — dois lances de NPCs ficam separados pelo intervalo sorteado
 *   W4 — nada depois da margem de fecho: devolve null
 *   W5 — as constantes têm os valores do plano (30 s, 6–10 s)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextNpcReleaseAt } from "../npcTransferHelpers";
import {
  AUCTION_NPC_WINDOW_MS,
  AUCTION_NPC_GAP_MIN_MS,
  AUCTION_NPC_GAP_MAX_MS,
  AUCTION_NPC_CLOSE_MARGIN_MS,
} from "../gameConstants";

const ENDS_AT = 120_000;
const WINDOW_START = ENDS_AT - AUCTION_NPC_WINDOW_MS; // 90 000
const CLOSE_AT = ENDS_AT - AUCTION_NPC_CLOSE_MARGIN_MS; // 118 000

test("W1: antes da janela, o lance espera pelo início da janela", () => {
  const at = nextNpcReleaseAt({ now: 10_000, endsAt: ENDS_AT, lastReleaseAt: null, gapMs: 8000 });
  assert.equal(at, WINDOW_START);
});

test("W2: dentro da janela e sem lances anteriores, sai já", () => {
  const at = nextNpcReleaseAt({ now: 100_000, endsAt: ENDS_AT, lastReleaseAt: null, gapMs: 8000 });
  assert.equal(at, 100_000);
});

test("W3: o lance seguinte respeita o intervalo sorteado após o último lance de NPC", () => {
  const gap = 7500;
  const at = nextNpcReleaseAt({ now: 95_000, endsAt: ENDS_AT, lastReleaseAt: 95_000, gapMs: gap });
  assert.equal(at, 95_000 + gap);
  // com o último lance em 91 s e gap de 6 s, o próximo cai em 97 s (não antes)
  const at2 = nextNpcReleaseAt({ now: 91_000, endsAt: ENDS_AT, lastReleaseAt: 91_000, gapMs: 6000 });
  assert.equal(at2, 97_000);
});

test("W4: sem tempo antes da margem de fecho devolve null", () => {
  assert.equal(nextNpcReleaseAt({ now: 119_000, endsAt: ENDS_AT, lastReleaseAt: null, gapMs: 8000 }), null);
  // gap empurra o lance para depois do fecho
  assert.equal(nextNpcReleaseAt({ now: 110_000, endsAt: ENDS_AT, lastReleaseAt: 112_000, gapMs: 8000 }), null);
  // e o último instante permitido ainda conta
  assert.equal(nextNpcReleaseAt({ now: CLOSE_AT - 1, endsAt: ENDS_AT, lastReleaseAt: null, gapMs: 8000 }), CLOSE_AT - 1);
});

test("W5: constantes da janela e do espaçamento", () => {
  assert.equal(AUCTION_NPC_WINDOW_MS, 30_000);
  assert.equal(AUCTION_NPC_GAP_MIN_MS, 6_000);
  assert.equal(AUCTION_NPC_GAP_MAX_MS, 10_000);
  assert.ok(AUCTION_NPC_CLOSE_MARGIN_MS > 0 && AUCTION_NPC_CLOSE_MARGIN_MS < AUCTION_NPC_WINDOW_MS);
});
