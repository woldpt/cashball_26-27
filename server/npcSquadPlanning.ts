/**
 * npcSquadPlanning.ts — decisões de plantel dos NPCs (puro, sem BD nem sockets).
 * Os helpers de mercado/contratos/tática chamam estas funções; os testes também.
 */
import {
  signingWage,
  NPC_POS_MIN,
  NPC_POS_MAX,
  NPC_BUY_BUDGET_SHARE,
  NPC_BUY_BUDGET_SHARE_URGENT,
} from "./gameConstants";

type AnyRow = Record<string, any>;

/** Plantel principal por posição — juniores (ids negativos) não contam. */
export function countByPosition(squad: AnyRow[]): Record<string, number> {
  const counts: Record<string, number> = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
  for (const p of squad) {
    if (p.id > 0 && counts[p.position] !== undefined) counts[p.position]++;
  }
  return counts;
}

/**
 * Alvos de compra na lista de transferências, por ordem de preferência:
 * primeiro a posição em falta, depois a mais curta, e dentro dela o melhor.
 * Fica de fora quem não chega ao piso, quem joga numa posição cheia e quem
 * não cabe no orçamento com os ordenados até ao fim da época.
 */
export function rankNpcBuyTargets(args: {
  teamId: number;
  squad: AnyRow[];
  market: AnyRow[];
  budget: number;
  weeksLeft: number;
  floorSkill: number;
}): Array<{ player: AnyRow; price: number }> {
  const { teamId, squad, market, budget, weeksLeft, floorSkill } = args;
  const counts = countByPosition(squad);
  const urgent = (pos: string) => (counts[pos] ?? 0) < (NPC_POS_MIN[pos] ?? 3);
  const fill = (pos: string) => (counts[pos] ?? 0) / (NPC_POS_MAX[pos] ?? 8);

  const targets: Array<{ player: AnyRow; price: number }> = [];
  for (const player of market) {
    if (player.team_id === teamId) continue;
    if ((player.skill || 0) < floorSkill) continue;
    const pos = player.position;
    if ((counts[pos] ?? 0) >= (NPC_POS_MAX[pos] ?? 8)) continue;

    const listed =
      player.transfer_price > 0 ? player.transfer_price : Math.round((player.value || 0) * 1.2);
    if (listed <= 0) continue;
    // Contra-oferta: preço que aperta o orçamento (> 35%) negoceia-se a 85%.
    const price = listed > budget * 0.35 ? Math.round(listed * 0.85) : listed;
    if (price <= 0) continue;
    const share = urgent(pos) ? NPC_BUY_BUDGET_SHARE_URGENT : NPC_BUY_BUDGET_SHARE;
    if (price + signingWage(player) * Math.max(0, weeksLeft) > budget * share) continue;
    targets.push({ player, price });
  }
  return targets.sort(
    (a, b) =>
      Number(urgent(b.player.position)) - Number(urgent(a.player.position)) ||
      fill(a.player.position) - fill(b.player.position) ||
      (b.player.skill || 0) - (a.player.skill || 0) ||
      a.price - b.price,
  );
}
