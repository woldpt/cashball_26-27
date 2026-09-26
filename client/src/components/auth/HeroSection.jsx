import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SEASON_LABEL } from "../../constants/index.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import {
	SHOWCASE_LIVE,
	SHOWCASE_MINUTE_TICK,
	SHOWCASE_START_MINUTE,
} from "./landingShowcase.js";

/**
 * Coluna esquerda do hero: marca compacta (para mobile landscape, onde o
 * header está escondido), título e o jogo em direto da montra — teatro com
 * temporizador sobre fixtures estáticas, não é simulação. Com
 * `prefers-reduced-motion`, o minuto fica estático.
 *
 * @returns {JSX.Element}
 */
const HeroSection = () => {
	const reducedMotion = usePrefersReducedMotion();
	const [minute, setMinute] = useState(SHOWCASE_START_MINUTE);

	useEffect(() => {
		if (reducedMotion) return;
		const id = setInterval(
			() => setMinute((m) => (m >= 90 ? 90 : m + 1)),
			SHOWCASE_MINUTE_TICK,
		);
		return () => clearInterval(id);
	}, [reducedMotion]);

	const { home, away, homeGoals, awayGoals, events } = SHOWCASE_LIVE;

	return (
		<motion.div
			initial={{ opacity: 0, x: -30 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.6, ease: "easeOut" }}
			className="w-full short:w-[40%] lg:w-1/2 flex flex-col items-start text-left"
		>
			{/* Marca compacta — o header é short:hidden; sem isto a marca
			    desaparecia em mobile landscape */}
			<div className="hidden short:flex items-center gap-2 mb-3">
				<img src="/icon-512.png" alt="Logotipo CashBall" className="w-5 h-5" />
				<span className="font-headline font-black text-base tracking-tighter text-on-surface">
					Cash<span className="text-primary">Ball</span>
					<span className="text-on-surface-variant/50 font-bold ml-1.5 text-xs">{SEASON_LABEL}</span>
				</span>
			</div>

			<h1 className="font-headline font-black leading-none tracking-tighter mb-4 short:mb-2 text-[min(3.25rem,calc((100vw-3rem)/6))] sm:text-6xl lg:text-[4.5rem] short:text-[clamp(1.4rem,4.5vw,2.2rem)] text-on-surface">
				O balneário
				<span className="block text-primary">é teu.</span>
			</h1>

			<p className="text-base text-on-surface-variant leading-relaxed mb-6 max-w-md short:hidden">
				Escolhe o clube, gere o plantel e o orçamento, monta a tática —
				depois sofre os 90 minutos com os outros treinadores.
			</p>

			{/* Direto da montra — cartão de jogo com pele do jogo */}
			<div className="relative w-full max-w-md short:max-w-none bg-surface-container rounded-md overflow-hidden border border-outline-variant/25">
				<div aria-hidden className="top-light" />
				<div className="px-4 short:px-3 py-2.5 short:py-1.5 flex items-center justify-between bg-surface-container-high/50">
					<span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-primary">
						<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
						Direto · Jornada 9
					</span>
					<span
						role="timer"
						aria-label={`Demonstração: minuto ${minute}, segunda parte`}
						className="text-sm font-headline font-black tabular-nums text-on-surface"
					>
						{minute}&apos;
					</span>
				</div>
				<div className="p-4 short:p-2 short:hidden">
					{[home, away].map((team, i) => (
						<div key={team.short} className="flex items-center gap-2 py-1">
							<span
								aria-hidden
								className="shrink-0 w-2 h-2 rounded-full"
								style={{ backgroundColor: team.color }}
							/>
							<span className="text-[10px] font-black text-on-surface-variant/60 w-7">
								{team.short}
							</span>
							<span className="flex-1 min-w-0 truncate text-sm font-bold text-on-surface">
								{team.name}
							</span>
							<span className="font-headline font-black text-2xl tabular-nums text-on-surface">
								{i === 0 ? homeGoals : awayGoals}
							</span>
						</div>
					))}
					<div className="mt-2 pt-2 border-t border-outline-variant/10 space-y-1">
						{events.map(({ minute: m, text }) => (
							<p key={m} className="text-xs text-on-surface-variant">
								<span className="font-black tabular-nums text-tertiary mr-1.5">
									{m}&apos;
								</span>
								{text}
							</p>
						))}
					</div>
				</div>
				{/* Landscape: só o marcador, sem eventos */}
				<div className="hidden short:flex items-center gap-2 px-3 py-1.5">
					{[home, away].map((team, i) => (
						<span key={team.short} className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
							<span
								aria-hidden
								className="w-1.5 h-1.5 rounded-full"
								style={{ backgroundColor: team.color }}
							/>
							{team.short} {i === 0 ? homeGoals : awayGoals}
							{i === 0 && <span className="text-on-surface-variant/40">–</span>}
						</span>
					))}
				</div>
			</div>
		</motion.div>
	);
};

export default HeroSection;
