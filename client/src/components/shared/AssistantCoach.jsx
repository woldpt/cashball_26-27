import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MODAL_Z } from "../../constants/index.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { useAssistantCoach } from "../../hooks/useAssistantCoach.js";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion.js";
import { useTypewriter } from "../../hooks/useTypewriter.js";
import { Button } from "../shared/Button.jsx";

/**
 * Boneco do adjunto sem moldura (assets `/coaches/jj-fechada.webp` e
 * `/coaches/jj-aberta.webp` com fundo transparente, caricatura espelhada
 * a olhar para a direita dele): busto flutuante com sombra suave.
 * A boca alterna em loop (~420ms) enquanto a dica está visível; com
 * `prefers-reduced-motion` fica parado em boca fechada.
 * `mood` só muda o tratamento do retrato — "sad" dessatura e escurece.
 * @param {string} mood Expressão do adjunto ("worried" | "sad").
 * @param {boolean} [compact] Medalhão mais pequeno (tutorial no telemóvel).
 */
export function AssistantMascot({ mood, compact }) {
  const sad = mood === "sad";
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setOpen((v) => !v), 420);
    return () => clearInterval(id);
  }, [reducedMotion]);
  const size = compact
    ? "h-[76px] w-[76px]"
    : "h-[108px] w-[108px] lg:h-[132px] lg:w-[132px]";
  const imgClass = "h-full w-full";
  const shadow = "drop-shadow(0 6px 10px rgba(0,0,0,0.45))";
  const filter = sad ? { filter: `saturate(0.45) brightness(0.82) ${shadow}` } : { filter: shadow };
  return (
    <div
      role="img"
      aria-label="Treinador-adjunto"
      className={`relative ${size} shrink-0`}
    >
      <img src="/coaches/jj-fechada.webp" alt="" className={imgClass} style={filter} />
      <img
        src="/coaches/jj-aberta.webp"
        alt=""
        aria-hidden
        className={`${imgClass} absolute inset-0 m-auto transition-opacity duration-100 ${open ? "opacity-100" : "opacity-0"}`}
        style={filter}
      />
    </div>
  );
}

/**
 * Vista pura do adjunto (sem contextos): a mesma usada em produção e no harness.
 * @param {Object} props
 * @param {{id: string, mood: string, text: string, cta: string}} props.tip Dica ativa.
 * @param {() => void} props.onGo Navega para a tab que resolve.
 * @param {() => void} props.onDismiss Dispensa a dica (1x/semana).
 * @param {boolean} [props.menuOpen] Fly-up do menu mobile aberto — o balão cala-se.
 * @returns {JSX.Element}
 */
export function AssistantCoachView({ tip, onGo, onDismiss, menuOpen }) {
  const reducedMotion = usePrefersReducedMotion();
  const { shown, done, complete } = useTypewriter(tip.text);

  return (
    <div
      // `bottom-24` no mobile deixa folga exata sobre o rodapé Notícias CM
      // (`bottom-16 h-8` = 64–96px); em desktop o rodapé vive a `bottom-0`.
      // `invisible` (e não desmontar) com o fly-up aberto: o balão está no
      // mesmo ancoradouro do menu e, com z maior, roubava-lhe os toques —
      // escondido, o texto e o gate do onze ficam intactos.
      className={`fixed bottom-24 lg:bottom-6 left-0 right-0 pointer-events-none flex justify-center lg:justify-end px-3 lg:pr-6 ${menuOpen ? "invisible" : ""}`}
      style={{ zIndex: MODAL_Z.assistant }}
      data-tour="assistant-coach"
    >
      <div
        className="pointer-events-auto flex items-end gap-2 w-full max-w-md lg:flex-row-reverse"
        role="dialog"
        aria-live="polite"
        aria-label={`Treinador-adjunto: ${tip.text}`}
      >
        {/* O boneco sobe primeiro; ao dispensar sai por último. */}
        <motion.div
          initial={reducedMotion ? false : { y: "120%" }}
          animate={reducedMotion ? undefined : { y: 0 }}
          exit={reducedMotion ? undefined : { y: "120%", transition: { delay: 0.15, duration: 0.25 } }}
          transition={{ duration: 0.3 }}
        >
          <AssistantMascot mood={tip.mood} />
        </motion.div>
        {/* O balão surge quando o boneco chega; ao dispensar desvanece primeiro. */}
        <motion.div
          onClick={() => (done ? onDismiss() : complete())}
          className="relative flex-1 cursor-pointer bg-white border-[3px] border-zinc-900 rounded-3xl p-4 pr-3 text-zinc-900 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.25 } }}
          exit={reducedMotion ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
        >
          {/* Rabicho do balão: aponta ao retrato (à esquerda no mobile,
              à direita em desktop, onde o retrato fica no canto). */}
          <span
            aria-hidden
            className="absolute bottom-5 w-4 h-4 rotate-45 bg-white -left-[11px] border-l-[3px] border-b-[3px] border-zinc-900 lg:left-auto lg:-right-[11px] lg:border-l-0 lg:border-r-[3px]"
          />
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
            Treinador-adjunto
          </p>
          <p className="relative text-sm leading-snug mt-1" aria-hidden="true">
            {/* Camada invisível reserva a altura final desde o início —
                a máquina de escrever revela por cima sem empurrar o balão. */}
            <span className="invisible">{tip.text}</span>
            <span className="absolute inset-0">
              {shown}
              {!done && (
                <span aria-hidden="true" className="animate-pulse font-black text-emerald-700">
                  ▌
                </span>
              )}
            </span>
          </p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <Button variant="primary" size="sm" uppercase onClick={onGo}>
              {tip.cta}
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dispensar dica"
              className="min-w-11 min-h-11 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              X
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Treinador-adjunto: boneco do treinador + balão de banda desenhada.
 * Monta-se no `GameLayout`; o hook decide se há dica (1x/situação/semana).
 * @returns {JSX.Element|null}
 */
export function AssistantCoach() {
  const { mobileSubMenu } = useGame();
  const { tip, dismissTip, goTip } = useAssistantCoach();

  return (
    <AnimatePresence>
      {tip && (
        <AssistantCoachView
          key={tip.id}
          tip={tip}
          menuOpen={mobileSubMenu != null}
          onGo={goTip}
          onDismiss={dismissTip}
        />
      )}
    </AnimatePresence>
  );
}
