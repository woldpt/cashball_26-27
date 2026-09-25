/**
 * Regression test — classificação 0–10 (com meias) pós-jogo (game/ratings.ts).
 *
 * Cobre: base por contributo (skill efetiva × forma × posição), temperos de
 * eventos (golo +1, amarelo −0,5, vermelho −2), arredondamento a meias,
 * clamp 0–10, exclusão de juniores, participantes via eventos de
 * substituição e agrupamento dos UPDATEs de `last_rating`.
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
  // A skill do snapshot já é a efetiva (com fadiga); a forma vem do roster.
  { id: 1, name: "GR Forte", position: "GR", skill: 40 },
  { id: 2, name: "Defesa Fraco", position: "DEF", skill: 10 },
  { id: 3, name: "Golador", position: "ATA", skill: 30 },
  { id: 5, name: "Amarelado", position: "MED", skill: 20 },
  { id: 6, name: "Expulso", position: "DEF", skill: 20 },
  { id: 9, name: "Reforço HT", position: "MED", skill: 33 },
  { id: 10, name: "Craque", position: "DEF", skill: 50 },
  { id: 11, name: "Azarado", position: "DEF", skill: 5 },
  { id: 12, name: "Deslocado", position: "ATA", skill: 30 },
  { id: 13, name: "Titular 10", position: "ATA", skill: 25 },
  { id: 14, name: "Titular 11", position: "ATA", skill: 25 },
  { id: 20, name: "Banco 1", position: "GR", skill: 30 },
  { id: 21, name: "Banco 2", position: "DEF", skill: 30 },
  { id: 22, name: "Banco 3", position: "DEF", skill: 30 },
  { id: 23, name: "Banco 4", position: "MED", skill: 30 },
  { id: 24, name: "Banco 5", position: "MED", skill: 30 },
  { id: 25, name: "Banco 6", position: "ATA", skill: 30 },
  { id: 26, name: "Banco 7", position: "ATA", skill: 30 },
  { id: -7, name: "Júnior GR", position: "GR", skill: 30 },
];
const roster = [
  { id: 1, name: "GR Forte", position: "GR", skill: 40, form: 32 },
  { id: 2, name: "Defesa Fraco", position: "DEF", skill: 10, form: 32 },
  { id: 3, name: "Golador", position: "ATA", skill: 30, form: 40 },
  { id: 4, name: "Cavalheiro", position: "MED", skill: 15, form: 32 },
  { id: 5, name: "Amarelado", position: "MED", skill: 20, form: 20 },
  { id: 6, name: "Expulso", position: "DEF", skill: 20, form: 32 },
  { id: 8, name: "Bancada", position: "MED", skill: 25, form: 32 },
  { id: 9, name: "Reforço HT", position: "MED", skill: 33, form: 32 },
  { id: 10, name: "Craque", position: "DEF", skill: 50, form: 50 },
  { id: 11, name: "Azarado", position: "DEF", skill: 5, form: 32 },
  { id: 12, name: "Deslocado", position: "DEF", skill: 30, form: 32 },
  { id: 13, name: "Titular 10", position: "ATA", skill: 25, form: 32 },
  { id: 14, name: "Titular 11", position: "ATA", skill: 25, form: 32 },
];
const events = [
  { team: "home", type: "goal", playerId: 3, playerName: "Golador" },
  { team: "home", type: "yellow", playerId: 5, playerName: "Amarelado" },
  { team: "home", type: "red", playerId: 6, playerName: "Expulso" },
  { team: "home", type: "injury", playerId: 11, playerName: "Azarado" },
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
  _homeFullRoster: roster,
});
const byId = new Map(home.map((r) => [r.id, r]));

assert(byId.get(1)?.stars === 8, "skill 40 neutro sem eventos = 8 (contributo puro)");
assert(byId.get(2)?.stars === 2, "skill 10 neutro sem eventos = 2");
assert(byId.get(3)?.stars === 8.5, "skill 30 em forma (7,5) + golo (+1) = 8,5");
assert(byId.get(5)?.stars === 2.5, "skill 20 em baixo de forma (3) + amarelo (−0,5) = 2,5");
assert(byId.get(6)?.stars === 2, "skill 20 (4) + vermelho (−2) = 2");
assert(byId.get(9)?.stars === 6.5, "skill 33 (6,6) arredonda a meias = 6,5");
assert(byId.get(10)?.stars === 10, "skill 50 no auge passa do teto e fica em 10");
assert(byId.get(11)?.stars === 0, "skill 5 (1) + lesão (−2) bate no piso 0");
assert(byId.get(12)?.stars === 4, "fora da posição de origem (×0,7): 4,2 → 4");
assert(
  (byId.get(2)?.stars ?? 0) < (byId.get(1)?.stars ?? 0),
  "skill 10 com jogo limpo continua abaixo do skill 40 apagado (propriedade Hattrick)",
);
assert(!byId.has(-7), "junior (id negativo) fica de fora");
assert(byId.has(4), "quem saiu ao intervalo já não está no snapshot mas conta (outPlayerId)");
assert(byId.get(4)?.stars === 3, "saído ao intervalo sem eventos: skill 15 = 3");
assert(byId.has(9), "quem entrou ao intervalo conta via snapshot");
assert(byId.get(8)?.stars === 5 && byId.get(8)?.starter === false, "suplente entrado conta pelo roster, marcado como não titular");
assert(byId.get(1)?.starter === true && byId.get(14)?.starter === true, "XI fica no relvado (starter)");
assert(byId.get(9)?.starter === false, "suplente entrado (no slot do XI no snapshot) fica marcado como não titular");
assert(
  [20, 21, 22, 23, 24, 25, 26].every((id) => !byId.has(id)),
  "banco que não entrou não tem classificação (mantém last_rating anterior)",
);

// persistLastRatings agrupa os UPDATEs por nota (agora com meias).
const sqls: Array<{ sql: string; params: any[] }> = [];
persistLastRatings(
  {
    run(sql: string, params: any[]) {
      sqls.push({ sql, params });
    },
  },
  { events, homeLineup: lineup, awayLineup: [], _homeFullRoster: roster },
);
const eightHalf = sqls.find((s) => s.params[0] === 8.5);
assert(!!eightHalf && eightHalf.params.includes(3) && eightHalf.sql.includes("last_rating = ?"), "8,5 agrupado num só UPDATE");
assert(sqls.length <= 42, "no máximo 21 notas distintas por equipa (escala de meias)");
assert(sqls.every((s) => s.sql.includes("UPDATE players SET last_rating")), "só toca a coluna last_rating");

console.log("PASS");
