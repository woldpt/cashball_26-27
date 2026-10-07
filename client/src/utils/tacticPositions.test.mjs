/**
 * Teste das posições da tática (corre com `node`).
 *
 *   node client/src/utils/tacticPositions.test.mjs
 */
import assert from "node:assert/strict";
import { buildClearedTactic, countStatus } from "./tacticPositions.js";

const squad = [{ id: 1 }, { id: 2 }, { id: 3 }];

// 1. Formação preservada.
{
  const t = buildClearedTactic({ formation: "4-3-3", style: "Offensive", positions: { 1: "Titular" } }, squad);
  assert.equal(t.formation, "4-3-3");
  assert.equal(t.style, "Offensive");
}

// 2. Formação vazia ou inválida → "4-4-2".
assert.equal(buildClearedTactic({ formation: "" }, squad).formation, "4-4-2");
assert.equal(buildClearedTactic({ formation: "9-9-9" }, squad).formation, "4-4-2");
assert.equal(buildClearedTactic(undefined, squad).formation, "4-4-2");

// 3. Todas as posições "Excluído" e todos os ids do plantel cobertos.
{
  const t = buildClearedTactic({ formation: "4-4-2", positions: { 99: "Titular" } }, squad);
  assert.deepEqual(Object.keys(t.positions).sort(), ["1", "2", "3"]);
  assert.ok(Object.values(t.positions).every((v) => v === "Excluído"));
}

// 4. Fantasma (fora do plantel) não conta; excludeId respeitado.
{
  const ids = new Set([1, 2, 3]);
  const pos = { 1: "Titular", 2: "Titular", 77: "Titular", 3: "Suplente" };
  assert.equal(countStatus(pos, "Titular", ids), 2);
  assert.equal(countStatus(pos, "Titular", ids, 1), 1);
  assert.equal(countStatus(pos, "Suplente", ids, 3), 0);
  assert.equal(countStatus(undefined, "Titular", ids), 0);
}

console.log("tacticPositions: OK");
