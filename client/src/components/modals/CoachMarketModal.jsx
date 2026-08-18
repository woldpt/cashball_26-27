import { motion } from "framer-motion";
import { DIVISION_NAMES, MODAL_Z } from "../../constants/index.js";
import { ModalShell } from "../shared/ModalShell.jsx";

/**
 * Resumo semanal do mercado de treinadores: despedimentos e contratações
 * (NPCs e humanos) que ocorreram após cada jornada.
 *
 * @param {{ report: { matchweek: number, events: Array<object> }|null, onClose: function }} props
 */

/**
 * @param {{ event: { type: string, coachName: string, teamName: string, division: number, reason?: string, isHuman: boolean, colorPrimary?: string, colorSecondary?: string } }} props
 */
function EventRow({ event }) {
	const {
		coachName,
		teamName,
		division,
		reason,
		isHuman,
		colorPrimary,
		colorSecondary,
	} = event;

	const color = colorPrimary || (event.type === "dismissal" ? "#dc2626" : "#10b981");

	return (
		<div
			className="flex items-center gap-3 px-4 py-3 rounded-lg border"
			style={{
				borderColor: (colorSecondary || "#27272a") + "55",
				background: `linear-gradient(120deg, ${color}14 0%, transparent 100%)`,
			}}
		>
			{/* Acento de cor do clube */}
			<div
				className="w-1.5 self-stretch rounded-full shrink-0"
				style={{ backgroundColor: color }}
			/>
			<div className="min-w-0 flex-1">
				<p className="text-white font-bold text-sm truncate leading-tight">
					{coachName}
				</p>
				<p
					className="text-[11px] font-semibold truncate leading-tight mt-0.5"
					style={{ color }}
				>
					{teamName}
				</p>
				{event.type === "dismissal" && reason && (
					<p className="text-[9px] font-bold uppercase tracking-widest text-red-400/80 mt-0.5 truncate">
						{event.detail ||
							(reason === "budget"
								? "Insolvência financeira"
								: "Má série de resultados")}
					</p>
				)}
			</div>
			<div className="flex flex-col items-end gap-1 shrink-0">
				{division != null && (
					<span
						className="px-1.5 py-0.5 rounded border text-[9px] font-black tracking-widest uppercase"
						style={{
							borderColor: color + "55",
							color,
							backgroundColor: color + "12",
						}}
					>
						{DIVISION_NAMES[division] || `Div ${division}`}
					</span>
				)}
				<span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">
					{isHuman ? "Treinador" : "NPC"}
				</span>
			</div>
		</div>
	);
}

/**
 * @param {{ events: Array<object>, type: "dismissal"|"hiring" }} props
 */
function EventList({ events, type }) {
	if (!events || events.length === 0) return null;

	const isDismissal = type === "dismissal";
	const accent = isDismissal ? "#f87171" : "#34d399";

	return (
		<section className="px-5 pt-4">
			<div className="flex items-center gap-2 mb-2">
				<span
					className="material-symbols-outlined"
					style={{ fontSize: "1.15rem", color: accent }}
				>
					{isDismissal ? "person_off" : "person_add"}
				</span>
				<p
					className="text-[10px] font-black uppercase tracking-widest"
					style={{ color: accent }}
				>
					{isDismissal ? "Despedimentos" : "Contratações"}
				</p>
				<span
					className="ml-auto text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full"
					style={{
						color: accent,
						backgroundColor: accent + "18",
					}}
				>
					{events.length}
				</span>
			</div>
			<div className="flex flex-col gap-1.5">
				{events.map((event, idx) => (
					<EventRow key={`${event.coachName}-${event.teamName}-${idx}`} event={event} />
				))}
			</div>
		</section>
	);
}

export function CoachMarketModal({ report, onClose }) {
	const events = report?.events;
	const dismissals = (events || []).filter((e) => e?.type === "dismissal");
	const hirings = (events || []).filter((e) => e?.type === "hiring");

	return (
		<ModalShell
			visible={!!report}
			z={MODAL_Z.coachMarket}
			variant="md"
			backdropClassName="p-4"
		>
			{report && (
				<motion.div
					className="flex flex-col max-h-[85vh]"
					initial={{ scale: 0.94, y: 20 }}
					animate={{ scale: 1, y: 0 }}
					exit={{ scale: 0.94, y: 20 }}
					transition={{ type: "spring", stiffness: 320, damping: 28 }}
				>
					{/* Header */}
					<div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-outline-variant/20">
						<span
							className="material-symbols-outlined text-2xl"
							style={{ color: "#fbbf24" }}
						>
							sports
						</span>
						<div className="min-w-0">
							<h2 className="text-white font-black text-base tracking-tight leading-tight">
								Mercado de Treinadores
							</h2>
							<p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
								Jornada {report.matchweek}
							</p>
						</div>
					</div>

					{/* Corpo scrollável */}
					<div className="overflow-y-auto pb-2">
						{dismissals.length === 0 && hirings.length === 0 ? (
							<div className="px-5 py-8 text-center">
								<p className="text-sm text-on-surface-variant">
									Sem movimentações no mercado de treinadores esta jornada.
								</p>
							</div>
						) : (
							<>
								<EventList events={dismissals} type="dismissal" />
								<EventList events={hirings} type="hiring" />
							</>
						)}
					</div>

					{/* Footer */}
					<div className="px-5 pt-3 pb-5 border-t border-outline-variant/20">
						<button
							onClick={onClose}
							className="w-full font-black py-3 rounded-lg text-sm uppercase tracking-widest transition-all active:scale-95 hover:-translate-y-px shadow-lg"
							style={{
								backgroundColor: "#fbbf24",
								color: "#1c1917",
								boxShadow: "0 8px 24px #fbbf2430",
							}}
						>
							Continuar
						</button>
					</div>
				</motion.div>
			)}
		</ModalShell>
	);
}
