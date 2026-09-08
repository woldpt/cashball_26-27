import { useEffect } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";
import { CelebrationBurst } from "../shared/CelebrationBurst.jsx";
import { MODAL_Z } from "../../constants/index.js";
import { playSigningSound, playBooSound } from "../../utils/audio.js";

/**
 * Configuração por variante de humor. A variante é calculada no GameContext
 * (ver `utils/moodVariant.js`) a partir do resultado + contexto do adversário
 * (posição na divisão, ou diferença de escalão na Taça).
 *
 * Campos:
 *  - title:      cabeçalho principal
 *  - fans:       emojis dos adeptos
 *  - subtitle:   linha curta sob o resultado (null = oculta)
 *  - accent:     cor de destaque (título, badge)
 *  - gradient:   cor do gradiente radial de fundo
 *  - sound:      "signing" | "boo" | null
 *  - celebrate:  mostrar CelebrationBurst
 *  - fansRepeat: animação dos adeptos em loop (furiosos)
 */
const MOOD_CONFIG = {
	// ── Vitórias ──────────────────────────────────────────────────────────
	win: {
		title: "Vitória!",
		fans: ["🎉", "🥳", "👏", "📣"],
		subtitle: "A festa está garantida!",
		accent: "#4ade80",
		gradient: "rgba(74,222,128,0.18)",
		sound: "signing",
		celebrate: true,
		fansRepeat: false,
	},
	win_big: {
		title: "Vitória Épica!",
		fans: ["🏆", "🎉", "🥳", "📣"],
		subtitle: "Vitória sobre um gigante da liga!",
		accent: "#86efac",
		gradient: "rgba(134,239,172,0.22)",
		sound: "signing",
		celebrate: true,
		fansRepeat: false,
	},
	win_upset: {
		title: "Vitória Épica!",
		fans: ["🏆", "🤯", "🎉", "📣"],
		subtitle: "Sensação! Vencemos um adversário de escalão superior!",
		accent: "#86efac",
		gradient: "rgba(134,239,172,0.22)",
		sound: "signing",
		celebrate: true,
		fansRepeat: false,
	},
	// ── Derrotas ──────────────────────────────────────────────────────────
	loss: {
		title: "Adeptos Descontentes",
		fans: ["😡", "😠", "😤", "📢"],
		subtitle: "Os adeptos abandonaram o estádio a assobiar…",
		accent: "#f87171",
		gradient: "rgba(248,113,113,0.16)",
		sound: "boo",
		celebrate: false,
		fansRepeat: true,
	},
	loss_shameful: {
		title: "Derrota Vergonhosa",
		fans: ["😡", "😤", "🔥", "📢"],
		subtitle: "Perder com o último classificado — a aflição é total!",
		accent: "#ef4444",
		gradient: "rgba(239,68,68,0.2)",
		sound: "boo",
		celebrate: false,
		fansRepeat: true,
	},
	loss_expected: {
		title: "Derrota Esperada",
		fans: ["🫡", "👏", "🤝", "📣"],
		subtitle: "Derrota justa perante um adversário à altura — respeito!",
		accent: "#94a3b8",
		gradient: "rgba(148,163,184,0.14)",
		sound: null,
		celebrate: false,
		fansRepeat: false,
	},
	// ── Empates ───────────────────────────────────────────────────────────
	draw: {
		title: "Empate",
		fans: ["😐", "😑", "🤷", "👀"],
		subtitle: null,
		accent: "#a1a1aa",
		gradient: "rgba(161,161,170,0.12)",
		sound: null,
		celebrate: false,
		fansRepeat: false,
	},
	draw_honorable: {
		title: "Empate Honroso",
		fans: ["😌", "👍", "🤝", "📣"],
		subtitle: "Pontos merecidos perante um rival forte.",
		accent: "#fbbf24",
		gradient: "rgba(251,191,36,0.14)",
		sound: null,
		celebrate: false,
		fansRepeat: false,
	},
	draw_bitter: {
		title: "Empate Amargo",
		fans: ["😕", "🤦", "😤", "📢"],
		subtitle: "Deixámos pontos na mesa…",
		accent: "#f59e0b",
		gradient: "rgba(245,158,11,0.14)",
		sound: null,
		celebrate: false,
		fansRepeat: false,
	},
};

