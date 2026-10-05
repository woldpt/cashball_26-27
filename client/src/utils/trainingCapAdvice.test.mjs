/**
 * Teste do aviso de teto do treino (corre com `node`).
 *
 *   node client/src/utils/trainingCapAdvice.test.mjs
 */
import assert from "node:assert/strict";
import { trainingCapTip, trainingLowTip } from "./trainingCapAdvice.js";

const squad = (n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    form: 32,
    resistance: 26,
    ...extra,
  }));

// 1. Foco de skill nunca avisa (o teto é de Forma/Resistência).
{
  assert.equal(trainingCapTip(squad(10, { skill: 50 }), "Defesas"), null);
  assert.equal(trainingCapTip(squad(10), null), null);
  assert.equal(trainingCapTip(squad(10), "Forma inválida"), null);
}

// 2. Forma: 7 de 10 no teto (70%) avisa; 6 de 10 (60%) não.
{
  const at70 = [
    ...squad(7, { form: 50 }),
    ...squad(3, { form: 44 }),
  ];
  assert.equal(trainingCapTip(at70, "Forma").id, "trainingcap");
  assert.match(trainingCapTip(at70, "Forma").text, /^Foco na Forma\?.*teto/);

  const at60 = [...squad(6, { form: 50 }), ...squad(4, { form: 44 })];
  assert.equal(trainingCapTip(at60, "Forma"), null);
}

// 3. Resistência usa o campo e o teto dela (form no teto não conta).
{
  const res = [
    ...squad(8, { resistance: 50, form: 50 }),
    ...squad(2, { resistance: 49, form: 32 }),
  ];
  assert.match(
    trainingCapTip(res, "Resistência").text,
    /^Foco na Resistência\?.*teto/,
  );
  assert.equal(trainingCapTip([...squad(8, { form: 50 }), ...squad(2, {})], "Resistência"), null);
}

// 4. Sem valores no plantel (ou plantel vazio) não avisa.
{
  assert.equal(trainingCapTip([], "Forma"), null);
  assert.equal(trainingCapTip([{ id: 1 }, { id: 2 }], "Forma"), null);
}

// 5. A dica aponta para o Treino e traz CTA.
{
  const tip = trainingCapTip(squad(10, { form: 50 }), "Forma");
  assert.equal(tip.tab, "training");
  assert.equal(tip.cta, "Mudar foco");
  assert.equal(tip.mood, "worried");
}

// 6. Forma/Resistência baixas: avisa o mais baixo, cala-se se já é o foco.
{
  assert.equal(trainingLowTip(squad(10), null), null);
  const low = squad(10, { form: 15, resistance: 10 });
  assert.match(trainingLowTip(low, null).text, /Resistência/);
  assert.match(trainingLowTip(low, "Resistência").text, /Forma/);
  assert.equal(trainingLowTip(squad(10, { form: 15 }), "Forma"), null);
  assert.equal(trainingLowTip(squad(10, { form: 20 }), null), null);
}

console.log("trainingCapAdvice: 6 grupos de asserções OK");
