/**
 * Tons e classes partilhadas do Jornal (cores por categoria, links,
 * tabelas). Sem lógica — só constantes.
 */

export const FILTER_TONES = {
  all: {
    icon: "newspaper",
    selected: "bg-surface-container-high/80 ring-1 ring-inset ring-outline-variant/50",
    bar: "bg-on-surface-variant/40",
    badge: "neutral",
    dot: "bg-on-surface-variant/40",
    cap: "text-on-surface",
  },
  club: {
    icon: "shield",
    selected: "bg-amber-500/20 ring-1 ring-inset ring-amber-400/40",
    bar: "bg-amber-500",
    badge: "warning",
    dot: "bg-amber-400",
    cap: "text-amber-300",
  },
  competitions: {
    icon: "emoji_events",
    selected: "bg-sky-500/20 ring-1 ring-inset ring-sky-400/40",
    bar: "bg-sky-500",
    badge: "cooldown",
    dot: "bg-sky-400",
    cap: "text-sky-300",
  },
  squad: {
    icon: "groups",
    selected: "bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/40",
    bar: "bg-emerald-500",
    badge: "sold",
    dot: "bg-emerald-400",
    cap: "text-emerald-300",
  },
  market: {
    icon: "swap_horiz",
    selected: "bg-violet-500/20 ring-1 ring-inset ring-violet-400/40",
    bar: "bg-violet-500",
    badge: "junior",
    dot: "bg-violet-400",
    cap: "text-violet-300",
  },
};

/** Tinta simples para links de entidades no título: sem pílula (em corpo
 * grande dominava a manchete). */
export const TITLE_LINK_CLS =
  "font-black text-primary hover:text-on-surface transition-colors";

/** Link de entidade clicável (jogador/equipa) no corpo das notícias: pílula
 * com fundo ténue em vez de sublinhado nu — o `px-1` garante que nunca cola
 * às margens e o `box-decoration-break` mantém a pílula legível quando parte
 * em quebra de linha. `font-bold` (não `black`) para o corpo não pesar. */
export const LINK_CLS =
  "rounded-sm bg-primary/10 px-1 font-bold text-primary [box-decoration-break:clone] hover:bg-primary/20 hover:text-on-surface transition-colors";

/** Invólucro, tabela e cabeçalho das tabelas do Jornal (Taça, classificação). */
export const TABLE_WRAP_CLS =
  "mt-3 overflow-x-auto rounded-sm border border-outline-variant/20";
export const TABLE_CLS =
  "mx-auto w-full max-w-md border-collapse text-sm tabular-nums text-on-surface";
/** Classificação: ocupa a largura toda da coluna (tabelas curtas usam TABLE_CLS). */
export const TABLE_CLS_WIDE =
  "mx-auto w-full border-collapse text-sm tabular-nums text-on-surface";
export const THEAD_ROW_CLS =
  "bg-surface-container-high/60 text-[10px] font-black uppercase tracking-widest text-on-surface-variant";
