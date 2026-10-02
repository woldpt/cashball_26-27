import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../shared/Button.jsx";
import { AssistantMascot } from "../shared/AssistantCoach.jsx";
import { useTypewriter } from "../../hooks/useTypewriter.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { COACH_TUTORIAL_STEPS } from "./coachTutorialSteps.js";

/**
 * Encontra o primeiro alvo visível do passo (desktop primeiro, fallback mobile).
 * @param {Array<string>} targets
 * @returns {Element|null}
 */
function findTarget(targets) {
  for (const sel of targets || []) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
  }
  return null;
}

/**
 * Overlay spotlight + balão fixo no centro do tutorial de Coach.
 * Navega para a tab do passo e destaca o elemento `data-tour` — o balão não se move.
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
  /** @type {[{x:number,y:number,w:number,h:number}|null, Function]} */
  const [rect, setRect] = useState(null);
  const balloonRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const { shown, done } = useTypewriter(step.text);

  useLayoutEffect(() => {
    onNavigate(step);
    // A tab nova monta depois da antiga sair (AnimatePresence mode="wait",
    // saída ~0,22s) — volta a tentar até o alvo aparecer (máx. ~1s).
    let raf = 0;
    let attempts = 0;
    let scrolled = false;
    const tryMeasure = () => {
      const el = findTarget(step.targets);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          setRect({ x: r.x, y: r.y, w: r.width, h: r.height });
        });
        return true;
      }
      setRect(null);
      return false;
    };
    tryMeasure();
    // Passo final sem alvos (balão centrado) — não há nada para esperar.
    const t =
      (step.targets?.length ?? 0) > 0
        ? setInterval(() => {
            attempts += 1;
            if (tryMeasure() || attempts >= 6) clearInterval(t);
          }, 150)
        : undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    balloonRef.current?.focus({ preventScroll: true });
    const onResize = () => {
      const el = findTarget(step.targets);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ x: r.x, y: r.y, w: r.width, h: r.height });
      } else {
        setRect(null);
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      clearInterval(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Entra de baixo 1x ao abrir e sai para baixo 1x ao Saltar/Concluir —
  // entre passos o conteúdo troca sem animar.
  return (
    <motion.div
      className="fixed inset-0 z-[300]"
      data-tour="tutorial-overlay"
      initial={reducedMotion ? false : { opacity: 0, y: 120 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 120 }}
      transition={{ duration: 0.3 }}
    >
      {/* Spotlight: 4 faixas à volta do alvo */}
      {rect ? (
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-black/70"
            style={{ height: Math.max(0, rect.y - 4) }}
          />
          <div
            className="absolute left-0 right-0 bg-black/70"
            style={{ top: rect.y + rect.h + 4, bottom: 0 }}
          />
          <div
            className="absolute bg-black/70"
            style={{
              top: Math.max(0, rect.y - 4),
              height: rect.h + 8,
              left: 0,
              width: Math.max(0, rect.x - 4),
            }}
          />
          <div
            className="absolute bg-black/70"
            style={{
              top: Math.max(0, rect.y - 4),
              height: rect.h + 8,
              left: rect.x + rect.w + 4,
              right: 0,
            }}
          />
          {/* Anel de destaque */}
          <div
            className="absolute rounded-lg border-2 border-primary shadow-[0_0_24px_rgba(74,222,128,0.45)] pointer-events-none"
            style={{
              left: rect.x - 4,
              top: rect.y - 4,
              width: rect.w + 8,
              height: rect.h + 8,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}

      {/* Balão do adjunto: fixo no centro — só o destaque se move */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={balloonRef}
          tabIndex={-1}
          className="flex items-end gap-2 w-full max-w-md"
          data-tour="tutorial-balloon"
          role="dialog"
          aria-label={`Treinador-adjunto: passo ${stepIndex + 1} de ${total}. ${step.title}. ${step.text}`}
        >
          <div className="sm:hidden">
            <AssistantMascot mood="worried" compact />
          </div>
          <div className="hidden sm:block">
            <AssistantMascot mood="worried" />
          </div>
          <div className="relative flex-1 bg-white border-[3px] border-zinc-900 rounded-3xl p-4 text-zinc-900 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
            {/* Rabicho para o retrato */}
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
            <span className="invisible" aria-hidden="true">{step.text}</span>
            <span className="absolute inset-0" aria-hidden="true">
              {shown}
              {!done && (
                <span aria-hidden="true" className="animate-pulse font-black text-emerald-700">
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
          <div className="flex items-center justify-between gap-2 mt-2">
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
      </div>
      </div>
    </motion.div>
  );
}
