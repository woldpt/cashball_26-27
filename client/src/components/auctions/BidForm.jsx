import { useState, useCallback } from "react";
import { formatCurrency } from "../../utils/formatters.js";
import { AUCTION_BID_STEP } from "../../constants/index.js";
import { emitComAck } from "../../socket.js";

/**
 * Form de lance de leilão — partilhado entre AuctionCard (tab de leilões)
 * e o modal de lance inline da scout (PlayerSearchView).
 *
 * Validação idêntica ao original (mínimo = lance atual + passo; orçamento),
 * emit `placeAuctionBid` com ack + anti-duplicação (__actionId no servidor).
 *
 * @param {{
 *   playerId: number,
 *   minBid: number,
 *   budget: number,
 *   socket: object,
 *   accentHex?: string,
 *   onPlaced?: function,
 * }} props
 */
export function BidForm({ playerId, minBid, budget, socket, accentHex = "#94a3b8", onPlaced }) {
	const [bidInput, setBidInput] = useState(() => String(minBid));
	const [bidError, setBidError] = useState("");
	const [bidSuccess, setBidSuccess] = useState(false);

	const handleBid = useCallback(() => {
		const amount = Number(bidInput);
		if (!Number.isFinite(amount) || amount < minBid) {
			setBidError(`Lance mínimo: ${formatCurrency(minBid)}`);
			return;
		}
		if (budget != null && amount > budget) {
			setBidError("Orçamento insuficiente.");
			return;
		}
		setBidError("");
		if (!socket?.connected) {
			// Sem rede: o lance fica em fila e é enviado ao reconectar (com
			// __actionId anti-duplicado no servidor). Feedback imediato.
			setBidError("Sem ligação — lance em fila para enviar.");
		}
		emitComAck(
			"placeAuctionBid",
			{ playerId, bidAmount: amount },
			{
				onOk: () => {
					setBidError("");
					setBidSuccess(true);
					setTimeout(() => setBidSuccess(false), 3000);
					onPlaced?.(amount);
				},
				onError: (err) => {
					setBidError(err?.message || "Erro ao processar o lance.");
					setTimeout(() => setBidError(""), 3000);
				},
			},
		);
	}, [bidInput, minBid, playerId, budget, socket, onPlaced]);

	return (
		<div className="flex flex-col gap-1.5">
			<div
				className="flex items-center rounded-lg overflow-hidden border bg-surface/60"
				style={{ borderColor: `${accentHex}66` }}
			>
				<span className="material-symbols-outlined text-base px-2.5 shrink-0" style={{ color: accentHex }}>
					currency_exchange
				</span>
				<input
					type="number"
					inputMode="numeric"
					min={minBid}
					value={bidInput}
					onChange={(e) => {
						setBidInput(e.target.value);
						setBidError("");
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleBid();
					}}
					className="flex-1 min-w-0 bg-transparent py-2 pr-3 text-white font-mono text-xs outline-none"
					aria-label="Valor do lance"
				/>
			</div>
			{bidError && <p className="text-[10px] text-red-400 font-bold">{bidError}</p>}
			{bidSuccess && <p className="text-[10px] text-emerald-400 font-bold">Lance registado!</p>}
			<button
				type="button"
				onClick={handleBid}
				className="w-full py-2 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110"
				style={{ background: accentHex, color: "#0d0d14" }}
			>
				Licitar · mín. {formatCurrency(minBid)}
			</button>
		</div>
	);
}
