import type { ActiveGame, PlayerSession } from "./types";
import {
	CONTRACT_LENGTH_MATCHWEEKS,
	contractEpoch,
} from "./gameConstants";

type AnyRow = Record<string, any>;

type RunAll = <T extends AnyRow = AnyRow>(
	db: any,
	sql: string,
	params?: any[],
) => Promise<T[]>;

interface ScoutHandlerDeps {
	getGameBySocket: (socketId: string) => ActiveGame | null;
	getPlayerBySocket: (game: ActiveGame, socketId: string) => PlayerSession | null;
	runAll: RunAll;
}

const SEARCH_LIMIT = 200;

interface PlayerSearchFilters {
	name?: string;
	position?: string;
	skillMin?: number | null;
	skillMax?: number | null;
	ageMin?: number | null;
	ageMax?: number | null;
	priceMin?: number | null;
	priceMax?: number | null;
	division?: string;
	transferStatus?: string;
	isStar?: boolean;
	onlyAvailable?: boolean;
	sort?: string;
}

/**
 * Effective acquisition price of a player (what the scout page charges):
 *  - listed (fixed/auction) with a price: transfer_price
 *  - otherwise: release clause = ROUND(value * 1.35) ("Proposta" price)
 */
const ACQUISITION_PRICE_SQL =
	"CASE WHEN p.transfer_status IN ('fixed', 'auction') AND p.transfer_price > 0 " +
	"THEN p.transfer_price ELSE CAST(ROUND(p.value * 1.35) AS INTEGER) END";

function toInt(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? Math.trunc(n) : null;
}

function sanitizeLike(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function registerScoutSocketHandlers(
	socket: any,
	deps: ScoutHandlerDeps,
) {
	const { getGameBySocket, getPlayerBySocket, runAll } = deps;

	socket.on("requestPlayerSearch", async (filters: PlayerSearchFilters) => {
		const game = getGameBySocket(socket.id);
		if (!game) return;

		const f: PlayerSearchFilters = filters && typeof filters === "object" ? filters : {};

		const where: string[] = [];
		const params: any[] = [];

		const name = sanitizeLike(f.name);
		if (name) {
			where.push("p.name LIKE ?");
			params.push(`%${name}%`);
		}

		if (f.position && ["GR", "DEF", "MED", "ATA"].includes(f.position)) {
			where.push("p.position = ?");
			params.push(f.position);
		}

		const skillMin = toInt(f.skillMin);
		if (skillMin !== null) {
			where.push("p.skill >= ?");
			params.push(skillMin);
		}

		const skillMax = toInt(f.skillMax);
		if (skillMax !== null) {
			where.push("p.skill <= ?");
			params.push(skillMax);
		}

		const ageMin = toInt(f.ageMin);
		if (ageMin !== null) {
			where.push("p.age >= ?");
			params.push(ageMin);
		}

		const ageMax = toInt(f.ageMax);
		if (ageMax !== null) {
			where.push("p.age <= ?");
			params.push(ageMax);
		}

		const priceMin = toInt(f.priceMin);
		if (priceMin !== null) {
			where.push(`${ACQUISITION_PRICE_SQL} >= ?`);
			params.push(priceMin);
		}

		const priceMax = toInt(f.priceMax);
		if (priceMax !== null) {
			where.push(`${ACQUISITION_PRICE_SQL} <= ?`);
			params.push(priceMax);
		}

		if (f.division && f.division !== "all") {
			const div = toInt(f.division);
			if (div !== null) {
				where.push("t.division = ?");
				params.push(div);
			}
		}

		if (f.transferStatus && f.transferStatus !== "all") {
			where.push("p.transfer_status = ?");
			params.push(f.transferStatus);
		}

		if (f.isStar) {
			where.push("p.is_star = 1");
		}

		if (f.onlyAvailable) {
			const playerState = getPlayerBySocket(game, socket.id);
			if (playerState?.teamId != null) {
				where.push("(p.team_id IS NULL OR p.team_id != ?)");
				params.push(playerState.teamId);
			}
			const epoch = contractEpoch(game.season || 1, game.matchweek || 1);
			where.push("(p.contract_start_epoch = 0 OR p.contract_start_epoch + ? <= ?)");
			params.push(CONTRACT_LENGTH_MATCHWEEKS, epoch);
		}

		const sort = f.sort || "quality-desc";
		const sortMap: Record<string, string> = {
			"quality-desc": "p.skill DESC, p.name ASC",
			"quality-asc": "p.skill ASC, p.name ASC",
			"value-desc": "p.value DESC, p.name ASC",
			"value-asc": "p.value ASC, p.name ASC",
			"age-asc": "p.age ASC, p.name ASC",
			"age-desc": "p.age DESC, p.name ASC",
		};
		const orderBy = sortMap[sort] || sortMap["quality-desc"];

		const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

		try {
			// Total real de correspondências (a LIMIT só aplica-se aos resultados).
			const [countRow] = await runAll<any>(
				game.db,
				`SELECT COUNT(*) AS total
				 FROM players p
				 LEFT JOIN teams t ON p.team_id = t.id
				 ${whereSql}`,
				params,
			);
			const total = Number(countRow?.total ?? 0);

			const rows = await runAll<any>(
				game.db,
				`SELECT p.*, t.name AS team_name, t.division, t.color_primary, t.color_secondary
				 FROM players p
				 LEFT JOIN teams t ON p.team_id = t.id
				 ${whereSql}
				 ORDER BY ${orderBy}
				 LIMIT ?`,
				[...params, SEARCH_LIMIT],
			);

			const results = rows || [];
			const truncated = total > results.length;

			socket.emit("playerSearchResults", {
				results,
				total,
				truncated,
			});
		} catch (err) {
			console.error("[requestPlayerSearch] Error:", err);
			socket.emit("playerSearchResults", {
				results: [],
				total: 0,
				truncated: false,
			});
		}
	});
}
