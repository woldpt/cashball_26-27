/**
 * breakpoints.js — fonte única de verdade dos breakpoints de viewport.
 *
 * Centraliza as larguras/alturas que separam os modos de layout do jogo
 * (desktop sidebar / mobile portrait bottom-nav / mobile landscape rail).
 * Os hooks em `hooks/useIsMobile.js` constroem os seus `matchMedia` a partir
 * daqui — os literais (767, 768, 519, 520, …) nunca devem ser repetidos em
 * JS. O CSS do Tailwind (md/lg e a variante `short`) usa os mesmos valores
 * por convenção; a paridade é verificada por `scripts/breakpointParityRegression.mjs`.
 *
 * ⚠️ Se alterares um valor aqui, altera também:
 *   - Tailwind `@theme`/`@custom-variant` em `index.css`
 *   - os comentários dos hooks em `useIsMobile.js`
 * e corre o script de paridade.
 */

/** Larguras de ecrã (px). Valores são *inclusive* no lower bound do modo. */
export const BREAKPOINTS = {
  /** `md` do Tailwind — abaixo disto é "mobile" na semântica dos hooks (768). */
  md: 768,
  /** `lg` do Tailwind — a partir daqui entra a sidebar desktop (1024). */
  lg: 1024,
};

/** Alturas de ecrã (px). `*Below` = upper-bound do modo curto. */
export const HEIGHTS = {
  /** `short` (index.css): compactação vertical de modais/cards (<= 560). */
  short: 560,
  /** Altura mínima para o layout desktop exigir (>= 520). */
  compact: 520,
};

/** `compactBelow`/`shortBelow`/`lgBelow`: limites "abaixo de" p/ media queries. */
export const BREAKPOINT_LIMITS = {
  /** matchMedia `(max-width: …)` para `md` — `mdBelow = md - 1`. */
  mdBelow: BREAKPOINTS.md - 1,
  /** matchMedia `(max-width: …)` para `lg`. */
  lgBelow: BREAKPOINTS.lg - 1,
  /** matchMedia `(max-height: …)` para `short`. */
  shortBelow: HEIGHTS.short,
  /** matchMedia `(max-height: …)` para landscape curto. */
  compactBelow: HEIGHTS.compact - 1,
};

/**
 * Compõe uma media query a partir de um operador (ex. `"max-width"`) e de um
 * valor em px. Serve para derivar as strings dos hooks sem duplicar números.
 *
 * @param {"min-width"|"max-width"|"min-height"|"max-height"} feature
 * @param {number} px
 * @returns {string} Ex.: `"(max-width: 767px)"`.
 */
export function mediaQuery(feature, px) {
  return `(${feature}: ${px}px)`;
}
