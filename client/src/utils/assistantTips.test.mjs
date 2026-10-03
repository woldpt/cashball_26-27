/**
 * Teste das dicas do treinador-adjunto (corre com `node`).
 *
 *   node client/src/utils/assistantTips.test.mjs
 *
 * O que trava: a ORDEM de prioridade, o formato das chaves de visto (mudá-lo
 * faz reaparecer todas as dicas já vistas em produção), o gate do onze, os
 * limiares e o anti-Clippy (nunca na tab que resolve).
 */
import assert from "node:assert/strict";
import { FANS_MOOD_LOW } from "../constants/index.js";
import { NAV_GROUPS } from "../constants/navigation.js";
import {
  ASSISTANT_TIP_IDS,
  buildAssistantTips,
  pickAssistantTip,
  seenKeyFor,
} from "./assistantTips.js";

const squad = (n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    form: 32,
    resistance: 26,
    ...extra,
  }));

/** Plantel com 70% no teto da Forma e 3 indisponíveis (lesão). */
const squadAtTeto = [
  ...squad(7, { form: 50 }),
  ...squad(3, { form: 44, injury_until_matchweek: 9 }),
];

/** Estado em que TODAS as 7 dicas disparam. */
const allFiring = {
  squad: squadAtTeto,
  matchweek: 3,
  hasRedFlag: true,
  hasTraining: false,
  focusName: "Forma",
  fansMood: 10,
  currentBudget: 1000,
  totalWeeklyWage: 200000,
  isLineupComplete: false,
  lineupEligible: true,
};

/** Estado em que NENHUMA dispara (plantel são, treino feito, cofre cheio). */
const calm = {
  squad: squad(10),
  matchweek: 3,
  hasRedFlag: false,
  hasTraining: true,
  focusName: null,
  fansMood: 30,
  currentBudget: 500000,
  totalWeeklyWage: 200000,
  isLineupComplete: true,
  lineupEligible: false,
};

/** `calm` com n indisponíveis. */
const hurt = (n) => ({
  ...calm,
  squad: [...squad(10 - n), ...squad(n, { injury_until_matchweek: 9 })],
});

// 1. Catálogo: ordem de prioridade e ids únicos, com texto/CTA/tab em todas.
{
  assert.deepEqual(ASSISTANT_TIP_IDS, [
    "redflag",
    "lineup",
    "training",
    "trainingcap",
    "medical",
    "wage",
    "fans",
  ]);
  assert.equal(new Set(ASSISTANT_TIP_IDS).size, ASSISTANT_TIP_IDS.length);
  assert.equal(buildAssistantTips(allFiring).length, ASSISTANT_TIP_IDS.length);
  for (const tip of buildAssistantTips(allFiring)) {
    assert.ok(tip.text?.length > 10, `texto curto em ${tip.id}`);
    assert.ok(tip.cta?.length > 2, `CTA curta em ${tip.id}`);
    assert.ok(tip.tab?.length > 2, `tab em falta em ${tip.id}`);
    assert.ok(["worried", "sad"].includes(tip.mood), `mood em ${tip.id}`);
  }
}

// 2. Chaves de visto: formato estável de produção.
{
  assert.equal(seenKeyFor("AB12", 7, "wage"), "cashball_assistant:AB12:7:wage");
  assert.equal(
    seenKeyFor("AB12", 7, "lineup"),
    "cashball_assistant:AB12:sala:lineup",
  );
  assert.equal(seenKeyFor(undefined, undefined, "wage"), "cashball_assistant:?:0:wage");
  assert.equal(
    seenKeyFor("AB12", undefined, "lineup"),
    "cashball_assistant:AB12:sala:lineup",
  );
}

