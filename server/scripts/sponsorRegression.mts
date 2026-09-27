/**
 * Regression test — mercado de patrocinadores (server/game/sponsors.ts).
 *
 * Regras em causa:
 *  - 60 marcas, 12 por escalão (tier = divisão).
 *  - 3 ofertas distintas por equipa, uma de cada perfil A/B/C.
 *  - Totais sobre a base da divisão: A 100%, B 120% (20 semanas), C 110%.
 *  - `taken` exclui marcas já atribuídas; pote curto devolve as que houver.
 *  - Logos sem `clipPath` (regra do projeto).
 *
 * Run: cd server && npm run test:sponsor
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sponsors = require("../game/sponsors.ts") as typeof import("../game/sponsors.js");

const {
	SPONSORS,
	SPONSOR_WEEKS,
	dealDisplaySponsors,
	drawOffers,
	drawOffersAny,
	drawNpcChoice,
	sponsorBaseFor,
	sponsorById,
	sponsorsByTier,
	sponsorLogo,
} = sponsors;

function assertEq(actual: unknown, expected: unknown, msg: string) {
	if (actual !== expected) {
		console.error(`FAIL: ${msg} — esperado ${expected}, obtido ${actual}`);
		process.exit(1);
	}
	console.log(`ok  - ${msg} (${actual})`);
}

function assert(cond: boolean, msg: string) {
	if (!cond) {
		console.error(`FAIL: ${msg}`);
		process.exit(1);
	}
	console.log(`ok  - ${msg}`);
}

// Catálogo
assertEq(SPONSORS.length, 60, "catálogo com 60 marcas");
for (const tier of [1, 2, 3, 4, 5]) {
	assertEq(sponsorsByTier(tier).length, 12, `tier ${tier} com 12 marcas`);
}
assertEq(sponsorBaseFor(1), 2000000, "base D1");
assertEq(sponsorBaseFor(5), 400000, "base D5");
assert(SPONSORS.every((s) => !sponsorLogo(s).includes("clipPath")), "logos sem clipPath");

// Ofertas D1: 3 distintas, perfis A/B/C, contas certas
const offers = drawOffers(1, new Set(), 3);
assertEq(offers.length, 3, "3 ofertas");
assertEq(new Set(offers.map((o) => o.sponsorId)).size, 3, "marcas distintas");
assertEq(new Set(offers.map((o) => o.profile)).size, 3, "perfis A/B/C distintos");
const a = offers.find((o) => o.profile === "A")!;
const b = offers.find((o) => o.profile === "B")!;
const c = offers.find((o) => o.profile === "C")!;
assertEq(a.total, 2000000, "A total 100%");
assertEq(a.upfront, 2000000, "A tudo já");
assertEq(b.total, b.weekly * SPONSOR_WEEKS, "B total = semanal × 20");
assert(Math.abs(b.total - 2400000) <= SPONSOR_WEEKS, `B total ~120% (${b.total})`);
assertEq(c.total, 2 * Math.round(2000000 * 0.55), "C total 110%");
assertEq(c.upfront, c.secondHalf, "C meio-meio");

// Taken: 11 de 12 ocupadas → 1 oferta, fora das ocupadas
const tier1 = sponsorsByTier(1);
const taken = new Set(tier1.slice(0, 11).map((s) => s.id));
const last = drawOffers(1, taken, 3);
assertEq(last.length, 1, "pote curto devolve 1");
assertEq(last[0].sponsorId, tier1[11].id, "a que sobra é a livre");
const none = drawOffers(1, new Set(tier1.map((s) => s.id)), 3);
assertEq(none.length, 0, "pote vazio devolve 0");

// NPC: escolha do escalão certo
const npc = drawNpcChoice(4, new Set());
assert(!!npc && sponsorById(npc.sponsorId)?.tier === 4, "NPC recebe marca do seu escalão");

// Fallback global: pote esgotado nunca deixa equipa sem opções
const allTaken = new Set(SPONSORS.map((s) => s.id));
assertEq(drawOffersAny(allTaken, 3).length, 0, "global esgotado devolve 0");
const almostAll = new Set(SPONSORS.slice(0, 59).map((s) => s.id));
const fallback = drawOffersAny(almostAll, 3);
assertEq(fallback.length, 1, "global com 1 livre devolve 1");
assertEq(fallback[0].sponsorId, SPONSORS[59].id, "fallback é a marca livre");

// Exibição época 1: 40 equipas (8×5), 1 marca cada, única no escalão
const fakeTeams = [1, 2, 3, 4, 5].flatMap((division) =>
	Array.from({ length: 8 }, (_, i) => ({ id: division * 100 + i, division })),
);
const dealt = dealDisplaySponsors(fakeTeams);
assertEq(dealt.length, 40, "display cobre as 40 equipas");
for (const division of [1, 2, 3, 4, 5]) {
	const mine = dealt.filter((d) => fakeTeams.find((t) => t.id === d.teamId)?.division === division);
	assertEq(new Set(mine.map((d) => d.sponsorId)).size, 8, `display D${division} sem repetições`);
	assert(mine.every((d) => sponsorById(d.sponsorId)?.tier === division), `display D${division} no escalão certo`);
}

console.log("\nPASS test:sponsor");
