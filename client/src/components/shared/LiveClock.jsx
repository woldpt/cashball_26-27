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
 * @param {{home: number, away: number, homeName?: string, awayName?: string}|null} [props.score] Resultado do meu jogo (some sem jogo).
 * @returns {import("react").ReactElement|null} Pill do relógio ou `null`.
 */
export function LiveClock({
  liveMinute,
  isPlayingMatch,
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
  const ariaFull = score
    ? `${score.homeName ?? "Casa"} ${score.home}, ${score.awayName ?? "Fora"} ${score.away}. ${ariaLabel}`
    : ariaLabel;

  // Urgência: últimos 15' do tempo regulamentar (75'+) e do
  // prolongamento (110'+) — fora disso o relógio fica quieto.
  const urgent =
    isPlayingMatch &&
    (liveMinute >= 110 || (liveMinute >= 75 && liveMinute <= 90));

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 max-w-[38vw] pointer-events-none ${urgent ? "liveclock-urgent" : ""}`}>
      <span
        role="timer"
        aria-label={ariaFull}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border max-w-full ${urgent ? "border-amber-400 bg-amber-950" : "bg-surface border-outline-variant/50"}`}
      >
        {score && (
          <>
            <span aria-hidden className="hidden lg:block max-w-28 truncate text-[10px] font-black uppercase tracking-wide text-on-surface-variant">
              {score.homeName}
            </span>
            <span aria-hidden className="shrink-0 font-headline font-black tabular-nums leading-none text-base text-on-surface">
              <span key={`h${score.home}`} className="score-pop inline-block">{score.home}</span>
              <span className="mx-1 text-on-surface-variant/50">–</span>
              <span key={`a${score.away}`} className="score-pop inline-block">{score.away}</span>
            </span>
            <span aria-hidden className="hidden lg:block max-w-28 truncate text-[10px] font-black uppercase tracking-wide text-on-surface-variant">
              {score.awayName}
            </span>
            <span aria-hidden className="h-4 w-px bg-outline-variant/50 shrink-0" />
          </>
        )}
        <span
          aria-hidden
          className={`text-sm font-headline font-black tabular-nums leading-none ${urgent ? "text-amber-400" : "text-on-surface"} shrink-0`}
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
