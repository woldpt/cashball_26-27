import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { FormDots } from "../shared/FormDots.jsx";
import { Panel } from "../shared/Panel.jsx";
import { PlayerRow } from "../shared/PlayerRow.jsx";
import { SummaryWidget } from "../shared/SummaryWidget.jsx";
import {
	SHOWCASE_HEADLINES,
	SHOWCASE_SQUAD,
	SHOWCASE_TABLE,
	SHOWCASE_WIDGETS,
} from "./landingShowcase.js";

/**
 * Um bloco da montra: texto (kicker + título + frase) ao lado do visual,
 * em coluna no telemóvel. `flip` põe o texto à direita no desktop para os
 * blocos alternarem. Entra com fade ao aparecer no ecrã (uma vez); com
 * `prefers-reduced-motion` aparece logo.
 *
 * @param {Object} props
 * @param {string} props.kicker - Etiqueta curta por cima do título.
 * @param {string} props.title - Título do bloco.
 * @param {string} props.text - Frase de explicação.
 * @param {boolean} [props.flip] - Texto à direita no desktop.
 * @param {import("react").ReactNode} props.children - O visual (componentes do jogo).
 * @returns {JSX.Element}
 */
const ShowcaseBlock = ({ kicker, title, text, flip = false, children }) => {
	const reducedMotion = usePrefersReducedMotion();
	return (
		<motion.section
			initial={reducedMotion ? false : { opacity: 0, y: 16 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.25 }}
			transition={{ duration: 0.5, ease: "easeOut" }}
			className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 lg:gap-12 items-center"
		>
			<div className={flip ? "lg:order-last" : ""}>
				<p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">
					{kicker}
				</p>
				<h2 className="font-headline font-black text-3xl sm:text-4xl tracking-tighter text-on-surface mb-3">
					{title}
				</h2>
				<p className="text-base text-on-surface-variant leading-relaxed max-w-md">{text}</p>
			</div>
			<div className="min-w-0">{children}</div>
		</motion.section>
	);
};

/**
 * Secções-montra sob o hero: três blocos alternados (plantel, liga, jornal),
 * cada um explicado em texto e mostrado com componentes e tokens do jogo
 * sobre fixtures estáticas. Escondida em ecrãs curtos (mobile landscape),
 * onde não há altura para a mostrar.
 *
 * @returns {JSX.Element}
 */
const ShowcaseSections = () => (
	<div className="relative z-10 w-full border-t border-outline-variant/20 bg-bg short:hidden">
		<div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 sm:py-24 space-y-20 sm:space-y-28">
			<ShowcaseBlock
				kicker="Plantel e finanças"
				title="Cada euro conta."
				text="Contrata em leilão, renova os craques antes que fujam e equilibra a folha salarial com o orçamento — a época é longa e a direção não perdoa."
			>
				<div className="space-y-4">
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						{SHOWCASE_WIDGETS.map(({ label, value, sub, accentClass }) => (
							<SummaryWidget
								key={label}
								mini
								label={label}
								value={value}
								sub={sub}
								accentClass={accentClass}
							/>
						))}
					</div>
					<Panel title="O teu plantel" icon="group" meta="Demonstração">
						<div className="space-y-1.5">
							{SHOWCASE_SQUAD.map((player) => (
								<PlayerRow key={player.id} player={player} matchweekCount={9} />
							))}
						</div>
					</Panel>
				</div>
			</ShowcaseBlock>

			<ShowcaseBlock
				flip
				kicker="Liga e taças"
				title="Sofre com os amigos."
				text="Junta os amigos na mesma sala: os jogos da jornada correm todos ao mesmo tempo e a classificação mexe ao minuto."
			>
				<Panel title="Primeira Liga" icon="stadium" meta="Demonstração">
			<table className="w-full text-xs text-left">
				<thead>
					<tr className="text-[10px] uppercase text-on-surface-variant/70 font-bold">
						<th className="pl-2 pr-1 py-1.5 w-8">Pos</th>
						<th className="px-1 py-1.5">Clube</th>
						<th className="px-1 py-1.5 text-center w-8">J</th>
						<th className="px-1 py-1.5 text-center w-8">DG</th>
						<th className="px-1 py-1.5 text-center w-8">Pts</th>
						<th className="pr-2 pl-1 py-1.5 text-right">Forma</th>
					</tr>
				</thead>
				<tbody>
					{SHOWCASE_TABLE.map((t, idx) => (
						<tr
							key={t.name}
							className="border-t border-outline-variant/10 first:border-t-0"
						>
							<td className="pl-2 pr-1 py-2 font-black tabular-nums text-on-surface-variant/80">
								{String(idx + 1).padStart(2, "0")}
							</td>
							<td className="px-1 py-2">
								<span className="flex items-center gap-1.5 min-w-0">
									<span
										aria-hidden
										className="shrink-0 w-2 h-2 rounded-full"
										style={{ backgroundColor: t.color }}
									/>
									<span className="truncate font-bold text-on-surface">{t.name}</span>
								</span>
							</td>
							<td className="px-1 py-2 text-center tabular-nums text-on-surface-variant/80">
								{t.played}
							</td>
							<td
								className={`px-1 py-2 text-center tabular-nums font-bold ${
									t.goalDiff > 0
										? "text-emerald-400"
										: t.goalDiff < 0
											? "text-red-400"
											: "text-on-surface-variant/40"
								}`}
							>
								{t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff}
							</td>
							<td className="px-1 py-2 text-center font-black font-headline tabular-nums text-on-surface">
								{t.points}
							</td>
							<td className="pr-2 pl-1 py-2 text-right">
								<FormDots form={t.form} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
				</Panel>
			</ShowcaseBlock>

			<ShowcaseBlock
				kicker="Jornal da jornada"
				title="Tudo vira notícia."
				text="Viradas, renovações e sorteios chegam ao jornal da liga. As boas vitórias ficam na história — e as más também."
			>
				<Panel title="Jornal da jornada" icon="newspaper" meta="Demonstração">
					{/* Textura de papel do jornal da app, bem atenuada */}
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.07]"
						style={{ backgroundImage: "url(/backgrounds/jornal.webp)" }}
					/>
					<div className="relative divide-y divide-outline-variant/10">
						{SHOWCASE_HEADLINES.map(({ kicker, title }) => (
							<div key={title} className="py-3 first:pt-0 last:pb-0">
								<p className="text-[9px] font-black uppercase tracking-[0.25em] text-tertiary mb-0.5">
									{kicker}
								</p>
								<p className="font-newsreader text-xl leading-snug text-on-surface">
									{title}
								</p>
							</div>
						))}
					</div>
				</Panel>
			</ShowcaseBlock>
		</div>
	</div>
);

export default ShowcaseSections;
