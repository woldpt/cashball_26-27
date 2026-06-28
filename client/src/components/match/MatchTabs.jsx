/* ── MatchTabs — Orchestrator ────────────────────────────────────────────
 *
 * Re-exporta todas as tabs e componentes partilhados.
 * A lógica de cada tab está nos ficheiros de tabs/ e shared/.
 *
 * Estrutura:
 *   tabs/
 *     MatchView.jsx           ← vista principal 2 colunas (narrativa + pitch)
 *     IntervencaoView.jsx     ← substituições + cronologia + adversário
 *   shared/
 *     MatchPlayerCard.jsx     ← card de jogador (sempre expandido)
 *     PitchFormation.jsx      ← SVG pitch + formação
 *     BenchPlayers.jsx         ← lista de suplentes
 *     PossessionBar.jsx       ← barra de posse
 *     EventCard.jsx           ← card de evento
 *     RefWeatherBar.jsx        ← info estádio/árbitro/clima
 *     TacticsButtons.jsx      ← botões mentalidade
 *     ConfirmedSubsStrip.jsx  ← strip subs confirmados
 */

/* ── Tabs ─────────────────────────────────────────────────────────────── */
export {
  MatchView,
  IntervencaoView,
} from "./tabs/index.js";

/* eslint-disable react-refresh/only-export-components */
/* ── Shared constants (re-exported for tab compatibility) ─────────────── */
export {
  POS_STYLES,
  getPosStyle,
  POS_ORDER,
  PITCH_POS_COLORS,
  MATCH_EVENT_TYPES,
  sortPlayersByPos,
  filterMatchEvents,
  buildPositionRows,
} from "./matchConstants.js";