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
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankNpcBuyTargets } from "../npcSquadPlanning";
import { signingWage } from "../gameConstants";

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
