import { socket } from "../../socket.js";

/**
 * Listeners de Jornal, histórico, scouting e finanças.
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerNewsListeners(handlers, refs, ctx) {
	socket.on("globalNews", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setGlobalNews(
			data && Array.isArray(data.news) && Array.isArray(data.results)
				? data
				: { news: [], results: [] },
		);
	});
	// Broadcast do servidor (fim de jornada, Taça, fim de época, transferências)
	// → refetch imediato do Jornal Global.
	socket.on("globalNewsUpdated", () => {
		if (!ctx.inRoom()) return;
		socket.emit("getGlobalNews");
	});
	socket.on("palmaresData", (data) => {
		handlers.setPalmares(data);
		handlers.setPalmaresTeamId(data.teamId);
	});
	socket.on("clubHistoryData", (data) => {
		handlers.setClubHistory(data);
		handlers.setClubHistoryTeamId(data.teamId);
	});
	socket.on("clubNewsData", (data) => {
		handlers.setClubNews(data.news || []);
	});
	socket.on(
		"clubNewsUpdated",
		({ teamId }) => {
			// Use meRef (not me) to avoid stale closure — this listener is registered once with [] deps
			const currentMe = refs.meRef.current;
			if (currentMe?.teamId === teamId) {
				socket.emit("requestClubNews", { teamId });
			}
		},
	);
	socket.on("playerHistoryData", (data) =>
		handlers.setPlayerHistoryModal(data),
	);
	socket.on("playerSearchResults", (data) => {
		// Anti-race: ignora respostas de pesquisas antigas (searchId ecoado pelo
		// servidor) — só a última pesquisa feita pode atualizar os resultados.
		if (data?.searchId != null && data.searchId !== refs.playerSearchIdRef?.current) return;
		handlers.setPlayerSearchLoading(false);
		handlers.setPlayerSearchData({
			results: data?.results || [],
			total: data?.total || 0,
			truncated: !!data?.truncated,
		});
	});
	socket.on("financeData", (data) => handlers.setFinanceData(data));
	socket.on("stadiumBuilt", ({ teamId }) => {
			// Re-pedir financeData se somos o clube em questão
		const currentMe = refs.meRef.current;
		if (currentMe?.teamId && Number(currentMe.teamId) === Number(teamId)) {
			socket.emit("requestFinanceData", { teamId: currentMe.teamId });
		}
	});
	return () => {
		socket.off("globalNews");
		socket.off("globalNewsUpdated");
		socket.off("palmaresData");
		socket.off("clubHistoryData");
		socket.off("clubNewsData");
		socket.off("clubNewsUpdated");
		socket.off("playerHistoryData");
		socket.off("playerSearchResults");
		socket.off("financeData");
		socket.off("stadiumBuilt");
	};
}
