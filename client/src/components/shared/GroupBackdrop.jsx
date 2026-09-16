import { getTabGroupId } from "../../constants/navigation.js";

/* Uma foto livre (Unsplash) por tab, servida de /backgrounds em WebP leve.
   Carregada só ao visitar a tab (o navegador guarda em cache); ver
   `.group-backdrop` em index.css para o tratamento escuro + desfocado. */
const TAB_BG = {
  live: "/backgrounds/live.webp",
  standings: "/backgrounds/standings.webp",
  bracket: "/backgrounds/bracket.webp",
  cup: "/backgrounds/cup.webp",
  calendario: "/backgrounds/calendario.webp",
  club: "/backgrounds/club.webp",
  jornal: "/backgrounds/jornal.webp",
  finances: "/backgrounds/finances.webp",
  stadium: "/backgrounds/stadium.webp",
  players: "/backgrounds/players.webp",
  squad: "/backgrounds/squad.webp",
  training: "/backgrounds/training.webp",
  tactic: "/backgrounds/tactic.webp",
  market: "/backgrounds/market.webp",
  leiloes: "/backgrounds/leiloes.webp",
  scout: "/backgrounds/scout.webp",
  user_settings: "/backgrounds/user_settings.webp",
};

// Recurso para tabs sem foto própria (não deve acontecer — o mapa cobre
// todas as de `GameRoutes`, mas o custo é uma linha).
const GROUP_FALLBACK = {
  jornal: "jornal",
  gestao: "club",
  competicao: "live",
  transferencias: "market",
};

/**
 * Fundo fotográfico da tab ativa: escuro e ligeiramente desfocado para
 * embelezar sem tirar leitura ao conteúdo. Puramente visual —
 * `aria-hidden` e sem interceção de cliques.
 *
 * @param {{ tabKey?: string|null }} props
 */
export function GroupBackdrop({ tabKey }) {
  const key =
    TAB_BG[tabKey] != null
      ? tabKey
      : (GROUP_FALLBACK[getTabGroupId(tabKey)] ?? "club");
  return (
    <div
      aria-hidden
      className="group-backdrop pointer-events-none absolute inset-0 -z-20"
    >
      <img
        key={key}
        src={TAB_BG[key]}
        alt=""
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}
