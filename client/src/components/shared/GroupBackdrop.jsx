import { getTabGroupId } from "../../constants/navigation.js";

/* Fotos livres (Unsplash, licença gratuita): noite/holofotes (jornal),
   Bernabéu de dia (gestao), estádio à noite (competicao), linha de
   relva (transferencias). Servidas de /backgrounds em WebP leve. */
const GROUP_BG = {
  jornal: "/backgrounds/jornal.webp",
  gestao: "/backgrounds/gestao.webp",
  competicao: "/backgrounds/competicao.webp",
  transferencias: "/backgrounds/transferencias.webp",
};

// Tabs sem grupo (pré-jogo) usam o fundo de competição.
const TAB_OVERRIDE = { tactic: "competicao", squad: "competicao" };

/**
 * Fundo fotográfico por grupo de navegação: escuro e ligeiramente
 * desfocado (ver `.group-backdrop` em index.css) para embelezar sem
 * tirar leitura ao conteúdo. Puramente visual — `aria-hidden` e sem
 * interceção de cliques. Escondido no jogo ao vivo (`hidden`).
 *
 * @param {{ tabKey?: string|null, hidden?: boolean }} props
 */
export function GroupBackdrop({ tabKey, hidden = false }) {
  if (hidden) return null;
  const group = TAB_OVERRIDE[tabKey] ?? getTabGroupId(tabKey) ?? "gestao";
  return (
    <div
      aria-hidden
      className="group-backdrop pointer-events-none absolute inset-0 -z-20"
    >
      {Object.entries(GROUP_BG).map(([id, src]) => (
        <img
          key={id}
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          className={id === group ? "is-active" : undefined}
        />
      ))}
    </div>
  );
}
