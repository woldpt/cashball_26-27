import type { ActiveGame, GamePhase, PlayerSession } from "./types";
import { getAllTeamForms, getTeamsWithCoachNames, buildSkillHistory, fetchTopScorers, logClubNews, runRoomTask } from "./coreHelpers";
import { SPONSOR_REVENUE_BY_DIVISION, CUP_ROUND_NAMES, FRIENDLY_ROUND_NAME, SEASON_CALENDAR, AWAY_TICKET_SHARE, loanInstallment, WEEKLY_BASE_INCOME, STADIUM_UPKEEP_EXEMPT_SEATS, STADIUM_UPKEEP_PER_SEAT_WEEK } from "./gameConstants";
import { drawOffers, drawOffersAny, sponsorById, SPONSOR_WEEKS } from "./game/sponsors";
import { getGlobalMessages, CHAT_RETENTION_MS } from "./db/globalDatabase";
import { withJuniorGRs, ensureFullBench } from "./game/engine";
import { upcomingMatchweek } from "./game/lineupReady";
import {
  takePendingMatchAction,
  listTeamMatchActions,
} from "./game/engine";
import { serializeActiveAuctions } from "./auctionHelpers";
import { getCupWeekFriendlyStatus } from "./socketCupHandlers";
import { notifyRoomInvite } from "./push";
import {
  claimSeat,
  deleteSeat,
  emitPresencePause,
  markSeatSeen,
  releaseSeat,
  setSeatIntent,
  setSeatTeamId,
} from "./roomStateHelpers";

type AnyRow = Record<string, any>;

type RunAll = <T extends AnyRow = AnyRow>(
	db: any,
	sql: string,
	params?: any[],
) => Promise<T[]>;

type RunGet = <T extends AnyRow = AnyRow>(
	db: any,
	sql: string,
	params?: any[],
) => Promise<T | null>;

// ── Rate limiting para joinGame ────────────────────────────────────────────────
// O canal socket não tem o rate-limit HTTP. Limites em memória por nome e por IP
// impedem brute-force de tokens/sessões e spam de criação de salas.

type LimitRec = { count: number; first: number };
const joinRateStore = new Map<string, LimitRec>();
const newGameRateStore = new Map<string, LimitRec>();

const JOIN_LIMIT_PER_NAME = { max: 30, windowMs: 10 * 60 * 1000 };
const JOIN_LIMIT_PER_IP = { max: 150, windowMs: 10 * 60 * 1000 };
const NEW_GAME_LIMIT_PER_NAME = { max: 3, windowMs: 15 * 60 * 1000 };

function allowLimit(
	store: Map<string, LimitRec>,
	key: string,
	max: number,
	windowMs: number,
): boolean {
	const now = Date.now();
	const rec = store.get(key);
	if (!rec || now - rec.first > windowMs) {
		store.set(key, { count: 1, first: now });
		return true;
	}
	rec.count += 1;
	return rec.count <= max;
}

function getSocketIp(socket: any): string {
	return socket.handshake?.address || socket.conn?.remoteAddress || "unknown";
}

interface SessionHandlerDeps {
	io: any;
	verifySession: (
		token: string,
	) => Promise<{ ok: boolean; transient?: boolean; name?: string; expiresAt?: number }>;
	getGame: (
		roomCode: string,
		onReady?: (game: ActiveGame | null, error?: Error) => void,
		creatorName?: string,
	) => ActiveGame | null;
	recordRoomAccess: (name: string, roomCode: string) => void;
	getRoomCoaches: (roomCode: string, excludeName?: string) => Promise<string[]>;
	getCoachAvatars: (names: string[]) => Promise<Record<string, number>>;
	getAvatarSeed: (name: string) => Promise<string>;
	getGameBySocket: (socketId: string) => ActiveGame | null;
	getPlayerBySocket: (
		game: ActiveGame,
		socketId: string,
	) => PlayerSession | null;
	bindSocket: (
		game: ActiveGame,
		name: string,
		socketId: string,
	) => string | null;
	unbindSocket: (game: ActiveGame, socketId: string) => void;
	getPlayerList: (game: ActiveGame) => PlayerSession[];
	saveGameState: (game: ActiveGame) => void;
	emitCurrentPhaseToSocket: (game: ActiveGame, socket: any) => void;
	emitAwaitingCoaches: (game: ActiveGame) => void;
	emitPresence: (game: ActiveGame) => void;
	checkAllReady: (game: ActiveGame) => void | Promise<void>;
	runAll: RunAll;
	runGet: RunGet;
	buildNextMatchSummary: (game: ActiveGame, teamId: number) => Promise<any>;
	doesGameExist: (roomCode: string) => boolean;
	generateUniqueRoomCode: () => string;
	globalDb?: any;
	emitGlobalPlayerUpdate?: () => void;
	getGlobalPlayerList?: () => { name: string; roomCode: string }[];
	findOnlineCoachSocket?: (
		name: string,
	) => { roomCode: string; socketId: string } | null;
	presenceRoom?: string;
	resendPendingContractRequests?: (game: ActiveGame) => Promise<void>;
	resendPendingJobOffer?: (game: ActiveGame, toSocket: any, coachName: string) => Promise<boolean>;
	resendBoardWarning?: (game: ActiveGame, toSocket: any, teamId: number) => Promise<boolean>;
}

// ── Convites de sala entre coaches (pre-join → in-game) ─────────────────────
// O emissor está na escolha de salas (ainda sem sala ligada); o destinatário
// está online noutra sala. O mapa guarda convites pendentes para que a
// resposta (aceitar/recusar) volte ao socket do emissor.
interface PendingRoomInvite {
	inviteId: string;
	fromName: string;
	fromSocketId: string;
	roomCode: string;
	roomName: string;
	toCoach: string;
}

const pendingRoomInvites = new Map<string, PendingRoomInvite>();
let roomInviteSeq = 0;

const INVITE_LIMIT_PER_NAME = { max: 20, windowMs: 10 * 60 * 1000 };
const INVITE_LIMIT_PER_IP = { max: 120, windowMs: 10 * 60 * 1000 };
const inviteRateStore = new Map<string, LimitRec>();

function nextInviteId(): string {
	roomInviteSeq += 1;
	return `inv_${Date.now().toString(36)}_${roomInviteSeq}`;
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
	if (!json) return fallback;
	try {
		return JSON.parse(json);
	} catch {
		return fallback;
	}
}

// ─── LEGACY COMPAT HELPERS ───────────────────────────────────────────────────
// Derive old-style matchState/cupState from the new unified gamePhase.
// Keeps the existing client working without changes.

/**
 * Payload único do `gameState` — usado no join/rejoin E no `requestResync`.
 * Se divergirem, o cliente que perdeu eventos fica com um estado diferente do
 * que recebeu ao ligar. Um só construtor resolve isso por construção.
 */
function buildGameStatePayload(game: ActiveGame, name: string, overrides: Record<string, any> = {}) {
	return {
		// Sequência do log da sala: o cliente guarda-a e pede resync quando
		// deteta um salto (evento perdido durante um flape).
		seq: game.eventSeq || 0,
		gamePhase: game.gamePhase,
		calendarIndex: game.calendarIndex,
		currentEvent: game.currentEvent,
		liveMinute: game.liveMinute ?? null,
		allMatchResults: game.allMatchResults || {},
		matchweek: game.matchweek,
		season: game.season,
		matchState: legacyMatchState(game.gamePhase),
		cupState: legacyCupState(game),
		cupRound:
			game.currentEvent?.type === "cup" ? (game.currentEvent as any).round : 0,
		year: game.year,
		// A tática do assento viaja tal como está em qualquer fase. Apagar as
		// posições no lobby destruía o 11 já confirmado após um restart (o
		// `ready` sobrevivia no assento e o jogo arrancava com o painel de
		// intervalo vazio). A limpeza entre rondas faz-se no finalize
		// (`clearSeatPositions`), nunca aqui.
		tactic: game.playersByName[name]?.tactic ?? null,
		lockedCoaches: [...game.lockedCoaches],
		lastHalfTimePayload:
			game.gamePhase === "match_halftime"
				? game.lastHalftimePayload || null
				: null,
		roomCreator: game.roomCreator || "",
		msPerMinute: game.msPerMinute ?? null,
		activeAuctions: serializeActiveAuctions(game),
		...overrides,
	};
}

function legacyMatchState(gamePhase: GamePhase): string {
	switch (gamePhase) {
		case "match_first_half":
			return "running_first_half";
		case "match_halftime":
			return "halftime";
		case "match_second_half":
			return "playing_second_half";
		default:
			return "idle";
	}
}

function legacyCupState(game: ActiveGame): string {
	if (!game.currentEvent || game.currentEvent.type !== "cup") return "idle";
	switch (game.gamePhase) {
		case "match_first_half":
			return "playing_first_half";
		case "match_halftime":
			return "halftime";
		case "match_second_half":
		case "match_extra_time":
			return "playing_second_half";
		default:
			return "idle";
	}
}

