/**
 * Regression — prémio de Melhor Marcador: um por divisão, pago ao clube que
 * SOFREU os golos.
 *
 * O caso que motivou isto: vender/comprar o goleador na última jornada. Sem
 * atribuição, o prémio (dinheiro + troféu no museu + notícia) ia para o clube
 * onde o jogador fechava a época — o comprador levava tudo e o vendedor nada.
 * `player_season_goals` (golos por clube, escrita no flush do apito final, Liga
 * + Taça) passou a decidir: o prémio vai a quem os golos foram marcados.
 *
 *   T1 — 4 vencedores, um por divisão: 500K€ a cada, 1 palmarés + 1 notícia +
 *        1 CM por divisão
 *   T2 — goleador vendido a meio da época: prémio (e divisão) ao clube que os
 *        sofreu; o comprador não herda nada
 *   T3 — empate a golos: os dois vencem e os dois levam o prémio cheio
 *   T4 — divisão 5 (pool interno) fora; agente livre (sem equipa) não vence
 *   T6 — equipa NPC: dinheiro e palmarés sim, notícia no Jornal não
 *   T7 — prefixo «Melhor Marcador» intacto (histórico do jogador + museu
 *        dependem dele) e `pickTopScorerWinners` puro
 *   T8 — sidebar (`fetchTopScorers`): ranking por divisão sobre a atribuição,
 *        top 10 por divisão, divisão 5 fora
 *   T9 — transferência dentro da mesma divisão: um só troféu por jogador, no
 *        clube onde fecha a época
 *
 * Run: cd server && npm run test:topscorer
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3").verbose();
const { createCupFlowHelpers, pickTopScorerWinners } = require("../cupFlowHelpers.ts") as typeof import("../cupFlowHelpers.js");
const { runAll } = require("../coreHelpers.ts") as typeof import("../coreHelpers.js");
const { fetchTopScorers } = require("../coreHelpers.ts") as typeof import("../coreHelpers.js");
const { DIVISION_NAMES } = require("../gameConstants.ts") as typeof import("../gameConstants.js");

const DDL = `
CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT, division INTEGER, budget INTEGER DEFAULT 0, manager_id INTEGER, color_primary TEXT DEFAULT '#111111', color_secondary TEXT DEFAULT '#ffffff');
CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT, team_id INTEGER, goals INTEGER DEFAULT 0, skill INTEGER, position TEXT);
CREATE TABLE palmares (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL, season INTEGER NOT NULL,
  achievement TEXT NOT NULL, coach_name TEXT DEFAULT NULL, is_human_coach INTEGER DEFAULT 0, player_id INTEGER);
CREATE TABLE club_news (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL, type TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT, player_id INTEGER, player_name TEXT, related_team_id INTEGER,
  related_team_name TEXT, amount INTEGER, matchweek INTEGER, slot INTEGER, year INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE player_season_goals (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL, goals INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX idx_player_season_goals_unique ON player_season_goals(player_id, team_id);
`;

let failures = 0;
function check(cond: boolean, msg: string) {
	if (cond) {
		console.log(`ok   - ${msg}`);
	} else {
		failures++;
		console.error(`FAIL - ${msg}`);
	}
}
function checkEq(actual: unknown, expected: unknown, msg: string) {
	check(actual === expected, `${msg} (esperado ${expected}, obtido ${actual})`);
}

function openDb(): Promise<any> {
	return new Promise((resolve) => {
		const db = new sqlite3.Database(":memory:", () => db.exec(DDL, () => resolve(db)));
	});
}

const run = (db: any, sql: string, params: any[] = []) =>
	new Promise<void>((resolve, reject) => db.run(sql, params, (err: any) => (err ? reject(err) : resolve())));
const all = (db: any, sql: string, params: any[] = []) =>
	new Promise<any[]>((resolve, reject) => db.all(sql, params, (err: any, rows: any[]) => (err ? reject(err) : resolve(rows))));
const defer = () => new Promise((r) => setTimeout(r, 30));

/** Sala com 3 clubes por divisão (1–4) + 1 na divisão 5; equipa 1 tem treinador humano. */
async function makeRoom() {
	const db = await openDb();
	for (let div = 1; div <= 5; div++) {
		for (let n = 0; n < 3; n++) {
			const id = div * 10 + n;
			await run(db, "INSERT INTO teams (id, name, division, budget) VALUES (?, ?, ?, ?)", [
				id,
				`Div${div} Equipa ${n}`,
				div,
				1000000,
			]);
		}
	}
	const messages: Array<{ event: string; payload: any }> = [];
	const io = {
		to: () => ({
			emit: (event: string, payload: any) => messages.push({ event, payload }),
		}),
	};
	const game: any = {
		roomCode: "TESTMC",
		db,
		// Só a equipa 10 (1.ª da Primeira Liga) é humana: `logClubNews` não
		// escreve notícia para NPC.
		playersByName: { Ana: { teamId: 10, socketId: "s1" } },
	};
	const mustNotRun = (name: string) => () => {
		throw new Error(`dependência não esperada neste teste: ${name}`);
	};
	const helpers = createCupFlowHelpers({
		io,
		runAll,
		runGet: mustNotRun("runGet") as any,
		getStandingsRows: (teams: any[] = []) => teams,
		DIVISION_NAMES,
		CUP_TEAMS_BY_ROUND: {},
		CUP_ROUND_NAMES: [],
		saveGameState: mustNotRun("saveGameState") as any,
		getTeamSquad: mustNotRun("getTeamSquad") as any,
		simulateExtraTime: mustNotRun("simulateExtraTime") as any,
		simulatePenaltyShootout: mustNotRun("simulatePenaltyShootout") as any,
		getPlayerList: mustNotRun("getPlayerList") as any,
		emitPresence: mustNotRun("emitPresence") as any,
		applyTrainingBonuses: mustNotRun("applyTrainingBonuses") as any,
		clearSeasonTrainingState: mustNotRun("clearSeasonTrainingState") as any,
		applyPostMatchQualityEvolution: mustNotRun("applyPostMatchQualityEvolution") as any,
		resumeAllPausedAuctions: mustNotRun("resumeAllPausedAuctions") as any,
		processRelegatedHumanCoaches: mustNotRun("processRelegatedHumanCoaches") as any,
	} as any);
	const addPlayer = (id: number, teamId: number | null, goals: number, skill = 30, name = `Jogador ${id}`) =>
		run(db, "INSERT INTO players (id, name, team_id, goals, skill, position) VALUES (?, ?, ?, ?, ?, 'AV')", [
			id,
			name,
			teamId,
			goals,
			skill,
		]);
	const attribute = (playerId: number, teamId: number, goals: number) =>
		run(db, "INSERT INTO player_season_goals (player_id, team_id, goals) VALUES (?, ?, ?)", [playerId, teamId, goals]);
	const budgetOf = async (teamId: number) =>
		(await all(db, "SELECT budget FROM teams WHERE id = ?", [teamId]))[0].budget;
	return { db, game, messages, helpers, addPlayer, attribute, budgetOf };
}

