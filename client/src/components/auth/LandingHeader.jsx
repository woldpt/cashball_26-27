import { useEffect, useState } from "react";
import { SEASON_LABEL } from "../../constants/index.js";

/**
 * Barra de título sticky da página de entrada. Esconde-se logo após o início do
 * scroll vertical (volta ao topo → reaparece) e desaparece por completo em
 * ecrãs curtos (mobile landscape), onde os 64px de marca esmagam o hero.
 *
 * @returns {JSX.Element}
 */
const LandingHeader = () => {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 4);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			aria-hidden={scrolled}
			className={`z-10 w-full border-b border-white/[0.06] bg-landing-bg/70 backdrop-blur-xl sticky top-0 transition-transform duration-300 ease-out short:hidden ${scrolled ? "-translate-y-full pointer-events-none" : "translate-y-0"}`}
		>
			<div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<img src="/icon-512.png" alt="Logotipo CashBall" className="w-8 h-8" />
					<span className="font-headline font-black text-xl tracking-tighter text-white">
						Cash<span className="text-green-400">Ball</span>
						<span className="text-white/30 font-bold ml-2 text-sm">{SEASON_LABEL}</span>
					</span>
				</div>
				<div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
					<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
					<span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400 hidden sm:block">
						Época {SEASON_LABEL} · Activa
					</span>
				</div>
			</div>
		</header>
	);
};

export default LandingHeader;