export function registerSessionSocketHandlers(
	socket: any,
	deps: SessionHandlerDeps,
) {
	const {
		io,
		verifySession,
		getGame,
		recordRoomAccess,
		getRoomCoaches,
		getCoachAvatars,
		getAvatarSeed,
		getGameBySocket,
		getPlayerBySocket,
		bindSocket,
		unbindSocket,
		saveGameState,
		emitCurrentPhaseToSocket,
		emitPresence,
		checkAllReady,
		runAll,
		runGet,
		buildNextMatchSummary,
		doesGameExist,
		generateUniqueRoomCode,
		emitGlobalPlayerUpdate,
		getGlobalPlayerList,
		findOnlineCoachSocket,
		presenceRoom,
		resendPendingContractRequests,
		resendPendingJobOffer,
		resendBoardWarning,
	} = deps;

	// Avisa o socket deslocado — só se estiver vivo (um socket antigo morto do
	// mesmo telemóvel não recebe nada, logo não há falso deslocamento). O motivo
	// distingue outro dispositivo de outra tab do mesmo.
	function notifyDisplaced(
		oldSocketId: string | null,
		previousDevice: string | null,
		deviceId: string | null,
	) {
		if (!oldSocketId || !io.sockets.sockets.get(oldSocketId)?.connected) return;
		const otherDevice = !!(previousDevice && deviceId && previousDevice !== deviceId);
		io.to(oldSocketId).emit("sessionDisplaced", {
			reason: otherDevice ? "another_device" : "another_tab",
		});
	}

	// O mesmo socket a entrar noutra sala sem `leaveRoom` (troca de sala com o
	// pedido de saída perdido): desliga-o da anterior como numa queda — o
	// assento fica, a presença cai. Sem isto a sala antiga guardava o socketId
	// e via o treinador presente (e o convite ia para a sala errada).
	function detachFromOtherRoom(roomCode: string) {
		const prev = getGameBySocket(socket.id);
		if (!prev || prev.roomCode === roomCode) return;
		const prevPlayer = getPlayerBySocket(prev, socket.id);
		console.log(
			`[${prev.roomCode}] 🔀 socket ${socket.id} (${prevPlayer?.name ?? "unknown"}) mudou para ${roomCode} sem leaveRoom`,
		);
		unbindSocket(prev, socket.id);
		socket.leave(prev.roomCode);
		if (prevPlayer?.teamId) {
			io.to(prev.roomCode).emit("coachDisconnected", {
				coachName: prevPlayer.name,
				teamId: prevPlayer.teamId,
			});
		}
		emitPresence(prev);
		emitPresencePause(prev, io);
	}

	function assignPlayer(
		game: ActiveGame,
		name: string,
		team: any,
		roomCode: string,
		isNew: boolean = true,
		deviceId: string | null = null,
		passive: boolean = false,
	) {
		console.log(
			`[${roomCode}] 👤 assignPlayer: ${name} → team=${team.name ?? team.id} | isNew=${isNew} | phase=${game.gamePhase}`,
		);
		// Reconexão em segundo plano (separador oculto): não rouba o assento a
		// outro dispositivo que o tem ligado e vivo — este cliente fica deslocado
		// e só volta com «Retomar aqui» (aí o join é visível e passa).
		if (passive) {
			const cur = game.playersByName[name]?.socketId;
			const seatDevice = game.seats[name]?.deviceId ?? null;
			if (
				cur &&
				cur !== socket.id &&
				io.sockets.sockets.get(cur)?.connected &&
				seatDevice &&
				deviceId &&
				seatDevice !== deviceId
			) {
				socket.leave(roomCode);
				socket.emit("sessionDisplaced", { reason: "another_device" });
				return;
			}
		}
		if (!game.playersByName[name]) {
			game.playersByName[name] = {
				name,
				teamId: team.id,
				roomCode,
				ready: false,
				tactic: { formation: "4-4-2", style: "Balanced" },
				socketId: socket.id,
			};
		} else if (game.playersByName[name].teamId !== team.id) {
			// Reconciliação: o clube mudou fora do join (convite aceite) e a
			// projeção ficou obsoleta — a BD (via managers) manda. Sem isto,
			// Jornal e briefing do clube antigo sobreviviam a refreshes.
			console.log(
				`[${roomCode}] 🔄 assignPlayer reconcilia equipa: ${name} ${game.playersByName[name].teamId} → ${team.id}`,
			);
			game.playersByName[name].teamId = team.id;
		}
		// O assento é a fonte da verdade: repõe equipa e intenção (ready/tática)
		// que sobreviveram ao disconnect/restart — o rejoin já não perde o que o
		// treinador tinha confirmado.
		setSeatTeamId(game, name, team.id);
		const previousDevice = game.seats[name]?.deviceId ?? null;
		claimSeat(game, name, { teamId: team.id, deviceId });
		detachFromOtherRoom(roomCode);
		const displacedSocketId = bindSocket(game, name, socket.id);

		// Cada treinador recebe a sua peça de boas-vindas no Jornal da sua
		// equipa — reentradas (isNew=false) e convites (via própria) não duplicam.
		if (isNew) {
			logClubNews(
				game,
				"welcome",
				`📰 Bem-vindo ao ${team.name}`,
				team.id,
				{
					description:
						"Há uma bancada para conquistar, um plantel para moldar e uma época para escrever.",
					matchweek: game.matchweek,
					year: game.year,
				},
				io,
			);
		}
		// Só avisa um socket antigo que ainda esteja vivo (ver notifyDisplaced).
		notifyDisplaced(displacedSocketId, previousDevice, deviceId ?? null);

		game.lockedCoaches.add(name);
		if (game.lockedCoaches.size >= 2) {
			saveGameState(game);
			io.to(roomCode).emit("roomLocked", { coaches: [...game.lockedCoaches] });
		}

		getTeamsWithCoachNames(game.db)
			.then((teams: any[]) => {
				// À sala só quando entra um treinador novo; num rejoin só ao próprio
				// (cada desbloqueio do telemóvel inundava a sala com a lista toda).
				if (isNew) io.to(roomCode).emit("teamsData", teams);
				else socket.emit("teamsData", teams);
				getAllTeamForms(game.db, game.season)
					.then((forms) => {
						socket.emit("teamForms", forms);
					})
					.catch(() => {});
			})
			.catch(() => {});
		game.db.all(
			"SELECT * FROM players WHERE team_id = ?",
			[team.id],
			(_err: any, squad: any[]) => {
				socket.emit(
					"mySquad",
					ensureFullBench(
						withJuniorGRs(squad || [], team.id, upcomingMatchweek(game)),
						team.id,
						upcomingMatchweek(game),
					),
				);
				// O plantel (query async) TEM de chegar antes do gameState e da
				// fase (síncronos): o painel do intervalo abria com zero
				// jogadores quando o halfTimeResults ganhava a corrida.
				socket.emit("marketUpdate", game.globalMarket);

				// Emite o estado actual ao coach que se reconectou (refresh do browser).
				// NOTA: o gameManager já reset fases transientes → 'lobby' ao carregar da DB
				// após reinício do servidor. Aqui NUNCA forçamos reset — um refresh isolado
				// não deve interromper o jogo em curso para os restantes coaches.
				console.log(
					`[${roomCode}] 🔌 assignPlayer reconnect | phase=${game.gamePhase} | coach=${name}`,
				);
				socket.emit("gameState", buildGameStatePayload(game, name));

				emitCurrentPhaseToSocket(game, socket);
				// Convite de clube e aviso da direção sobrevivem ao refresh: o
				// estado do cliente morreu mas o pendente continua no servidor.
				// Re-emitir traz os itens de volta ao Jornal (mesmos ids: o
				// «lido» do localStorage vale e nada duplica).
				resendPendingJobOffer?.(game, socket, name)?.catch(() => {});
				resendBoardWarning?.(game, socket, team.id)?.catch(() => {});

			// Ações pendentes da equipa que sobreviveram ao disconnect (flape rápido:
			// o join novo fez bind antes do disconnect do socket velho, que por isso
			// já não auto-resolveu). Re-emitir o `matchActionRequired` REAL com o
			// tempo restante — o cliente reconstrói o modal em vez de ficar preso
			// até ao fallback. Só restos com deadline passada recebem
			// `matchActionExpired` (o timer dispara de seguida na mesma).
			// TEM de vir DEPOIS de emitCurrentPhaseToSocket: o `matchReplay` desse
			// payload limpa o estado de ação no cliente e apagava a janela reaberta
			// (lesão/substituição "nunca apareceu" ao voltar de uma tab morta).
			for (const pendingAction of listTeamMatchActions(game, team.id)) {
				const now = Date.now();
				const live =
					typeof pendingAction.expiresAt !== "number" ||
					pendingAction.expiresAt > now;
				if (live) {
					// Sem flag: cada rejoin re-emite (idempotente no cliente pelo
					// actionId) para cobrir tab morta e reaberta a meio da janela.
					console.log(
						`[${roomCode}] 🔁 Reenviando ação pendente a ${name} (actionId=${pendingAction.actionId}, type=${pendingAction.type})`,
					);
					socket.emit("matchActionRequired", {
						actionId: pendingAction.actionId,
						type: pendingAction.type,
						teamId: team.id,
						...(pendingAction.payload || {}),
						expiresAt: pendingAction.expiresAt ?? now + 60000,
					});
				} else {
					// Resto com deadline passada: notificar uma vez (o timer de
					// fallback dispara de seguida na mesma).
					if (pendingAction.expiredNotified) continue;
					pendingAction.expiredNotified = true;
					console.log(
						`[${roomCode}] ⚠ Reconnecting coach ${name} had pending action (actionId=${pendingAction.actionId}) that was already resolved`,
					);
					socket.emit("matchActionExpired", {
						actionId: pendingAction.actionId,
						type: pendingAction.type,
						teamId: team.id,
						reason: "coach_disconnected",
					});
				}
			}

			emitPresence(game);
			emitGlobalPlayerUpdate?.();

			// Presença mudou: a sala pode descongelar.
			emitPresencePause(game, io);

			// If halftime is already waiting and all coaches are now ready (e.g. safety
			// timeout fired while this coach was offline), advance without waiting for
			// another setReady — otherwise the button stays permanently disabled.
			if (game.gamePhase === "match_halftime") {
				checkAllReady(game);
			}
			},
		);

		fetchTopScorers(game.db).then((scorers) => socket.emit("topScorers", scorers));

		game.db.get(
			"SELECT id, name, division, budget, points, wins, draws, losses, goals_for, goals_against, color_primary, color_secondary, crest, stadium_capacity, stadium_name FROM teams WHERE id = ?",
			[team.id],
			(err: any, details: any) => {
				if (err) {
					console.error(
						`[${roomCode}] assignPlayer: failed to fetch team details for id=${team.id}:`,
						err,
					);
				}
				const d = details || team;
				getRoomCoaches(roomCode, name)
					.catch((): string[] => [])
					.then(async (coaches) => {
						const coachAvatars = await getCoachAvatars(coaches).catch(
							() => ({}),
						);
						// Seeds partilhados: todos renderizam `nome|seed` (ver coachAvatarSeed).
						const coachAvatarSeeds: Record<string, string> = {};
						await Promise.all(
							coaches.map(async (c: string) => {
								const s = await getAvatarSeed(c).catch(() => "");
								if (s) coachAvatarSeeds[c] = s;
							}),
						).catch(() => {});
						socket.emit("teamAssigned", {
							teamName: d.name,
							teamId: d.id,
							division: d.division ?? 4,
							budget: d.budget ?? 0,
							points: d.points ?? 0,
							wins: d.wins ?? 0,
							draws: d.draws ?? 0,
							losses: d.losses ?? 0,
							goalsFor: d.goals_for ?? 0,
							goalsAgainst: d.goals_against ?? 0,
							colorPrimary: d.color_primary ?? "#888888",
							colorSecondary: d.color_secondary ?? "#ffffff",
							crest: d.crest ?? null,
							stadiumCapacity: d.stadium_capacity ?? 0,
							stadiumName: d.stadium_name ?? "",
							coaches,
							coachAvatars,
							coachAvatarSeeds,
							isNew,
						});
					});
			},
		);

		// Emit chat history for both channels
		game.db.all(
			"SELECT id, coach_name AS coachName, message, timestamp FROM chat_messages WHERE timestamp >= ? ORDER BY id DESC LIMIT 50",
			[Date.now() - CHAT_RETENTION_MS],
			(err: any, rows: any[]) => {
				const messages = err ? [] : (rows || []).reverse();
				socket.emit("chatHistory", { channel: "room", messages });
			},
		);
		getGlobalMessages(50, Date.now() - CHAT_RETENTION_MS)
			.then((messages) =>
				socket.emit("chatHistory", { channel: "global", messages }),
			)
			.catch(() =>
				socket.emit("chatHistory", { channel: "global", messages: [] }),
			);
	}

	function generateRandomTeam(
		game: ActiveGame,
		name: string,
		roomCode: string,
		managerId: number,
		deviceId: string | null = null,
	) {
		const takenTeamIds = Object.values(game.playersByName)
			.map((player) => player.teamId)
			.filter(Boolean);
		const placeholders = takenTeamIds.map(() => "?").join(",");
		let query =
			"SELECT id, name FROM teams WHERE division = 4 AND manager_id IS NULL";
		let params: any[] = [];
		if (takenTeamIds.length > 0) {
			query += ` AND id NOT IN (${placeholders})`;
			params = [...takenTeamIds];
		}
		query += " ORDER BY RANDOM() LIMIT 1";

		game.db.get(query, params, (err: any, team: any) => {
			if (err || !team) {
				let fallbackQuery = "SELECT id, name FROM teams WHERE division = 4";
				let fallbackParams: any[] = [];
				if (takenTeamIds.length > 0) {
					fallbackQuery += ` AND id NOT IN (${placeholders})`;
					fallbackParams = [...takenTeamIds];
				}
				fallbackQuery += " ORDER BY RANDOM() LIMIT 1";

				game.db.get(fallbackQuery, fallbackParams, (err2: any, team2: any) => {
					if (err2 || !team2) {
						socket.emit("joinError", "Nenhuma equipa disponível na Divisão 4.");
						return;
					}
					game.db.run(
						"UPDATE teams SET manager_id = ? WHERE id = ?",
						[managerId, team2.id],
						() => assignPlayer(game, name, team2, roomCode, true, deviceId),
					);
				});
				return;
			}
			game.db.run(
				"UPDATE teams SET manager_id = ? WHERE id = ?",
				[managerId, team.id],
				() => assignPlayer(game, name, team, roomCode, true, deviceId),
			);
		});
	}

	socket.on("joinGame", async (data) => {
		const { name, token, roomCode: rawRoom, roomName, joinMode, deviceId, visible } = data;

		if (!name || typeof name !== "string" || name.trim().length === 0) {
			return socket.emit("joinError", "Nome de treinador inválido.");
		}
		if (!token || typeof token !== "string" || token.trim().length === 0) {
			// Token em falta no payload: o servidor nada validou, por isso a
			// mensagem fica fora do vocabulário de `isAuthError` — sem prova de
			// invalidez, a sessão guardada no cliente não se apaga.
			return socket.emit("joinError", "Sessão em falta. Volta a tentar entrar na sala.");
		}

		const trimmedName = name.trim();
		const ip = getSocketIp(socket);

		// Autenticação por token de sessão (nunca por password em claro)
		const session = await verifySession(token.trim());

		// Rate limit por nome e por IP (anti brute-force): apenas falhas de
		// autenticação consomem — um join com sessão válida (reconect, auto-
		// rejoin ao abrir o browser) nunca pode bloquear o dono da conta, e
		// um erro transitório é falha do servidor, não ataque.
		const joinNameKey = `name:${trimmedName.toLowerCase()}`;
		const authOk =
			!!session.ok &&
			session.name.toLowerCase() === trimmedName.toLowerCase();
		if (!authOk) {
			if (session.transient) {
				// Falha transitória de verificação (BD): não é credencial
				// inválida e não consome o rate limit. Mensagem fora do
				// vocabulário de `isAuthError` para o cliente manter a sessão
				// e o retry recuperar sozinho.
				return socket.emit(
					"joinError",
					"Sessão temporariamente indisponível. A tentar de novo.",
				);
			}
			if (
				!allowLimit(
					joinRateStore,
					joinNameKey,
					JOIN_LIMIT_PER_NAME.max,
					JOIN_LIMIT_PER_NAME.windowMs,
				) ||
				!allowLimit(
					joinRateStore,
					`ip:${ip}`,
					JOIN_LIMIT_PER_IP.max,
					JOIN_LIMIT_PER_IP.windowMs,
				)
			) {
				return socket.emit(
					"joinError",
					"Demasiadas tentativas. Tenta novamente em breve.",
				);
			}
			if (!session.ok) {
				return socket.emit("joinError", "Sessão expirada. Volta a iniciar sessão.");
			}
			return socket.emit("joinError", "Sessão inválida para este treinador.");
		}
		// Sessão válida: limpar falhas anteriores do nome — a conta está provada.
		joinRateStore.delete(joinNameKey);

		// Limite de criação de salas novas por treinador
		if (
			joinMode === "new-game" &&
			!allowLimit(
				newGameRateStore,
				`name:${trimmedName.toLowerCase()}`,
				NEW_GAME_LIMIT_PER_NAME.max,
				NEW_GAME_LIMIT_PER_NAME.windowMs,
			)
		) {
			return socket.emit(
				"joinError",
				"Limite de novos jogos atingido. Tenta mais tarde.",
			);
		}

		let finalRoomCode = (rawRoom || "").toUpperCase();

		if (joinMode === "new-game") {
			finalRoomCode = generateUniqueRoomCode();
		} else if (joinMode === "friend-room" || joinMode === "saved-game") {
			if (!doesGameExist(finalRoomCode)) {
				return socket.emit("joinError", "Sala não encontrada. Verifica o código.");
			}
		} else {
			// Reconnect flow
			if (!finalRoomCode) {
				return socket.emit("joinError", "Código de sala inválido.");
			}
			if (!doesGameExist(finalRoomCode)) {
				return socket.emit("joinError", "A sala já não existe.");
			}
		}

		const creatorHint = joinMode === "new-game" ? trimmedName : undefined;
		try {
			getGame(finalRoomCode, (game, gameErr) => {
			if (!game || gameErr) {
				return socket.emit(
					"joinError",
					gameErr
						? gameErr.message
						: "Erro ao carregar o jogo. Contacta o administrador.",
				);
			}

			const doJoinContinue = () => {
				// Bloquear coaches expulso definitivamente pelo Admin
				if (game.kickedCoaches?.has(trimmedName)) {
					socket.leave(finalRoomCode);
					return socket.emit(
						"joinError",
						"Foste expulso desta sala pelo Admin.",
					);
				}

				// Definir o criador da sala quando é criada de raiz
				if (joinMode === "new-game" && !game.roomCreator) {
					game.roomCreator = trimmedName;
					saveGameState(game);
				}

				recordRoomAccess(trimmedName, finalRoomCode);

				// Carregar a membresia persistente (room_managers) antes do
				// primeiro emitPresence do join — garante que a lista de offline
				// está correcta mesmo após restart / load fresco do jogo.
				getRoomCoaches(finalRoomCode)
					.then((members: string[]) => {
						game.roomMembers = new Set(members);
					})
					.catch(() => {})
					.then(() => proceedWithManagerLookup());
			};

			const proceedWithManagerLookup = () => {
				game.db.get(
					"SELECT * FROM managers WHERE name = ?",
					[trimmedName],
					(_err: any, row: any) => {
						if (row) {
							game.db.get(
								"SELECT id, name FROM teams WHERE manager_id = ?",
								[row.id],
								(_err2: any, team: any) => {
									if (team) {
										assignPlayer(game, trimmedName, team, finalRoomCode, false, deviceId ?? null, visible === false);
									} else if (game.dismissedCoachSince[trimmedName]) {
										// Coach is dismissed and waiting for a new job — rebind socket
										// without assigning a new team so their dismissed state is preserved.
										if (!game.playersByName[trimmedName]) {
											game.playersByName[trimmedName] = {
												name: trimmedName,
												teamId: null,
												roomCode: finalRoomCode,
												ready: false,
												tactic: { formation: "4-4-2", style: "Balanced" },
												socketId: socket.id,
											};
										}
										const dismissedPrevDevice = game.seats[trimmedName]?.deviceId ?? null;
										detachFromOtherRoom(finalRoomCode);
										const displacedSocketId = bindSocket(game, trimmedName, socket.id);
										notifyDisplaced(displacedSocketId, dismissedPrevDevice, deviceId ?? null);

										const dismissalInfo = game.dismissedCoachSince[trimmedName];
										socket.emit("coachDismissed", {
											reason: dismissalInfo.reason || "results",
											teamName: dismissalInfo.teamName || "equipa anterior",
											detail: dismissalInfo.detail,
										});

										getTeamsWithCoachNames(game.db)
											.then((teams: any[]) => {
												socket.emit("teamsData", teams);
												getAllTeamForms(game.db, game.season)
													.then((forms) => socket.emit("teamForms", forms))
													.catch(() => {});
											})
											.catch(() => {});

										// Mesmo construtor do join/resync: sem equipa não há tática
										// nem painel de intervalo para este treinador.
										socket.emit(
											"gameState",
											buildGameStatePayload(game, trimmedName, {
												tactic: null,
												lastHalfTimePayload: null,
											}),
										);

										emitPresence(game);
										emitGlobalPlayerUpdate?.();

										game.db.all(
											"SELECT id, coach_name AS coachName, message, timestamp FROM chat_messages WHERE timestamp >= ? ORDER BY id DESC LIMIT 50",
											[Date.now() - CHAT_RETENTION_MS],
											(errC: any, rows: any[]) => {
												const messages = errC ? [] : (rows || []).reverse();
												socket.emit("chatHistory", {
													channel: "room",
													messages,
												});
											},
										);
										getGlobalMessages(50, Date.now() - CHAT_RETENTION_MS)
											.then((messages) =>
												socket.emit("chatHistory", {
													channel: "global",
													messages,
												}),
											)
											.catch(() =>
												socket.emit("chatHistory", {
													channel: "global",
													messages: [],
												}),
											);

										console.log(
											`[${finalRoomCode}] 🔄 Dismissed coach ${trimmedName} reconnected — preserved dismissed state`,
										);
									} else {
										generateRandomTeam(game, trimmedName, finalRoomCode, row.id, deviceId ?? null);
									}
								},
							);
						} else {
							// New player (no record in this room's DB).
							// New human coaches can be invited (via room code) at any time,
							// even after the game has already started.
							game.db.run(
								"INSERT INTO managers (name, is_human) VALUES (?, 1)",
								[trimmedName],
								function (_err2: any) {
									generateRandomTeam(game, trimmedName, finalRoomCode, this.lastID, deviceId ?? null);
								},
							);
						}
					},
				);
			}; // end proceedWithManagerLookup

			const doJoin = () => {
				// Sala cheia recusa ANTES do sucesso: o cliente já não recebe
				// «entraste» seguido de «recusado».
				const connectedCount = Object.values(game.playersByName).filter(
					(player) => player.socketId,
				).length;
				if (connectedCount >= 8 && !game.playersByName[trimmedName]) {
					socket.emit("joinError", "Sala cheia (Máximo 8 Treinadores).");
					return;
				}

				socket.join(finalRoomCode);
				socket.join("__global__");

				socket.emit("joinGameSuccess", {
					roomCode: finalRoomCode,
					roomName: (game as any).roomName || finalRoomCode,
				});

				doJoinContinue();
			}; // end doJoin

			if (joinMode === "new-game" && roomName) {
				game.db.run(
					"INSERT OR REPLACE INTO game_state (key, value) VALUES ('roomName', ?)",
					[roomName],
					() => {
						(game as any).roomName = roomName;
						doJoin();
					},
				);
			} else {
				doJoin();
			}
		},
			creatorHint,
			);
		} catch (err) {
			// Falha ao localizar/criar o ficheiro da sala (ex.: pasta de saves
			// sem escrita) — erro só para este join, sem derrubar o servidor.
			console.error(`[join] Sala ${finalRoomCode}:`, (err as Error)?.message || err);
			return socket.emit(
				"joinError",
				"Erro ao carregar o jogo. Contacta o administrador.",
			);
		}
	});

	socket.on("requestNextMatchSummary", async ({ teamId }) => {
		const game = getGameBySocket(socket.id);
		if (!game) return;
		const playerState = getPlayerBySocket(game, socket.id);
		if (!playerState) return;

		try {
			const summary = await buildNextMatchSummary(
				game,
				playerState.teamId || teamId,
			);
			if (summary) {
				summary.cupWeekFriendly = await getCupWeekFriendlyStatus(
					game,
					playerState.teamId || teamId,
					runAll,
				);
			}
			socket.emit("nextMatchSummary", summary);
		} catch (error) {
			console.error(`[${game.roomCode}] nextMatchSummary error:`, error);
			socket.emit("nextMatchSummary", null);
		}
	});

	// Foto de avatar carregada/removida no UserSettingsPage (via REST): difundir a
	// versão atual (lida da BD, sem confiar no cliente) para todos verem sem refresh.
	socket.on("notifyAvatarChanged", async () => {
		const game = getGameBySocket(socket.id);
		if (!game) return;
		const playerState = getPlayerBySocket(game, socket.id);
		const coachName = playerState?.name ?? game.socketToName?.[socket.id];
		if (!coachName) return;
		try {
			const [versions, seed] = await Promise.all([
				getCoachAvatars([coachName]).catch(() => ({})),
				getAvatarSeed(coachName).catch(() => ""),
			]);
			io.emit("coachAvatarUpdated", {
				name: coachName,
				// Object.values (não lookup direto): a chave vem com a caixa da BD.
				version: Object.values(versions)[0] ?? null,
				seed: seed || null,
			});
		} catch (error) {
			console.error(`[${game.roomCode}] notifyAvatarChanged error:`, error);
		}
	});

	socket.on("requestCalendar", async () => {
		const game = getGameBySocket(socket.id);
		if (!game) return;
		try {
			const leagueMatches = await runAll(
				game.db,
				"SELECT id, matchweek, home_team_id, away_team_id, home_score, away_score, attendance, ticket_revenue FROM matches WHERE played = 1 AND season = ? ORDER BY matchweek, id",
				[game.season],
			);

			// MOM por equipa/jogo (match_moms) — chave `${slot}:${teamId}`.
			const leagueMomRows = await runAll(
				game.db,
				"SELECT matchweek, team_id, player_name FROM match_moms WHERE season = ? AND competition = 'League'",
				[game.season],
			);
			const cupMomRows = await runAll(
				game.db,
				"SELECT round, team_id, player_name FROM match_moms WHERE season = ? AND competition = 'Cup'",
				[game.season],
			);
			const leagueMoms = new Map<string, string>();
			for (const r of leagueMomRows as any[]) leagueMoms.set(`${r.matchweek}:${r.team_id}`, r.player_name);
			const cupMoms = new Map<string, string>();
			for (const r of cupMomRows as any[]) cupMoms.set(`${r.round}:${r.team_id}`, r.player_name);

			// Calendário magro: narrative/lineups nunca são consumidos do calendarData
			const parsedLeagueMatches = leagueMatches.map((match: any) => ({
				...match,
				finalHomeGoals: match.home_score,
				finalAwayGoals: match.away_score,
				events: [],
				homeLineup: [],
				awayLineup: [],
				home_mom: leagueMoms.get(`${match.matchweek}:${match.home_team_id}`) ?? null,
				away_mom: leagueMoms.get(`${match.matchweek}:${match.away_team_id}`) ?? null,
			}));

			const cupMatches = (await runAll(
				game.db,
				"SELECT id, round, home_team_id, away_team_id, home_score, away_score, home_et_score, away_et_score, home_penalties, away_penalties, winner_team_id, ticket_revenue, played FROM cup_matches WHERE season = ? ORDER BY round, id LIMIT 200",
				[game.season],
			)) as any[];
			for (const m of cupMatches) {
				m.home_mom = cupMoms.get(`${m.round}:${m.home_team_id}`) ?? null;
				m.away_mom = cupMoms.get(`${m.round}:${m.away_team_id}`) ?? null;
			}
			socket.emit("calendarData", {
				calendarIndex: game.calendarIndex,
				season: game.season,
				year: game.year,
				matchweek: game.matchweek,
				gamePhase: game.gamePhase,
				fixtureSeeds: game.fixtureSeeds ?? {},
				leagueMatches: parsedLeagueMatches,
				cupMatches,
			});
		} catch (err) {
			console.error(`[${game.roomCode}] requestCalendar error:`, err);
			socket.emit("calendarData", null);
		}
	});

	socket.on("requestPalmares", async ({ teamId }: { teamId?: number } = {}) => {
		const game = getGameBySocket(socket.id);
		if (!game) return;
		try {
			const rows = await runAll(
				game.db,
				`SELECT pa.season, pa.achievement, pa.coach_name, pa.is_human_coach, t.name as team_name
         FROM palmares pa
         JOIN teams t ON t.id = pa.team_id
         WHERE pa.team_id = ?
         ORDER BY pa.season DESC, pa.id DESC`,
				[teamId],
			);
			const allChampions = await runAll(
				game.db,
				`SELECT pa.season, pa.achievement, pa.coach_name, pa.is_human_coach, t.id as team_id, t.name as team_name, t.color_primary, t.color_secondary
         FROM palmares pa
         JOIN teams t ON t.id = pa.team_id
         ORDER BY pa.season DESC, pa.id DESC`,
			);
			socket.emit("palmaresData", { teamId, trophies: rows, allChampions });
		} catch (err) {
			console.error(`[${game.roomCode}] requestPalmares error:`, err);
			socket.emit("palmaresData", { teamId, trophies: [], allChampions: [] });
		}
	});

	socket.on("requestClubNews", async ({ teamId }: { teamId?: number } = {}) => {
		const game = getGameBySocket(socket.id);
		if (!game || !teamId) return;
		try {
			const news = await runAll(
				game.db,
				`SELECT id, team_id, type, title, description, player_id, player_name, related_team_id, related_team_name, amount, matchweek, year, created_at
         FROM club_news
         WHERE team_id = ?
           AND type IN ('transfer_in', 'transfer_out', 'auction_won', 'manager_dismissed', 'manager_hired', 'prize')
         ORDER BY year DESC, created_at DESC, id DESC
         LIMIT 100`,
				[teamId],
			);
			socket.emit("clubNewsData", { teamId, news: news || [] });
		} catch (err) {
			console.error(`[${game.roomCode}] requestClubNews error:`, err);
			socket.emit("clubNewsData", { teamId, news: [] });
		}
	});

	socket.on(
		"requestClubHistory",
		async ({ teamId }: { teamId?: number } = {}) => {
			const game = getGameBySocket(socket.id);
			if (!game || !teamId) return;
			try {
				const trophies = await runAll(
					game.db,
					`SELECT pa.season, pa.achievement, pa.coach_name, pa.is_human_coach, pa.player_id, t.name as team_name
					 FROM palmares pa
					 JOIN teams t ON t.id = pa.team_id
					 WHERE pa.team_id = ?
					 ORDER BY pa.season DESC, pa.id DESC`,
					[teamId],
				);

				const events = await runAll(
					game.db,
					`SELECT id, team_id, type, title, description, player_id, player_name,
					        related_team_id, related_team_name, amount, matchweek, year, created_at
					 FROM club_news
					 WHERE team_id = ?
					   AND type IN ('transfer_in', 'transfer_out', 'auction_won', 'manager_dismissed', 'manager_hired', 'prize')
					 ORDER BY year DESC, matchweek DESC, id DESC
					 LIMIT 100`,
					[teamId],
				);

				// Resumo por época da liga: registo de todos os teams (para ranking),
				// mas só expõe o do clube pedido.
				const seasonRows = await runAll(
					game.db,
					`SELECT season, team_id,
					        SUM(wins) AS wins,
					        SUM(draws) AS draws,
					        SUM(losses) AS losses,
					        SUM(goals_for) AS goals_for,
					        SUM(goals_against) AS goals_against
					 FROM (
					   SELECT season, home_team_id AS team_id,
					          CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS wins,
					          CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS draws,
					          CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS losses,
					          home_score AS goals_for,
					          away_score AS goals_against
					   FROM matches
					   WHERE played = 1
					   UNION ALL
					   SELECT season, away_team_id AS team_id,
					          CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS wins,
					          CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS draws,
					          CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS losses,
					          away_score AS goals_for,
					          home_score AS goals_against
					   FROM matches
					   WHERE played = 1
					 )
					 GROUP BY season, team_id`,
				);

				const pairRows = await runAll(
					game.db,
					`SELECT season, home_team_id AS a, away_team_id AS b
					 FROM matches
					 WHERE played = 1`,
				);

				// Nomes das equipas: só para identificar o campeão de cada época na
				// trajetória (o resto da query de época já vem por team_id).
				const teamNameRows = await runAll(game.db, `SELECT id, name FROM teams`);
				const teamNameById: Map<number, string> = new Map(
					(teamNameRows || []).map((r: any) => [r.id, r.name]),
				);

				// Liga é round-robin por divisão: a componente conexa das jogos de uma
				// época é a própria divisão. Usa union-find para reconstruir a divisão
				// de cada equipa por época (a divisão atual não vale para o histórico).
				const find = (parent: Map<number, number>, x: number): number => {
					let r = parent.get(x) ?? x;
					if (parent.get(r) !== undefined) {
						r = find(parent, r);
						parent.set(x, r);
					}
					return r;
				};
				const union = (parent: Map<number, number>, a: number, b: number) => {
					const ra = find(parent, a);
					const rb = find(parent, b);
					if (ra !== rb) parent.set(ra, rb);
				};

				const baseYear = (game.year ?? 0) - (game.season ?? 0);
				const currentSeason = game.season ?? 1;
				const bySeason = new Map<number, AnyRow[]>();
				const divBySeason = new Map<number, Map<number, number>>();
				for (const row of seasonRows || []) {
					const list = bySeason.get(row.season) || [];
					list.push(row);
					bySeason.set(row.season, list);
				}
				for (const pair of pairRows || []) {
					let parent = divBySeason.get(pair.season);
					if (!parent) {
						parent = new Map();
						divBySeason.set(pair.season, parent);
					}
					union(parent, pair.a, pair.b);
				}

				const seasonRecords: Array<{
					year: number;
					season: number;
					position: number;
					wins: number;
					draws: number;
					losses: number;
					goalsFor: number;
					goalsAgainst: number;
					points: number;
					divisionSize: number;
					championName: string | null;
					championPoints: number;
				}> = [];
				for (const [season, rows] of bySeason) {
					// Época corrente ainda não acabou — só histórico das concluídas.
					if (Number(season) === currentSeason) continue;

					const parent = divBySeason.get(season) || new Map<number, number>();
					const myRoot = find(parent, teamId);
					const group = rows.filter((r) => find(parent, r.team_id) === myRoot);
					const sorted = [...group].sort((a, b) => {
						const pa = 3 * a.wins + a.draws;
						const pb = 3 * b.wins + b.draws;
						if (pb !== pa) return pb - pa;
						const gda = a.goals_for - a.goals_against;
						const gdb = b.goals_for - b.goals_against;
						if (gdb !== gda) return gdb - gda;
						return b.goals_for - a.goals_for;
					});
					const idx = sorted.findIndex((r) => r.team_id === teamId);
					if (idx === -1) continue;
					const row = sorted[idx];
					// A componente conexa da época é a divisão: o líder dela é o campeão.
					const champion = sorted[0];
					seasonRecords.push({
						year: baseYear + season,
						season,
						position: idx + 1,
						wins: row.wins,
						draws: row.draws,
						losses: row.losses,
						goalsFor: row.goals_for,
						goalsAgainst: row.goals_against,
						points: 3 * row.wins + row.draws,
						divisionSize: group.length,
						championName: teamNameById.get(champion.team_id) ?? null,
						championPoints: 3 * champion.wins + champion.draws,
					});
				}
				seasonRecords.sort((a, b) => b.season - a.season);

				// Lista completa de jogos do clube (Liga + Taça + amigável de
				// pré-época). Só épocas concluídas e jogos realizados.
				const leagueRows = await runAll(
					game.db,
					`SELECT m.season, m.matchweek, m.home_team_id, m.away_team_id,
					        m.home_score, m.away_score,
					        ht.name AS home_name, at.name AS away_name
					 FROM matches m
					 JOIN teams ht ON ht.id = m.home_team_id
					 JOIN teams at ON at.id = m.away_team_id
					 WHERE m.played = 1
					   AND m.season != ?
					   AND (m.home_team_id = ? OR m.away_team_id = ?)
					 ORDER BY m.season DESC, m.matchweek DESC
					 LIMIT 200`,
					[currentSeason, teamId, teamId],
				);
				const cupRows = await runAll(
					game.db,
					`SELECT c.season, c.round, c.home_team_id, c.away_team_id,
					        c.home_score, c.away_score, c.home_penalties, c.away_penalties,
					        c.winner_team_id,
					        ht.name AS home_name, at.name AS away_name
					 FROM cup_matches c
					 JOIN teams ht ON ht.id = c.home_team_id
					 JOIN teams at ON at.id = c.away_team_id
					 WHERE c.played = 1
					   AND c.season != ?
					   AND (c.home_team_id = ? OR c.away_team_id = ?)
					 ORDER BY c.season DESC, c.round DESC
					 LIMIT 100`,
					[currentSeason, teamId, teamId],
				);
				const games = [
					...(leagueRows || []).map((r: any) => ({
						kind: "league",
						season: r.season,
						year: baseYear + r.season,
						matchweek: r.matchweek,
						round: null,
						roundName: null,
						homeTeamId: r.home_team_id,
						awayTeamId: r.away_team_id,
						homeName: r.home_name,
						awayName: r.away_name,
						homeScore: r.home_score,
						awayScore: r.away_score,
						homePenalties: 0,
						awayPenalties: 0,
						winnerTeamId: null,
					})),
					...(cupRows || []).map((r: any) => ({
						kind: Number(r.round) <= 0 ? "friendly" : "cup",
						season: r.season,
						year: baseYear + r.season,
						matchweek: null,
						round: r.round,
						roundName:
							Number(r.round) === 0
								? FRIENDLY_ROUND_NAME
								: Number(r.round) < 0
								? "Amigável"
								: (CUP_ROUND_NAMES[Number(r.round)] || `Ronda ${r.round}`),
						homeTeamId: r.home_team_id,
						awayTeamId: r.away_team_id,
						homeName: r.home_name,
						awayName: r.away_name,
						homeScore: r.home_score,
						awayScore: r.away_score,
						homePenalties: r.home_penalties || 0,
						awayPenalties: r.away_penalties || 0,
						winnerTeamId: r.winner_team_id ?? null,
					})),
				];
				games.sort((a: any, b: any) => b.season - a.season || (b.matchweek ?? 99) - (a.matchweek ?? 99) || (b.round ?? -1) - (a.round ?? -1));

				socket.emit("clubHistoryData", {
					teamId,
					trophies: trophies || [],
					events: events || [],
					seasonRecords,
					games,
				});
			} catch (err) {
				console.error(`[${game.roomCode}] requestClubHistory error:`, err);
				socket.emit("clubHistoryData", {
					teamId,
					trophies: [],
					events: [],
					seasonRecords: [],
					games: [],
				});
			}
		},
	);

	socket.on(
		"requestPlayerHistory",
		async ({ playerId }: { playerId?: number } = {}) => {
			const game = getGameBySocket(socket.id);
			// Negative IDs belong to ephemeral junior GRs — no DB row exists for them.
			if (!game || !playerId || playerId < 0) return;
			try {
				const player = await runGet(
					game.db,
					`SELECT p.*, t.name as team_name, t.crest as team_crest, t.color_primary as team_color_primary, t.color_secondary as team_color_secondary
         FROM players p
         LEFT JOIN teams t ON t.id = p.team_id
         WHERE p.id = ?`,
					[playerId],
				);
				if (!player) {
					socket.emit("playerHistoryData", null);
					return;
				}
				// ex-Clube só para jogadores que rescindiram e estão em leilão (isExClub === true no leilão ativo)
				player.isExClub =
					player.transfer_status === "auction" &&
					!!(game.auctions as any)?.[player.id]?.isExClub;
				const transfers = await runAll(
					game.db,
					`SELECT cn.year, cn.matchweek, cn.title, cn.amount,
                cn.team_id, t.name as team_name,
                cn.related_team_id, cn.related_team_name, cn.type
         FROM club_news cn
         LEFT JOIN teams t ON t.id = cn.team_id
         WHERE cn.player_id = ?
           AND cn.type IN ('transfer_in', 'transfer_out')
         ORDER BY cn.year ASC, cn.matchweek ASC, cn.id ASC`,
					[playerId],
				);

				// Each transfer logs two club_news rows with the same player_id:
				// transfer_in (new club) + transfer_out (old club). Treat them as
				// one event — keep a single row, preferring the transfer_in side.
				const dedupedTransfers: AnyRow[] = [];
				const seenTransfer = new Map<string, AnyRow>();
				for (const t of transfers || []) {
					const a = t.team_id ?? t.related_team_id;
					const b = t.related_team_id ?? t.team_id;
					const [lo, hi] = [a, b].sort();
					const key = `${t.year ?? ""}|${t.matchweek ?? ""}|${t.amount ?? ""}|${lo ?? ""}|${hi ?? ""}`;
					const existing = seenTransfer.get(key);
					if (!existing) {
						seenTransfer.set(key, t);
						dedupedTransfers.push(t);
					} else if (t.type === "transfer_in" && existing.type !== "transfer_in") {
						seenTransfer.set(key, t);
						const idx = dedupedTransfers.indexOf(existing);
						if (idx > -1) dedupedTransfers[idx] = t;
					}
				}

				// Player awards — Melhor Marcador is the only individual award,
				// stored in palmares with player_id.
				const awards = await runAll(
					game.db,
					`SELECT pa.season, pa.achievement
					 FROM palmares pa
					 WHERE pa.player_id = ?
					 ORDER BY pa.season ASC, pa.id ASC`,
					[playerId],
				);

				// Skill history — from player_skill_snapshots table
				const skillRows = await runAll<{ matchweek: number; season: number; skill: number }>(
					game.db,
					`SELECT matchweek, season, skill FROM player_skill_snapshots
					 WHERE player_id = ?
					 ORDER BY season ASC, matchweek ASC`,
					[playerId],
				);

				// Always append current skill to ensure the chart shows latest value.
				// buildSkillHistory preserves `season` (matchweek is the per-season calendar slot 1..25;
				// without season, multi-season charts collapse all seasons onto the
				// same X positions — latest records become invisible).
				const playerRow = await runGet(
					game.db,
					`SELECT skill FROM players WHERE id = ?`,
					[playerId],
				);
				let skillHistory: Array<{
					matchweek: number;
					season: number;
					skill: number;
				}> = [];
				if (playerRow && playerRow.skill != null) {
					skillHistory = buildSkillHistory(skillRows || [], {
						matchweek: (game.calendarIndex ?? 0) + 1,
						season: game.season || 1,
						skill: playerRow.skill,
					});
				} else {
					skillHistory = (skillRows || []).map((r) => ({
						matchweek: r.matchweek,
						season: r.season,
						skill: r.skill,
					}));
				}

				socket.emit("playerHistoryData", {
					player,
					transfers: dedupedTransfers,
					skillHistory,
					awards: awards || [],
				});
			} catch (err) {
				console.error(`[${game.roomCode}] requestPlayerHistory error:`, err);
				socket.emit("playerHistoryData", null);
			}
		},
	);

	// Prova de vida do cliente ao voltar do segundo plano: o ack é a prova; o
	// `socket.use` (index.ts) já renova o lease com qualquer pacote recebido.
	socket.on("presencePing", (ack) => {
		if (typeof ack === "function") ack({ ok: true });
	});

	socket.on("presenceSubscribe", () => {
		// Pré-jogo (escolha de salas): junta o socket ao canal de presença para
		// receber updates e devolve o snapshot actual dos coaches online.
		if (presenceRoom) socket.join(presenceRoom);
		if (getGlobalPlayerList) {
			socket.emit("globalPlayersUpdate", getGlobalPlayerList());
		}
	});

	socket.on("presenceUnsubscribe", () => {
		if (presenceRoom) socket.leave(presenceRoom);
	});

	// ─── Convite de sala (pre-join → coach online noutra sala) ──────────────
	socket.on("sendRoomInvite", async (data, ack) => {
		const reply = (payload: any) => {
			if (typeof ack === "function") ack(payload);
		};

		const rawName =
			typeof data?.name === "string" ? data.name.trim() : "";
		const rawToken =
			typeof data?.token === "string" ? data.token.trim() : "";
		const roomCode = (
			typeof data?.roomCode === "string" ? data.roomCode : ""
		).toUpperCase();
		const toCoach =
			typeof data?.toCoach === "string" ? data.toCoach.trim() : "";
		const roomName =
			typeof data?.roomName === "string" && data.roomName
				? data.roomName
				: roomCode;

		if (!rawName || !rawToken) return reply({ ok: false, error: "Sessão inválida." });
		if (!/^[A-Z0-9]{4,8}$/.test(roomCode))
			return reply({ ok: false, error: "Código de sala inválido." });
		if (!toCoach)
			return reply({ ok: false, error: "Treinador inválido." });

		const ip = getSocketIp(socket);
		if (
			!allowLimit(
				inviteRateStore,
				`name:${rawName.toLowerCase()}`,
				INVITE_LIMIT_PER_NAME.max,
				INVITE_LIMIT_PER_NAME.windowMs,
			) ||
			!allowLimit(
				inviteRateStore,
				`ip:${ip}`,
				INVITE_LIMIT_PER_IP.max,
				INVITE_LIMIT_PER_IP.windowMs,
			)
		) {
			return reply({
				ok: false,
				error: "Demasiados convites. Tenta novamente em breve.",
			});
		}

		const session = await verifySession(rawToken);
		if (!session.ok)
			return reply({ ok: false, error: "Sessão expirada. Volta a iniciar sessão." });
		if (session.name.toLowerCase() !== rawName.toLowerCase())
			return reply({ ok: false, error: "Sessão inválida para este treinador." });

		// Só se convida para salas de que se é membro; e o alvo deve ser membro.
		try {
			const coaches = await getRoomCoaches(roomCode);
			const lower = (x: string) => x.toLowerCase();
			const members = new Set(coaches.map(lower));
			if (!members.has(lower(session.name))) {
				return reply({ ok: false, error: "Não pertences a esta sala." });
			}
			if (!members.has(lower(toCoach))) {
				return reply({
					ok: false,
					error: `${toCoach} já não pertence a esta sala.`,
				});
			}
		} catch {
			return reply({ ok: false, error: "Erro ao validar a sala." });
		}

		if (!findOnlineCoachSocket) {
			return reply({ ok: false, error: "Erro interno (presença)." });
		}
		const target = findOnlineCoachSocket(toCoach);
		if (!target) {
			// Offline: o socket não chega lá — o convite segue por push (o toque
			// abre a app na sala certa, pelo deep link). Sem convite pendente:
			// não há socket para o aceitar.
			notifyRoomInvite(toCoach, session.name, roomCode, roomName);
			return reply({ ok: true, toCoach, pushed: true });
		}
		if (target.roomCode === roomCode) {
			return reply({ ok: false, error: `${toCoach} já está nesta sala.` });
		}

		const inviteId = nextInviteId();
		pendingRoomInvites.set(inviteId, {
			inviteId,
			fromName: session.name,
			fromSocketId: socket.id,
			roomCode,
			roomName,
			toCoach,
		});

		io.to(target.socketId).emit("roomInvite", {
			inviteId,
			fromName: session.name,
			roomCode,
			roomName,
		});
		reply({ ok: true, inviteId, toCoach });
	});

	socket.on("respondRoomInvite", (data) => {
		const inviteId = typeof data?.inviteId === "string" ? data.inviteId : "";
		const accepted = !!data?.accepted;
		const pending = pendingRoomInvites.get(inviteId);
		if (!pending) return;
		pendingRoomInvites.delete(inviteId);

		// A resposta volta ao socket do emissor (escolha de salas).
		io.to(pending.fromSocketId).emit("roomInviteResult", {
			inviteId,
			toCoach: pending.toCoach,
			roomCode: pending.roomCode,
			accepted,
		});
	});

	// ─── leaveRoom ─────────────────────────────────────────────────────────────
	// Saída voluntária da sala: desvincula o socket, remove da sessão activa e
	// notifica os restantes coaches. A equipa fica associada ao coach na DB
	// (manager_id inalterado) para que possa voltar mais tarde.
	socket.on("leaveRoom", () => {
		const game = getGameBySocket(socket.id);
		if (!game) return;

		const playerState = getPlayerBySocket(game, socket.id);
		const coachName = playerState?.name ?? game.socketToName?.[socket.id];

		console.log(
			`[${game.roomCode}] 🚪 leaveRoom: ${coachName ?? "unknown"} (socket=${socket.id})`,
		);

		if (playerState) {
			// Repor ready para lobby (o assento é libertado abaixo)
			playerState.ready = false;
			setSeatIntent(game, playerState.name, { ready: false });

			// Remover dos lockedCoaches
			game.lockedCoaches.delete(playerState.name);

			// Cancelar pendingMatchActions se eram deste coach
			for (const pendingAction of listTeamMatchActions(
				game,
				playerState.teamId,
			)) {
				takePendingMatchAction(game, pendingAction.actionId);
				try {
					pendingAction.finalize(pendingAction.fallback?.(), "auto");
				} catch (err) {
					console.error(
						`[${game.roomCode}] leaveRoom: erro ao finalizar pendingMatchAction:`,
						err,
					);
				}
			}

			// Remover de playersByName — sessão activa limpa
			delete game.playersByName[playerState.name];

			// Libertamento explícito do assento: é a única forma de a sala
			// descongelar sem o treinador — saída voluntária é consentimento.
			releaseSeat(game, playerState.name, "left");
		}

		// Desvincular socket e sair da sala Socket.io
		unbindSocket(game, socket.id);
		socket.leave(game.roomCode);

		// Notificar restantes coaches
		io.to(game.roomCode).emit("coachDisconnected", {
			coachName: coachName ?? null,
			teamId: playerState?.teamId ?? null,
		});
		emitPresence(game);
		emitPresencePause(game, io);

		// Verificar se o jogo pode avançar sem este coach (ex: halftime a dois)
		const activePhases = ["match_halftime", "match_et_gate"];
		if (activePhases.includes(game.gamePhase)) {
			checkAllReady(game);
		}
	});

	// ─── requestResync ────────────────────────────────────────────────────────
	// O cliente deteta um salto de `seq` (evento perdido num flape) e pede o
	// estado completo. Responde com o mesmo payload do join — não há diff, porque
	// a fonte é a mesma e uma snapshot é impossível de ficar dessincronizada.
	socket.on("requestResync", () => {
		const game = getGameBySocket(socket.id);
		if (!game) return;
		const playerState = getPlayerBySocket(game, socket.id);
		if (!playerState) return;

		markSeatSeen(game, playerState.name);
		console.log(
			`[${game.roomCode}] 🔄 requestResync: ${playerState.name} (seq=${game.eventSeq})`,
		);
		// Tabela de equipas também: o cliente pede resync quando o GameProvider
		// monta depois da rajada do join, e sem isto ficava sem `teams` (sem
		// orçamento, cores nem posição) até ao próximo broadcast.
		getTeamsWithCoachNames(game.db)
			.then((teams: any[]) => {
				socket.emit("teamsData", teams);
				getAllTeamForms(game.db, game.season)
					.then((forms) => socket.emit("teamForms", forms))
					.catch(() => {});
			})
			.catch(() => {});
		if (playerState.teamId != null) {
			const teamId = playerState.teamId;
			game.db.all(
				"SELECT * FROM players WHERE team_id = ?",
				[teamId],
				(_err: any, squad: any[]) => {
					socket.emit(
						"mySquad",
						ensureFullBench(
							withJuniorGRs(squad || [], teamId, upcomingMatchweek(game)),
							teamId,
							upcomingMatchweek(game),
						),
					);
					// Mesmo ordenamento do join: o plantel chega antes do
					// estado/fase para o painel do intervalo não abrir vazio.
					socket.emit("gameState", buildGameStatePayload(game, playerState.name));
					emitCurrentPhaseToSocket(game, socket);
					emitPresence(game);
					emitPresencePause(game, io);
					emitGlobalPlayerUpdate?.();
				},
			);
			game.db.get(
				"SELECT id, name, division, budget, points, wins, draws, losses, goals_for, goals_against, color_primary, color_secondary, crest, stadium_capacity, stadium_name FROM teams WHERE id = ?",
				[teamId],
				(_err: any, d: any) => {
					if (!d) return;
					socket.emit("teamAssigned", {
						teamName: d.name,
						teamId: d.id,
						division: d.division ?? 4,
						budget: d.budget ?? 0,
						points: d.points ?? 0,
						wins: d.wins ?? 0,
						draws: d.draws ?? 0,
						losses: d.losses ?? 0,
						goalsFor: d.goals_for ?? 0,
						goalsAgainst: d.goals_against ?? 0,
						colorPrimary: d.color_primary ?? "#888888",
						colorSecondary: d.color_secondary ?? "#ffffff",
						crest: d.crest ?? null,
						stadiumCapacity: d.stadium_capacity ?? 0,
						stadiumName: d.stadium_name ?? "",
						isNew: false,
					});
				},
			);
		} else {
			// Sem equipa (ex. despedido): sem plantel para ordenar.
			socket.emit("gameState", buildGameStatePayload(game, playerState.name));
			emitCurrentPhaseToSocket(game, socket);
			emitPresence(game);
			emitPresencePause(game, io);
			emitGlobalPlayerUpdate?.();
		}
		fetchTopScorers(game.db).then((scorers) => socket.emit("topScorers", scorers));
	});

	/** Estado do patrocinador de um clube para o `sponsorState` (Jornal + modal). */
	async function buildSponsorState(game: ActiveGame, teamId: number) {
		const row = await runGet(game.db, "SELECT sponsor_pending, sponsor_offers, sponsor_id, sponsor_profile, sponsor_upfront, sponsor_weekly, sponsor_second_half FROM teams WHERE id = ?", [teamId]);
		const pending = (row?.sponsor_pending || 0) === 1;
		const offers = pending ? safeParse<any[]>(row?.sponsor_offers, []) : [];
		const brand = row?.sponsor_id ? sponsorById(String(row.sponsor_id)) : undefined;
		return {
			pending,
			offers: Array.isArray(offers) ? offers : [],
			chosen: brand ? {
				sponsorId: brand.id,
				name: brand.name,
				sector: brand.sector,
				profile: row?.sponsor_profile || null,
				bg: brand.bg,
				fg: brand.fg,
				glyph: brand.glyph,
				shape: brand.shape,
				total: (Number(row?.sponsor_upfront) || 0) + (Number(row?.sponsor_weekly) || 0) * SPONSOR_WEEKS + (Number(row?.sponsor_second_half) || 0),
			} : null,
		};
	}

	socket.on("requestSponsorOffers", async ({ teamId }: { teamId?: number } = {}) => {
		const game = getGameBySocket(socket.id);
		if (!game || !teamId) return;
		try {
			socket.emit("sponsorState", await buildSponsorState(game, teamId));
		} catch {
			socket.emit("sponsorState", { pending: false, offers: [], chosen: null });
		}
	});

	/**
	 * Escolha do patrocinador (clique no Jornal). Reserva a marca por
	 * sala/época em transação: em colisão com outro clube, regenera só
	 * essa oferta e devolve `taken: true` para o modal refrescar.
	 */
	socket.on("chooseSponsor", async ({ teamId, sponsorId }: { teamId?: number; sponsorId?: string } = {}) => {
		const game = getGameBySocket(socket.id);
		const player = game ? getPlayerBySocket(game, socket.id) : null;
		if (!game || !player || !teamId || !sponsorId) return;
		if (player.teamId !== teamId) return;
		const dbRunRaw = (sql: string, params: any[] = []) =>
			new Promise<void>((resolve, reject) => {
				(game.db as any).run(sql, params, (err: any) => (err ? reject(err) : resolve()));
			});
		try {
			const team = await runGet(game.db, "SELECT division, sponsor_pending, sponsor_offers, sponsor_season FROM teams WHERE id = ?", [teamId]);
			if (!team || !team.sponsor_pending) {
				socket.emit("sponsorState", await buildSponsorState(game, teamId));
				return;
			}
			const offers = safeParse<any[]>(team.sponsor_offers, []);
			const offer = (Array.isArray(offers) ? offers : []).find((o: any) => o?.sponsorId === sponsorId);
			if (!offer) {
				socket.emit("sponsorState", await buildSponsorState(game, teamId));
				return;
			}
			const clash = await runGet(game.db, "SELECT id FROM teams WHERE sponsor_season = ? AND sponsor_id = ? AND id != ?", [game.season, sponsorId, teamId]);
			if (clash) {
				const takenRows = await runAll(game.db, "SELECT sponsor_id FROM teams WHERE sponsor_season = ? AND sponsor_id IS NOT NULL", [game.season]);
				const taken = new Set((takenRows || []).map((r: any) => String(r.sponsor_id)));
				const fresh = drawOffers(team.division, taken, 1)[0] ?? drawOffersAny(taken, 1)[0] ?? null;
				const next = (Array.isArray(offers) ? offers : []).map((o: any) => (o?.sponsorId === sponsorId && fresh ? fresh : o));
				await dbRunRaw("UPDATE teams SET sponsor_offers = ? WHERE id = ?", [JSON.stringify(next), teamId]);
				socket.emit("sponsorState", { pending: true, offers: next, chosen: null, taken: true });
				return;
			}
			await runRoomTask(game.roomCode, async () => {
				await dbRunRaw("BEGIN TRANSACTION");
				try {
					await dbRunRaw(
						"UPDATE teams SET sponsor_id = ?, sponsor_profile = ?, sponsor_pending = 0, sponsor_upfront = ?, sponsor_weekly = ?, sponsor_second_half = ?, sponsor_paid_second = 0, sponsor_season = ? WHERE id = ?",
						[offer.sponsorId, offer.profile, offer.upfront || 0, offer.weekly || 0, offer.secondHalf || 0, game.season, teamId],
					);
					if ((offer.upfront || 0) > 0) {
						await dbRunRaw("UPDATE teams SET budget = budget + ? WHERE id = ?", [offer.upfront, teamId]);
					}
					await dbRunRaw(
						`INSERT INTO club_news (team_id, type, title, description, player_id, player_name, related_team_id, related_team_name, amount, matchweek, slot, year)
						 VALUES (?, 'sponsor', ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?)`,
						[teamId, `${offer.name} é o novo patrocinador`, `Escolha do treinador (perfil ${offer.profile}, total ${offer.total}€)`, offer.upfront > 0 ? offer.upfront : offer.total, game.matchweek, 1, game.year],
					);
					await dbRunRaw("COMMIT");
				} catch (txErr) {
					await dbRunRaw("ROLLBACK").catch(() => {});
					throw txErr;
				}
			});
			socket.emit("sponsorState", await buildSponsorState(game, teamId));
			// Sem este broadcast a camisola (TeamKit via `sponsorBrand`) e o saldo
			// ficavam presos até ao refresh — mesmo padrão dos outros fluxos
			// que mexem em teams (loans, estádio, transferências).
			getTeamsWithCoachNames(game.db)
				.then((teams) => io.to(game.roomCode).emit("teamsData", teams))
				.catch(() => {});
			io.to(game.roomCode).emit("clubNewsUpdated", { teamId });
			io.to(game.roomCode).emit("globalNewsUpdated");
		} catch (chooseErr: any) {
			console.error(`[${game.roomCode}] chooseSponsor error:`, chooseErr?.message || chooseErr);
			socket.emit("systemMessage", { text: "⛔ Não foi possível registar o patrocinador. Tenta de novo." });
		}
	});

	socket.on(
		"requestFinanceData",
		async ({ teamId }: { teamId?: number } = {}) => {
			const game = getGameBySocket(socket.id);
			if (!game || !teamId) return;
			try {
				// Bilheteira ao preço faturado à altura (ticket_revenue persistido na
				// finalização = receita bruta). A casa fica com a bruta menos a
				// parte do visitante (AWAY_TICKET_SHARE), exatamente como o crédito.
				const awayShareOf = (gross: number) => Math.floor(gross * AWAY_TICKET_SHARE);
				const billedOrEstimate = (m: any) => {
					const gross = m.ticket_revenue ?? (m.attendance || 0) * 15;
					return gross - awayShareOf(gross);
				};
				let homeMatches: any[];
				try {
					homeMatches = await runAll(
						game.db,
						`SELECT m.attendance, m.ticket_revenue, m.matchweek, m.away_team_id, COALESCE(t.name, '?') as away_team_name
           FROM matches m
           LEFT JOIN teams t ON t.id = m.away_team_id
           WHERE m.home_team_id = ? AND m.played = 1 AND m.season = ?
           ORDER BY m.matchweek ASC`,
						[teamId, game.season],
					);
				} catch (ticketErr: any) {
					// DBs antigas sem coluna ticket_revenue — fallback sem receita exacta
					if (!String(ticketErr?.message || "").includes("no such column")) throw ticketErr;
					homeMatches = await runAll(
						game.db,
						`SELECT m.attendance, m.matchweek, m.away_team_id, COALESCE(t.name, '?') as away_team_name
           FROM matches m
           LEFT JOIN teams t ON t.id = m.away_team_id
           WHERE m.home_team_id = ? AND m.played = 1 AND m.season = ?
           ORDER BY m.matchweek ASC`,
						[teamId, game.season],
					);
				}
				// Taça: jogos em casa com receita de bilheteira (attendance já persistido em cup_matches)
				let cupHomeMatches: any[] = [];
				try {
					cupHomeMatches = await runAll(
						game.db,
						`SELECT cm.attendance, cm.ticket_revenue, cm.round, cm.away_team_id, COALESCE(t.name, '?') as away_team_name
               FROM cup_matches cm
               LEFT JOIN teams t ON t.id = cm.away_team_id
               WHERE cm.home_team_id = ? AND cm.played = 1 AND cm.season = ?
               ORDER BY cm.round ASC`,
						[teamId, game.season],
					);
				} catch (cupErr: any) {
					// DBs antigas sem coluna attendance/ticket_revenue em cup_matches
					if (!String(cupErr?.message || "").includes("no such column")) throw cupErr;
					try {
						cupHomeMatches = await runAll(
							game.db,
							`SELECT cm.attendance, cm.round, cm.away_team_id, COALESCE(t.name, '?') as away_team_name
               FROM cup_matches cm
               LEFT JOIN teams t ON t.id = cm.away_team_id
               WHERE cm.home_team_id = ? AND cm.played = 1 AND cm.season = ?
               ORDER BY cm.round ASC`,
							[teamId, game.season],
						);
					} catch (cupErr2: any) {
						if (!String(cupErr2?.message || "").includes("no such column")) throw cupErr2;
						cupHomeMatches = [];
					}
				}
				const leagueTicketRevenue = homeMatches.reduce(
					(sum, m) => sum + billedOrEstimate(m),
					0,
				);
				const cupTicketRevenue = cupHomeMatches.reduce(
					(sum, m) => sum + billedOrEstimate(m),
					0,
				);
				const totalTicketRevenue = leagueTicketRevenue + cupTicketRevenue;
				// Parte do visitante (15%) dos jogos fora — liga e Taça.
				const awayRows = await runAll(
					game.db,
					`SELECT 'league' AS comp, ticket_revenue FROM matches WHERE away_team_id = ? AND played = 1 AND season = ?
					 UNION ALL
					 SELECT 'cup' AS comp, ticket_revenue FROM cup_matches WHERE away_team_id = ? AND played = 1 AND season = ?`,
					[teamId, game.season, teamId, game.season],
				).catch(() => []);
				const awayLeagueRows = (awayRows || []).filter((r: any) => r.comp === "league");
				const awayTicketRevenue = (awayRows || []).reduce(
					(sum: number, r: any) => sum + awayShareOf(r.ticket_revenue || 0),
					0,
				);
				const awayLeagueTicketRevenue = awayLeagueRows.reduce(
					(sum: number, r: any) => sum + awayShareOf(r.ticket_revenue || 0),
					0,
				);
				const leagueBreakdown = homeMatches.map((m) => ({
					competition: "league" as const,
					matchweek: m.matchweek,
					round: null as number | null,
					roundName: null as string | null,
					attendance: m.attendance || 0,
					revenue: billedOrEstimate(m),
					away_team_name: m.away_team_name || "—",
				}));
				const cupBreakdown = cupHomeMatches.map((m) => ({
					competition: "cup" as const,
					matchweek: null as number | null,
					round: m.round as number,
					roundName: (CUP_ROUND_NAMES[m.round] || `Ronda ${m.round}`) as string,
					attendance: m.attendance || 0,
					revenue: billedOrEstimate(m),
					away_team_name: m.away_team_name || "—",
				}));
				const ticketBreakdown = [...leagueBreakdown, ...cupBreakdown];

				// Folha contabilística renova a cada época: vendas, compras e obras
				// filtrados pelo ano corrente (club_news.year = game.year).
				const currentYear = game.year || 0;
				const transferInList = await runAll(
					game.db,
					"SELECT player_id, player_name, amount, related_team_id, related_team_name, matchweek FROM club_news WHERE team_id = ? AND type = 'transfer_in' AND amount > 0 AND year = ? ORDER BY matchweek ASC",
					[teamId, currentYear],
				);
				const transferOutList = await runAll(
					game.db,
					"SELECT player_id, player_name, amount, related_team_id, related_team_name, matchweek FROM club_news WHERE team_id = ? AND type = 'transfer_out' AND amount > 0 AND year = ? ORDER BY matchweek ASC",
					[teamId, currentYear],
				);
				const stadiumBuilds = await runAll(
					game.db,
					"SELECT amount FROM club_news WHERE team_id = ? AND type = 'stadium_build' AND amount > 0 AND year = ?",
					[teamId, currentYear],
				);
				const totalTransferIncome = transferOutList.reduce(
					(sum, n) => sum + (n.amount || 0),
					0,
				);
				const totalTransferExpenses = transferInList.reduce(
					(sum, n) => sum + (n.amount || 0),
					0,
				);
				const totalStadiumExpenses = stadiumBuilds.reduce(
					(sum, n) => sum + (n.amount || 0),
					0,
				);

				const team = await runGet(
					game.db,
					"SELECT division, budget, sponsor_id, sponsor_profile, sponsor_season, sponsor_weekly, sponsor_second_half, sponsor_paid_second, stadium_capacity FROM teams WHERE id = ?",
					[teamId],
				);
				// Patrocínio real recebido (upfront + tranches com linhas `sponsor`
				// no diário); sem linhas, o fixo antigo por divisão (salas e
				// épocas anteriores ao mercado).
				let sponsorRevenue = SPONSOR_REVENUE_BY_DIVISION[team?.division || 4] || 0;
				try {
					const paid = await runGet(game.db, "SELECT COALESCE(SUM(amount), 0) AS s FROM club_news WHERE team_id = ? AND type = 'sponsor' AND year = ?", [teamId, currentYear]);
					if (paid && Number(paid.s) > 0) sponsorRevenue = Number(paid.s);
				} catch {
					// Mantém o fixo.
				}
				const sponsorChosen = team?.sponsor_id ? sponsorById(String(team.sponsor_id)) : undefined;

				// Rubricas semanais reais (resumos `weekly_finance` do Jornal) e
				// prémios da época — o cliente deixa de estimar com o salário atual.
				const weekly = { weeks: 0, baseIncome: 0, wages: 0, upkeep: 0, staff: 0, interest: 0 };
				let prizeRevenue = 0;
				try {
					const weekRows = await runAll(game.db, "SELECT description FROM club_news WHERE team_id = ? AND type = 'weekly_finance' AND year = ?", [teamId, currentYear]);
					for (const r of weekRows || []) {
						try {
							const f = JSON.parse(r.description || "{}");
							weekly.weeks += 1;
							weekly.baseIncome += f.income || 0;
							weekly.wages += f.wages || 0;
							weekly.upkeep += f.upkeep || 0;
							weekly.staff += f.staff || 0;
							weekly.interest += f.interest || 0;
						} catch {}
					}
					const prizes = await runGet(game.db, "SELECT COALESCE(SUM(amount), 0) AS s FROM club_news WHERE team_id = ? AND type = 'prize' AND year = ?", [teamId, currentYear]);
					prizeRevenue = Number(prizes?.s || 0);
				} catch {}

				// ── Balance history ──────────────────────────────────────────────
				// Saldo real de fim de semana, gravado em team_balance_history
				// (um ponto por slot do calendário). Janela deslizante das últimas
				// 25 semanas — uma época (atravessa a viragem em vez de fazer reset).
				// Cada ponto tem um `label` para o eixo X e `x` global
				// (época * 25 + slot) para épocas distintas não colapsarem no eixo.
				let balanceHistory: Array<{
					x: number;
					year: number;
					matchweek: number;
					balance: number;
					label: string;
				}> = [];
				try {
					const histRows = await runAll(
						game.db,
						`SELECT slot, season, matchweek, year, balance FROM team_balance_history
						 WHERE team_id = ?
						 ORDER BY season DESC, slot DESC
						 LIMIT ${SEASON_CALENDAR.length}`,
						[teamId],
					);
					const cupTick = ["", "32 avos", "16 avos", "Oitavos", "Quartos", "Meias", "Final"];
					const ordered = [...(histRows || [])].reverse();
					balanceHistory = ordered.map((r) => {
						const entry = SEASON_CALENDAR[r.slot ?? 0];
						return {
							x: (Math.max(1, r.season ?? 1) - 1) * SEASON_CALENDAR.length + (r.slot ?? 0),
							year: r.year ?? 0,
							matchweek: r.matchweek ?? 0,
							balance: Math.round(r.balance ?? 0),
							label:
								entry?.type === "league"
									? `J${r.matchweek ?? (entry as any).matchweek}`
									: entry?.type === "friendly"
										? "Amigável"
										: cupTick[(entry as any)?.round ?? 0] || "",
						};
					});
				} catch (histErr: any) {
					// Sala antiga sem a tabela — o gráfico começa vazio.
					if (!String(histErr?.message || "").includes("no such table")) throw histErr;
				}

				// ── Assistência média histórica (todas as épocas, sem reset) ───
				// Liga + Taça + amigável (round 0 vive em cup_matches). Sem filtro
				// de época; os campos por época acima ficam intactos (FinancesTab).
				let allTimeHomeMatches = homeMatches.length + cupHomeMatches.length;
				let allTimeTotalAttendance = ticketBreakdown.reduce(
					(sum, t) => sum + (t.attendance || 0),
					0,
				);
				try {
					const allLeague: any = await runGet(
						game.db,
						`SELECT COUNT(*) AS n, COALESCE(SUM(attendance), 0) AS s FROM matches WHERE home_team_id = ? AND played = 1`,
						[teamId],
					);
					const allCup: any = await runGet(
						game.db,
						`SELECT COUNT(*) AS n, COALESCE(SUM(attendance), 0) AS s FROM cup_matches WHERE home_team_id = ? AND played = 1`,
						[teamId],
					);
					allTimeHomeMatches = Number(allLeague?.n || 0) + Number(allCup?.n || 0);
					allTimeTotalAttendance = Number(allLeague?.s || 0) + Number(allCup?.s || 0);
				} catch {
					// DB antiga sem coluna attendance — fica a média da época atual.
				}

				socket.emit("financeData", {
					teamId,
					totalTicketRevenue,
					awayTicketRevenue,
					awayLeagueTicketRevenue,
					awayLeagueMatchesPlayed: awayLeagueRows.length,
					leagueTicketRevenue,
					cupTicketRevenue,
					totalTransferIncome,
					totalTransferExpenses,
					totalStadiumExpenses,
					sponsorRevenue,
					prizeRevenue,
					weekly,
					// Dados para o saldo previsto (o cliente projeta semana a semana).
					forecast: {
						loanInstallment: loanInstallment(team?.division ?? 5),
						baseIncome: WEEKLY_BASE_INCOME[team?.division ?? 5] ?? 0,
						upkeep: Math.trunc(
							Math.max(0, (team?.stadium_capacity || 0) - STADIUM_UPKEEP_EXEMPT_SEATS) *
								STADIUM_UPKEEP_PER_SEAT_WEEK,
						),
						sponsorWeekly: team?.sponsor_season === game.season ? team?.sponsor_weekly || 0 : 0,
						sponsorSecondPending:
							team?.sponsor_season === game.season && !team?.sponsor_paid_second
								? team?.sponsor_second_half || 0
								: 0,
					},
					sponsorName: sponsorChosen?.name || null,
					sponsorId: team?.sponsor_id || null,
					sponsorProfile: team?.sponsor_profile || null,
					homeMatchesPlayed: homeMatches.length,
					cupHomeMatchesPlayed: cupHomeMatches.length,
					totalHomeMatchesPlayed: homeMatches.length + cupHomeMatches.length,
					allTimeHomeMatches,
					allTimeTotalAttendance,
					ticketBreakdown,
					transferInList,
					transferOutList,
					balanceHistory,
				});
			} catch (err) {
				console.error(`[${game.roomCode}] requestFinanceData error:`, err);
				socket.emit("financeData", {
					teamId,
					totalTicketRevenue: 0,
					totalTransferIncome: 0,
					totalTransferExpenses: 0,
					totalStadiumExpenses: 0,
					sponsorRevenue: 0,
					homeMatchesPlayed: 0,
					allTimeHomeMatches: 0,
					allTimeTotalAttendance: 0,
					ticketBreakdown: [],
					transferInList: [],
					transferOutList: [],
					balanceHistory: [],
				});
			}
		},
	);
}