// ── T1 ──────────────────────────────────────────────────────────────────────
{
	const room = await makeRoom();
	const { db, game, messages, helpers, addPlayer, attribute, budgetOf } = room;
	// Um goleador claro por divisão, todos com atribuição ao próprio clube.
	for (const [div, pid] of [[1, 101], [2, 201], [3, 301], [4, 401]] as const) {
		await addPlayer(pid, div * 10, 20 + div);
		await attribute(pid, div * 10, 20 + div);
	}
	const paid = await helpers.payTopScorerPrize(game, 2030);
	await defer();
	checkEq(paid.length, 4, "T1 4 vencedores");
	checkEq(paid.map((w: any) => w.divId).join(","), "1,2,3,4", "T1 divisões 1–4 em ordem");
	checkEq(paid.map((w: any) => w.prize).join(","), "500000,250000,125000,60000", "T1 prémio por divisão (um quarto do de campeão)");
	const budgets = await Promise.all([10, 20, 30, 40].map((t) => budgetOf(t)));
	checkEq(budgets.join(","), "1500000,1250000,1125000,1060000", "T1 cada clube recebe o prémio da sua divisão");
	const palmares = await all(db, "SELECT team_id, achievement, player_id FROM palmares ORDER BY team_id");
	checkEq(palmares.length, 4, "T1 4 linhas de palmarés");
	check(
		palmares.every((p: any) => String(p.achievement).startsWith("Melhor Marcador — ")),
		"T1 prefixo «Melhor Marcador — » no palmarés",
	);
	check(
		palmares.some((p: any) => p.achievement === "Melhor Marcador — Liga 3 (23 golos)"),
		"T1 conquista com divisão e golos (Liga 3)",
	);
	checkEq(palmares.filter((p: any) => p.player_id == null).length, 0, "T1 palmarés com player_id");
	const news = await all(db, "SELECT team_id, title FROM club_news ORDER BY team_id");
	checkEq(news.length, 1, "T1 notícia só para o clube humano (equipa 10)");
	checkEq(news[0]?.team_id, 10, "T1 notícia no clube humano");
	checkEq(news[0]?.title, "Prémio de Melhor Marcador — Primeira Liga", "T1 notícia com a divisão no título");
	const cm = messages.filter((m) => m.event === "systemMessage");
	checkEq(cm.length, 4, "T1 4 anúncios (um por divisão)");
	check(
		cm.every((m) => String(m.payload.text).includes("Melhor Marcador ·")),
		"T1 anúncios com a divisão",
	);
}

