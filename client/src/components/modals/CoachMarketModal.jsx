import { DIVISION_NAMES, MODAL_Z } from "../../constants/index.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";
import { REASON_TEXT } from "./DismissalModal.jsx";
import { pairCoachMarketEvents } from "../../utils/coachMarketPairs.js";

/**
 * Resumo semanal do mercado de treinadores: feed de transições por jornada.
 *
 * Cada cartão conta uma história (emparelhamento client-side exato — ver
 * `utils/coachMarketPairs.js`; o servidor grava despedimento + contratação
 * do substituto no mesmo fluxo):
 *  - Transição no clube: "X despedido → Para o seu lugar foi contratado Y";
 *  - Nova era: "X despedido do A → Assinou para o B";
 *  - Standalone: despedimento sem sequência (ex. despromoção) ou contratação.
 *
 * @param {{ report: { matchweek: number, events: Array<object> }|null, onClose: function, meName?: string|null, coachAvatars?: object, backendUrl?: string }} props
 */

const OUT_COLOR = "#f87171";
const IN_COLOR = "#34d399";

/** Cor do clube com fallback por tipo (as cores do servidor podem faltar). */
function clubColor(event) {
	return event.colorPrimary || (event.type === "dismissal" ? "#dc2626" : "#10b981");
}

/** Motivo do despedimento: detail do servidor → mapa partilhado → genérico. */
function dismissalReason(event) {
	return event.detail || REASON_TEXT[event.reason] || REASON_TEXT.results;
}

/**
 * Linha de um cartão: treinador sai (vermelho) ou entra (verde); o nome do
 * clube só aparece quando o cartão não tem cabeçalho de clube.
 *
 * @param {{ name: string, teamName?: string|null, division?: number|null, photo?: string|null, clubColor: string, tone: "out"|"in", label: string, reason?: string|null, isHuman?: boolean, meName?: string|null, coachAvatars?: object, backendUrl?: string }} props
 */
function MarketRow({
	name,
	teamName,
	division,
	photo,
	clubColor,
	tone,
	label,
	reason,
	isHuman,
	meName,
	coachAvatars,
	backendUrl,
}) {
	const accent = tone === "out" ? OUT_COLOR : IN_COLOR;

	return (
		<div className="flex items-center gap-3 py-1.5">
			{/* Foto do treinador (enviada > real > procedural) */}
			<CoachAvatar
				name={name}
				seed={coachAvatarSeed(name, meName)}
				teamColor={clubColor}
				size="sm"
				coachAvatars={coachAvatars}
				backendUrl={backendUrl}
				photo={photo || null}
			/>
			<div className="min-w-0 flex-1">
				<p className="text-white font-bold text-sm truncate leading-tight">
					{name}
				</p>
				{teamName && (
					<p
						className="text-[11px] font-semibold truncate leading-tight mt-0.5"
						style={{ color: clubColor }}
					>
						{teamName}
					</p>
				)}
				{reason && (
					<p className="text-[9px] font-bold uppercase tracking-widest text-red-400/80 mt-0.5 truncate">
						{reason}
					</p>
				)}
			</div>
			<div className="flex flex-col items-end gap-1 shrink-0">
				<span
					className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest"
					style={{ color: accent, backgroundColor: accent + "18" }}
				>
					{label}
				</span>
				{division != null && (
					<span
						className="px-1.5 py-0.5 rounded border text-[9px] font-black tracking-widest uppercase"
						style={{
							borderColor: clubColor + "55",
							color: clubColor,
							backgroundColor: clubColor + "12",
						}}
					>
						{DIVISION_NAMES[division] || `Div ${division}`}
					</span>
				)}
				{isHuman && (
					<span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">
						Treinador
					</span>
				)}
			</div>
		</div>
	);
}

/** Conector narrativo entre a saída e a entrada (alinhado com o avatar). */
function Connector({ children }) {
	return (
		<div className="flex items-center gap-1.5 pl-10 py-1">
			<span
				aria-hidden
				className="material-symbols-outlined"
				style={{ fontSize: "0.85rem", color: IN_COLOR }}
			>
				south
			</span>
			<p className="text-[9px] font-black uppercase tracking-widest text-emerald-300/90">
				{children}
			</p>
		</div>
	);
}

/**
 * Cartão do feed: transição no clube (header do clube + sai/entra), nova era
 * (assinou noutro clube) ou movimentação standalone.
 *
 * @param {{ card: { dismissal?: object, replacement?: object, nextClub?: object, hiring?: object }, meName?: string|null, coachAvatars?: object, backendUrl?: string }} props
 */
