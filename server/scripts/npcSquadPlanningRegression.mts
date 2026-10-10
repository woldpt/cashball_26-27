/**
 * Regression — decisões de plantel dos NPCs (npcSquadPlanning.ts).
 *
 * Antes: compravam o jogador de maior qualidade que coubesse em 70% do
 * orçamento, sem ver a posição nem o ordenado.
 *
 *   B1 — sem 2.º GR, o GR vem primeiro mesmo havendo um avançado melhor
 *   B2 — posição cheia não recebe mais ninguém
 *   B3 — o preço cabe mas preço + ordenados não: não compra
 *   B4 — abaixo do piso de qualidade ou da própria equipa: fora
 *   B5 — pedido acima de NPC_BUY_MAX_VALUE_RATIO × valor: fora (um humano
 *        vendia a NPC por 5× o valor)
 *
 * Antes: com o plantel cheio ia à lista o mais fraco, de qualquer posição, ao
 * valor de tabela; e a renovação só olhava à qualidade.
 *
 *   S1 — com 5 defesas nenhum defesa vai à lista (sai o que sobra noutra linha)
 *   S2 — quem está ao nível da divisão sai com sobrepreço
 *   S3 — venda de oportunidade: o melhor dos que sobram, nunca um titular
 *   S4 — plantel curto ou sem ninguém a sobrar: não lista
 *   R1 — fraco renova se a posição ficar abaixo do mínimo sem ele
 *
 * Antes: o onze saía pela qualidade base (a forma, que conta no jogo, era
 * ignorada) e a formação pela média de cada sector, suplentes incluídos.
 *
 *   L1 — o melhor em baixo de forma perde o lugar para um colega em forma
 *   L2 — plantel forte em médios joga com 5 médios, mesmo com suplentes fracos
 *   L3 — lesionado não joga; banco com 1 GR e no máximo MAX_BENCH_SIZE
 *
 * Antes: o NPC rico construía todas as semanas, com ou sem adeptos.
 *
 *   E1 — só constrói com massa adepta acima da lotação
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankNpcBuyTargets, pickNpcListing, npcShouldRenew, npcShouldBuildStadium } from "../npcSquadPlanning";
import {
  signingWage,
  NPC_BUY_MAX_VALUE_RATIO,
  NPC_LIST_MARKET_PREMIUM,
  NPC_OPPORTUNITY_SALE_PREMIUM,
  MAX_BENCH_SIZE,
} from "../gameConstants";
import { pickAiLineup } from "../game/matchCalculations";

let nextId = 1;
const player = (position: string, skill: number, extra: Record<string, any> = {}) => ({
  id: nextId++,
  position,
  skill,
  value: skill * 1000,
  wage: skill * 20,
  team_id: 99,
  transfer_status: "none",
  transfer_price: 0,
  ...extra,
});
const squadOf = (counts: Record<string, number>, skill = 30, teamId = 1) =>
  Object.entries(counts).flatMap(([pos, n]) =>
    Array.from({ length: n }, () => player(pos, skill, { team_id: teamId })),
  );
const listed = (position: string, skill: number, price: number) =>
  player(position, skill, { transfer_status: "fixed", transfer_price: price });

const buy = (squad: any[], market: any[], budget = 1_000_000, weeksLeft = 10) =>
  rankNpcBuyTargets({ teamId: 1, squad, market, budget, weeksLeft, floorSkill: 20 });

test("B1: sem 2.º GR, o GR vem antes de um avançado melhor", () => {
  const squad = squadOf({ GR: 1, DEF: 6, MED: 6, ATA: 5 });
  const gr = listed("GR", 25, 20_000);
  const ata = listed("ATA", 45, 20_000);
  assert.deepEqual(buy(squad, [ata, gr]).map((t) => t.player.id), [gr.id, ata.id]);
});

test("B2: posição cheia não recebe mais ninguém", () => {
  const squad = squadOf({ GR: 3, DEF: 6, MED: 6, ATA: 5 });
  assert.equal(buy(squad, [listed("GR", 45, 20_000)]).length, 0);
});

test("B3: o preço cabe, preço + ordenados não", () => {
  const squad = squadOf({ GR: 2, DEF: 6, MED: 6, ATA: 5 });
  const p = listed("MED", 40, 30_000);
  const wage = signingWage(p);
  assert.equal(buy(squad, [p], 100_000, 0).length, 1);
  const weeks = Math.ceil((50_000 - 30_000) / wage) + 1;
  assert.equal(buy(squad, [p], 100_000, weeks).length, 0);
});

test("B4: abaixo do piso ou da própria equipa fica de fora", () => {
  const squad = squadOf({ GR: 2, DEF: 6, MED: 6, ATA: 5 });
  const own = listed("MED", 40, 10_000);
  own.team_id = 1;
  assert.equal(buy(squad, [listed("MED", 19, 10_000), own]).length, 0);
});

test("B5: pedido acima do máximo sobre o valor fica de fora", () => {
  const squad = squadOf({ GR: 2, DEF: 6, MED: 6, ATA: 5 });
  const value = 30 * 1000;
  const fair = listed("MED", 30, Math.floor(value * NPC_BUY_MAX_VALUE_RATIO));
  const greedy = listed("MED", 30, value * 5);
  assert.deepEqual(buy(squad, [greedy, fair]).map((t) => t.player.id), [fair.id]);
});

const list = (squad: any[], rolls: number[], divisionLevel = 100) => {
  const queue = [...rolls];
  return pickNpcListing({
    squad,
    eligibleIds: new Set(squad.map((p) => p.id)),
    divisionLevel,
    rng: () => queue.shift() ?? 0.99,
  });
};
// Sorteios: 1.º = venda de oportunidade (< 0,05 dispara), 2.º = plantel cheio.
const NORMAL = [0.9, 0.0];
const OPPORTUNITY = [0.0];

test("S1: com 5 defesas nenhum defesa vai à lista", () => {
  const squad = [
    ...squadOf({ GR: 2, DEF: 5, ATA: 4 }, 10),
    ...squadOf({ MED: 6 }, 30),
  ];
  const med = squad.find((p) => p.position === "MED")!;
  med.skill = 28;
  const out = list(squad, NORMAL);
  assert.equal(out?.player.id, med.id);
  assert.equal(out?.price, med.value);
});

test("S2: quem está ao nível da divisão sai com sobrepreço", () => {
  const squad = squadOf({ GR: 2, DEF: 5, MED: 6, ATA: 4 }, 30);
  const out = list(squad, NORMAL, 30);
  assert.equal(out?.price, Math.round(out!.player.value * NPC_LIST_MARKET_PREMIUM));
});

test("S3: venda de oportunidade leva o melhor suplente, nunca um titular", () => {
  const squad = squadOf({ GR: 2, DEF: 7, MED: 5, ATA: 4 }, 30);
  const defs = squad.filter((p) => p.position === "DEF");
  defs.forEach((p, i) => (p.skill = 40 - i)); // 40..34: sobram o 35 e o 34
  const out = list(squad, OPPORTUNITY);
  assert.equal(out?.player.skill, 35);
  assert.equal(out?.price, Math.round(out!.player.value * NPC_OPPORTUNITY_SALE_PREMIUM));
});

test("S4: plantel curto ou sem ninguém a sobrar não lista", () => {
  assert.equal(list(squadOf({ GR: 2, DEF: 5, MED: 5, ATA: 4 }), OPPORTUNITY), null);
  assert.equal(list(squadOf({ GR: 2, DEF: 4, MED: 4, ATA: 2 }), NORMAL), null);
  // 12 jogadores com um a sobrar: abaixo do 1.º limiar de plantel cheio.
  assert.equal(list(squadOf({ GR: 1, DEF: 6, MED: 3, ATA: 2 }), NORMAL), null);
});

test("R1: fraco renova se a posição ficar abaixo do mínimo sem ele", () => {
  const weak = { skill: 10, squadAvgSkill: 30 };
  assert.equal(npcShouldRenew({ ...weak, position: "GR", positionCount: 2 }), true);
  assert.equal(npcShouldRenew({ ...weak, position: "GR", positionCount: 3 }), false);
  assert.equal(npcShouldRenew({ skill: 28, squadAvgSkill: 30, position: "GR", positionCount: 3 }), true);
});

test("L1: o melhor em baixo de forma perde o lugar", () => {
  const squad = squadOf({ GR: 2, DEF: 6, MED: 6, ATA: 2 }, 30);
  const star = player("ATA", 34, { form: 16 });
  const inForm = player("ATA", 30, { form: 40 });
  const { starters } = pickAiLineup([...squad, star, inForm]);
  const ids = starters.map((p) => p.id);
  assert.ok(ids.includes(inForm.id));
  assert.ok(!ids.includes(star.id));
});

test("L2: forte em médios joga com 5 médios, apesar dos suplentes fracos", () => {
  const squad = [
    ...squadOf({ GR: 2, DEF: 5, ATA: 2 }, 25),
    ...squadOf({ MED: 5 }, 40),
    ...squadOf({ MED: 3 }, 5), // puxavam a média dos médios para baixo
    ...squadOf({ ATA: 2 }, 30),
  ];
  const { formation, starters } = pickAiLineup(squad);
  assert.equal(starters.length, 11);
  assert.equal(formation.split("-")[1], "5");
});

test("L3: lesionado fica de fora; banco com 1 GR e tamanho máximo", () => {
  const squad = squadOf({ GR: 3, DEF: 8, MED: 8, ATA: 6 }, 30);
  const injured = player("ATA", 50, { injury_until_matchweek: 5 });
  const { starters, bench } = pickAiLineup([...squad, injured], 3);
  assert.ok(![...starters, ...bench].some((p) => p.id === injured.id));
  assert.equal(bench.filter((p) => p.position === "GR").length, 1);
  assert.equal(bench.length, MAX_BENCH_SIZE);
});

test("E1: NPC só constrói com massa adepta acima da lotação", () => {
  assert.equal(npcShouldBuildStadium({ stadium_capacity: 50000, fanbase: 35000 }), false);
  assert.equal(npcShouldBuildStadium({ stadium_capacity: 10000, fanbase: 10000 }), false);
  assert.equal(npcShouldBuildStadium({ stadium_capacity: 10000, fanbase: 12000 }), true);
  assert.equal(npcShouldBuildStadium({ stadium_capacity: 10000 }), false);
});