// Fallback seguro: se a variante for desconhecida, usa o resultado base.
const FALLBACK_BY_OUTCOME = { win: "win", loss: "loss", draw: "draw" };

/**
 * Modal de humor pós-jogo — Vitória, Adeptos descontentes (derrota) ou
 * Empate, com variações por contexto (adversário líder/lanterna, escalão na
 * Taça). Sem timeout: requer clique do coach para avançar.
 *
 * @param {{
 *   mood: object|null,
 *   onClose: function,
 * }} props
 */
export function PostMatchMoodModal({ mood, onClose }) {
	useEffect(() => {
		if (!mood) return;
		const cfg = MOOD_CONFIG[mood.variant] || MOOD_CONFIG[FALLBACK_BY_OUTCOME[mood.outcome]];
		if (cfg?.sound === "signing") playSigningSound();
		else if (cfg?.sound === "boo") playBooSound();
	}, [mood]);

	if (!mood) return null;

	const variant =
		mood.variant || FALLBACK_BY_OUTCOME[mood.outcome] || "draw";
	const cfg = MOOD_CONFIG[variant] || MOOD_CONFIG[FALLBACK_BY_OUTCOME[mood.outcome]] || MOOD_CONFIG.draw;
	const isWin = mood.outcome === "win";

	return (
		<ModalShell
			visible={!!mood}
			onClose={onClose}
			z={MODAL_Z.postMatch}
			variant="card"
			cardClassName="!bg-surface overflow-hidden"
		>
			<div
				className="relative px-6 short:px-4 py-8 short:py-3 text-center overflow-hidden"
				style={{
					background: `radial-gradient(ellipse at top, ${cfg.gradient} 0%, rgba(15,19,32,0) 60%)`,
				}}
			>
				{cfg.celebrate && <CelebrationBurst seed={`pm-${mood.key}`} />}

				{/* ── Adeptos ───────────────────────────────────────────────── */}
				<div className="flex justify-center gap-3 short:gap-2 mb-4 short:mb-2">
					{cfg.fans.map((fan, i) => (
						<motion.span
							key={fan}
							className="text-3xl short:text-2xl select-none"
							initial={cfg.celebrate ? { opacity: 0, scale: 0.4 } : { opacity: 0, y: -10 }}
							animate={
								cfg.celebrate
									? { opacity: 1, scale: 1 }
									: { opacity: [0, 1, 0.6, 1], y: [0, -8, 0] }
							}
							transition={
								cfg.celebrate
									? { duration: 0.5, delay: 0.1 + i * 0.15 }
									: {
										duration: 1.6,
										delay: i * 0.25,
										repeat: cfg.fansRepeat ? Infinity : 1,
									}
							}
						>
							{fan}
						</motion.span>
					))}
				</div>

				<span
					className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm mb-4 short:mb-2"
					style={{ background: `${cfg.accent}22`, color: cfg.accent }}
				>
					{mood.roundLabel || (mood.source === "cup" ? "Taça" : "Liga")}
				</span>

				<motion.h2
					className="font-headline font-black text-3xl short:text-xl tracking-tight text-on-surface uppercase"
					initial={{ scale: 0.6, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
					style={{ color: cfg.accent }}
				>
					{cfg.title}
				</motion.h2>

				<p className="mt-3 short:mt-1.5 text-sm short:text-xs font-bold text-on-surface-variant">
					{mood.source === "cup" ? "Eliminatória" : "Jogo contra"}{" "}
					<span className="font-headline font-black text-white">
						{mood.opponentName}
					</span>
				</p>

				<p className="mt-2 short:mt-1 font-headline font-black text-4xl short:text-2xl tracking-tight text-white tabular-nums">
					{mood.myGoals}
					<span className="mx-2 text-on-surface-variant">–</span>
					{mood.oppGoals}
				</p>

				{cfg.subtitle && (
					<p className="mt-2 text-[11px] font-bold text-on-surface-variant">
						{cfg.subtitle}
					</p>
				)}

				<div className="mt-6 short:mt-3">
					<Button onClick={onClose} variant={isWin ? "success" : "secondary"} full>
						Continuar
					</Button>
				</div>
			</div>
		</ModalShell>
	);
}
