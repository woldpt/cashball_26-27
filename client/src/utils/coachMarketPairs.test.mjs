/**
 * Teste do emparelhamento do Mercado de Treinadores (corre com `node`).
 *
 *   node client/src/utils/coachMarketPairs.test.mjs
 */
import assert from "node:assert/strict";
import { pairCoachMarketEvents } from "./coachMarketPairs.js";

// 1. Par NPC: despedimento + substituto no mesmo clube, no mesmo reporte.
{
	const cards = pairCoachMarketEvents([
		{ type: "dismissal", coachName: "X", teamName: "FC Norte", division: 2 },
		{ type: "hiring", coachName: "Y", teamName: "FC Norte", division: 2 },
	]);
	assert.equal(cards.length, 1);
	assert.equal(cards[0].dismissal.coachName, "X");
	assert.equal(cards[0].replacement.coachName, "Y");
	assert.equal(cards[0].nextClub, undefined);
}

// 2. Humano despedido sem substituto; o próprio assina noutro clube.
{
	const cards = pairCoachMarketEvents([
		{ type: "dismissal", coachName: "X", teamName: "FC Sul", division: 3, reason: "results" },
		{ type: "hiring", coachName: "X", teamName: "SC Litoral", division: 4, isHuman: true },
	]);
	assert.equal(cards.length, 1);
	assert.equal(cards[0].replacement, undefined);
	assert.equal(cards[0].nextClub.teamName, "SC Litoral");
}

// 3. Misto: par por clube e assinatura do despedido no mesmo reporte.
{
	const cards = pairCoachMarketEvents([
		{ type: "dismissal", coachName: "X", teamName: "FC Norte", division: 2 },
		{ type: "hiring", coachName: "Y", teamName: "FC Norte", division: 2 },
		{ type: "hiring", coachName: "X", teamName: "SC Alto", division: 4, isHuman: true },
	]);
	assert.equal(cards.length, 1);
	assert.equal(cards[0].replacement.coachName, "Y");
	assert.equal(cards[0].nextClub.teamName, "SC Alto");
}

// 4. Contratação standalone e despedimento sem sequência.
{
	const cards = pairCoachMarketEvents([
		{ type: "hiring", coachName: "Z", teamName: "Clube C", division: 1 },
		{ type: "dismissal", coachName: "W", teamName: "Clube D", division: 4, reason: "relegation" },
	]);
	assert.equal(cards.length, 2);
	assert.equal(cards[0].hiring.coachName, "Z");
	assert.equal(cards[1].dismissal.coachName, "W");
	assert.equal(cards[1].replacement, undefined);
	assert.equal(cards[1].nextClub, undefined);
}

// 5. Substituto não é roubado a outro despedimento do mesmo clube; nulls ignorados.
{
	const cards = pairCoachMarketEvents([
		null,
		{ type: "dismissal", coachName: "A", teamName: "FC 1", division: 2 },
		{ type: "hiring", coachName: "B", teamName: "FC 1", division: 2 },
		{ type: "dismissal", coachName: "C", teamName: "FC 1", division: 2 },
	]);
	assert.equal(cards.length, 2);
	assert.ok(cards[0].replacement);
	assert.equal(cards[1].replacement, undefined);
}

// 6. Vazio / null.
assert.deepEqual(pairCoachMarketEvents([]), []);
assert.deepEqual(pairCoachMarketEvents(null), []);

console.log("✅ coachMarketPairs: 6/6 casos OK");