// 3. Prioridade: desligando o que bloqueia o Pronto, desce na ordem.
{
  const off = (over) => ({ ...allFiring, ...over });
  assert.equal(pickAssistantTip(allFiring)?.id, "redflag");
  assert.equal(pickAssistantTip(off({ hasRedFlag: false }))?.id, "lineup");
  assert.equal(
    pickAssistantTip(off({ hasRedFlag: false, lineupEligible: false }))?.id,
    "training",
  );
  assert.equal(
    pickAssistantTip(
      off({ hasRedFlag: false, lineupEligible: false, hasTraining: true }),
    )?.id,
    "trainingcap",
  );
  assert.equal(
    pickAssistantTip(
      off({
        hasRedFlag: false,
        lineupEligible: false,
        hasTraining: true,
        focusName: null,
      }),
    )?.id,
    "medical",
  );
  // Plantel são: cai na do salário; cofre a chegar, cai na dos adeptos.
  const noHurtAndNoCap = off({
    hasRedFlag: false,
    lineupEligible: false,
    hasTraining: true,
    focusName: null,
    squad: squad(10),
  });
  assert.equal(pickAssistantTip(noHurtAndNoCap)?.id, "wage");
  assert.equal(
    pickAssistantTip({ ...noHurtAndNoCap, currentBudget: 500000 })?.id,
    "fans",
  );
  assert.equal(
    pickAssistantTip({
      ...noHurtAndNoCap,
      currentBudget: 500000,
      fansMood: 30,
    }),
    null,
  );
}

// 4. Gate do onze: sem inatividade (ou com o 11 fechado) não chateia.
{
  assert.equal(
    pickAssistantTip({ ...allFiring, hasRedFlag: false, lineupEligible: false })
      ?.id,
    "training",
  );
  assert.equal(
    pickAssistantTip({ ...allFiring, hasRedFlag: false, isLineupComplete: true })
      ?.id,
    "training",
  );
}

// 5. Anti-Clippy: a dica nunca aponta para a tab onde o jogador já está, e
//    uma já vista sai de cena (a próxima da fila assume).
{
  assert.equal(pickAssistantTip(allFiring, { activeTab: "jornal" })?.id, "lineup");
  assert.equal(
    pickAssistantTip(allFiring, { seenIds: new Set(["redflag", "lineup"]) })?.id,
    "training",
  );
  assert.equal(
    pickAssistantTip(allFiring, { seenIds: new Set(ASSISTANT_TIP_IDS) }),
    null,
  );
  for (const tip of buildAssistantTips(allFiring)) {
    assert.notEqual(
      pickAssistantTip(allFiring, { activeTab: tip.tab })?.tab,
      tip.tab,
    );
  }
}

// 6. Limiares: enfermaria aos 3 indisponíveis, adeptos abaixo de FANS_MOOD_LOW.
{
  assert.equal(pickAssistantTip(hurt(2)), null);
  assert.equal(pickAssistantTip(hurt(3))?.id, "medical");
  assert.equal(pickAssistantTip({ ...calm, fansMood: FANS_MOOD_LOW }), null);
  assert.equal(
    pickAssistantTip({ ...calm, fansMood: FANS_MOOD_LOW - 1 })?.id,
    "fans",
  );
}

// 7. Estado vazio/parcial nunca rebenta nem inventa dicas.
{
  assert.equal(pickAssistantTip(undefined), null);
  assert.equal(pickAssistantTip({}), null);
  assert.equal(pickAssistantTip(calm, {}), null);

  // 8. Toda a tab do catálogo tem de ser navegável (`navigateTab`) — hoje um
  //    typo não dava erro, só não navegava. `tactic` não vive nos NavGroups.
  const known = new Set([
    ...NAV_GROUPS.flatMap((g) => g.tabs.map((t) => t.key)),
    "tactic",
  ]);
  for (const tip of buildAssistantTips(allFiring)) {
    assert.ok(known.has(tip.tab), `tab desconhecida "${tip.tab}" em ${tip.id}`);
  }
}

console.log("assistantTips: 8 grupos de asserções OK");
