/**
 * LiveClock.jsx — chip único do relógio do jogo no header.
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
 * @param {boolean} props.isCupMatch Se é jogo da taça.
 * @param {boolean} props.cupPreMatch Se ainda está em pré-jogo da taça.
 * @param {string} props.cupMatchRoundName Nome da ronda da taça.
 * @param {boolean} props.cupExtraTimeBadge Se está em prolongamento na taça.
 * @returns {import("react").ReactElement|null} Pill do relógio ou `null`.
 */
export function LiveClock({
  liveMinute,
  isPlayingMatch,
  isCupMatch,
  cupPreMatch,
  cupMatchRoundName,
  cupExtraTimeBadge,
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
    time = "⏸";
    shortPhase = "Intervalo";
    longPhase = "intervalo";
  } else {
    return null;
  }

  const ariaLabel =
    isPlayingMatch && liveMinute >= 1
      ? `Minuto ${liveMinute}, ${longPhase}`
      : `Jogo ${longPhase}`;

  return (
    <div className="absolute left-1/2 -translate-x-1/2 max-w-[38vw] pointer-events-none">
      <span
        role="timer"
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-outline-variant/50 max-w-full"
      >
        <span
          aria-hidden
          className="text-sm font-headline font-black tabular-nums leading-none text-on-surface shrink-0"
        >
          {time}
        </span>
        <span
          aria-hidden
          className="text-[9px] font-bold uppercase tracking-widest leading-none text-on-surface opacity-70 truncate"
        >
          {shortPhase}
        </span>
      </span>
    </div>
  );
}
