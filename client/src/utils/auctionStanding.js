/**
 * Posição do treinador num leilão: vendedor, a liderar, superado (licitou
 * mas já não lidera) ou de fora. Usado no cromo (fita) e no topo (chips).
 *
 * @param {{sellerTeamId?: number, currentHighBidTeamId?: number|null, auction_bid_history?: Array<{teamId?: number, team_id?: number}>}} auction
 * @param {number|null|undefined} teamId
 * @returns {"seller"|"leader"|"outbid"|null}
 */
export function auctionStanding(auction, teamId) {
  if (teamId == null) return null;
  const mine = Number(teamId);
  if (Number(auction.sellerTeamId) === mine) return "seller";
  if (auction.currentHighBidTeamId != null && Number(auction.currentHighBidTeamId) === mine) return "leader";
  const bid = (auction.auction_bid_history || []).some((b) => Number(b.teamId ?? b.team_id) === mine);
  return bid ? "outbid" : null;
}

/**
 * Ordem dos leilões em curso: o que acaba primeiro à frente; pausados (e sem
 * `endsAt`) no fim. Não muta o array.
 *
 * @template {{paused?: boolean, endsAt?: number|null}} T
 * @param {T[]} auctions
 * @returns {T[]}
 */
export function sortByEnding(auctions) {
  const key = (a) => (a.paused || a.endsAt == null ? Infinity : a.endsAt);
  return [...auctions].sort((a, b) => key(a) - key(b));
}