// ── T2 — o caso que motivou tudo: goleador vendido na última jornada ────────
{
	const room = await makeRoom();
	const { db, game, messages, helpers, addPlayer, attribute, budgetOf } = room;
	// João: 22 golos pelo clube 20 (div 2), vendido ao clube 10 (div 1), onde
	// marcou 2. Fecha a época com 24 golos — o maior total da sala.
	await addPlayer(101, 10, 24, 40, "João");
	await attribute(101, 20, 22);
	await attribute(101, 10, 2);
	// Próximo melhor da Primeira Liga (o prémio de D1 passa a ser dele).
	await addPlayer(102, 11, 18, 35, "Rui");
	await attribute(102, 11, 18);
	const paid = await helpers.payTopScorerPrize(game, 2030);
	await defer();
	const div2 = paid.find((w: any) => w.divId === 2);
	const div1 = paid.find((w: any) => w.divId === 1);
	checkEq(div2?.id, 101, "T2 João vence o prémio da Segunda Liga (22 golos)");
	checkEq(div2?.team_id, 20, "T2 prémio creditado ao clube que sofreu os golos (20)");
	checkEq(div2?.goals, 22, "T2 golos contados pelo clube, não pelo total da época");
	checkEq(div1?.id, 102, "T2 o prémio da Primeira Liga vai ao melhor marcador da divisão");
	checkEq(await budgetOf(20), 1250000, "T2 o vendedor leva os 250K€ da Segunda Liga");
	checkEq(await budgetOf(10), 1000000, "T2 o comprador não herda o prémio");
	const palmares = await all(db, "SELECT team_id, achievement FROM palmares WHERE player_id = 101");
	checkEq(palmares.length, 1, "T2 uma linha de palmarés para o jogador");
	checkEq(palmares[0]?.team_id, 20, "T2 o troféu fica no museu do vendedor");
	checkEq(palmares[0]?.achievement, "Melhor Marcador — Segunda Liga (22 golos)", "T2 troféu com a divisão dos golos");
}

// ── T3 — empate: prémio cheio para cada um ──────────────────────────────────
{
	const room = await makeRoom();
	const { db, game, helpers, addPlayer, attribute, budgetOf } = room;
	await addPlayer(101, 10, 19, 30, "Ana");
	await attribute(101, 10, 19);
	await addPlayer(102, 11, 19, 25, "Beto");
	await attribute(102, 11, 19);
	const paid = await helpers.payTopScorerPrize(game, 2030);
	await defer();
	checkEq(paid.length, 2, "T3 dois empatados vencem");
	check(paid.every((w: any) => w.divId === 1 && w.prize === 500000), "T3 prémio cheio para cada empatado");
	checkEq((await budgetOf(10)) + (await budgetOf(11)), 3000000, "T3 500K€ a cada clube empatado");
	const palmares = await all(db, "SELECT achievement FROM palmares ORDER BY id");
	checkEq(palmares.length, 2, "T3 palmarés para os dois");
}

// ── T4 — divisão 5 e agentes livres fora ────────────────────────────────────
{
	const room = await makeRoom();
	const { db, game, helpers, addPlayer, attribute } = room;
	await addPlayer(101, 10, 12);
	await attribute(101, 10, 12);
	// Bola de ouro das distritais: nunca deve vencer nada (pool invisível).
	await addPlayer(501, 50, 40);
	await attribute(501, 50, 40);
	// Agente livre (sem equipa): fora do ranking — antes era ele o vencedor
	// global e o prémio não era pago a ninguém.
	await addPlayer(999, null, 30);
	const paid = await helpers.payTopScorerPrize(game, 2030);
	await defer();
	checkEq(paid.length, 1, "T4 só uma divisão com vencedor");
	checkEq(paid[0]?.id, 101, "T4 vencedor da Primeira Liga");
	check(!paid.some((w: any) => w.id === 501 || w.id === 999), "T4 divisão 5 e agente livre fora do prémio");
}

