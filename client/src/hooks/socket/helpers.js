import { POSITION_SHORT_LABELS, POSITION_TEXT_CLASS } from "../../constants/index.js";
import { seasonToYear } from "../../utils/formatters.js";
import { slotLabel } from "../../utils/slotLabel.js";

export function buildPositionPeers(refs, position, playerId) {
	const squad = Array.isArray(refs.mySquadRef?.current)
		? refs.mySquadRef.current
		: [];
	return squad
		.filter((p) => p.position === position && Number(p.id) !== Number(playerId))
		.map((p) => ({
			id: p.id,
			name: p.name,
			skill: Number(p.skill ?? 0),
			wage: Number(p.wage ?? 0),
		}))
		.sort((a, b) => b.skill - a.skill);
}

export function buildPlayerStats({
	position,
	skill,
	wage,
	requestedWage,
	contractEndMatchweek,
	contractEndSeason,
}) {
	const stats = [];
	if (position) {
		stats.push({
			label: "Pos",
			value: POSITION_SHORT_LABELS[position] ?? position,
			className: POSITION_TEXT_CLASS[position] ?? "",
		});
	}
	if (skill) stats.push({ label: "Skill", value: String(skill) });
	if (typeof wage === "number" && wage > 0) {
		stats.push({ label: "Salário", value: `€${wage.toLocaleString("pt-PT")}/sem` });
	}
	if (typeof requestedWage === "number" && requestedWage > 0) {
		stats.push({
			label: "Pedido",
			value: `€${requestedWage.toLocaleString("pt-PT")}/sem`,
		});
	}
	if (contractEndMatchweek && contractEndSeason) {
		stats.push({
			label: "Contrato",
			value: `${seasonToYear(contractEndSeason)}, ${slotLabel(contractEndMatchweek)}`,
		});
	}
	return stats;
}

/**
 * Avatar para os modais de contrato (proposta e festa), a partir do plantel.
 *
 * @param {object} refs refs partilhados (usa `mySquadRef`, `teamsRef`, `meRef`)
 * @param {number} playerId id do jogador
 * @param {object} over campos vindos do servidor (preferidos ao plantel)
 */
export function contractAvatar(refs, playerId, over = {}) {
	const squad = Array.isArray(refs.mySquadRef?.current)
		? refs.mySquadRef.current
		: [];
	const row = squad.find((p) => Number(p.id) === Number(playerId));
	const teams = Array.isArray(refs.teamsRef?.current)
		? refs.teamsRef.current
		: [];
	const myTeam = teams.find(
		(t) => Number(t.id) === Number(refs.meRef?.current?.teamId),
	);
	return {
		seed: playerId,
		position: over.position ?? row?.position,
		teamColor: myTeam?.color_primary || myTeam?.colorPrimary || "#27272a",
		nationality: over.nationality ?? row?.nationality ?? null,
		photo: over.photo ?? row?.photo ?? null,
	};
}

/**
 * Mostra o desfecho de um contrato (festa/malas): transforma o modal do
 * próprio jogador se ainda estiver aberto, senão entra na fila (nunca
 * esmaga o pedido de outro jogador que esteja no ecrã).
 */
export function showContractOutcome(handlers, refs, playerId, dialog) {
	const cur = refs.gameDialogRef?.current;
	if (
		cur &&
		cur.kind === "contract" &&
		Number(cur.playerId) === Number(playerId)
	) {
		handlers.setGameDialog(dialog);
	} else {
		handlers.queueContractDialog(dialog);
	}
}

export function hasSeenWelcome(coachName, roomCode) {
	try {
		return (
			window.localStorage.getItem(
				`cashball_welcome:${coachName}:${roomCode}`,
			) === "1"
		);
	} catch {
		return false;
	}
}

export function hasSeenWelcomeThisSession(coachName, roomCode) {
	try {
		return (
			window.sessionStorage.getItem(
				`cashball_welcome_session:${coachName}:${roomCode}`,
			) === "1"
		);
	} catch {
		return false;
	}
}