function MarketCard({ card, meName, coachAvatars, backendUrl }) {
	const { dismissal, replacement, nextClub, hiring } = card;
	const pass = { meName, coachAvatars, backendUrl };

	// Contratação standalone (sem despedimento associado no reporte).
	if (!dismissal) {
		const c = clubColor(hiring);
		return (
			<div
				className="rounded-lg border px-4 py-2"
				style={{
					borderColor: (hiring.colorSecondary || "#27272a") + "55",
					background: `linear-gradient(120deg, ${c}14 0%, transparent 100%)`,
				}}
			>
				<MarketRow
					name={hiring.coachName}
					teamName={hiring.teamName}
					division={hiring.division}
					photo={hiring.coachPhoto}
					clubColor={c}
					tone="in"
					label="Contratado"
					isHuman={hiring.isHuman}
					{...pass}
				/>
			</div>
		);
	}

	const c = clubColor(dismissal);
	const reason = dismissalReason(dismissal);

	// Transição no mesmo clube: header do clube + sai → entra.
	if (replacement) {
		return (
			<div
				className="flex gap-3 rounded-lg border px-4 py-3"
				style={{
					borderColor: (dismissal.colorSecondary || "#27272a") + "55",
					background: `linear-gradient(120deg, ${c}14 0%, transparent 100%)`,
				}}
			>
				{/* Acento de cor do clube */}
				<div
					className="w-1.5 self-stretch rounded-full shrink-0"
					style={{ backgroundColor: c }}
				/>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 pb-2 mb-1 border-b border-white/5">
						<p className="text-white font-black text-sm truncate leading-tight">
							{dismissal.teamName}
						</p>
						<span
							className="ml-auto shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-black tracking-widest uppercase"
							style={{
								borderColor: c + "55",
								color: c,
								backgroundColor: c + "12",
							}}
						>
							{DIVISION_NAMES[dismissal.division] || `Div ${dismissal.division}`}
						</span>
					</div>
					<MarketRow
						name={dismissal.coachName}
						photo={dismissal.coachPhoto}
						clubColor={c}
						tone="out"
						label="Despedida"
						reason={reason}
						{...pass}
					/>
					<Connector>Para o seu lugar foi contratado</Connector>
					<MarketRow
						name={replacement.coachName}
						photo={replacement.coachPhoto}
						clubColor={c}
						tone="in"
						label="Contratado"
						{...pass}
					/>
				</div>
			</div>
		);
	}

	// Despedimento sem substituto (humano órfão, despromoção), com assinatura
	// noutro clube quando o próprio treinador apareceu no reporte.
	return (
		<div
			className="rounded-lg border px-4 py-2"
			style={{
				borderColor: (dismissal.colorSecondary || "#27272a") + "55",
				background: `linear-gradient(120deg, ${c}14 0%, transparent 100%)`,
			}}
		>
			<MarketRow
				name={dismissal.coachName}
				teamName={dismissal.teamName}
				division={dismissal.division}
				photo={dismissal.coachPhoto}
				clubColor={c}
				tone="out"
				label="Despedida"
				reason={reason}
				isHuman={dismissal.isHuman}
				{...pass}
			/>
			{nextClub && (
				<>
					<Connector>Assinou para o {nextClub.teamName}</Connector>
					<MarketRow
						name={nextClub.coachName}
						photo={nextClub.coachPhoto}
						clubColor={clubColor(nextClub)}
						tone="in"
						label="Contratado"
						{...pass}
					/>
				</>
			)}
		</div>
	);
}

export function CoachMarketModal({ report, onClose, meName, coachAvatars, backendUrl }) {
	const cards = pairCoachMarketEvents(report?.events);

	return (
		<ModalShell
			visible={!!report}
			z={MODAL_Z.coachMarket}
			variant="md"
			cardClassName="flex flex-col max-h-[85vh]"
			backdropClassName="p-4"
		>
			{report && (
				<>
					{/* Header (shrink-0: ver nota em PlayerHistoryModal — o flex-shrink
					    do container max-height encolhe o header abaixo do conteúdo) */}
					<div className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-4 border-b border-outline-variant/20">
						<span
							aria-hidden
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
						{cards.length === 0 ? (
							<div className="px-5 py-8 text-center">
								<p className="text-sm text-on-surface-variant">
									Sem movimentações no mercado de treinadores esta jornada.
								</p>
							</div>
						) : (
							<div className="flex flex-col gap-2 px-5 pt-4">
								{cards.map((card, idx) => (
									<MarketCard
										key={idx}
										card={card}
										meName={meName}
										coachAvatars={coachAvatars}
										backendUrl={backendUrl}
									/>
								))}
							</div>
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
				</>
			)}
		</ModalShell>
	);
}
