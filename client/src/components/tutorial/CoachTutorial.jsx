import { useLayoutEffect, useState } from "react";
import { Button } from "../shared/Button.jsx";
import { COACH_TUTORIAL_STEPS } from "./coachTutorialSteps.js";

const BALLOON_W = 320;
const GAP = 12;

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
 * Overlay spotlight + balão ancorado do tutorial de Coach.
 * Navega para a tab do passo e ancora o balão ao elemento `data-tour`.
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

  useLayoutEffect(() => {
    onNavigate(step);
    // Dá tempo à tab de montar antes de medir o alvo.
    let raf = 0;
    const measure = () => {
      const el = findTarget(step.targets);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          setRect({ x: r.x, y: r.y, w: r.width, h: r.height });
        });
      } else {
        setRect(null);
      }
    };
    const t = setTimeout(measure, 120);
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
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let balloon = { left: Math.max(8, (vw - BALLOON_W) / 2), top: vh / 2 - 100 };
  let below = true;
  if (rect) {
    below = rect.y + rect.h + GAP + 220 <= vh || rect.y < 200;
    const left = Math.max(
      8,
      Math.min(rect.x + rect.w / 2 - BALLOON_W / 2, vw - BALLOON_W - 8),
    );
    const top = below ? rect.y + rect.h + GAP : rect.y - GAP - 240;
    balloon = { left, top: Math.max(8, top) };
  }

  return (
    <div className="fixed inset-0 z-[300]" data-tour="tutorial-overlay">
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

      {/* Balão */}
      <div
        className="absolute bg-surface-container border border-primary/30 rounded-xl shadow-2xl p-4 flex flex-col gap-2"
        style={{
          left: balloon.left,
          top: balloon.top,
          width: `min(${BALLOON_W}px, calc(100vw - 16px))`,
        }}
        data-tour="tutorial-balloon"
        role="dialog"
        aria-label={`Tutorial passo ${stepIndex + 1} de ${total}`}
      >
        {/* Seta para o alvo */}
        {rect && (
          <span
            className="absolute w-3 h-3 rotate-45 bg-surface-container border-primary/30"
            style={{
              left: Math.min(
                Math.max(rect.x + rect.w / 2 - balloon.left - 6, 16),
                BALLOON_W - 28,
              ),
              ...(below
                ? { top: -7, borderLeftWidth: 1, borderTopWidth: 1 }
                : { bottom: -7, borderRightWidth: 1, borderBottomWidth: 1 }),
            }}
          />
        )}
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
          Tutorial · Passo {stepIndex + 1} de {total}
        </p>
        <h3 className="text-base font-black font-headline tracking-tight text-on-surface uppercase">
          {step.title}
        </h3>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {step.text}
        </p>
        {/* Progresso */}
        <div className="flex gap-1 mt-1" aria-hidden="true">
          {COACH_TUTORIAL_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-outline-variant/30"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <button
            type="button"
            onClick={onSkip}
            className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors px-1 py-2"
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
  );
}
