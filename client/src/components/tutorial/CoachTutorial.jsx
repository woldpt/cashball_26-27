import { useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "../shared/Button.jsx";
import { AssistantMascot } from "../shared/AssistantCoachView.jsx";
import { SPOTLIGHT_PAD, useTargetRect } from "../../hooks/useTargetRect.js";
import { useTypewriter } from "../../hooks/useTypewriter.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { COACH_TUTORIAL_STEPS } from "./coachTutorialSteps.js";

/**
 * Caixa do destaque clampada ao viewport — alvo meio fora do ecrã não abre
 * buracos nem larguras negativas no escurecimento.
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {{w:number,h:number}} viewport
 * @returns {{left:number,top:number,width:number,height:number}}
 */
function clampBox(rect, viewport) {
	const left = Math.max(0, rect.x - SPOTLIGHT_PAD);
	const top = Math.max(0, rect.y - SPOTLIGHT_PAD);
	const right = Math.min(viewport.w, rect.x + rect.w + SPOTLIGHT_PAD);
	const bottom = Math.min(viewport.h, rect.y + rect.h + SPOTLIGHT_PAD);
	return {
		left,
		top,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top),
	};
}

/**
 * Tutorial do Coach: navega para a tab do passo, destaca o alvo `data-tour`
 * (anel único com `box-shadow` a escurecer o resto) e põe o balão do adjunto
 * no lado livre do alvo.
 *
 * @param {Object} props
 * @param {number} props.stepIndex - índice do passo atual
 * @param {function} props.onNavigate - chamado com o passo ao entrar (muda de tab)
 * @param {function} props.onNext
 * @param {function} props.onBack
 * @param {function} props.onSkip - saltar (marca concluído)
 * @returns {JSX.Element}
 */
export function CoachTutorial({ stepIndex, onNavigate, onNext, onBack, onSkip }) {
	const step = COACH_TUTORIAL_STEPS[stepIndex] ?? COACH_TUTORIAL_STEPS[0];
	const total = COACH_TUTORIAL_STEPS.length;
	const isLast = stepIndex >= total - 1;
	const balloonRef = useRef(null);
	const reducedMotion = usePrefersReducedMotion();
	const { shown, done } = useTypewriter(step.text);
	const { rect, viewport } = useTargetRect(step);

	const box = rect ? clampBox(rect, viewport) : null;
	const ring = box && box.width > 2 && box.height > 2 ? box : null;
	// Lado com mais espaço livre: alvo em baixo → balão em cima. Passo sem alvo
	// (o último) devolve `null` e o balão fica centrado.
	const placeAbove = rect ? rect.y > viewport.h - (rect.y + rect.h) : null;

	useLayoutEffect(() => {
		onNavigate(step);
		const onKey = (e) => {
			if (e.key === "Escape") onSkip();
		};
		window.addEventListener("keydown", onKey);
		balloonRef.current?.focus({ preventScroll: true });
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stepIndex]);

	return (
		<motion.div
			className="fixed inset-0 z-[300]"
			data-tour="tutorial-overlay"
			initial={reducedMotion ? false : { opacity: 0 }}
			animate={reducedMotion ? undefined : { opacity: 1 }}
			exit={reducedMotion ? undefined : { opacity: 0 }}
			transition={{ duration: 0.3 }}
		>
			{/* Destaque: um anel com sombra gigante escurece tudo à volta. Só o
			    anel se move entre passos (o balão tem a sua própria animação). */}
			{ring ? (
				<div
					aria-hidden
					data-tour="tutorial-ring"
					className={`absolute rounded-lg border-2 border-primary pointer-events-none ${
						reducedMotion ? "" : "transition-all duration-200 ease-out"
					}`}
					style={{
						left: ring.left,
						top: ring.top,
						width: ring.width,
						height: ring.height,
						boxShadow:
							"0 0 0 100vmax rgba(0,0,0,0.7), 0 0 24px rgba(74,222,128,0.45)",
					}}
				/>
			) : (
				<div className="absolute inset-0 bg-black/70" />
			)}

			{/* Balão do adjunto, no lado do ecrã com mais folga. */}
			<div
				className={`absolute inset-x-0 flex justify-center p-4 ${
					placeAbove === null
						? "inset-y-0 items-center"
						: placeAbove
							? "top-0 items-start"
							: "items-end bottom-24 lg:bottom-6"
				}`}
			>
				<motion.div
					ref={balloonRef}
					tabIndex={-1}
					className="flex items-end gap-2 w-full max-w-md"
					data-tour="tutorial-balloon"
					role="dialog"
					aria-label={`Treinador-adjunto: passo ${stepIndex + 1} de ${total}. ${step.title}. ${step.text}`}
					initial={reducedMotion ? false : { y: 120 }}
					animate={reducedMotion ? undefined : { y: 0 }}
					exit={reducedMotion ? undefined : { y: 120 }}
					transition={{ duration: 0.3 }}
				>
					<AssistantMascot mood="worried" />
					<div className="relative flex-1 min-w-0 bg-white border-[3px] border-zinc-900 rounded-3xl p-4 text-zinc-900 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
						{/* Rabicho para o retrato (fica sempre à esquerda do balão) */}
						<span
							aria-hidden
							className="absolute bottom-5 w-4 h-4 rotate-45 bg-white -left-[11px] border-l-[3px] border-b-[3px] border-zinc-900"
						/>
						<p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
							Treinador-adjunto · Passo {stepIndex + 1} de {total}
						</p>
						<h3 className="text-base font-black font-headline tracking-tight text-zinc-900 uppercase mt-0.5">
							{step.title}
						</h3>
						<p className="relative text-sm text-zinc-700 leading-relaxed mt-1">
							{/* Altura final reservada desde o início; a máquina escreve por cima. */}
							<span className="invisible" aria-hidden="true">
								{step.text}
							</span>
							<span className="absolute inset-0" aria-hidden="true">
								{shown}
								{!done && (
									<span
										aria-hidden="true"
										className="animate-pulse font-black text-emerald-700"
									>
										▌
									</span>
								)}
							</span>
						</p>
						{/* Progresso */}
						<div className="flex gap-1 mt-2" aria-hidden="true">
							{COACH_TUTORIAL_STEPS.map((s, i) => (
								<span
									key={s.id}
									className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-zinc-200"}`}
								/>
							))}
						</div>
						<div className="flex flex-wrap items-center justify-between gap-2 mt-2">
							<button
								type="button"
								onClick={onSkip}
								className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-900 transition-colors px-1 py-2"
							>
								Saltar
							</button>
							<div className="flex gap-2">
								{stepIndex > 0 && (
									<Button variant="secondary" size="sm" uppercase onClick={onBack}>
										Voltar
									</Button>
								)}
								<Button variant="primary" size="sm" uppercase onClick={onNext}>
									{isLast ? "Concluir" : "Seguinte"}
								</Button>
							</div>
						</div>
					</div>
				</motion.div>
			</div>
		</motion.div>
	);
}