// ── T6/T7 — NPC sem notícia; prefixo do palmarés; puro ──────────────────────
{
	const room = await makeRoom();
	const { db, game, helpers, addPlayer, attribute } = room;
	// Só um NPC vence (equipa 2x) + um humano com golos a menos (não vence).
	await addPlayer(201, 20, 25, 30, "Npc");
	await attribute(201, 20, 25);
	await addPlayer(101, 10, 3, 30, "Ana");
	await attribute(101, 10, 3);
	await helpers.payTopScorerPrize(game, 2030);
	await defer();
	const news = await all(db, "SELECT team_id FROM club_news");
	check(!news.some((n: any) => n.team_id === 20), "T6 NPC não recebe notícia no Jornal");
	check(news.length > 0, "T6 o clube humano continua a receber");
	const palmares = await all(db, "SELECT achievement FROM palmares ORDER BY id");
	checkEq(palmares.length, 2, "T6 palmarés existe para humanos e NPC");
	check(
		palmares.every((p: any) => /^Melhor Marcador — .+ \(\d+ golos\)$/.test(String(p.achievement))),
		"T7 formato «Melhor Marcador — <divisão> (N golos)»",
	);
	checkEq(pickTopScorerWinners([]).length, 0, "T7 puro: sem rows, sem vencedores");
	checkEq(
		pickTopScorerWinners([
			{ id: 1, division: 2, goals: 5, team_id: 1, name: "a" },
			{ id: 2, division: 2, goals: 5, team_id: 2, name: "b" },
			{ id: 3, division: 2, goals: 4, team_id: 3, name: "c" },
			{ id: 4, division: 3, goals: 1, team_id: 4, name: "d" },
		]).map((r: any) => r.id).join(","),
		"1,2,4",
		"T7 puro: empate incluído, máximo por divisão",
	);
}

// ── T8 — sidebar: ranking por divisão sobre a atribuição ────────────────────
{
	const room = await makeRoom();
	const { db, addPlayer, attribute } = room;
	// João: 22 golos pelo clube 20 (div 2) e 2 pelo clube 10 (div 1) — no
	// ranking do clube atual conta 2 (não 24), como no prémio.
	await addPlayer(101, 10, 24, 40, "João");
	await attribute(101, 20, 22);
	await attribute(101, 10, 2);
	await addPlayer(102, 11, 18, 35, "Rui");
	await attribute(102, 11, 18);
	// Bola de ouro da divisão 5: fora do ranking (pool invisível).
	await addPlayer(501, 50, 40, 45, "Npc Div5");
	await attribute(501, 50, 40);
	const rows = await fetchTopScorers(db);
	const div1 = rows.filter((r: any) => r.division === 1);
	checkEq(div1.map((r: any) => `${r.id}:${r.goals}`).join(","), "102:18,101:2", "T8 div 1: golos atribuídos ao clube atual");
	check(
		rows.every((r: any) => r.division >= 1 && r.division <= 4),
		"T8 divisão 5 fora do ranking",
	);
	check(
		rows.every((r: any) => r.goals > 0 && r.team_name && r.color_primary === "#111111"),
		"T8 payload com os campos que a sidebar usa",
	);
	// Top 10 por divisão: 12 jogadores na mesma divisão → só 10 saem.
	for (let i = 0; i < 12; i++) {
		await addPlayer(300 + i, 30, 5 + i, 20);
		await attribute(300 + i, 30, 5 + i);
	}
	const rows2 = await fetchTopScorers(db);
	checkEq(rows2.filter((r: any) => r.division === 3).length, 10, "T8 top 10 por divisão");
}

// ── T9 — mesma divisão, dois clubes: um troféu só para o jogador ────────────
{
	const room = await makeRoom();
	const { db, game, helpers, addPlayer, attribute, budgetOf } = room;
	// Vítor marcou 10 pelo clube 10 e 10 pelo clube 11 (transferência dentro da
	// Primeira Liga a meio da época); fecha a época no 11. Não pode levar dois
	// troféus da mesma divisão: fica com o clube onde está.
	await addPlayer(101, 11, 20, 30, "Vítor");
	await attribute(101, 10, 10);
	await attribute(101, 11, 10);
	const paid = await helpers.payTopScorerPrize(game, 2030);
	await defer();
	checkEq(paid.length, 1, "T9 um troféu só por jogador e divisão");
	checkEq(paid[0]?.team_id, 11, "T9 troféu no clube onde fecha a época");
	checkEq(await budgetOf(11), 1500000, "T9 prémio no clube atual");
	checkEq(await budgetOf(10), 1000000, "T9 o clube anterior não leva prémio nenhum");
}

if (failures > 0) {
	console.error(`\n${failures} check(s) falharam.`);
	process.exit(1);
}
console.log("\nPrémio de Melhor Marcador — todos os checks passaram.");
