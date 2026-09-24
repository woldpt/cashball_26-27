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
  // Snapshot final: [...XI (11), ...banco] — quem saiu já não está, quem
  // entrou herdou o slot do titular (troca no lugar).
  { id: 1, name: "GR Limpo", position: "GR" },
  { id: 2, name: "Defesa Limpo", position: "DEF" },
  { id: 3, name: "Golador", position: "ATA" },
  { id: 5, name: "Amarelado", position: "MED" },
  { id: 6, name: "Expulso", position: "DEF" },
  { id: 9, name: "Reforço HT", position: "MED" },
  { id: 10, name: "Titular 7", position: "DEF" },
  { id: 11, name: "Titular 8", position: "DEF" },
  { id: 12, name: "Titular 9", position: "MED" },
  { id: 13, name: "Titular 10", position: "ATA" },
  { id: 14, name: "Titular 11", position: "ATA" },
  { id: 20, name: "Banco 1", position: "GR" },
  { id: 21, name: "Banco 2", position: "DEF" },
  { id: 22, name: "Banco 3", position: "DEF" },
  { id: 23, name: "Banco 4", position: "MED" },
  { id: 24, name: "Banco 5", position: "MED" },
  { id: 25, name: "Banco 6", position: "ATA" },
  { id: 26, name: "Banco 7", position: "ATA" },
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
assert(byId.get(1)?.starter === true && byId.get(14)?.starter === true, "XI fica no relvado (starter)");
assert(byId.get(9)?.starter === false, "suplente entrado (no slot do XI no snapshot) fica marcado como não titular");
assert(
  [20, 21, 22, 23, 24, 25, 26].every((id) => !byId.has(id)),
  "banco que não entrou não tem classificação (mantém last_rating anterior)",
);

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
