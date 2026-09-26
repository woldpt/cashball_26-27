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
 * Pontinhos de forma (V=vitória, E=empate, resto=derrota), como nas
 * tabelas do jogo.
 *
 * @param {{ form?: string }} props
 * @returns {JSX.Element}
 */
const FormDots = ({ form = "" }) => (
	<span className="inline-flex justify-end gap-1">
		{form.split("").map((r, i) => (
			<span
				key={i}
				className={`w-2 h-2 rounded-full ${
					r === "V" ? "bg-emerald-500" : r === "E" ? "bg-amber-500" : "bg-red-500"
				}`}
			/>
		))}
	</span>
);

/**
 * Secções-montra sob o hero: widgets, plantel, mini-classificação e jornal —
 * tudo com componentes e tokens do jogo sobre fixtures estáticas. Escondida
 * em ecrãs curtos (mobile landscape), onde não há altura para a mostrar.
 *
 * @returns {JSX.Element}
 */
const ShowcaseSections = () => (
	<div className="relative z-10 w-full border-t border-outline-variant/20 bg short:hidden">
		<div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 space-y-4">
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

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<Panel title="O teu plantel" icon="group" meta="Demonstração">
					<div className="space-y-1.5">
						{SHOWCASE_SQUAD.map((player) => (
							<PlayerRow key={player.id} player={player} matchweekCount={9} />
						))}
					</div>
				</Panel>

				<Panel title="Primeira Liga" icon="stadium" meta="Demonstração">
					<table className="w-full text-xs text-left">
						<thead>
							<tr className="text-[8px] uppercase text-on-surface-variant/50 font-bold">
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
									<td className="pl-2 pr-1 py-2 font-black tabular-nums text-on-surface-variant/60">
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
									<td className="px-1 py-2 text-center tabular-nums text-on-surface-variant/60">
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
			</div>

			<Panel title="Jornal da jornada" icon="newspaper" meta="Demonstração">
				<div className="divide-y divide-outline-variant/10">
					{SHOWCASE_HEADLINES.map(({ kicker, title }) => (
						<div key={title} className="py-2.5 first:pt-0 last:pb-0">
							<p className="text-[9px] font-black uppercase tracking-[0.25em] text-tertiary mb-0.5">
								{kicker}
							</p>
							<p className="font-newsreader text-lg leading-snug text-on-surface">
								{title}
							</p>
						</div>
					))}
				</div>
			</Panel>
		</div>
	</div>
);

export default ShowcaseSections;
