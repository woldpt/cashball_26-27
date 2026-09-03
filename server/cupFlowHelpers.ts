// @ts-nocheck
import type { ActiveGame, PlayerSession } from "./types";
import type { CalendarEntry } from "./gameConstants";
import {
  SEASON_CALENDAR,
  SPONSOR_REVENUE_BY_DIVISION,
  recalcPlayerValue,
  remainingSubstitutions,
  incrementSubCount,
} from "./gameConstants";
import { clearPhaseTimer } from "./matchFlowHelpers";
import { generateAITactic } from "./game/matchCalculations";
import { getMatchFatigueSnapshot } from "./game/engine";
import { getTeamsWithCoachNames, logClubNews } from "./coreHelpers";
import { updateTacticFamiliarity } from "./game/tacticFamiliarity";
import { serializeActiveAuctions } from "./auctionHelpers";

interface CupFlowDeps {
	io: any;
	runAll: <T extends Record<string, any> = Record<string, any>>(
		db: any,
		sql: string,
		params?: any[],
	) => Promise<T[]>;
	runGet: <T extends Record<string, any> = Record<string, any>>(
		db: any,
		sql: string,
		params?: any[],
	) => Promise<T | null>;
	getStandingsRows: (teams?: Record<string, any>[]) => Record<string, any>[];
	DIVISION_NAMES: Record<number, string>;
	CUP_TEAMS_BY_ROUND: Record<number, number>;
	CUP_ROUND_NAMES: string[];
	saveGameState: (game: ActiveGame) => void;
	getTeamSquad: (
		db: any,
		teamId: number,
		tactic: any,
		currentMatchweek?: number,
	) => Promise<any[]>;
	simulateExtraTime: (...args: any[]) => Promise<any>;
	simulatePenaltyShootout: (...args: any[]) => any;
	getPlayerList: (game: ActiveGame) => PlayerSession[];
	emitPresence: (game: ActiveGame) => void;
	applyTrainingBonuses: (
		game: ActiveGame,
		fixtures: any[],
		completedCalendarIndex: number,
	) => Promise<void>;
	clearSeasonTrainingState: (game: ActiveGame) => Promise<void>;
	applyPostMatchQualityEvolution: (
		db: any,
		fixtures: any[],
		currentMatchweek: number,
		season: number,
		calendarIndex?: number,
	) => Promise<void>;
	resumeAllPausedAuctions: (game: ActiveGame) => void;
	processRelegatedHumanCoaches: (
		game: ActiveGame,
		relegatedTeamIds: number[],
	) => Promise<void>;
}

