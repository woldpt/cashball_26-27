import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SEASON_LABEL } from "../../constants/index.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import {
	HERO_PHRASE_INTERVAL,
	HERO_PHRASES,
	HERO_TITLE_SIZE,
} from "./landingContent.js";

/**
 * Coluna esquerda do hero: marca compacta (para mobile landscape, onde o header
 * sticky está escondido), etiqueta de treinador e título com crossfade entre as
 * frases de marca. Com `prefers-reduced-motion`, mostra uma frase estática.
 *
 * @returns {JSX.Element}
 */
const HeroSection = () => {
	const reducedMotion = usePrefersReducedMotion();
	const [phraseIndex, setPhraseIndex] = useState(0);

	useEffect(() => {
		if (reducedMotion) return;
		const id = setInterval(
			() => setPhraseIndex((i) => (i + 1) % HERO_PHRASES.length),
			HERO_PHRASE_INTERVAL,
		);
		return () => clearInterval(id);
	}, [reducedMotion]);

	return (
		<motion.div
			initial={{ opacity: 0, x: -30 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.6, ease: "easeOut" }}
			className="w-full short:w-[40%] lg:w-1/2 flex flex-col items-start text-left"
		>
			{/* Brand compacta — o header sticky é short:hidden; sem isto a marca
			    desaparecia em mobile landscape */}
			<div className="hidden short:flex items-center gap-2 mb-3">
				<img src="/icon-512.png" alt="Logotipo CashBall" className="w-5 h-5" />
				<span className="font-headline font-black text-base tracking-tighter text-white">
					Cash<span className="text-green-400">Ball</span>
					<span className="text-white/30 font-bold ml-1.5 text-xs">{SEASON_LABEL}</span>
				</span>
			</div>

			{/* Placar de balneário — etiqueta de treinador com cronómetro */}
			<div className="mb-5 short:mb-2 flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
				<span className="material-symbols-outlined text-green-400 text-[16px] leading-none">
					sports_soccer
				</span>
				<span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
					Treinador · Época {SEASON_LABEL}
				</span>
				<span className="flex items-center gap-1.5 border-l border-white/10 pl-2">
					<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
					<span className="text-[10px] font-black tabular-nums tracking-widest text-green-400">
						90'
					</span>
				</span>
			</div>

			<h1 className="relative font-headline font-black leading-none tracking-tighter mb-8 short:mb-2">
				{/* Fita-cola — folha afixada no quadro tático */}
				<span aria-hidden="true" className="absolute -top-2 left-8 h-4 w-14 -rotate-6 rounded-[2px] bg-white/15" />
				<span aria-hidden="true" className="absolute -top-2 right-8 h-4 w-14 rotate-6 rounded-[2px] bg-white/15" />
				{/* Nome acessível estável — o bloco visual cicla e é decorativo */}
				<span className="sr-only">{HERO_PHRASES[0].join(" ")}</span>
				<span aria-hidden="true" className="block relative">
					{/* Sizer invisível: reserva a altura (3 linhas) em fluxo normal
					    para o crossfade não deslocar o layout. */}
					<span className="block invisible">
						<span className={`block ${HERO_TITLE_SIZE}`}>{HERO_PHRASES[0][0]}</span>
						<span className={`block ${HERO_TITLE_SIZE}`}>{HERO_PHRASES[0][1]}</span>
						<span className={`block ${HERO_TITLE_SIZE}`}>{HERO_PHRASES[0][2]}</span>
					</span>
					<AnimatePresence mode="wait">
						<motion.span
							key={phraseIndex}
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -12 }}
							transition={{ duration: 0.45, ease: "easeOut" }}
							className="absolute inset-0 flex flex-col justify-start"
						>
							{HERO_PHRASES[phraseIndex].map((word, i) => (
								<span
									key={i}
									className={`${HERO_TITLE_SIZE} ${
										i === 1
											? "text-green-400 drop-shadow-[0_0_40px_rgba(74,222,128,0.35)]"
											: "text-white"
									} `}
								>
									{word}
								</span>
							))}
						</motion.span>
					</AnimatePresence>
				</span>
			</h1>

			<motion.p
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.45, duration: 0.5 }}
				className="text-base text-white/50 leading-relaxed mb-10 max-w-md short:hidden"
			>
				Sem tácticas de génio nem super-gráficos. Só plantel, orçamento e
				90 minutos que podem correr muito bem — ou muito mal.
			</motion.p>
		</motion.div>
	);
};

export default HeroSection;
