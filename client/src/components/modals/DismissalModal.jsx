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
 * @param {{ dismissalModal: {reason: string, teamName: string, detail: string, newTeam: object}|null, onContinue: function }} props
 */
export function DismissalModal({ dismissalModal, onContinue }) {
	const newTeam = dismissalModal?.newTeam;
	const colorPrimary = newTeam?.colorPrimary || "#95d4b3";
	const colorSecondary = newTeam?.colorSecondary || "#003824";

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

					{/* New team section */}
					{newTeam && (
						<div
							className="flex flex-col items-center gap-4 px-8 pt-6 pb-7"
							style={{
								background: `linear-gradient(160deg, ${colorPrimary}18 0%, transparent 100%)`,
							}}
						>
							<p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
								Novo clube atribuído
							</p>

							{/* Colour swatch */}
							<div className="relative flex items-center justify-center">
								<div
									aria-hidden
									className="absolute w-20 h-20 rounded-full blur-2xl opacity-25"
									style={{ backgroundColor: colorPrimary }}
								/>
								<div
									aria-hidden
									className="relative w-14 h-14 rounded-lg border-2 border-white/20 shadow-xl flex items-center justify-center text-2xl"
									style={{ backgroundColor: colorPrimary }}
								>
									⚽
								</div>
							</div>

							<div className="text-center">
								<h2 className="font-black text-xl text-white tracking-tight leading-tight">
									{newTeam.teamName}
								</h2>
								{newTeam.division != null && (
									<span
										className="inline-block mt-1 px-2 py-0.5 rounded border text-[10px] font-black tracking-widest uppercase"
										style={{
											borderColor: colorPrimary + "60",
											color: colorPrimary,
											backgroundColor: colorPrimary + "18",
										}}
									>
										{DIVISION_NAMES[newTeam.division] || `Divisão ${newTeam.division}`}
									</span>
								)}
							</div>

							<div className="grid grid-cols-2 gap-2 w-full text-center">
								<div className="bg-zinc-800/60 rounded-lg p-2.5 border border-zinc-700/30">
									<p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">
										Orçamento
									</p>
									<p className="text-white font-black text-sm">
										{formatCurrency(newTeam.budget ?? 0)}
									</p>
								</div>
								<div className="bg-zinc-800/60 rounded-lg p-2.5 border border-zinc-700/30">
									<p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">
										V / E / D
									</p>
									<p className="text-white font-black text-sm">
										{newTeam.wins ?? 0} / {newTeam.draws ?? 0} / {newTeam.losses ?? 0}
									</p>
								</div>
							</div>

							<button
								onClick={onContinue}
								autoFocus
								className="w-full font-black py-3.5 rounded-lg text-sm uppercase tracking-widest transition-all active:scale-95 hover:-translate-y-px shadow-lg"
								style={{
									backgroundColor: colorPrimary,
									color: colorSecondary,
									boxShadow: `0 8px 24px ${colorPrimary}30`,
								}}
							>
								Assumir o comando
							</button>
						</div>
					)}
				</>
			)}
		</ModalShell>
	);
}