export function createCupFlowHelpers(deps: CupFlowDeps) {
	const {
		io,
		runAll,
		runGet,
		getStandingsRows,
		DIVISION_NAMES,
		CUP_TEAMS_BY_ROUND,
		CUP_ROUND_NAMES,
		saveGameState,
		getTeamSquad,
		simulateExtraTime,
		simulatePenaltyShootout,
		getPlayerList,
		emitPresence,
		applyTrainingBonuses,
		clearSeasonTrainingState,
		applyPostMatchQualityEvolution,
		resumeAllPausedAuctions,
		processRelegatedHumanCoaches,
	} = deps;

	// ─── OFF-SEASON AGING & IDLENESS ────────────────────────────────────────

	/**
	 * Aplica decaimento de fim de época (age-free). Os jogadores são eternos e
	 * a base de dados é fixa, por isso não há envelhecimento nem incremento de
	 * idade. Este é o freio sazonal que mantém o equilíbrio:
	 *
	 * Inatividade:
	 *  - Jogadores com 0 games_played na época: 30% -1 skill
	 *
	 * Retorno à média:
	 *  - Jogadores acima do teto de potencial: 25% -1 skill
	 */
	async function applyOffSeasonDecay(game: ActiveGame): Promise<void> {
		return new Promise<void>((resolve) => {
			game.db.all(
				"SELECT id, team_id, skill, potential, form, games_played FROM players WHERE team_id IS NOT NULL",
				(err, players) => {
					if (err || !players || players.length === 0) {
						resolve();
						return;
					}

					const updates: Array<{ id: number; skill: number }> = [];
					const potentialUpdates: Array<{ id: number; potential: number }> = [];
					const season = game.season || 1;

					for (const p of players) {
						const skill = p.skill ?? 0;
						const played = p.games_played ?? 0;
						const form = p.form ?? 90;
						let delta = 0;

						// ── Inatividade: quem não jogou a época decai ──
						if (played === 0 && Math.random() < 0.30) {
							delta -= 1;
						}

						// ── Acima do teto de potencial: retorno à média ──
						const potential =
							p.potential != null ? Math.min(50, p.potential) : 50;
						if (skill > potential && Math.random() < 0.25) {
							delta -= 1;
						}

						if (delta !== 0) {
							const newSkill = Math.max(1, Math.min(50, skill + delta));
							if (newSkill !== skill) {
								updates.push({ id: p.id, skill: newSkill });
							}
						}

						// ── Dinâmica de potencial (age-free) ────────────────
						// Jogadores que jogaram quase toda a época com forma alta
						// "descobrem" talento (+1); os que cumpriram em forma baixa
						// estagnam (-1). Simula surgimento/declínio de estrelas.
						if (played >= 12) {
							if (form >= 38 && Math.random() < 0.20) {
								const newPotential = Math.min(50, potential + 1);
								if (newPotential !== potential) {
									potentialUpdates.push({ id: p.id, potential: newPotential });
								}
							} else if (form <= 7 && Math.random() < 0.20) {
								const newPotential = Math.max(5, potential - 1);
								if (newPotential !== potential) {
									potentialUpdates.push({ id: p.id, potential: newPotential });
								}
							}
						}
					}

					const allUpdates = updates.length + potentialUpdates.length;
					if (allUpdates === 0) {
						resolve();
						return;
					}

					let remaining = allUpdates;
					const done = () => {
						remaining -= 1;
						if (remaining === 0) resolve();
					};

					game.db.serialize(() => {
						if (updates.length > 0) {
							game.db.run("UPDATE players SET prev_skill = NULL WHERE team_id IS NOT NULL");
							for (const upd of updates) {
								game.db.run(
									"UPDATE players SET prev_skill = skill, skill = ?, value = ? WHERE id = ?",
									[upd.skill, recalcPlayerValue(upd.skill), upd.id],
									() => {
										// Snapshot after season-end decay
										game.db.run(
											"INSERT OR REPLACE INTO player_skill_snapshots (player_id, matchweek, season, skill) VALUES (?, ?, ?, ?)",
											[upd.id, game.matchweek, season, upd.skill],
											done,
										);
									},
								);
							}
						}
						for (const pupd of potentialUpdates) {
							game.db.run(
								"UPDATE players SET potential = ? WHERE id = ?",
								[pupd.potential, pupd.id],
								done,
							);
						}
					});
				},
			);
		});
	}

	// ─── SEASON END ────────────────────────────────────────────────────────────

	async function applySeasonEnd(game: ActiveGame) {
		const season = game.season;
		const year = game.year;
		const allTeams = await runAll(
			game.db,
			"SELECT * FROM teams ORDER BY division, id",
		);

		const byDiv: Record<number, any[]> = {};
		for (const team of allTeams) {
			if (!byDiv[team.division]) byDiv[team.division] = [];
			byDiv[team.division].push(team);
		}
		for (const div in byDiv) {
			byDiv[Number(div)] = getStandingsRows(byDiv[Number(div)]);
		}

		const CHAMPION_PRIZE: Record<number, number> = {
			1: 2000000,
			2: 1000000,
			3: 500000,
			4: 250000,
		};

		const iLigaWinner = byDiv[1] && byDiv[1][0];
		if (iLigaWinner) {
			const coachInfo = await runGet(
				game.db,
				"SELECT m.name as coach_name, m.is_human as is_human FROM teams t JOIN managers m ON t.manager_id = m.id WHERE t.id = ?",
				[iLigaWinner.id],
			);
			await new Promise((resolve) => {
				game.db.run(
					"INSERT INTO palmares (team_id, season, achievement, coach_name, is_human_coach) VALUES (?, ?, ?, ?, ?)",
					[
						iLigaWinner.id,
						year,
						"Campeão Nacional",
						coachInfo?.coach_name || null,
						coachInfo?.is_human || 0,
					],
					resolve,
				);
			});
			await new Promise((resolve) => {
				game.db.run(
					"UPDATE teams SET budget = budget + ? WHERE id = ?",
					[CHAMPION_PRIZE[1], iLigaWinner.id],
					resolve,
				);
			});
			io.to(game.roomCode).emit("systemMessage", {
				text: `🏆 ${iLigaWinner.name} é o Campeão Nacional de ${year}! (+2.000.000€)`,
				broadcast: true,
			});
		}

		for (const div of [2, 3, 4]) {
			const winner = byDiv[div] && byDiv[div][0];
			if (winner) {
				const coachInfo = await runGet(
					game.db,
					"SELECT m.name as coach_name, m.is_human as is_human FROM teams t JOIN managers m ON t.manager_id = m.id WHERE t.id = ?",
					[winner.id],
				);
				await new Promise((resolve) => {
					game.db.run(
						"INSERT INTO palmares (team_id, season, achievement, coach_name, is_human_coach) VALUES (?, ?, ?, ?, ?)",
						[
							winner.id,
							year,
							`Campeão ${DIVISION_NAMES[div]}`,
							coachInfo?.coach_name || null,
							coachInfo?.is_human || 0,
						],
						resolve,
					);
				});
				const prize = CHAMPION_PRIZE[div];
				await new Promise((resolve) => {
					game.db.run(
						"UPDATE teams SET budget = budget + ? WHERE id = ?",
						[prize, winner.id],
						resolve,
					);
				});
				const prizeFormatted = new Intl.NumberFormat("pt-PT").format(prize);
				io.to(game.roomCode).emit("systemMessage", {
					text: `🥇 ${winner.name} é Campeão ${DIVISION_NAMES[div]} de ${year}! (+${prizeFormatted}€)`,
					broadcast: true,
				});
			}
		}

		// Sponsor revenue by division
		for (const team of allTeams) {
			const sponsorAmount = SPONSOR_REVENUE_BY_DIVISION[team.division] || 0;
			if (sponsorAmount > 0) {
				await new Promise((resolve) => {
					game.db.run(
						"UPDATE teams SET budget = budget + ? WHERE id = ?",
						[sponsorAmount, team.id],
						resolve,
					);
				});
			}
		}
		io.to(game.roomCode).emit("systemMessage", {
			text: "📺 Receitas de patrocinadores distribuídas.",
			broadcast: true,
		});

		// Best scorer prize
		const topScorer = await runGet(
			game.db,
			`SELECT p.id, p.name, p.team_id, p.goals, t.name as team_name
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.goals > 0
       ORDER BY p.goals DESC, p.skill DESC
       LIMIT 1`,
		);
		if (topScorer && topScorer.team_id) {
			await new Promise((resolve) => {
				game.db.run(
					"UPDATE teams SET budget = budget + 500000 WHERE id = ?",
					[topScorer.team_id],
					resolve,
				);
			});
			await new Promise((resolve) => {
				game.db.run(
					"INSERT INTO palmares (team_id, season, achievement, coach_name, is_human_coach, player_id) VALUES (?, ?, ?, ?, ?, ?)",
					[
						topScorer.team_id,
						year,
						`Melhor Marcador (${topScorer.goals} golos)`,
						topScorer.name,
						1,
						topScorer.id,
					],
					resolve,
				);
			});
			io.to(game.roomCode).emit("systemMessage", {
				text: `⚽ ${topScorer.name} (${topScorer.team_name}) é o Melhor Marcador com ${topScorer.goals} golos! (+500.000€ para ${topScorer.team_name})`,
				broadcast: true,
			});
		}

		// Jornal do Clube persiste entre épocas — não apagar club_news.
		// As notícias são agregadas por ano no frontend (ClubTab.jsx) para evitar lista infinita.

		const promotions: Array<{
			teamId: number;
			toDiv: number;
			fromDiv: number;
			teamName: string;
		}> = [];

		// Equipas despromovidas do CP (div 4) — usadas no fim da função para o
		// despedimento obrigatório de treinadores humanos.
		const relegatedFromDiv4: number[] = [];

		function pickRandomTeamIds(teams: any[], count: number): number[] {
			const pool = [...teams];
			for (let i = pool.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[pool[i], pool[j]] = [pool[j], pool[i]];
			}
			return pool.slice(0, Math.min(count, pool.length)).map((team) => team.id);
		}

		for (const [upperDiv, lowerDiv] of [
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
		]) {
			const upper = byDiv[upperDiv] || [];
			const lower = byDiv[lowerDiv] || [];
			if (!upper.length || !lower.length) continue;
			const relegated = upper.slice(-2).map((team) => team.id);
			if (upperDiv === 4 && lowerDiv === 5)
				relegatedFromDiv4.push(...relegated);
			const promoted =
				upperDiv === 4 && lowerDiv === 5
					? pickRandomTeamIds(lower, 2)
					: lower.slice(0, 2).map((team) => team.id);
			relegated.forEach((id) => {
				const team = allTeams.find((t: any) => t.id === id);
				promotions.push({
					teamId: id,
					toDiv: lowerDiv,
					fromDiv: upperDiv,
					teamName: team?.name || `Equipa ${id}`,
				});
			});
			promoted.forEach((id) => {
				const team = allTeams.find((t: any) => t.id === id);
				promotions.push({
					teamId: id,
					toDiv: upperDiv,
					fromDiv: lowerDiv,
					teamName: team?.name || `Equipa ${id}`,
				});
			});
		}

		const dbRun = (sql: string, params: any[] = []) =>
			new Promise<void>((resolve, reject) =>
				game.db.run(sql, params, (err: any) => (err ? reject(err) : resolve())),
			);

		await dbRun("BEGIN");
		try {
			for (const promotion of promotions) {
				await dbRun("UPDATE teams SET division = ? WHERE id = ?", [
					promotion.toDiv,
					promotion.teamId,
				]);
			}
			await dbRun(
				"UPDATE teams SET points=0, wins=0, draws=0, losses=0, goals_for=0, goals_against=0",
			);
			await dbRun("COMMIT");
		} catch (txErr) {
			await dbRun("ROLLBACK").catch(() => {});
			throw txErr;
		}

		// Persist avg_attendance per team (rolling average: blend previous + this season)
		for (const team of allTeams) {
			const homeMatches = await runAll<{ attendance: number }>(
				game.db,
				"SELECT attendance FROM matches WHERE home_team_id = ? AND played = 1 AND attendance > 0",
				[team.id],
			);
			if (homeMatches.length > 0) {
				const seasonAvg = Math.round(
					homeMatches.reduce((s, m) => s + (m.attendance || 0), 0) /
						homeMatches.length,
				);
				const prevAvg = team.avg_attendance || 0;
				const newAvg =
					prevAvg > 0 ? Math.round((prevAvg + seasonAvg) / 2) : seasonAvg;
				await new Promise((resolve) => {
					game.db.run(
						"UPDATE teams SET avg_attendance = ? WHERE id = ?",
						[newAvg, team.id],
						resolve,
					);
				});
			}
		}
		// ── Off-season decay & idleness (age-free) ─────────────────────
		// Runs BEFORE stats reset so games_played is still available
		await applyOffSeasonDecay(game);

		await dbRun("BEGIN");
		try {
			await dbRun(
				"UPDATE players SET career_goals = career_goals + goals, career_reds = career_reds + red_cards, career_injuries = career_injuries + injuries, career_games = career_games + games_played",
			);
			await dbRun(
				// last_appearance_matchweek stores calendar slots (0-based); it must reset with
        // the season or the engine's per-slot replay guard blocks slot 0 of the new
        // season for players who appeared late in the previous one.
        "UPDATE players SET goals = 0, red_cards = 0, injuries = 0, games_played = 0, suspension_games = 0, suspension_until_matchweek = 0, injury_until_matchweek = 0, transfer_cooldown_until_matchweek = 0, last_appearance_matchweek = 0",
			);
			await dbRun("COMMIT");
		} catch (txErr) {
			await dbRun("ROLLBACK").catch(() => {});
			throw txErr;
		}

		// Carregar equipas com as NOVAS divisões (pós-promoção/despromoção)
		// antes de resetar o estado do jogo, para que o saveGameState abaixo
		// já persista os fixtureSeeds corretos e elimine a janela onde seeds
		// antigos podiam ficar gravados na DB.
		const updatedTeams = await getTeamsWithCoachNames(game.db);

		// Gerar fixtureSeeds com as equipas nas suas NOVAS divisões
		game.fixtureSeeds = {};
		for (const div of [1, 2, 3, 4]) {
			const divTeams = updatedTeams
				.filter((t: any) => t.division === div)
				.sort((a: any, b: any) => a.id - b.id);
			if (divTeams.length > 0) {
				const ids: number[] = divTeams.map((t: any) => t.id);
				for (let i = ids.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[ids[i], ids[j]] = [ids[j], ids[i]];
				}
				game.fixtureSeeds[div] = ids;
			}
		}
		console.log(
			`[${game.roomCode}] 🎲 fixtureSeeds gerados para nova época:`,
			Object.entries(game.fixtureSeeds)
				.map(([d, ids]) => `div${d}=${ids.length}eq`)
				.join(", "),
		);

		// Limpar estado de treino da época concluída antes de reiniciar o
		// calendarIndex — as tabelas guardam o calendarIndex 0-based por época
		// e, sem limpeza, as linhas da época anterior colidiam com a nova época
		// (histórico misturado, foco stale, carry-forward sem referência).
		await clearSeasonTrainingState(game);

		// Reset to new season — agora com fixtureSeeds já corretos em memória
		game.season += 1;
		game.year += 1;
		game.calendarIndex = 0;
		game.matchweek = 1;
		game.gamePhase = "lobby";
		game.currentEvent = SEASON_CALENDAR[0];
		game.currentFixtures = [];
		game.allMatchResults = {};
		game.cupTeamIds = [];
		game.cupHalftimePayload = null;
		game.lastHalftimePayload = null;
		game.dismissalsThisSeason = new Set<string>();
		game.negativeBudgetStreak = {};
		game.boardBudgetWarned = {};
		clearPhaseTimer(game);
		game.phaseAcks = new Set();
		game.phaseToken = "";
		saveGameState(game);

		io.to(game.roomCode).emit("teamsData", updatedTeams);
		io.to(game.roomCode).emit("topScorers", []); // Reset top scorers for new season
		io.to(game.roomCode).emit("teamForms", {}); // Reset form display for new season

		// Build season-end summary for the modal
		const divisionChampions = ([1, 2, 3, 4] as number[])
			.map((div) => {
				const winner = byDiv[div]?.[0];
				if (!winner) return null;
				return {
					divId: div,
					divName: DIVISION_NAMES[div] || `Divisão ${div}`,
					teamId: winner.id,
					teamName: winner.name,
					prize: CHAMPION_PRIZE[div] || 0,
				};
			})
			.filter(Boolean);
		const cupWinnerRow = await runGet(
			game.db,
			`SELECT p.team_id, t.name as team_name
       FROM palmares p
       JOIN teams t ON p.team_id = t.id
       WHERE p.season = ? AND p.achievement = 'Vencedor da Taça de Portugal'
       LIMIT 1`,
			[year],
		);

		io.to(game.roomCode).emit("seasonEnd", {
			season,
			year,
			newSeason: game.season,
			champion: iLigaWinner
				? { id: iLigaWinner.id, name: iLigaWinner.name }
				: null,
			promotions,
			divisionChampions,
			cupWinner: cupWinnerRow
				? {
						teamId: cupWinnerRow.team_id,
						teamName: cupWinnerRow.team_name,
						prize: 500000,
					}
				: null,
			topScorer: topScorer
				? {
						name: topScorer.name,
						teamId: topScorer.team_id,
						teamName: topScorer.team_name,
						goals: topScorer.goals,
						prize: 500000,
					}
				: null,
		});

		// Despedimento obrigatório de treinadores humanos despromovidos do
		// Campeonato de Portugal: a sua equipa caiu para o pool invisível da
		// div 5 — sem realocação, o coach ficaria numa equipa que não joga.
		try {
			await processRelegatedHumanCoaches(game, relegatedFromDiv4);
		} catch (relegationErr) {
			console.error(
				`[${game.roomCode}] Relegation coach dismissal error:`,
				relegationErr,
			);
		}
	}

	// ─── CUP DRAW ──────────────────────────────────────────────────────────────

	async function generateCupDraw(game: ActiveGame, round: number) {
		const season = game.season;
		let teamIds: number[];

		if (round === 1) {
			const teams = await runAll(
				game.db,
				"SELECT id FROM teams WHERE division BETWEEN 1 AND 4 ORDER BY id",
			);
			teamIds = teams.map((team: any) => team.id);
			if (teamIds.length !== CUP_TEAMS_BY_ROUND[1]) {
				throw new Error(
					`Cup round ${round} expected ${CUP_TEAMS_BY_ROUND[1]} teams from divisions 1-4, got ${teamIds.length}`,
				);
			}
		} else {
			const prevRound = await runAll(
				game.db,
				"SELECT winner_team_id FROM cup_matches WHERE season = ? AND round = ? AND played = 1",
				[season, round - 1],
			);
			teamIds = prevRound.map((row: any) => row.winner_team_id).filter(Boolean);
			const expectedTeams = CUP_TEAMS_BY_ROUND[round] || 0;
			if (teamIds.length !== expectedTeams) {
				throw new Error(
					`Cup round ${round} expected ${expectedTeams} winners, got ${teamIds.length}`,
				);
			}
		}

		// Fisher-Yates shuffle (skip for finals — neutral ground)
		if (round !== 5) {
			for (let i = teamIds.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]];
			}
		}

		const fixtures: Array<{ homeTeamId: number; awayTeamId: number }> = [];
		// Idempotência: se este sorteio já foi gerado numa sessão anterior que
		// crashou antes do saveGameState, apagar os registos por jogar desta ronda
		// antes de reinserir. Nunca toca em rondas já jogadas (played = 1) — os
		// vencedores que alimentam as rondas seguintes ficam intactos.
		await new Promise((resolve) => {
			game.db.run(
				"DELETE FROM cup_matches WHERE season = ? AND round = ? AND played = 0",
				[season, round],
				resolve,
			);
		});
		for (let i = 0; i < teamIds.length; i += 2) {
			const homeId = teamIds[i];
			const awayId = teamIds[i + 1];
			if (!homeId || !awayId) continue;
			await new Promise((resolve) => {
				game.db.run(
					"INSERT INTO cup_matches (season, round, home_team_id, away_team_id) VALUES (?, ?, ?, ?)",
					[season, round, homeId, awayId],
					resolve,
				);
			});
			fixtures.push({ homeTeamId: homeId, awayTeamId: awayId });
		}

		game.cupTeamIds = teamIds;
		return fixtures;
	}

	// ─── PREPARE CUP ROUND ──────────────────────────────────────────────────────
	// Generates the draw, populates game.currentFixtures, emits cupDrawStart.
	// Does NOT change gamePhase — that is the caller's responsibility.
	// Called when transitioning TO the lobby for a cup week, so coaches can
	// see their opponent and set tactics before clicking Ready.

	async function startCupRound(game: ActiveGame, round: number) {
		// Only emit the draw animation when in lobby. During crash recovery
		// (fixtures regenerated mid-match), silently generate fixtures without
		// showing the draw popup to clients.
		const isLobby = game.gamePhase === "lobby";

		const drawFixtures = await generateCupDraw(game, round);

		// Enrich fixtures with team info
		const enrichedFixtures: any[] = [];
		for (const fixture of drawFixtures) {
			const home = await runGet(
				game.db,
				"SELECT id, name, color_primary, color_secondary FROM teams WHERE id = ?",
				[fixture.homeTeamId],
			);
			const away = await runGet(
				game.db,
				"SELECT id, name, color_primary, color_secondary FROM teams WHERE id = ?",
				[fixture.awayTeamId],
			);
			enrichedFixtures.push({
				homeTeamId: fixture.homeTeamId,
				awayTeamId: fixture.awayTeamId,
				homeTeam: home,
				awayTeam: away,
				round,
				finalHomeGoals: 0,
				finalAwayGoals: 0,
				events: [],
				homeLineup: [],
				awayLineup: [],
				// Tactics are NOT pre-assigned here — they are read live from
				// game.playersByName[p].tactic at match start, same as league.
			});
		}

		game.currentFixtures = enrichedFixtures;
		game.currentEvent = SEASON_CALENDAR[game.calendarIndex];
		game.cupHalftimePayload = null;

		// Skip draw animation for the final (round 5) — fixtures are set silently
		if (round === 5) return;

		if (!isLobby) {
			// Crash recovery during active match: mark as seen, skip the popup
			const connectedPlayers = getPlayerList(game);
			for (const player of connectedPlayers) {
				game.cupDrawSeenBy.add(player.name);
			}
			return;
		}

		// Reset draw-seen tracking for this new round
		game.cupDrawSeenBy = new Set();

		// Compute humanInCup for the client's draw payload
		const connectedPlayers = getPlayerList(game);
		const humanTeamIds = new Set(connectedPlayers.map((p) => p.teamId));
		const humanInCup = game.cupTeamIds.some((id) => humanTeamIds.has(id));

		const drawPayload = {
			round,
			roundName: CUP_ROUND_NAMES[round] || `Ronda ${round}`,
			fixtures: enrichedFixtures.map((f) => ({
				homeTeam: f.homeTeam,
				awayTeam: f.awayTeam,
			})),
			humanInCup,
			season: game.season,
		};

		// Emit draw so clients can show the animation in the lobby
		io.to(game.roomCode).emit("cupDrawStart", drawPayload);

		// Mark all currently connected coaches as having seen the draw
		for (const player of connectedPlayers) {
			game.cupDrawSeenBy.add(player.name);
		}
	}

	// ─── CUP ROUND FINALIZATION (ET + PENALTIES) ────────────────────────────────
	// Called by weeklyFlowHelpers after cup second half completes.

	async function finalizeCupRound(game: ActiveGame) {
		const entry = game.currentEvent as any;
		const round = entry?.round;
		const season = game.season;
		const fixtures = game.currentFixtures;
		const roundName = CUP_ROUND_NAMES[round] || `Ronda ${round}`;

		console.log(
			`[${game.roomCode}] 🏆 finalizeCupRound | round=${round} (${roundName}) | fixtures=${fixtures.length}`,
		);

		// ── Determine which fixtures are drawn at 90 min ──────────────────────────
		const drawnFixtures = fixtures.filter(
			(fx: any) => fx.finalHomeGoals === fx.finalAwayGoals,
		);
		const hasAnyET = drawnFixtures.length > 0;
		const humanInAnyDraw = drawnFixtures.some((fixture: any) =>
			(Object.values(game.playersByName) as PlayerSession[]).some(
				(p) =>
					p.socketId &&
					(p.teamId === fixture.homeTeamId ||
						p.teamId === fixture.awayTeamId),
			),
		);

		// ── Phase 2 (gate): extra time — all drawn fixtures batched ───────────────
		// If a human coach is in a drawn fixture, pause for tactics (substitutions)
		// before ET. The gate is state-machine driven: this function returns here
		// and checkAllReady advances once the relevant coaches are ready (a 90s
		// safety timer forces ET otherwise). A transient in-memory promise is NOT
		// used, so a crash can never strand the round at match_et_gate.
		if (hasAnyET && humanInAnyDraw) {
			console.log(
				`[${game.roomCode}] ⏸ ET gate: waiting for coaches in drawn fixtures to ready up`,
			);
			// Reset ready states BEFORE changing phase
			Object.values(game.playersByName).forEach((p: any) => {
				p.ready = false;
			});
			game.gamePhase = "match_et_gate";
			const etGatePayload = {
				round,
				roundName,
				season,
				fixtures: fixtures.map((fx: any) => ({
					homeTeam: fx.homeTeam || null,
					awayTeam: fx.awayTeam || null,
					homeGoals: fx.finalHomeGoals,
					awayGoals: fx.finalAwayGoals,
					events: (fx.events || []).slice(),
					homeLineup: fx.homeLineup || [],
					awayLineup: fx.awayLineup || [],
					attendance: fx.attendance || null,
					homePossession: fx._homePossession ?? 50,
					awayPossession: fx._awayPossession ?? 50,
				})),
			};
			game.lastHalftimePayload = etGatePayload;
			emitPresence(game);
			io.to(game.roomCode).emit("cupETHalfTime", etGatePayload);
			saveGameState(game);

			// Safety fallback: if the relevant coaches stall or disconnect, force ET
			// after 90s instead of leaving the round stuck at match_et_gate.
			if (game._etGateTimer) clearTimeout(game._etGateTimer);
			game._etGateTimer = setTimeout(() => {
				game._etGateTimer = null;
				continueFromEtGate(game).catch((err) =>
					console.error(
						`[${game.roomCode}] ❌ ET gate forced continuation failed:`,
						err,
					),
				);
			}, 90_000);
			return;
		}

		// No gate required (NPC-only ET or no ET) — continue immediately.
		await continueFromEtGate(game);
	}

	/**
	 * Runs the cup round after the extra-time gate (or directly when no gate is
	 * needed). State-machine driven: called by checkAllReady once all coaches in
	 * drawn fixtures are ready, by the 90s safety timer, or inline by
	 * finalizeCupRound — so an orphaned promise can never strand the round.
	 */
	async function continueFromEtGate(game: ActiveGame) {
		if (game._etGateRunning) {
			console.warn(
				`[${game.roomCode}] ⚠ continueFromEtGate already running — skipping`,
			);
			return;
		}
		if (
			game.gamePhase !== "match_et_gate" &&
			game.gamePhase !== "match_finalizing"
		) {
			console.warn(
				`[${game.roomCode}] ⚠ continueFromEtGate skipped | phase=${game.gamePhase} (not in ET gate)`,
			);
			return;
		}
		if (game._etGateTimer) {
			clearTimeout(game._etGateTimer);
			game._etGateTimer = null;
		}
		game._etGateRunning = true;

		const entry = game.currentEvent as any;
		const round = entry?.round;
		const season = game.season;
		const fixtures = game.currentFixtures;
		const roundName = CUP_ROUND_NAMES[round] || `Ronda ${round}`;
		const results: any[] = [];

		try {

		// ── Phase 1: Setup tactics and snapshot 90-min scores ────────────────────
		type FixtureSetup = {
			fixture: any;
			t1: any;
			t2: any;
			ctx: any;
			goals90Home: number;
			goals90Away: number;
		};
		const setups: FixtureSetup[] = await Promise.all(
			fixtures.map(async (fixture) => {
				const p1 = Object.values(game.playersByName).find(
					(p: any) => p.teamId === fixture.homeTeamId,
				);
				const p2 = Object.values(game.playersByName).find(
					(p: any) => p.teamId === fixture.awayTeamId,
				);
				let t1 = (p1 as any)?.tactic || fixture._t1;
				let t2 = (p2 as any)?.tactic || fixture._t2;
				if (!t1) {
					t1 = await generateAITactic(
						game.db,
						fixture.homeTeamId,
						fixture.awayTeamId,
						game.matchweek,
					);
				}
				if (!t2) {
					t2 = await generateAITactic(
						game.db,
						fixture.awayTeamId,
						fixture.homeTeamId,
						game.matchweek,
					);
				}
				fixture._t1 = t1;
				fixture._t2 = t2;
				console.log(
					`[${game.roomCode}] 🏆 Cup fixture result: ${fixture.homeTeam?.name ?? fixture.homeTeamId} ${fixture.finalHomeGoals}-${fixture.finalAwayGoals} ${fixture.awayTeam?.name ?? fixture.awayTeamId}`,
				);
				return {
					fixture,
					t1,
					t2,
					ctx: { game, io, matchweek: game.matchweek, calendarIndex: game.calendarIndex },
					goals90Home: fixture.finalHomeGoals,
					goals90Away: fixture.finalAwayGoals,
				};
			}),
		);

		// ── Phase 2: Extra time — all drawn fixtures batched ─────────────────────
		const drawnSetups = setups.filter((s) => s.goals90Home === s.goals90Away);
		const hasAnyET = drawnSetups.length > 0;

		if (hasAnyET) {
			console.log(
				`[${game.roomCode}] 🏆 ${drawnSetups.length} fixture(s) drawn at 90 min — ET`,
			);

			// Only apply ET substitutions when a human coach is in a drawn fixture —
			// NPC-only draws keep the original (no-sub) behavior.
			const humanInAnyDraw = drawnSetups.some(({ fixture }) =>
				(Object.values(game.playersByName) as PlayerSession[]).some(
					(p) =>
						p.socketId &&
						(p.teamId === fixture.homeTeamId ||
							p.teamId === fixture.awayTeamId),
				),
			);

			// Mark ET as running BEFORE applying substitutions — a failure here must
			// not leave the round wedged at match_et_gate (match_extra_time recovers
			// via the standard transient-phase restart path).
			game.gamePhase = "match_extra_time";
			game._etSimCompleted = false;

			// Apply ET substitutions and re-read tactics changed during the pause screen
			if (humanInAnyDraw) {
				const lineupSnapshotET = (
					squad: any[],
					fx: any,
					teamSide: "home" | "away",
				) =>
					squad.map((p) => ({
						id: p.id,
						name: p.name,
						position: p.position,
						is_star: p.is_star || 0,
						skill: p.skill,
						...getMatchFatigueSnapshot(fx, teamSide, p.id),
					}));

				const applyETSubs = (
					squad: any[] | undefined,
					tactic: any,
					fullRoster: any[] | undefined,
					fx: any,
					teamSide: "home" | "away",
				) => {
					if (!squad || !tactic?.positions || !fullRoster) return;
					const positions: Record<number, string> = tactic.positions;
					const currentIds = new Set(squad.map((p: any) => p.id));
					const toRemoveIds = squad
						.filter((p: any) => positions[p.id] === "Suplente")
						.map((p: any) => p.id);
					let toAddIds = Object.entries(positions)
						.filter(
							([id, status]) =>
								status === "Titular" && !currentIds.has(Number(id)),
						)
						.map(([id]) => Number(id));

					// Filter out injured and red-carded players from incoming substitutions
					const injuredIds = new Set(
						(fx.events || [])
							.filter(
								(e: any) =>
									(e.type === "injury" || e.type === "red") &&
									e.team === teamSide &&
									e.playerId,
							)
							.map((e: any) => e.playerId),
					);
					toAddIds = toAddIds.filter((id) => !injuredIds.has(id));
					// Players already subbed out earlier (halftime, in-match) cannot re-enter in ET.
					const subbedOut = fx._subbedOut as Set<number> | undefined;
					toAddIds = toAddIds.filter((id) => !subbedOut?.has(id));

					if (toRemoveIds.length === 0 && toAddIds.length === 0) return;

					// Limitado ao número de substituições ainda possíveis na partida.
					// Substituições de alongamento também esgotam o limite por equipa.
					const teamId =
						teamSide === "home" ? fx.homeTeamId : fx.awayTeamId;
					const maxPairs = Math.min(
						toRemoveIds.length,
						toAddIds.length,
						remainingSubstitutions(fx, teamId),
					);
					if (maxPairs <= 0) return;

					// Limitar às substituições ainda permitidas (ordem de declaração).
					const limitedOutIds = toRemoveIds.slice(0, maxPairs);
					const limitedInIds = toAddIds.slice(0, maxPairs);

					const outPlayers = limitedOutIds
						.map((id: number) => squad.find((p: any) => p.id === id))
						.filter(Boolean);
					const inPlayers = limitedInIds
						.map((id: number) => fullRoster.find((p: any) => p.id === id))
						.filter(Boolean);

					for (const id of limitedOutIds) {
						const idx = squad.findIndex((p: any) => p.id === id);
						if (idx > -1) squad.splice(idx, 1);
						(fx._subbedOut ??= new Set<number>()).add(id);
					}
					for (const player of inPlayers) {
						squad.push(player);
					}

					// Cada substituição feita conta para o limite de substituições da partida.
					for (let i = 0; i < maxPairs; i++) {
						incrementSubCount(fx, teamId);
					}

					if (teamSide === "home") {
						fx.homeLineup = lineupSnapshotET(squad, fx, teamSide);
					} else {
						fx.awayLineup = lineupSnapshotET(squad, fx, teamSide);
					}

					const pairs = Math.min(outPlayers.length, inPlayers.length);
					for (let i = 0; i < pairs; i++) {
						fx.events = fx.events || [];
						fx.events.push({
							minute: 90,
							type: "et_sub",
							team: teamSide,
							emoji: "🔁",
							outPlayerId: outPlayers[i].id,
							outPlayerName: outPlayers[i].name,
							playerId: inPlayers[i].id,
							playerName: inPlayers[i].name,
							position: inPlayers[i].position,
							text: `[90+ET] 🔁 ${outPlayers[i].name} → ${inPlayers[i].name}`,
						});
					}
				};

				for (const setup of drawnSetups) {
					const { fixture: fx } = setup;
					const p1 = Object.values(game.playersByName).find(
						(p: any) => p.teamId === fx.homeTeamId,
					);
					const p2 = Object.values(game.playersByName).find(
						(p: any) => p.teamId === fx.awayTeamId,
					);
					if ((p1 as any)?.tactic) {
						setup.t1 = (p1 as any).tactic;
						fx._t1 = (p1 as any).tactic;
					}
					if ((p2 as any)?.tactic) {
						setup.t2 = (p2 as any).tactic;
						fx._t2 = (p2 as any).tactic;
					}
					applyETSubs(fx._homeSquad, setup.t1, fx._homeFullRoster, fx, "home");
					applyETSubs(fx._awaySquad, setup.t2, fx._awayFullRoster, fx, "away");
				}
			}

			// Emit cupExtraTimeStart ONCE — use the human's drawn fixture if available
			const primaryDrawn =
				drawnSetups.find(({ fixture }) =>
					(Object.values(game.playersByName) as PlayerSession[]).some(
						(p) =>
							p.socketId &&
							(p.teamId === fixture.homeTeamId ||
								p.teamId === fixture.awayTeamId),
					),
				)?.fixture ?? drawnSetups[0].fixture;
			io.to(game.roomCode).emit("cupExtraTimeStart", {
				homeTeamId: primaryDrawn.homeTeamId,
				awayTeamId: primaryDrawn.awayTeamId,
				homeGoals: primaryDrawn.finalHomeGoals,
				awayGoals: primaryDrawn.finalAwayGoals,
			});

			console.log(
				`[${game.roomCode}] 🏆 Simulating ET for ${drawnSetups.length} fixture(s) in parallel...`,
			);
			// Simulate ALL drawn fixtures' ET simultaneously so the clock only runs once
			await Promise.all(
				drawnSetups.map(({ fixture, t1, t2, ctx }) => {
					(ctx as any).hasHumanInET = humanInAnyDraw;
					return simulateExtraTime(game.db, fixture, t1, t2, ctx);
				}),
			);

			// Post-ET: determine winner (or penalties) for each drawn fixture
			for (const { fixture, t1, t2, goals90Home, goals90Away } of drawnSetups) {
				console.log(
					`[${game.roomCode}] 🏆 ET result: ${fixture.finalHomeGoals}-${fixture.finalAwayGoals} | ${fixture.homeTeam?.name ?? fixture.homeTeamId} vs ${fixture.awayTeam?.name ?? fixture.awayTeamId}`,
				);
				io.to(game.roomCode).emit("extraTimeEnded", {
					homeTeamId: fixture.homeTeamId,
					awayTeamId: fixture.awayTeamId,
					homeGoals: fixture.finalHomeGoals,
					awayGoals: fixture.finalAwayGoals,
				});

				// Golos marcados APENAS no prolongamento (o score final pós-ET já
				// inclui os 90'). O bracket soma home_score + home_et_score para
				// obter o resultado final — guardar o total aqui duplicaria golos.
				const etGoalsHome = fixture.finalHomeGoals - goals90Home;
				const etGoalsAway = fixture.finalAwayGoals - goals90Away;

				if (etGoalsHome !== etGoalsAway) {
					fixture._winnerId =
						etGoalsHome > etGoalsAway ? fixture.homeTeamId : fixture.awayTeamId;
					console.log(
						`[${game.roomCode}] 🏆 Winner decided in ET: teamId=${fixture._winnerId}`,
					);
				} else {
					console.log(
						`[${game.roomCode}] 🏆 Still draw after ET — going to penalties`,
					);
					// Usar os squads pós-substituições de ET (em memória) para o
					// shootout — um fetch fresco da DB ignoraria as trocas feitas
					// na pausa e poderia incluir lesionados/expulsos que o
					// applyETSubs filtrou. Fallback para getTeamSquad só se faltar.
					const homeSquad =
						(fixture._homeSquad && fixture._homeSquad.length > 0
							? fixture._homeSquad
							: await getTeamSquad(
									game.db,
									fixture.homeTeamId,
									t1,
									game.matchweek,
								)) as any[];
					const awaySquad =
						(fixture._awaySquad && fixture._awaySquad.length > 0
							? fixture._awaySquad
							: await getTeamSquad(
									game.db,
									fixture.awayTeamId,
									t2,
									game.matchweek,
								)) as any[];
					const shootout = simulatePenaltyShootout(homeSquad, awaySquad);

					const humanInThisFixture = (
						Object.values(game.playersByName) as PlayerSession[]
					).some(
						(p) =>
							p.socketId &&
							(p.teamId === fixture.homeTeamId ||
								p.teamId === fixture.awayTeamId),
					);
					if (humanInThisFixture) {
						io.to(game.roomCode).emit("cupPenaltyShootout", {
							round,
							homeTeamId: fixture.homeTeamId,
							awayTeamId: fixture.awayTeamId,
							...shootout,
						});
					}

					fixture._penaltyHomeGoals = shootout.homeGoals;
					fixture._penaltyAwayGoals = shootout.awayGoals;
					fixture._decidedByPenalties = true;
					fixture._winnerId =
						shootout.homeGoals > shootout.awayGoals
							? fixture.homeTeamId
							: fixture.awayTeamId;
					console.log(
						`[${game.roomCode}] 🏆 Penalties: ${shootout.homeGoals}-${shootout.awayGoals} → winner teamId=${fixture._winnerId}`,
					);

					await new Promise((resolve) => {
						game.db.run(
							"UPDATE cup_matches SET home_penalties = ?, away_penalties = ?, played = 1, winner_team_id = ? WHERE season = ? AND round = ? AND home_team_id = ? AND away_team_id = ?",
							[
								shootout.homeGoals,
								shootout.awayGoals,
								fixture._winnerId,
								season,
								round,
								fixture.homeTeamId,
								fixture.awayTeamId,
							],
							resolve,
						);
					});
				}

				await new Promise((resolve) => {
					game.db.run(
						"UPDATE cup_matches SET home_et_score = ?, away_et_score = ? WHERE season = ? AND round = ? AND home_team_id = ? AND away_team_id = ?",
						[
							etGoalsHome,
							etGoalsAway,
							season,
							round,
							fixture.homeTeamId,
							fixture.awayTeamId,
						],
						resolve,
					);
				});
			}
		}

		// ── Phase 3: DB updates, morale, and results for all fixtures ────────────
		// Bilheteira da Taça: credita attendance × 15 € à equipa da casa de cada
		// eliminatória (mesma tarifa da liga) e persiste attendance em cup_matches.
		// Executado antes dos resultados para garantir que receita e attendance fazem
		// parte do bloco idempotente marcado por applied_weeks('finalized').
		const upsets: Array<{
			winnerName: string;
			winnerDiv: number;
			loserName: string;
			loserDiv: number;
		}> = [];
		// Transacção atómica para receita + resultados + marker (recuperação de crash)
		await new Promise<void>((resolve) => game.db.run("BEGIN TRANSACTION", () => resolve()));
		let cupTxFailed = false;
		try {
		for (const { fixture, t1, t2, goals90Home, goals90Away } of setups) {
			// ── Bilheteira da Taça (mesma tarifa da liga: 15 € por espectador)
			const cupRevenue = (fixture.attendance || 0) * 15;
			if (cupRevenue > 0) {
				await new Promise<void>((resolve) => {
					game.db.run("UPDATE teams SET budget = budget + ? WHERE id = ?", [cupRevenue, fixture.homeTeamId], () => resolve());
				});
				logClubNews(game, "ticket_revenue", "Bilheteiras", fixture.homeTeamId, {
					amount: cupRevenue,
					description: `Receita de bilheteiras — Taça ${roundName}`,
					related_team_id: fixture.awayTeamId,
					related_team_name: (fixture.awayTeam as any)?.name || null,
				});
			}
			// Persiste attendance mesmo quando 0 (para auditoria e finances)
			await new Promise<void>((resolve) => {
				game.db.run(
					"UPDATE cup_matches SET attendance = ? WHERE season = ? AND round = ? AND home_team_id = ? AND away_team_id = ?",
					[fixture.attendance || 0, season, round, fixture.homeTeamId, fixture.awayTeamId],
					() => resolve(),
				);
			});
			const winnerId =
				fixture._winnerId ??
				(goals90Home > goals90Away ? fixture.homeTeamId : fixture.awayTeamId);

			// Memória táctica (Taça) — +1 estrela por jogo para todas as equipas
			const updateCupFamiliarity = (
				teamId: number,
				tactic: any,
				won: boolean,
			) => {
				if (!tactic?.formation || !tactic?.style) return;
				// Memória táctica: fonte de verdade é a memória do jogo
				updateTacticFamiliarity(
					game,
					teamId,
					tactic,
					game.matchweek,
					won ? "V" : "D",
				);
				const playerState = Object.values(game.playersByName).find(
					(p: any) => p.teamId === teamId && p.socketId,
				);
				if (!playerState) return;
				// Linha de auditoria (apenas coaches humanos)
				game.db.run(
					"INSERT INTO player_tactic_history (team_id, player_name, formation, style, matchweek, competition, result) VALUES (?, ?, ?, ?, ?, ?, ?)",
					[
						teamId,
						playerState.name,
						tactic.formation,
						tactic.style,
						game.matchweek,
						"cup",
						won ? "V" : "D",
					],
				);
			};
			updateCupFamiliarity(
				fixture.homeTeamId,
				t1,
				winnerId === fixture.homeTeamId,
			);
			updateCupFamiliarity(
				fixture.awayTeamId,
				t2,
				winnerId === fixture.awayTeamId,
			);

			await new Promise((resolve) => {
				game.db.run(
					"UPDATE cup_matches SET home_score = ?, away_score = ?, played = 1, winner_team_id = ? WHERE season = ? AND round = ? AND home_team_id = ? AND away_team_id = ?",
					[
						goals90Home,
						goals90Away,
						winnerId,
						season,
						round,
						fixture.homeTeamId,
						fixture.awayTeamId,
					],
					resolve,
				);
			});

			// Cup upset drama by division gap: the lower-division team that
			// advances gets an extra morale spike and the higher-division team
			// it eliminates takes a matching extra hit.
			const [homeDiv, awayDiv] = await Promise.all([
				runGet(game.db, "SELECT division FROM teams WHERE id = ?", [
					fixture.homeTeamId,
				]),
				runGet(game.db, "SELECT division FROM teams WHERE id = ?", [
					fixture.awayTeamId,
				]),
			]);
			const winnerIsHome = winnerId === fixture.homeTeamId;
			const winnerDiv = winnerIsHome
				? (homeDiv?.division ?? 5)
				: (awayDiv?.division ?? 5);
			const loserDiv = winnerIsHome
				? (awayDiv?.division ?? 5)
				: (homeDiv?.division ?? 5);
			if (loserDiv < winnerDiv) {
				const divDiff = winnerDiv - loserDiv;
				const upsetMorale = Math.min(30, divDiff * 10);
				await new Promise((resolve) => {
					game.db.run(
						"UPDATE teams SET morale = MIN(100, morale + ?) WHERE id = ?",
						[upsetMorale, winnerId],
						resolve,
					);
				});
				const loserId = winnerIsHome
					? fixture.awayTeamId
					: fixture.homeTeamId;
				await new Promise((resolve) => {
					game.db.run(
						"UPDATE teams SET morale = MAX(0, morale - ?) WHERE id = ?",
						[upsetMorale, loserId],
						resolve,
					);
				});
				const winnerName =
					(winnerIsHome ? fixture.homeTeam : fixture.awayTeam)?.name ?? "Desconhecido";
				const loserName =
					(winnerIsHome ? fixture.awayTeam : fixture.homeTeam)?.name ??
					"Desconhecido";
				upsets.push({ winnerName, winnerDiv, loserName, loserDiv });
			}

			results.push({
				homeTeamId: fixture.homeTeamId,
				awayTeamId: fixture.awayTeamId,
				homeTeam: fixture.homeTeam || null,
				awayTeam: fixture.awayTeam || null,
				homeGoals: fixture.finalHomeGoals,
				awayGoals: fixture.finalAwayGoals,
				winnerId,
				wentToET:
					!!fixture._decidedByPenalties ||
					fixture.events.some((e: any) => e.minute > 90),
				decidedByPenalties: !!fixture._decidedByPenalties,
				penaltyHomeGoals: fixture._penaltyHomeGoals ?? null,
				penaltyAwayGoals: fixture._penaltyAwayGoals ?? null,
				events: fixture.events,
			});

			if (round === 5) {
				const winnerTeam = await runGet(
					game.db,
					"SELECT name FROM teams WHERE id = ?",
					[winnerId],
				);
				const coachInfo = await runGet(
					game.db,
					"SELECT m.name as coach_name, m.is_human as is_human FROM teams t JOIN managers m ON t.manager_id = m.id WHERE t.id = ?",
					[winnerId],
				);
				await new Promise((resolve) => {
					game.db.run(
						"INSERT INTO palmares (team_id, season, achievement, coach_name, is_human_coach) VALUES (?, ?, ?, ?, ?)",
						[
							winnerId,
							game.year,
							"Vencedor da Taça de Portugal",
							coachInfo?.coach_name || null,
							coachInfo?.is_human || 0,
						],
						resolve,
					);
				});
				await new Promise((resolve) => {
					game.db.run(
						"UPDATE teams SET budget = budget + 500000 WHERE id = ?",
						[winnerId],
						resolve,
					);
				});
				logClubNews(game, "prize", "Prémio da Taça", winnerId, {
					amount: 500000,
					description: "Vencedor da Taça de Portugal",
				});
				const updatedTeams = await getTeamsWithCoachNames(game.db);
				io.to(game.roomCode).emit("teamsData", updatedTeams);
				if (winnerTeam) {
					io.to(game.roomCode).emit("systemMessage", {
						text: `🏆 ${winnerTeam.name} venceu a Taça de Portugal de ${game.year}! (+500 000 €) no Estádio do Jamor`,
						broadcast: true,
					});
				}
			}
		}
			// Fecha transacção atómica da Taça (receita + resultados + attendance)
			await new Promise<void>((resolve) => {
				game.db.run(
					"INSERT OR IGNORE INTO applied_weeks (season, slot, kind) VALUES (?, ?, 'finalized')",
					[game.season, game.calendarIndex],
					() => resolve(),
				);
			});
			await new Promise<void>((resolve) => {
				game.db.run("COMMIT", () => resolve());
			});
		} catch (cupTxErr) {
			cupTxFailed = true;
			console.error(`[${game.roomCode}] ❌ Cup transaction failed:`, cupTxErr);
			await new Promise<void>((resolve) => game.db.run("ROLLBACK", () => resolve()));
		}
		if (cupTxFailed) return;

		// ET animation gate: wait for all connected coaches to ack before advancing
		// Os resultados já estão construídos — guardá-los permite a um coach que
		// reconecte durante o gate receber os resultados em vez de um replay
		// fantasma de um ET que já acabou.
		game._etSimCompleted = true;
		game.cupResultsPayload = {
			round,
			roundName,
			results,
			season,
			isFinal: round === 5,
		};
		if (hasAnyET) {
			const anyHumanConnected = (
				Object.values(game.playersByName) as PlayerSession[]
			).some((p) => !!p.socketId);
			if (anyHumanConnected) {
				await cupETAnimGate(game, 45000);
			}
		}

		// Emit results
		io.to(game.roomCode).emit("cupRoundResults", game.cupResultsPayload);

		// Hype das surpresas de escalão (moral já aplicada na Phase 3)
		for (const u of upsets) {
			io.to(game.roomCode).emit("systemMessage", {
				text: `⚡ SURPRESA NA TAÇA! ${u.winnerName} (${DIVISION_NAMES[u.winnerDiv]}) eliminou ${u.loserName} (${DIVISION_NAMES[u.loserDiv]})!`,
				broadcast: true,
			});
		}
		// Apply training bonuses for this completed calendar event (cup round)
		const completedCalendarIndex = game.calendarIndex;
		try {
			await applyTrainingBonuses(game, fixtures, completedCalendarIndex);
		} catch (trainErr) {
			console.error(
				`[${game.roomCode}] training (cup): error applying bonuses:`,
				trainErr,
			);
		}

		// Apply quality evolution for cup matches (same as league matches)
		try {
			await applyPostMatchQualityEvolution(
				game.db,
				fixtures,
				game.matchweek,
				game.season || 1,
				completedCalendarIndex,
			);
		} catch (evolveErr) {
			console.error(
				`[${game.roomCode}] evolution (cup): error applying quality evolution:`,
				evolveErr,
			);
		}

		// Reduzir timers de indisponibilidade para equipas que jogaram esta ronda
		if (game.cupTeamIds.length > 0) {
			const placeholders = game.cupTeamIds.map(() => "?").join(", ");
			await runAll(
				game.db,
				`UPDATE players
         SET
           injury_until_matchweek             = MAX(0, injury_until_matchweek - 1),
           suspension_until_matchweek         = MAX(0, suspension_until_matchweek - 1)
         WHERE team_id IN (${placeholders})`,
				game.cupTeamIds,
			);
			console.log(
				`[${game.roomCode}] ⏱ Timers reduzidos para ${game.cupTeamIds.length} equipas da Taça`,
			);
		}

		// Marker 'finalized' já foi comitado atomically com receita + resultados
		// (ver transacção acima) — não reinserir aqui. Training/timers correm pós-marker
		// como na liga, idempotentes por época/slot.

		// Advance calendar
		game.calendarIndex += 1;
		game.lastPlayedAt = new Date().toISOString();
		game.currentEvent = SEASON_CALENDAR[game.calendarIndex] ?? null;
		game.currentFixtures = [];
		game.cupHalftimePayload = null;
		game.lastHalftimePayload = null;
		game._etSimCompleted = false;
		game.cupResultsPayload = null;
		game.gamePhase = "lobby";
		Object.values(game.playersByName).forEach((p) => {
			p.ready = false;
		});
		console.log(
			`[${game.roomCode}] ↩ Cup round ${round} finalized → lobby | calendarIndex=${game.calendarIndex} | nextEvent=${game.currentEvent?.type ?? "none"}`,
		);
		// Estado de época para a sala: a taça não incrementa matchweek, mas o
		// calendarIndex avança — sem este broadcast o cliente ficava com o
		// nextMatchSummary stale (refetch nunca disparava após uma ronda).
		io.to(game.roomCode).emit("seasonState", {
			matchweek: game.matchweek,
			calendarIndex: game.calendarIndex,
			season: game.season,
			year: game.year,
		});
		saveGameState(game);
		// Retomar leilões pausados durante o jogo de Taça
		resumeAllPausedAuctions(game);

		// Season end if past calendar
		if (game.calendarIndex >= SEASON_CALENDAR.length) {
			try {
				await applySeasonEnd(game);
				// Nova época em curso — re-emite o estado resetado.
				io.to(game.roomCode).emit("seasonState", {
					matchweek: game.matchweek,
					calendarIndex: game.calendarIndex,
					season: game.season,
					year: game.year,
				});
			} catch (seErr) {
				console.error(`[${game.roomCode}] Season end error (from cup):`, seErr);
			}
		} else {
			emitPresence(game);
		}
		} finally {
			game._etGateRunning = false;
		}
	}

	// ─── ET ANIMATION GATE ───────────────────────────────────────────────────────

	function cupETAnimGate(game: ActiveGame, timeoutMs = 45000): Promise<void> {
		return new Promise<void>((resolve) => {
			const acks = new Set<string>();
			const timeout = setTimeout(() => {
				delete game._cupETAnimHandler;
				resolve();
			}, timeoutMs);

			game._cupETAnimHandler = (socketId: string) => {
				acks.add(socketId);
				// Only require acks from coaches whose team is in a fixture that
				// ACTUALLY went to extra time (drawn at 90'). A coach whose tie
				// was decided in regulation is an observer for the ET animation —
				// requiring their ack lets a stuck client hold the gate for the
				// full 45s timeout every round.
				const inFixture = (
					Object.values(game.playersByName) as PlayerSession[]
				).filter(
					(p) =>
						!!p.socketId &&
						game.currentFixtures.some(
							(f) =>
								(f.homeTeamId === p.teamId || f.awayTeamId === p.teamId) &&
								f.finalHomeGoals === f.finalAwayGoals,
						),
				);
				// Fallback: if no human coach is in any fixture, use all connected coaches.
				const relevant =
					inFixture.length > 0
						? inFixture
						: (Object.values(game.playersByName) as PlayerSession[]).filter(
								(p) => !!p.socketId,
							);
				if (
					relevant.length > 0 &&
					relevant.every((p) => acks.has(p.socketId as string))
				) {
					clearTimeout(timeout);
					delete game._cupETAnimHandler;
					resolve();
				}
			};
		});
	}

	// ─── RECONNECT HELPERS ───────────────────────────────────────────────────────

	/**
	 * Emit the current phase state to a reconnecting socket.
	 * Cup lobby: re-emit the draw so the client can show the matchup.
	 */
	function emitCurrentPhaseToSocket(game: ActiveGame, socket: any) {
		console.log(
			`[${game.roomCode}] 🔌 emitCurrentPhaseToSocket | phase=${game.gamePhase} | eventType=${game.currentEvent?.type ?? "none"}`,
		);

		// Lobby during a cup week: re-emit draw so reconnecting coach sees matchup
		if (
			game.gamePhase === "lobby" &&
			game.currentEvent?.type === "cup" &&
			game.currentFixtures.length > 0
		) {
			const coachName = game.socketToName[socket.id];
			if (coachName && game.cupDrawSeenBy.has(coachName)) {
				return;
			}
			const entry = game.currentEvent as any;
			const connectedPlayers = getPlayerList(game);
			const humanTeamIds = new Set(connectedPlayers.map((p) => p.teamId));
			const humanInCup = game.cupTeamIds.some((id) => humanTeamIds.has(id));
			socket.emit("cupDrawStart", {
				round: entry.round,
				roundName: entry.roundName,
				fixtures: game.currentFixtures.map((f: any) => ({
					homeTeam: f.homeTeam,
					awayTeam: f.awayTeam,
				})),
				humanInCup,
				season: game.season,
			});
			if (coachName) {
				game.cupDrawSeenBy.add(coachName);
			}
			return;
		}

		if (game.gamePhase === "match_halftime") {
			if (game.currentEvent?.type === "cup" && game.cupHalftimePayload) {
				socket.emit("cupHalfTimeResults", game.cupHalftimePayload);
			} else if (game.lastHalftimePayload) {
				socket.emit("halfTimeResults", game.lastHalftimePayload);
			}
			return;
		}

		if (game.gamePhase === "match_et_gate") {
			if (game.lastHalftimePayload) {
				socket.emit("cupETHalfTime", game.lastHalftimePayload);
			}
			return;
		}

		// Recovery para match_first_half / match_second_half: replay do estado actual ao coach reconectado
		if (
			(game.gamePhase === "match_first_half" ||
				game.gamePhase === "match_second_half") &&
			game.currentFixtures?.length > 0
		) {
			const isCupHalf = game.currentEvent?.type === "cup";
			const halfEntry = game.currentEvent as any;
			socket.emit("matchReplay", {
				minute:
					game.liveMinute ?? (game.gamePhase === "match_second_half" ? 46 : 1),
				matchweek: game.matchweek,
				isCup: isCupHalf,
				cupRoundName: isCupHalf ? halfEntry?.roundName || null : null,
				fixtures: game.currentFixtures.map((f: any) => ({
					homeTeamId: f.homeTeamId,
					awayTeamId: f.awayTeamId,
					homeTeam: f.homeTeam || null,
					awayTeam: f.awayTeam || null,
					finalHomeGoals: f.finalHomeGoals || 0,
					finalAwayGoals: f.finalAwayGoals || 0,
					events: (f.events || []).slice(),
					homeLineup: f.homeLineup || [],
					awayLineup: f.awayLineup || [],
					attendance: f.attendance || null,
				})),
			});
			return;
		}

		// Recovery for match_extra_time: tell the reconnecting client that ET is running
		// Recovery for match_extra_time:
		//  - Se o ET já terminou (gate de animação / finalização), enviar os
		//    resultados da ronda em vez de um replay fantasma de um ET que já
		//    acabou — um reconnect aqui mostrava relógio a correr dos 91'.
		//  - Caso contrário (ET ainda a simular), replay do estado actual.
		if (game.gamePhase === "match_extra_time") {
			if (game._etSimCompleted && game.cupResultsPayload) {
				socket.emit("cupRoundResults", game.cupResultsPayload);
				return;
			}
			if (!game.currentFixtures?.length) return;
			const entry = game.currentEvent as any;
			socket.emit("matchReplay", {
				// Default to 91 because extra time starts at minute 91
				minute: game.liveMinute ?? 91,
				matchweek: game.matchweek,
				isCup: true,
				cupRoundName: entry?.roundName || null,
				fixtures: game.currentFixtures.map((f: any) => ({
					homeTeamId: f.homeTeamId,
					awayTeamId: f.awayTeamId,
					homeTeam: f.homeTeam || null,
					awayTeam: f.awayTeam || null,
					finalHomeGoals: f.finalHomeGoals || 0,
					finalAwayGoals: f.finalAwayGoals || 0,
					events: (f.events || []).slice(),
					homeLineup: f.homeLineup || [],
					awayLineup: f.awayLineup || [],
					attendance: f.attendance || null,
				})),
			});
			return;
		}

		// Recovery for match_finalizing: tell the client we are wrapping up
		if (game.gamePhase === "match_finalizing") {
			socket.emit("gameState", {
				gamePhase: game.gamePhase,
				calendarIndex: game.calendarIndex,
				currentEvent: game.currentEvent,
				matchweek: game.matchweek,
				year: game.year,
				activeAuctions: serializeActiveAuctions(game),
			});
			return;
		}

		// Lobby: ensure client has current gameState (year, matchweek, calendarIndex)
		if (game.gamePhase === "lobby") {
			socket.emit("gameState", {
				gamePhase: game.gamePhase,
				calendarIndex: game.calendarIndex,
				currentEvent: game.currentEvent,
				allMatchResults: game.allMatchResults || {},
				matchweek: game.matchweek,
				year: game.year,
				activeAuctions: serializeActiveAuctions(game),
			});
			return;
		}
	}

	/**
	 * No phase timers needed for cup lobby — coaches ready up same as league.
	 * Kept for API compatibility; no-op unless there's a timer already set.
	 */
	function ensurePhaseTimeout(_game: ActiveGame) {
		// Cup now uses the same lobby Ready flow as league — no separate timers.
	}

	return {
		applySeasonEnd,
		startCupRound,
		finalizeCupRound,
		continueFromEtGate,
		emitCurrentPhaseToSocket,
		ensurePhaseTimeout,
	};
}
