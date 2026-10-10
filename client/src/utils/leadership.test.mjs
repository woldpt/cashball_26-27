// Regressão da liderança no cliente — os mesmos casos do U34 do servidor
// (server/scripts/engineUnitRegression.mts): as duas fórmulas têm de bater.
import assert from "node:assert/strict";
import { leadershipOf, rankCaptains } from "./leadership.js";

const vet = { id: 1, name: "Vet", age: 30, career_games: 60, skill: 40, morale: 25 };
const kid = { id: 2, name: "Miúdo", age: 18, career_games: 0, skill: 40, morale: 25 };
assert.equal(leadershipOf(vet, 30), 5);
assert.equal(leadershipOf(kid, 30), 1);
assert.ok(leadershipOf({ ...vet, morale: 5 }, 30) < 5);
assert.ok(leadershipOf({ ...vet, career_games: 0 }, 30) < 5);
assert.ok(leadershipOf({ ...vet, skill: 20 }, 30) < 5);

assert.deepEqual(rankCaptains([kid, vet]).captain, { id: 1, name: "Vet", lead: 4, auto: true });
assert.equal(rankCaptains([kid, vet], 2).captain.id, 2);
assert.equal(rankCaptains([kid, vet], 2).captain.auto, false);
assert.equal(rankCaptains([kid, vet], 99).captain.id, 1, "escolhido fora do onze → automático");
assert.equal(rankCaptains([{ ...vet, id: 9 }, { ...vet, id: 4 }]).captain.id, 4);
assert.equal(rankCaptains([]).captain, null);

console.log("leadership: OK");
