/**
 * Regression — notícias de evolução do Jornal (hat-trick e marcos de golos).
 * Run: cd server && npm run test:progress-news
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { findHattricks, goalMilestoneFor } = require("../progressNewsHelpers.ts") as typeof import("../progressNewsHelpers");

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

const g = (team: string, playerId: number, type = "goal") => ({ type, team, playerId, playerName: `P${playerId}` });
const hat = findHattricks([g("home", 1), g("home", 1), g("home", 1, "penalty_goal"), g("away", 2), g("away", 2), g("home", -5), { type: "own_goal", team: "away", playerId: 3 }]);
assert(hat.length === 1 && hat[0].playerId === 1 && hat[0].goals === 3 && hat[0].side === "home", "3 golos (incl. penálti) = hat-trick; 2 golos e auto-golos não");
assert(findHattricks(undefined as any).length === 0, "sem eventos não rebenta");
assert(goalMilestoneFor(49) === 0 && goalMilestoneFor(50) === 50 && goalMilestoneFor(137) === 100, "limiares múltiplos de 50");
