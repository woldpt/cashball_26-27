import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SEASON_LABEL } from "../../constants/index.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import {
	SHOWCASE_FINAL_HOLD,
	SHOWCASE_LIVE,
	SHOWCASE_MINUTE_TICK,
	SHOWCASE_START_MINUTE,
} from "./landingShowcase.js";

/** Quantos eventos (os mais recentes) cabem no cartão. */
const VISIBLE_EVENTS = 3;

/** Argumentos de venda em uma linha, sob o parágrafo do hero. */
const HERO_CHIPS = [
	{ icon: "groups", label: "Multijogador em tempo real" },
	{ icon: "gavel", label: "Leilões e mercado" },
	{ icon: "emoji_events", label: "Liga e taças" },
];

/**
 * Coluna esquerda do hero: marca compacta (para mobile landscape, onde o
 * header está escondido), título e o jogo em direto da montra — teatro com
 * temporizador sobre fixtures estáticas, não é simulação: os eventos entram
 * quando o relógio lá chega, o resultado deriva deles e, após o apito
 * final, o direto recomeça. Com `prefers-reduced-motion`, mostra o jogo
 * acabado e parado.
 *
 * @returns {JSX.Element}
 */
const HeroSection = () => {
	const reducedMotion = usePrefersReducedMotion();
	// Passa dos 90 durante a pausa do apito final; o ecrã fica nos 90.
	const [tick, setTick] = useState(SHOWCASE_START_MINUTE);

	useEffect(() => {
		if (reducedMotion) return;
		const id = setInterval(
			() =>
				setTick((m) =>
					m >= 90 + SHOWCASE_FINAL_HOLD ? SHOWCASE_START_MINUTE : m + 1,
				),
			SHOWCASE_MINUTE_TICK,
		);
		return () => clearInterval(id);
	}, [reducedMotion]);

	const minute = reducedMotion ? 90 : Math.min(tick, 90);
	const { home, away, events } = SHOWCASE_LIVE;
	const happened = events.filter((e) => e.minute <= minute);
	const homeGoals = happened.filter((e) => e.side === "home").length;
	const awayGoals = happened.filter((e) => e.side === "away").length;
	const recent = happened.slice(-VISIBLE_EVENTS).reverse();
	const finished = minute >= 90;

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
				<img src="/icon-512.png" alt="" className="w-5 h-5" />
				<span className="font-headline font-black text-base tracking-tighter text-on-surface">
					Cash<span className="text-primary">Ball</span>
					<span className="text-on-surface-variant/70 font-bold ml-1.5 text-xs">{SEASON_LABEL}</span>
				</span>
			</div>

			<h1 className="font-headline font-black leading-none tracking-tighter mb-4 short:mb-2 text-[min(3.25rem,calc((100vw-3rem)/6))] sm:text-6xl xl:text-[5.5rem] short:text-[clamp(1.4rem,4.5vw,2.2rem)] text-on-surface">
				O balneário
				<span className="block text-primary">é teu.</span>
			</h1>

			<p className="text-base sm:text-lg text-on-surface-variant leading-relaxed mb-5 max-w-md short:hidden">
				O sorteio dá-te o clube — gere o plantel e o orçamento, monta a
				tática e depois sofre os 90 minutos com os outros treinadores.
			</p>

			<ul className="flex flex-wrap gap-2 mb-8 short:hidden">
				{HERO_CHIPS.map(({ icon, label }) => (
					<li
						key={label}
						className="flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container/70 backdrop-blur px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant"
					>
						<span className="material-symbols-outlined text-[14px] leading-none text-primary">{icon}</span>
						{label}
					</li>
				))}
			</ul>

			{/* Direto da montra — cartão de jogo com pele do jogo */}
			<div className="relative w-full max-w-md short:max-w-none bg-surface-container rounded-md overflow-hidden border border-outline-variant/25">
				<div aria-hidden className="top-light" />
				<div className="px-4 short:px-3 py-2.5 short:py-1.5 flex items-center justify-between bg-surface-container-high/50">
					<span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-primary">
						<span className={`w-1.5 h-1.5 rounded-full bg-primary ${finished ? "" : "motion-safe:animate-pulse"}`} />
						{finished ? "Final" : "Direto"} · Jornada 9
					</span>
					<span
						role="timer"
						aria-label={`Demonstração: minuto ${minute}, ${homeGoals}–${awayGoals}`}
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
							<span className="text-[10px] font-black text-on-surface-variant/80 w-7">
								{team.short}
							</span>
							<span className="flex-1 min-w-0 truncate text-sm font-bold text-on-surface">
								{team.name}
							</span>
							<span className="relative font-headline font-black text-2xl tabular-nums text-on-surface">
								{/* Remonta a cada golo: o número entra a brilhar em primary */}
								<motion.span
									key={i === 0 ? homeGoals : awayGoals}
									className="inline-block"
									initial={
										reducedMotion
											? false
											: { scale: 1.5, color: "var(--color-primary)" }
									}
									animate={{ scale: 1, color: "var(--color-on-surface)" }}
									transition={{ duration: 0.8, ease: "easeOut" }}
								>
									{i === 0 ? homeGoals : awayGoals}
								</motion.span>
							</span>
						</div>
					))}
					{/* Mais recente em cima; altura fixa para o cartão não saltar */}
					<div className="mt-2 pt-2 border-t border-outline-variant/10 space-y-1 h-[4.5rem] overflow-hidden">
						<AnimatePresence initial={false}>
							{recent.map(({ minute: m, text, side }) => (
								<motion.p
									key={m}
									layout
									initial={{ opacity: 0, y: -6 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className={`text-xs truncate ${side ? "text-on-surface font-bold" : "text-on-surface-variant"}`}
								>
									<span className="font-black tabular-nums text-tertiary mr-1.5">
										{m}&apos;
									</span>
									{text}
								</motion.p>
							))}
						</AnimatePresence>
					</div>
				</div>
				{/* Progresso do jogo (0–90') */}
				<div aria-hidden className="h-0.5 bg-outline-variant/15">
					<div
						className="h-full bg-primary transition-[width] duration-700 ease-out"
						style={{ width: `${(minute / 90) * 100}%` }}
					/>
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
