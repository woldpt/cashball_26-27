import { socket } from "../../socket.js";
import { SIM_SPEED_PRESETS, DEFAULT_SIM_SPEED } from "../../constants/index.js";

/**
 * Listeners de Dados base (plantel, classificação, época, tática, sistema).
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerCoreListeners(handlers, refs, ctx) {
	socket.on("calendarData", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setCalendarData(data);
	});
	socket.on("teamsData", (data) => {
		if (!ctx.inRoom()) return;
		// Snapshot da tabela atual antes do refresh — base para as setinhas
		// de subida/descida na classificação.
		handlers.setPrevStandings(refs.teamsRef.current || []);
		handlers.setTeams(data);
	});
	socket.on("teamForms", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setTeamForms(data || {});
	});
	socket.on("playerListUpdate", (data) => {
		if (!ctx.inRoom()) return;
		// Suporta formato novo { players, roomCreator } e legado (array)
		if (Array.isArray(data)) {
			handlers.setPlayers(data);
		} else if (data && Array.isArray(data.players)) {
			handlers.setPlayers(data.players);
			if (typeof data.roomCreator === "string") {
				handlers.setRoomCreator(data.roomCreator);
			}
		}
	});
	socket.on("simSpeedUpdated", (data) => {
		if (!ctx.inRoom()) return;
		if (data && typeof data.speed === "string" && SIM_SPEED_PRESETS[data.speed]) {
			handlers.setSimSpeed(data.speed);
		}
	});
	socket.on("mySquad", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setMySquad(data);
	});
	socket.on("topScorers", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setTopScorers(data);
	});
	socket.on("seasonEnd", (data) => {
		if (!ctx.inRoom()) return;
		// Show the season-end awards modal
		handlers.setSeasonEndModal(data);
		if (data.year) handlers.setSeasonYear(data.year);
		if (data.newSeason) handlers.setSeason(data.newSeason);
		handlers.setAllMatchResults({});
		handlers.setMatchweekCount(0);
		handlers.setMatchResults(null);
		handlers.setCalendarData(null);
		});
	socket.on("teamSquadData", ({ teamId, squad }) => {
		if (
			refs.selectedTeamRef.current &&
			refs.selectedTeamRef.current.id === teamId
		) {
			handlers.setSelectedTeamSquad(squad || []);
			handlers.setSelectedTeamLoading(false);
		}
	});
	socket.on("nextMatchSummary", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setNextMatchSummary(data);
		handlers.setNextMatchSummaryLoading(false);
	});
	socket.on("systemMessage", (msg) => {
		const text = typeof msg === "string" ? msg : msg.text;
		if (text) handlers.addToast(text);
	});
	socket.on("seasonState", (data) => {
		if (!ctx.inRoom()) return;
		// Broadcast pós-jogo (liga E taça): mantém matchweekCount/calendarIndex
		// em sincronia e força o refetch do nextMatchSummary na tab de tática —
		// sem isto, após uma ronda de taça o briefing podia ficar stale.
		if (data.matchweek) handlers.setMatchweekCount(data.matchweek - 1);
		if (typeof data.calendarIndex === "number")
			handlers.setCalendarIndex(data.calendarIndex);
		if (data.season) handlers.setSeason(data.season);
		if (data.year) handlers.setSeasonYear(data.year);
	});

	socket.on("tacticFamiliarity", (data) => {
		handlers.setTacticFamiliarity(data);
	});

	socket.on("allTacticFamiliarity", (entries) => {
		// Converter array [{formation, style, score, stars, bonus}]
		// para map { "4-3-3|OFENSIVO": { score, stars, bonus }, ... }
		// Normalizar estilo para uppercase PT independentemente do valor guardado na DB
		const styleToUpper = (s) => {
			const m = {
				Defensive: "DEFENSIVO",
				Balanced: "EQUILIBRADO",
				Offensive: "OFENSIVO",
			};
			return m[s] || (s || "").toUpperCase();
		};
		const map = {};
		(entries || []).forEach((e) => {
			map[`${e.formation}|${styleToUpper(e.style)}`] = {
				...e,
				style: styleToUpper(e.style),
			};
		});
		handlers.setAllTacticFamiliarity(map);
	});

	return () => {
		socket.off("teamsData");
		socket.off("teamForms");
		socket.off("playerListUpdate");
		socket.off("simSpeedUpdated");
		socket.off("mySquad");
		socket.off("teamSquadData");
		socket.off("nextMatchSummary");
		socket.off("seasonState");
		socket.off("calendarData");
		socket.off("topScorers");
		socket.off("seasonEnd");
		socket.off("tacticFamiliarity");
		socket.off("allTacticFamiliarity");
		socket.off("systemMessage");
	};
}
