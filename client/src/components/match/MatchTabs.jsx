/* ── MatchTabs — Orchestrator ────────────────────────────────────────────
 *
 * Re-exporta todas as tabs e componentes partilhados.
 * A lógica de cada tab está nos ficheiros de tabs/ e shared/.
 *
 * Estrutura:
 *   tabs/
 *     TabJogo.jsx          ← eventos, posse, narração, pitch do nosso time
 *     TabLineup.jsx        ← home vs away lineups
 *     TabAdversario.jsx    ← pitch + bench adversário
 *     TabIntervencao.jsx   ← substituições / gestão
 *     MatchIntervencaoView.jsx ← 3-col unified view
 *   shared/
 *     PitchFormation.jsx   ← SVG pitch + formação
 *     BenchPlayers.jsx     ← lista de suplentes
 *     PossessionBar.jsx    ← barra de posse
 *     EventCard.jsx        ← card de evento
 *     RefWeatherBar.jsx    ← info estádio/árbitro/clima
 *     TacticsButtons.jsx   ← botões mentalidade
 *     ConfirmedSubsStrip.jsx ← strip subs confirmados
 *     PlayerCard.jsx       ← card de jogador com stats
 */

/* ── Tabs ─────────────────────────────────────────────────────────────── */
export {
  TabJogo,
  TabLineup,
  TabAdversario,
  TabIntervencao,
  MatchIntervencaoView,
} from "./tabs/index.js";

/* eslint-disable react-refresh/only-export-components */
/* ── Shared constants (re-exported for tab compatibility) ─────────────── */
export { POS_STYLES, getPosStyle, POS_ORDER } from "./matchConstants.js";
