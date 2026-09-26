import { formatCurrency } from "../../utils/formatters.js";
import {
  POSITION_TEXT_CLASS,
  POSITION_ACCENT_HEX,
  MODAL_Z,
  AUCTION_BID_STEP,
} from "../../constants/index.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import { BidForm } from "../auctions/BidForm.jsx";
import { isSameTeamId } from "../../utils/teamHelpers.js";

/**
 * Modal de lance inline para a scout (PlayerSearchView) — licita sem sair
 * da pesquisa. Dados de leilão ao vivo vêm no payload da pesquisa
 * (auction_* calculados no socketScoutHandlers a partir de game.auctions).
 *
 * Sem snapshot de leilão (pesquisa velha / leilão já fechado): mostra
 * fallback com navegação para a tab de leilões.
 *
 * @param {{
 *   player: object|null,
 *   me: object|null,
 *   myBudget: number,
 *   socket: object,
 *   onClose: function,
 *   onGoToAuctions: function,
 * }} props
 */
export function AuctionBidModal({ player, me, myBudget, socket, onClose, onGoToAuctions }) {
	const visible = !!player;
	const high = player?.auction_high_bid ?? 0;
	const startingPrice = player?.auction_starting_price ?? player?.transfer_price ?? 0;
	const hasBid = player?.auction_high_bid_team_id != null;
	const minBid = hasBid ? high + AUCTION_BID_STEP : startingPrice;
	const isLeader = hasBid && isSameTeamId(player?.auction_high_bid_team_id, me?.teamId);
	const isPaused = !!player?.auction_paused;
	const hasAuction = player != null && (player.auction_starting_price != null || player.auction_high_bid != null);

	return (
		<ModalShell
			visible={visible}
			onClose={onClose}
			z={MODAL_Z.transferProposal}
			variant="md"
			dismissable
		>
			{player && (
				<>
					<div className="px-5 py-4 border-b border-outline-variant/15 bg-primary-container/20">
						<p className="text-xs uppercase tracking-widest font-black text-amber-400 mb-1">
							Lance no Leilão
						</p>
						<h3 className="text-xl font-black text-on-surface">{player.name}</h3>
						<p className="text-sm text-on-surface-variant mt-0.5">
							<span className={`font-black ${POSITION_TEXT_CLASS[player.position] || "text-zinc-300"}`}>
								{player.position}
							</span>
							{" · "}
							<span className="font-black text-on-surface">Qualidade {player.skill}</span>
							{player.team_name ? ` · ${player.team_name}` : ""}
						</p>
					</div>

					<div className="px-5 py-4 space-y-4">
						{!hasAuction ? (
							<div className="bg-surface rounded-lg p-4 border border-outline-variant/15 space-y-3 text-sm">
								<p className="text-on-surface-variant">
									Leilão indisponível neste resultado — a pesquisa pode estar desatualizada.
								</p>
								<button
									type="button"
									onClick={() => {
										onClose();
										onGoToAuctions?.();
									}}
									className="px-3 py-1.5 rounded text-xs font-black uppercase bg-amber-600 hover:bg-amber-500 text-white border border-amber-500 transition-colors"
								>
									Abrir leilões
								</button>
							</div>
						) : isPaused ? (
							<div className="rounded-lg py-3 text-center border border-outline-variant/15 bg-surface/50">
								<p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
									Em pausa · retoma no apito final
								</p>
							</div>
						) : (
							<>
								<div className="bg-surface rounded-lg p-4 space-y-2 text-sm border border-outline-variant/15">
									<div className="flex justify-between items-center">
										<span className="text-on-surface-variant">
											{hasBid ? "Lance atual" : "Preço base"}
										</span>
										<span className={`font-bold text-on-surface tabular-nums ${isLeader ? "text-emerald-400" : ""}`}>
											{formatCurrency(hasBid ? high : startingPrice)}
											{isLeader && " · tu lideras"}
										</span>
									</div>
									<div className="flex justify-between items-center border-t border-outline-variant/15 pt-2">
										<span className="text-on-surface font-bold">Lance mínimo</span>
										<span className="font-black text-amber-400 text-base tabular-nums">
											{formatCurrency(minBid)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-on-surface-variant">Caixa disponível</span>
										<span className="font-bold text-emerald-400 tabular-nums">
											{formatCurrency(myBudget)}
										</span>
									</div>
								</div>
								<BidForm
									playerId={player.id}
									minBid={minBid}
									budget={myBudget}
									socket={socket}
									accentHex={POSITION_ACCENT_HEX[player.position] || "#94a3b8"}
								/>
							</>
						)}
					</div>
				</>
			)}
		</ModalShell>
	);
}
