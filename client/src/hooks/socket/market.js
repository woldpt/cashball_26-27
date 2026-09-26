import { socket, queueEmit } from "../../socket.js";
import { POSITION_SHORT_LABELS } from "../../constants/index.js";
import { seasonToYear } from "../../utils/formatters.js";
import { playSigningSound, playBooSound } from "../../utils/audio.js";
import { buildPlayerStats, buildPositionPeers, contractAvatar, showContractOutcome } from "./helpers.js";

/**
 * Listeners de Mercado, leilões e contratos.
 *
 * @param {Object} handlers setters de estado e callbacks.
 * @param {Object} refs refs partilhados.
 * @param {Object} ctx contexto ({ inRoom, penaltyTimers }).
 * @returns {Function} cleanup (remove os listeners).
 */
export function registerMarketListeners(handlers, refs, ctx) {
	socket.on("marketUpdate", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setMarketPairs(data);
	});
	socket.on("transferHistory", (data) => {
		if (!ctx.inRoom()) return;
		handlers.setTransferHistory(Array.isArray(data) ? data : []);
	});
	socket.on("transferCompleted", (rec) => {
		if (!ctx.inRoom()) return;
		if (!rec || !rec.player_name) return;
		handlers.setTransferHistory((prev) => {
			const list = Array.isArray(prev) ? prev : [];
			const next = [rec, ...list];
			return next.slice(0, 40);
		});
	});
	socket.on("auctionStarted", (auctionData) => {
		// Add to activeAuctions list (used by AuctionsPage and toast)
		handlers.setActiveAuctions((prev) => {
			const exists = prev.find((a) => a.playerId === auctionData.playerId);
			if (exists) return prev;
			return [
				...prev,
				{
					...auctionData,
					currentHighBid: auctionData.currentHighBid ?? 0,
					currentHighBidTeamId: auctionData.currentHighBidTeamId ?? null,
				},
			];
		});
		// Legacy: keep selectedAuctionPlayer for any remaining compatibility
		if (
			refs.isPlayingMatchRef.current ||
			refs.showHalftimePanelRef?.current ||
			!!refs.matchActionRef?.current ||
			refs.isCupDrawRef.current
		) {
			return;
		}
		const myTeamId = refs.meRef.current?.teamId;
		const myTeamBudget =
			refs.teamsRef.current.find((t) => t.id == myTeamId)?.budget ?? 0;
		if (auctionData.startingPrice > myTeamBudget) return;
		handlers.setSelectedAuctionPlayer(auctionData);
		handlers.setIsAuctionExpanded(false);
		handlers.setAuctionBid("");
		handlers.setMyAuctionBid(null);
		handlers.setAuctionResult(null);
	});
	socket.on(
		"auctionBidPlaced",
		({ playerId, currentHighBid, currentHighBidTeamId, bidHistory }) => {
			handlers.setActiveAuctions((prev) =>
				prev.map((a) =>
					a.playerId === playerId
						? {
								...a,
								currentHighBid,
								currentHighBidTeamId,
								auction_bid_history: bidHistory || a.auction_bid_history,
							}
						: a,
				),
			);
		},
	);
	socket.on("auctionBidConfirmed", ({ playerId, bidAmount }) => {
		handlers.setSelectedAuctionPlayer((prev) => {
			if (prev && prev.playerId === playerId) {
				handlers.setMyAuctionBid(bidAmount);
			}
			return prev;
		});
	});
	socket.on("auctionClosed", (result) => {
			// Mark auction with result in activeAuctions; removal happens when matchweek advances
		handlers.setActiveAuctions((prev) =>
			prev.map((a) =>
				a.playerId === result.playerId ? { ...a, result, closed: true } : a,
			),
		);
		// Legacy cleanup
		handlers.setSelectedAuctionPlayer((prev) => {
			if (prev && prev.playerId === result.playerId) {
				handlers.setAuctionResult(result);
				setTimeout(() => {
					handlers.setSelectedAuctionPlayer(null);
					handlers.setIsAuctionExpanded(false);
					handlers.setAuctionBid("");
					handlers.setMyAuctionBid(null);
					handlers.setAuctionResult(null);
				}, 5000);
				return prev;
			}
			return prev?.playerId === result.playerId ? null : prev;
		});
	});
	socket.on("auctionPaused", ({ playerId }) => {
		handlers.setActiveAuctions((prev) =>
			prev.map((a) => (a.playerId === playerId ? { ...a, paused: true } : a)),
		);
	});
	socket.on(
		"auctionResumed",
		({ playerId, endsAt, currentHighBid, currentHighBidTeamId }) => {
			handlers.setActiveAuctions((prev) =>
				prev.map((a) =>
					a.playerId === playerId
						? {
								...a,
								paused: false,
								endsAt,
								currentHighBid,
								currentHighBidTeamId,
							}
						: a,
				),
			);
		},
	);
	socket.on(
		"renewContractCounterOffer",
		({
			playerId,
			playerName,
			position,
			skill,
			wage,
			demandedWage,
			agent,
		}) => {
			if (!ctx.inRoom()) return;
			const waitingText = `A falar com ${agent || "o agente"}…`;
			const counter = {
				mode: "confirm",
				kind: "contract",
				playerId,
				awaitServer: true,
				phase: "proposal",
				title: `Contra-proposta — ${playerName}`,
				description: `🤨 ${agent || "O agente"} diz que a tua oferta é "um insulto à profissão". ${playerName} exige €${demandedWage.toLocaleString("pt-PT")}/sem. Aceitas ou vai brilhar no leilão?`,
				stats: buildPlayerStats({
					position,
					skill,
					wage,
					requestedWage: demandedWage,
				}),
				peerPositionLabel: POSITION_SHORT_LABELS[position] ?? position,
				positionPeers: buildPositionPeers(refs, position, playerId),
				confirmLabel: "Aceitar",
				cancelLabel: "Leilão",
				onConfirm: () => {
					queueEmit("acceptCounterOffer", { playerId, accepted: true });
					handlers.setGameDialog({ ...counter, phase: "waiting", waitingText });
				},
				onCancel: () => {
					queueEmit("acceptCounterOffer", { playerId, accepted: false });
					handlers.setGameDialog({ ...counter, phase: "waiting", waitingText });
				},
			};
			// A contra-proposta é o desfecho da espera do próprio jogador:
			// transforma esse modal, nunca o de outro jogador.
			showContractOutcome(handlers, refs, playerId, counter);
		},
	);
	// Pedidos de renovação respondem-se na notícia do Jornal (sem modal de
	// apresentação): a pendência vive no plantel (`contract_request_pending`)
	// e a linha `contract_request` chega pelo `globalNewsUpdated` do log.
	// O evento `contractRequest` do servidor é ignorado de propósito.
	socket.on(
		"contractRenewed",
		({
			playerId,
			playerName,
			position,
			skill,
			wage,
			agent,
			contractEndMatchweek,
			contractEndSeason,
			contractEndLabel,
			photo,
			nationality,
		}) => {
			if (!ctx.inRoom()) return;
			playSigningSound();
			const endText =
				contractEndMatchweek && contractEndSeason
					? `${seasonToYear(contractEndSeason)}, ${contractEndLabel || `Jornada ${contractEndMatchweek}`}`
					: "";
			showContractOutcome(handlers, refs, playerId, {
				mode: "confirm",
				kind: "contract",
				playerId,
				phase: "renewed",
				hideCancel: true,
				title: `Renovado — ${playerName}`,
				description: `🥂 ${playerName} renovou${endText ? ` até ${endText}` : ""}. ${agent} já celebrou com champanhe… que depois te manda a conta.`,
				stats: buildPlayerStats({
					position,
					skill,
					wage,
					contractEndMatchweek,
					contractEndSeason,
				}),
				avatar: contractAvatar(refs, playerId, {
					position,
					photo,
					nationality,
				}),
				confirmLabel: "Continuar",
				onConfirm: () => {},
				onCancel: () => {},
			});
		},
	);
	socket.on(
		"contractDeclined",
		({
			playerId,
			playerName,
			position,
			skill,
			agent,
			photo,
			nationality,
		}) => {
			if (!ctx.inRoom()) return;
			playBooSound();
			showContractOutcome(handlers, refs, playerId, {
				mode: "confirm",
				kind: "contract",
				playerId,
				phase: "declined",
				hideCancel: true,
				title: `Fez as malas — ${playerName}`,
				description: `💼 ${agent} fez as malas: ${playerName} vai para leilão. Se for vendido, a verba vai para o teu clube.`,
				stats: buildPlayerStats({ position, skill }),
				avatar: contractAvatar(refs, playerId, {
					position,
					photo,
					nationality,
				}),
				confirmLabel: "Continuar",
				onConfirm: () => {},
				onCancel: () => {},
			});
		},
	);
	socket.on("transferProposalResult", ({ ok, message }) => {
		if (!ok) handlers.addToast(message);
		if (ok) handlers.setTransferProposalModal(null);
	});
	socket.on("playerSigned", (data) => {
		handlers.setSigningCelebration(data);
	});
	return () => {
		socket.off("marketUpdate");
		socket.off("transferHistory");
		socket.off("transferCompleted");
		socket.off("auctionStarted");
		socket.off("auctionBidConfirmed");
		socket.off("auctionBidPlaced");
		socket.off("auctionClosed");
		socket.off("auctionPaused");
		socket.off("auctionResumed");
		socket.off("transferProposalResult");
		socket.off("playerSigned");
		socket.off("renewContractCounterOffer");
		socket.off("contractRenewed");
		socket.off("contractDeclined");
	};
}
