import { DIVISION_NAMES, MODAL_Z } from "../../constants/index.js";
import { formatCurrency } from "../../utils/formatters.js";
import { ModalShell } from "../shared/ModalShell.jsx";

/** Texto por reason — os 3 valores que o servidor emite (coachDismissalHelpers.ts).
 *  Partilhado com CoachMarketModal (resumo semanal do mercado). */
// eslint-disable-next-line react-refresh/only-export-components
export const REASON_TEXT = {
	budget: "Insolvência financeira",
	relegation: "Despromoção do Campeonato de Portugal",
	results: "Má série de resultados",
};

/**
 * Despedimento + escolha do novo clube. O treinador fica sem clube até escolher
 * uma das opções, por isso o modal só fecha quando o clube é atribuído.
 * @param {Object} props
 * @param {{reason: string, teamName: string, detail: string, clubs: Array<{teamId: number, teamName: string, division: number, budget: number, wins: number, draws: number, losses: number, colorPrimary: string}>}|null} props.dismissalModal Despedimento + os 3 clubes à escolha (`clubs`).
 * @param {function(number): void} props.onChoose Escolhe o clube (teamId).
 * @returns {JSX.Element}
 */
export function DismissalModal({ dismissalModal, onChoose }) {
	const clubs = dismissalModal?.clubs ?? [];

	return (
		<ModalShell
			visible={!!dismissalModal}
			z={MODAL_Z.dismissal}
			variant="card"
			cardClassName="flex flex-col"
			backdropStyle={{
				background:
					"radial-gradient(ellipse at center, rgba(127,29,29,0.15) 0%, rgba(10,10,10,0.97) 70%)",
				backdropFilter: "blur(8px)",
			}}
		>
			{dismissalModal && (
				<>
					{/* Dismissal section */}
					<div className="flex flex-col items-center gap-3 px-8 pt-8 pb-6 border-b border-zinc-800">
						<span
							aria-hidden
							className="material-symbols-outlined text-red-500"
							style={{ fontSize: "2.5rem" }}
						>
							person_off
						</span>
						<div className="text-center">
							<p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">
								Despedido
							</p>
							<p className="text-white font-bold text-base">
								{dismissalModal.teamName}
							</p>
							<p className="text-zinc-500 text-xs mt-1">
								{dismissalModal.detail || REASON_TEXT[dismissalModal.reason] || REASON_TEXT.results}
							</p>
						</div>
					</div>

					{/* Escolha do novo clube */}
					<div className="flex flex-col gap-4 px-8 pt-6 pb-7">
						<p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 text-center">
							Escolhe o teu novo clube
						</p>
						{clubs.length > 0 ? (
							<ul className="flex flex-col gap-2">
								{clubs.map((o) => (
									<li key={o.teamId}>
										<button
											onClick={() => onChoose(o.teamId)}
											className="w-full flex items-center gap-3 rounded-lg border border-zinc-700/40 bg-zinc-800/50 px-3 py-2 text-left transition-all hover:bg-zinc-800 active:scale-[0.98]"
										>
											<span
												aria-hidden
												className="w-7 h-7 shrink-0 rounded-md border border-white/20"
												style={{ backgroundColor: o.colorPrimary }}
											/>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-bold text-white">
													{o.teamName}
												</span>
												<span className="block text-[10px] text-zinc-400">
													{DIVISION_NAMES[o.division] || `Divisão ${o.division}`} · {o.wins}V {o.draws}E {o.losses}D · {formatCurrency(o.budget)}
												</span>
											</span>
											<span aria-hidden className="material-symbols-outlined text-zinc-500" style={{ fontSize: "1.1rem" }}>
												arrow_forward
											</span>
										</button>
									</li>
								))}
							</ul>
						) : (
							<p className="text-zinc-400 text-xs text-center">
								Os clubes que te foram oferecidos já foram ocupados. Vais ter de esperar por uma nova oportunidade.
							</p>
						)}
					</div>
				</>
			)}
		</ModalShell>
	);
}
