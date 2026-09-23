/**
 * Regression test — classificação 1–5★ pós-jogo (game/ratings.ts).
 *
 * Cobre: base 3★ para quem entra em campo, conversão dos pesos MOM
 * (golo→5★, amarelo→2★, vermelho→1★), clamp 1–5, exclusão de juniores,
 * participantes via eventos de substituição e agrupamento dos UPDATEs
 * de `last_rating`.
 *
 * Run: cd server && npm run test:ratings
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { computeMatchRatings, persistLastRatings } = require("../game/ratings.ts") as {
  computeMatchRatings: typeof import("../game/ratings").computeMatchRatings;
  persistLastRatings: typeof import("../game/ratings").persistLastRatings;
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

const lineup = [
  // Snapshot final: quem saiu ao intervalo já não está, quem entrou está.
  { id: 1, name: "GR Limpo", position: "GR" },
  { id: 2, name: "Defesa Limpo", position: "DEF" },
  { id: 3, name: "Golador", position: "ATA" },
  { id: 5, name: "Amarelado", position: "MED" },
  { id: 6, name: "Expulso", position: "DEF" },
  { id: 9, name: "Reforço HT", position: "MED" },
  { id: -7, name: "Júnior GR", position: "GR" },
];
const events = [
  { team: "home", type: "goal", playerId: 3, playerName: "Golador" },
  { team: "home", type: "yellow", playerId: 5, playerName: "Amarelado" },
  { team: "home", type: "red", playerId: 6, playerName: "Expulso" },
  // Evento do adversário não conta.
  { team: "away", type: "goal", playerId: 99, playerName: "Adversário" },
  // Suplente entra em jogo; troca ao intervalo (o 4 saiu do snapshot).
  { team: "home", type: "substitution", playerId: 8, playerName: "Bancada" },
  { team: "home", type: "halftime_sub", playerId: 9, outPlayerId: 4, outPlayerName: "Cavalheiro" },
];

const { home } = computeMatchRatings({
  events,
  homeLineup: lineup,
  awayLineup: [],
});
const byId = new Map(home.map((r) => [r.id, r]));

assert(byId.get(1)?.stars === 3, "titular sem eventos fica com a base 3★");
assert(byId.get(3)?.stars === 5, "golador sobe para 5★");
assert(byId.get(5)?.stars === 2, "amarelo desce para 2★");
assert(byId.get(6)?.stars === 1, "vermelho desce para 1★ (mínimo)");
assert(!byId.has(-7), "junior (id negativo) fica de fora");
assert(byId.has(4), "quem saiu ao intervalo já não está no snapshot mas conta (outPlayerId)");
assert(byId.has(9), "quem entrou ao intervalo conta via snapshot");
assert(byId.get(8)?.stars === 3 && byId.get(8)?.starter === false, "suplente entrado conta, marcado como não titular");

// Clamp: dois golos não passam do teto.
const two = computeMatchRatings({
  events: [
    { team: "home", type: "goal", playerId: 3 },
    { team: "home", type: "penalty_goal", playerId: 3 },
  ],
  homeLineup: lineup,
  awayLineup: [],
}).home.find((r) => r.id === 3);
assert(two?.stars === 5, "dois golos ficam no teto 5★");

// persistLastRatings agrupa os UPDATEs por número de estrelas.
const sqls: Array<{ sql: string; params: any[] }> = [];
persistLastRatings(
  {
    run(sql: string, params: any[]) {
      sqls.push({ sql, params });
    },
  },
  { events, homeLineup: lineup, awayLineup: [] },
);
const five = sqls.find((s) => s.params[0] === 5);
assert(!!five && five.params.includes(3) && five.sql.includes("last_rating = ?"), "5★ agrupados num só UPDATE");
assert(sqls.length <= 10, "no máximo 5 UPDATEs por equipa");
assert(sqls.every((s) => s.sql.includes("UPDATE players SET last_rating")), "só toca a coluna last_rating");

console.log("PASS");
