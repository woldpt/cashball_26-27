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
  NPC_BUY_MAX_VALUE_RATIO,
  NPC_AUCTION_BUDGET_SHARE,
  NPC_POS_KEEP,
  NPC_LIST_MARKET_PREMIUM,
  NPC_LIST_SQUAD_THRESHOLDS,
  NPC_OPPORTUNITY_SALE_CHANCE,
  NPC_OPPORTUNITY_SALE_PREMIUM,
  NPC_RENEW_MIN_SKILL_RATIO,
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
 * Fica de fora quem não chega ao piso, quem joga numa posição cheia, quem é
 * pedido muito acima do valor e quem não cabe no orçamento com os ordenados
 * até ao fim da época.
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
    if (listed > (player.value || 0) * NPC_BUY_MAX_VALUE_RATIO) continue;
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

/**
 * Lance máximo de um NPC num leilão: o que o orçamento deixa e nunca acima
 * do teto sobre o valor — o mesmo da lista. Sem o teto bastava abrir o
 * leilão a 2,5× o valor para um NPC entrar, e o contra-lance não tinha
 * limite nenhum sobre o valor.
 */
export function npcAuctionMaxBid(budget: number, playerValue: number): number {
  return Math.round(
    Math.min(
      Math.max(0, budget || 0) * NPC_AUCTION_BUDGET_SHARE,
      Math.max(0, playerValue || 0) * NPC_BUY_MAX_VALUE_RATIO,
    ),
  );
}

/**
 * Quem vai à lista de transferências esta semana (ou ninguém). Só sai quem
 * sobra: fora dos NPC_POS_KEEP melhores da posição, que são os titulares em
 * qualquer formação. Plantel cheio → sai o mais fraco, ao valor de tabela
 * (com sobrepreço se estiver ao nível da divisão). De vez em quando sai o
 * melhor dos que sobram, mais caro.
 * `squad` é o plantel inteiro; `eligibleIds` os que o contrato deixa listar.
 */
export function pickNpcListing(args: {
  squad: AnyRow[];
  eligibleIds: Set<number>;
  divisionLevel: number;
  rng?: () => number;
}): { player: AnyRow; price: number } | null {
  const { squad, eligibleIds, divisionLevel, rng = Math.random } = args;
  // Quem já está à venda conta como saído.
  const staying = squad.filter((p) => p.id > 0 && (p.transfer_status || "none") === "none");
  const surplus: AnyRow[] = [];
  for (const pos of Object.keys(NPC_POS_KEEP)) {
    const line = staying
      .filter((p) => p.position === pos)
      .sort((a, b) => (b.skill || 0) - (a.skill || 0));
    surplus.push(...line.slice(NPC_POS_KEEP[pos]).filter((p) => eligibleIds.has(p.id)));
  }
  if (surplus.length === 0) return null;
  surplus.sort((a, b) => (a.skill || 0) - (b.skill || 0));
  const priced = (player: AnyRow, mult: number) => {
    const price = Math.round((player.value || 0) * mult);
    return price > 0 ? { player, price } : null;
  };

  if (rng() < NPC_OPPORTUNITY_SALE_CHANCE) {
    return priced(surplus[surplus.length - 1], NPC_OPPORTUNITY_SALE_PREMIUM);
  }
  const listChance =
    NPC_LIST_SQUAD_THRESHOLDS.find((t) => eligibleIds.size > t.size)?.chance ?? 0;
  if (listChance === 0 || rng() > listChance) return null;
  const weakest = surplus[0];
  return priced(
    weakest,
    (weakest.skill || 0) >= divisionLevel && divisionLevel > 0 ? NPC_LIST_MARKET_PREMIUM : 1,
  );
}

/**
 * Renovação NPC: fica quem está perto da média do plantel, ou quem faz falta
 * — sem ele a posição desce abaixo do mínimo.
 */
export function npcShouldRenew(args: {
  skill: number;
  squadAvgSkill: number;
  positionCount: number;
  position: string;
}): boolean {
  const { skill, squadAvgSkill, positionCount, position } = args;
  if (skill >= squadAvgSkill * NPC_RENEW_MIN_SKILL_RATIO) return true;
  return positionCount - 1 < (NPC_POS_MIN[position] ?? 3);
}

/**
 * Obra no estádio de um NPC: só com adeptos para encher os lugares novos.
 * A assistência é limitada pela massa adepta — bancada a mais só traz
 * manutenção e um estádio vazio (que ainda tira ataque à equipa).
 */
export function npcShouldBuildStadium(team: {
  stadium_capacity?: number;
  fanbase?: number;
}): boolean {
  return (team.fanbase || 0) > (team.stadium_capacity || 0);
}
