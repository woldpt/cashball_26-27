// Regressão das funções puras da vista live (feed, remates, cansaço).
import assert from "node:assert/strict";
import { liveFeed, liveScore, liveShots, tiredPlayers } from "./liveHelpers.js";

const events = [
  { minute: 1, type: "weather", team: null, emoji: "☀️", text: "[1'] ☀️ Sol radioso." },
  { minute: 1, type: "betting", team: null, text: "[1'] 2.10 / 3.20 / 3.50" },
  { minute: 10, type: "chance", team: "home", text: "[10'] 🧤 Defesa apertada." },
  { minute: 12, type: "tactic_change", team: "away", text: "[12'] Mudança para 4-4-2." },
  { minute: 20, type: "goal", team: "home", playerId: 1, playerName: "Silva", text: "[20'] ⚽ Golo de Silva!" },
  { minute: 20, type: "near_miss", team: "away", text: "[20'] 🥅 Ao poste!" },
  { minute: 30, type: "own_goal", team: "away", playerId: 2, text: "[30'] ⚽ Auto-golo." },
  { minute: 31, type: "red", team: "home", playerId: 3, text: "[31'] 🟥 Expulso." },
  { minute: 50, type: "goal", team: "home", playerId: 1, text: "[50'] ⚽ Bis!" },
];

// Resultado e remates até ao minuto (auto-golo conta no resultado, não nos remates).
assert.deepEqual(liveScore(events, 40), { home: 1, away: 1 });
assert.deepEqual(liveShots(events, 40), { home: 2, away: 1 });
assert.deepEqual(liveShots(events, 90), { home: 3, away: 1 });

// Feed: sem odds nem lances futuros, mais recente primeiro (mesmo minuto: último a chegar primeiro).
const feed = liveFeed(events, 40);
assert.equal(feed.length, 7);
assert.equal(feed[0].event.type, "red");
assert.equal(feed[2].event.type, "near_miss");
assert.equal(feed[3].event.type, "goal");
assert.equal(feed[3].icon, "⚽");
assert.equal(feed[3].phrase, "Golo de Silva!");
// Sem emoji: a 1.ª palavra não é comida.
assert.equal(feed.find((r) => r.event.type === "tactic_change").phrase, "Mudança para 4-4-2.");
assert.equal(feed.at(-1).icon, "☀️");

// Cansaço: só em campo, sem expulsos, ≥ limiar, mais cansado primeiro, top 2.
const lineup = [
  { id: 1, name: "A", is_starter: true, fatigueLoss: 3 },
  { id: 3, name: "Expulso", is_starter: true, fatigueLoss: 5 },
  { id: 4, name: "B", is_starter: true, fatigueLoss: 4 },
  { id: 5, name: "Banco", is_starter: false, fatigueLoss: 6 },
  { id: 6, name: "C", is_starter: true, fatigueLoss: 3 },
  { id: 7, name: "Fresco", is_starter: true, fatigueLoss: 1 },
];
assert.deepEqual(tiredPlayers(lineup, events, 40).map((p) => p.id), [4, 1]);
assert.deepEqual(tiredPlayers(lineup, events, 20).map((p) => p.id), [3, 4]);

console.log("liveHelpers: OK");
