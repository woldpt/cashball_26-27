import { AnimatePresence, motion } from "framer-motion";

/**
 * LiveClock.jsx — relógio do jogo no header: minuto com barra de progresso;
 * o resultado só aparece ao intervalo (transição animada) e depois volta ao tempo.
 *
 * Antes, o `GameLayout` tinha 4 variantes inline (jogo a decorrer em coluna
 * no portrait / linha no landscape, intervalo, taça, `null`), cada uma com o
 * seu padding e tipografia. Este componente unifica-as num só pill
 * horizontal compacto (`38' · 2ªP`), com `max-w` + truncagem para nunca
 * colidir visualmente com a marca e os botões em ecrãs estreitos.
 *
 * Acessibilidade: `role="timer"` com `aria-label` por extenso — o minuto só
 * muda 1×/min, por isso não há ruído para leitores de ecrã.
 */

/**
 * @param {object} props
 * @param {number} props.liveMinute Minuto atual do jogo.
 * @param {boolean} props.isPlayingMatch Se o meu jogo está a decorrer.
 * @param {boolean} [props.isHalftime] Painel de intervalo aberto (o jogo está parado, mas `isPlayingMatch` continua true).
 * @param {boolean} props.isCupMatch Se é jogo da taça.
 * @param {boolean} props.cupPreMatch Se ainda está em pré-jogo da taça.
 * @param {string} props.cupMatchRoundName Nome da ronda da taça.
 * @param {boolean} props.cupExtraTimeBadge Se está em prolongamento na taça.
 * @param {{home: number, away: number, homeName?: string, awayName?: string}|null} [props.score] Resultado do meu jogo (some sem jogo).
 * @returns {import("react").ReactElement|null} Pill do relógio ou `null`.
 */
export function LiveClock({
  liveMinute,
  isPlayingMatch,
  isHalftime = false,
  isCupMatch,
  cupPreMatch,
  cupMatchRoundName,
  cupExtraTimeBadge,
  score = null,
}) {
  /** @type {string|null} Texto grande (minuto ou símbolo). */
  let time;
  /** @type {string} Fase abreviada. */
  let shortPhase;
  /** @type {string} Fase por extenso (leitores de ecrã). */
  let longPhase;

  if (isPlayingMatch) {
    if (liveMinute < 1) {
      time = "⚽";
      shortPhase = "A começar";
      longPhase = "a começar";
    } else {
      time = `${liveMinute}'`;
      if (liveMinute > 90) {
        shortPhase = "Prol.";
        longPhase = "prolongamento";
      } else if (liveMinute > 45) {
        shortPhase = "2ªP";
        longPhase = "segunda parte";
      } else {
        shortPhase = "1ªP";
        longPhase = "primeira parte";
      }
    }
  } else if (isCupMatch) {
    time = "🏆";
    shortPhase = `${cupMatchRoundName}${cupPreMatch ? " · Pré" : cupExtraTimeBadge ? " · Prol." : ""}`;
    longPhase = `taça, ${cupMatchRoundName}`;
  } else if (liveMinute === 45) {
    time = "45'";
    shortPhase = "Intervalo";
    longPhase = "intervalo";
  } else {
    return null;
  }

  const ariaLabel =
    isPlayingMatch && liveMinute >= 1
      ? `Minuto ${liveMinute}, ${longPhase}`
      : `Jogo ${longPhase}`;
  // Resultado só nas pausas (intervalo / antes do prolongamento); a jogar, só o tempo.
  const showScore = !!score && isHalftime;
  const breakLabel = liveMinute >= 90 ? "Fim 90'" : "Intervalo";
  const ariaFull = showScore
    ? `${score.homeName ?? "Casa"} ${score.home}, ${score.awayName ?? "Fora"} ${score.away}. ${ariaLabel}`
    : ariaLabel;

  // Urgência: últimos 15' do tempo regulamentar (75'+) e do
  // prolongamento (110'+) — fora disso o relógio fica quieto.
  const urgent =
    isPlayingMatch &&
    !isHalftime &&
    (liveMinute >= 110 || (liveMinute >= 75 && liveMinute <= 90));

  // Progresso do jogo (90' ou 120' com prolongamento); só com minuto real.
  const total = liveMinute > 90 ? 120 : 90;
  const showBar = isPlayingMatch || isHalftime ? liveMinute >= 1 : liveMinute >= 45;
  const pct = Math.min(100, (Math.max(0, liveMinute) / total) * 100);

  const swap = {
    initial: { opacity: 0, y: 10, scale: 0.9, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, y: -10, scale: 0.9, filter: "blur(6px)" },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  };

  return (
    // Abaixo de md é um item normal da linha (o nome do clube encolhe e trunca); de md para cima fica absoluto, no centro do ecrã.
    <div className={`relative shrink-0 min-w-0 max-w-[38vw] pointer-events-none md:absolute md:left-1/2 md:-translate-x-1/2 ${urgent ? "liveclock-urgent" : ""}`}>
      <span
        role="timer"
        aria-label={ariaFull}
        className={`relative flex items-center justify-center min-w-24 sm:min-w-32 max-w-full overflow-hidden rounded-2xl border px-3 sm:px-4 pt-1.5 pb-2.5 backdrop-blur-md shadow-lg shadow-black/30 transition-colors duration-500 ${
          urgent
            ? "border-amber-400/80 bg-amber-950/80"
            : showScore
              ? "border-primary/60 bg-black/55"
              : "border-white/15 bg-black/45"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {showScore ? (
            <motion.span key="score" aria-hidden className="flex items-center gap-2" {...swap}>
              <span className="hidden lg:block max-w-24 truncate text-[10px] font-black uppercase tracking-wide text-on-surface-variant">
                {score.homeName}
              </span>
              <span className="shrink-0 font-headline font-black tabular-nums leading-none text-xl text-on-surface">
                <span key={`h${score.home}`} className="score-pop inline-block">{score.home}</span>
                <span className="mx-1.5 text-primary">–</span>
                <span key={`a${score.away}`} className="score-pop inline-block">{score.away}</span>
              </span>
              <span className="hidden lg:block max-w-24 truncate text-[10px] font-black uppercase tracking-wide text-on-surface-variant">
                {score.awayName}
              </span>
              <span className="hidden min-[400px]:block min-w-0 truncate text-[9px] font-black uppercase tracking-widest leading-none text-primary">
                {breakLabel}
              </span>
            </motion.span>
          ) : (
            <motion.span key="time" aria-hidden className="flex min-w-0 max-w-full items-center gap-2" {...swap}>
              {isPlayingMatch && !isHalftime && liveMinute >= 1 && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${urgent ? "bg-amber-400" : "bg-red-500"}`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${urgent ? "bg-amber-400" : "bg-red-500"}`} />
                </span>
              )}
              <span className={`shrink-0 font-headline font-black tabular-nums leading-none text-xl ${urgent ? "text-amber-400" : "text-on-surface"}`}>
                {time}
              </span>
              <span className="min-w-0 text-[9px] font-black uppercase tracking-widest leading-none text-on-surface/70 truncate">
                {shortPhase}
              </span>
            </motion.span>
          )}
        </AnimatePresence>
        {showBar && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <span
              className={`block h-full transition-[width] duration-1000 ease-linear ${urgent ? "bg-amber-400" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
            {total === 90 && <span className="absolute left-1/2 top-0 h-full w-px bg-white/40" />}
          </span>
        )}
      </span>
    </div>
  );
}
