import { LANDING_FEATURES } from "./landingContent.js";

/**
 * Faixa de funcionalidades sob o hero. Escondida em ecrãs curtos
 * (mobile landscape), onde não há altura para a mostrar.
 *
 * @returns {JSX.Element}
 */
const FeaturesStrip = () => (
	<div className="relative z-10 w-full border-t border-white/[0.06] bg-landing-surface/60 backdrop-blur-sm short:hidden">
		<div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{LANDING_FEATURES.map(({ icon, label, desc }) => (
					<div
						key={label}
						className="bg-white/[0.02] border border-white/[0.06] hover:border-green-500/25 hover:bg-green-500/[0.03] rounded-xl p-5 transition-all duration-300 group"
					>
						<div className="w-10 h-10 flex items-center justify-center bg-white/[0.04] border border-white/[0.06] rounded-xl mb-4 group-hover:bg-green-500/10 transition-colors duration-300">
							<span className="material-symbols-outlined text-green-400/80 text-[22px] leading-none">
								{icon}
							</span>
						</div>
						<p className="font-headline font-black text-sm text-white mb-1.5 tracking-tight">
							{label}
						</p>
						<p className="text-xs text-white/40 leading-relaxed">{desc}</p>
					</div>
				))}
			</div>
		</div>
	</div>
);

export default FeaturesStrip;
