/**
 * Regression — posição do treinador no leilão e ordem por fim.
 * Run: cd client && node src/utils/auctionStanding.test.mjs
 */
import assert from "node:assert/strict";
import { auctionStanding, sortByEnding } from "./auctionStanding.js";

const hist = [{ teamId: 5, amount: 100 }, { teamId: 2, amount: 110 }];
assert.equal(auctionStanding({ sellerTeamId: 5 }, 5), "seller");
assert.equal(auctionStanding({ currentHighBidTeamId: 5, auction_bid_history: hist }, "5"), "leader");
assert.equal(auctionStanding({ currentHighBidTeamId: 2, auction_bid_history: hist }, 5), "outbid");
assert.equal(auctionStanding({ currentHighBidTeamId: 2, auction_bid_history: [{ team_id: 5 }] }, 5), "outbid");
assert.equal(auctionStanding({ currentHighBidTeamId: 2, auction_bid_history: hist }, 9), null);
assert.equal(auctionStanding({ currentHighBidTeamId: null }, null), null);

const sorted = sortByEnding([
  { id: "paused", paused: true, endsAt: 1 },
  { id: "late", endsAt: 300 },
  { id: "none", endsAt: null },
  { id: "soon", endsAt: 10 },
]).map((a) => a.id);
assert.deepEqual(sorted.slice(0, 2), ["soon", "late"]);
assert.deepEqual(new Set(sorted.slice(2)), new Set(["paused", "none"]));

console.log("auctionStanding OK");
