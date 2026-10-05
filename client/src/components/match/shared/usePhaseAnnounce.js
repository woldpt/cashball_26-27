import { useEffect, useRef, useState } from "react";

/* ── Anúncio de fase no placar do hero ───────────────────────────────────
 *
 * Devolve o rótulo da fase acabada de começar ("1ª PARTE" ao sair do 0',
 * "2ª PARTE" aos 45', "PROLONGAMENTO" no 91') durante HOLD_MS, ou null.
 * O placar do LiveMatchHero usa-o para animar o centro do marcador.
 */

const HOLD_MS = 2200;

export function usePhaseAnnounce(liveMinute, isPlayingMatch) {
  const [label, setLabel] = useState(null);
  const sawZeroRef = useRef(false);
  const announcedRef = useRef(null);

  useEffect(() => {
    if (!isPlayingMatch) return;
    let next = null;
    if (liveMinute === 0) {
      sawZeroRef.current = true;
      announcedRef.current = null;
    } else if (liveMinute === 45) next = "2ª PARTE";
    // 91 e não 90: aos 90 todos os jogos param (apito final no campeonato).
    else if (liveMinute === 91) next = "PROLONGAMENTO";
    else if (sawZeroRef.current && liveMinute > 0 && liveMinute < 45) next = "1ª PARTE";

    if (!next || announcedRef.current === next) return;
    announcedRef.current = next;
    setLabel(next);
    setTimeout(() => setLabel(null), HOLD_MS);
  }, [liveMinute, isPlayingMatch]);

  return label;
}
