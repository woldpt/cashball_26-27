import { useState, useCallback, useRef, useEffect } from "react";
import { formatCurrency } from "../../utils/formatters.js";
import { AUCTION_BID_STEP } from "../../constants/index.js";
import { emitComAck } from "../../socket.js";

/**
 * Form de lance de leilão — partilhado entre AuctionCard (tab de leilões)
 * e o modal de lance inline da scout (ScoutView).
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
 *   autoFocus?: boolean,
 * }} props
 */
export function BidForm({ playerId, minBid, budget, socket, accentHex = "#94a3b8", onPlaced, autoFocus = false }) {
	const [bidInput, setBidInput] = useState(() => String(minBid));
	const inputRef = useRef(null);
	// O mínimo pode subir enquanto o form está aberto (outro lance ao vivo)
	// — ajuste no render (padrão documentado de estado derivado), sem efeito.
	const [prevMinBid, setPrevMinBid] = useState(minBid);
	if (prevMinBid !== minBid) {
		setPrevMinBid(minBid);
		const n = Number(bidInput);
		if (!Number.isFinite(n) || n < minBid) setBidInput(String(minBid));
	}
	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus, playerId]);
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

	// Atalhos de valor: mínimo e +5%/+10% sobre o mínimo (arredondados ao passo).
	const quick = [
		{ label: "Mín.", amount: minBid },
		{ label: "+5%", amount: Math.ceil((minBid * 1.05) / AUCTION_BID_STEP) * AUCTION_BID_STEP },
		{ label: "+10%", amount: Math.ceil((minBid * 1.1) / AUCTION_BID_STEP) * AUCTION_BID_STEP },
	];

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-stretch gap-1.5">
				<div
					className="flex-1 min-w-0 flex items-center rounded-lg overflow-hidden border bg-surface/80 focus-within:ring-1"
					style={{ borderColor: `${accentHex}66`, "--tw-ring-color": accentHex }}
				>
					<input
						ref={inputRef}
						type="number"
						inputMode="numeric"
						min={minBid}
						step={AUCTION_BID_STEP}
						value={bidInput}
						onChange={(e) => {
							setBidInput(e.target.value);
							setBidError("");
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleBid();
						}}
						className="flex-1 min-w-0 bg-transparent py-2 pl-3 text-on-surface font-mono font-black text-sm tabular-nums outline-none"
						aria-label="Valor do lance"
					/>
					<span className="pr-3 text-on-surface-variant font-mono text-xs">€</span>
				</div>
				<button
					type="button"
					onClick={handleBid}
					className="shrink-0 min-h-10 px-4 rounded-lg font-headline font-black uppercase text-xs tracking-wide transition-all active:scale-95 hover:brightness-110 inline-flex items-center gap-1"
					style={{ background: accentHex, color: "#0d0d14", boxShadow: `0 6px 18px -8px ${accentHex}` }}
				>
					<span className="material-symbols-outlined text-[16px] leading-none w-[1em] overflow-hidden">gavel</span>
					Licitar
				</button>
			</div>
			<div className="flex items-center gap-1">
				{quick.map((q) => {
					const on = Number(bidInput) === q.amount;
					return (
						<button
							key={q.label}
							type="button"
							onClick={() => {
								setBidInput(String(q.amount));
								setBidError("");
							}}
							title={formatCurrency(q.amount)}
							className={`flex-1 min-h-8 rounded-md border text-[10px] font-black uppercase tracking-wider tabular-nums transition-colors ${
								on ? "text-on-surface" : "border-outline-variant/25 text-on-surface-variant hover:text-on-surface"
							}`}
							style={on ? { borderColor: accentHex, background: `${accentHex}22` } : undefined}
						>
							{q.label}
						</button>
					);
				})}
			</div>
			<p className="text-[9px] text-on-surface-variant tabular-nums">
				Lance mínimo <b className="text-on-surface font-black">{formatCurrency(minBid)}</b>
			</p>
			{bidError && <p className="text-[10px] text-red-400 font-bold">{bidError}</p>}
			{bidSuccess && <p className="text-[10px] text-emerald-400 font-bold">Lance registado!</p>}
		</div>
	);
}
