// Regressão das funções puras da vista live (feed, resultado).
import assert from "node:assert/strict";
import { liveFeed, liveMomentum, liveScore, matchVerdict } from "./liveHelpers.js";

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

// Resultado até ao minuto (auto-golo conta no resultado).
assert.deepEqual(liveScore(events, 40), { home: 1, away: 1 });

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

// Ímpeto: quem marcou fica por cima 8' (o auto-golo conta para a equipa beneficiada).
assert.deepEqual(liveMomentum(events, 22), { team: "home", minutesLeft: 6 });
assert.equal(liveMomentum(events, 28), null);
assert.deepEqual(liveMomentum(events, 30), { team: "away", minutesLeft: 8 });
assert.equal(liveMomentum([{ minute: 10, type: "var_disallowed", team: "home" }], 12), null);
// Capitães: a duração vem no golo (3' com bom capitão de quem sofreu, 13' com mau).
assert.equal(liveMomentum([{ minute: 10, type: "goal", team: "home", momentumMinutes: 3 }], 13), null);
assert.deepEqual(liveMomentum([{ minute: 10, type: "goal", team: "home", momentumMinutes: 13 }], 20), { team: "home", minutesLeft: 3 });

// Leitura do jogo: quem criou mais e não ganhou → falta de pontaria.
const names = { home: "Benfica", away: "Porto" };
const shots = (team, n, xg) => Array.from({ length: n }, (_, i) => ({ minute: 5 + i, type: "chance", team, xg }));
assert.deepEqual(matchVerdict([...shots("home", 10, 0.2), { minute: 60, type: "goal", team: "away", xg: 0.3 }], names), [
  "Benfica criou mais (2,0 contra 0,3 golos esperados), mas faltou pontaria.",
]);
// Expulsão cedo vem primeiro; jogo equilibrado mostra as duas equipas.
assert.deepEqual(
  matchVerdict([{ minute: 30, type: "red", team: "away" }, { minute: 50, type: "goal", team: "home", xg: 0.4 }, ...shots("away", 1, 0.3)], names),
  ["Porto jogou com 10 desde os 30' e pagou caro.", "Jogo equilibrado (Benfica 0,4 · Porto 0,3 em golos esperados), decidido nos detalhes."],
);
// Golo no embalo de outro.
assert.equal(
  matchVerdict([{ minute: 10, type: "goal", team: "home", xg: 0.4 }, { minute: 15, type: "goal", team: "home", xg: 0.4 }], names)[1],
  "Benfica aproveitou o embalo: voltou a marcar poucos minutos depois de um golo.",
);
// Sem xg (jogos antigos): nada.
assert.deepEqual(matchVerdict([{ minute: 10, type: "goal", team: "home" }], names), []);

console.log("liveHelpers: OK");
