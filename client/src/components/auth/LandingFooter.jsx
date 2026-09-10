import { SEASON_LABEL } from "../../constants/index.js";

/**
 * Rodapé da página de entrada (marca + versão do build).
 *
 * @returns {JSX.Element}
 */
const LandingFooter = () => (
	<footer className="relative z-10 border-t border-white/[0.06] bg-landing-bg py-5 short:py-3">
		<div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between">
			<span className="flex items-center gap-1.5 text-xs text-white/30 font-bold">
				<img src="/icon-512.png" alt="Logotipo CashBall" className="w-4 h-4" />
				CashBall {SEASON_LABEL}
			</span>
			<span className="text-xs text-white/15">v1.1a © 2026 by Fábio Silva</span>
		</div>
	</footer>
);

export default LandingFooter;
