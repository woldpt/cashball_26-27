/**
 * Corpo do artigo do Jornal: texto com entidades clicáveis, parágrafos em
 * registo de imprensa clássica e o cromo do detalhe (faixa + metadados).
 */
import { FILTER_TONES, LINK_CLS, TITLE_LINK_CLS } from "./tones.js";
import { formatGroupLabel, highlightText, splitPartsByParagraphs, teamFromRef } from "./utils.jsx";

/** A capitular exige uma entrada com algum fôlego — em avisos de uma linha
 * ficaria desproporcional. */
export const LEAD_MIN_CHARS = 140;

/**
 * Texto de notícia com entidades clicáveis + suporte a parágrafos.
 * @param {{ parts?: Array, fallback?: string, teams: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function, bareLinks?: boolean, query?: string }} props
 * @returns {JSX.Element|string}
 */
export function RichNewsText({
  parts,
  fallback = "",
  teams,
  onOpenTeamSquad,
  onOpenPlayerHistory,
  bareLinks = false,
  query = "",
}) {
  const linkCls = bareLinks ? TITLE_LINK_CLS : LINK_CLS;
  const highlight = (value) =>
    query ? highlightText(value, query) : value;
  if (!Array.isArray(parts)) return highlight(fallback);
  return parts.map((part, index) => {
    const key = `${part.type}-${part.id ?? index}`;
    if (part.type === "player") {
      return (
        <button
          key={key}
          type="button"
          className={linkCls}
          onClick={() => onOpenPlayerHistory?.(part)}
        >
          {part.label}
        </button>
      );
    }
    if (part.type === "team") {
      const team = teamFromRef(teams, part);
      return (
        <button
          key={key}
          type="button"
          className={linkCls}
          onClick={() => team?.id && onOpenTeamSquad?.(team)}
          disabled={!team?.id || !onOpenTeamSquad}
        >
          {part.label}
        </button>
      );
    }
    return <span key={key} className={part.bold ? "font-black" : undefined}>{highlight(part.value)}</span>;
  });
}

/**
 * Corpo da notícia partido em parágrafos visíveis, em registo de imprensa
 * clássica: o primeiro parágrafo é a entrada (maior, com capitular na cor
 * da categoria) e os restantes correm em corpo uniforme.
 * @param {{ parts?: Array, fallback?: string, teams: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function, category?: string, noLead?: boolean, query?: string }} props
 * @returns {JSX.Element}
 */
export function RichParagraphs({
  parts,
  fallback = "",
  teams,
  onOpenTeamSquad,
  onOpenPlayerHistory,
  category,
  noLead,
  query = "",
}) {
  const cap = (FILTER_TONES[category] || FILTER_TONES.all).cap;
  const bodyCls =
    "text-base short:text-sm leading-relaxed whitespace-pre-line text-left text-on-surface";
  const leadCls = `text-lg short:text-base leading-relaxed whitespace-pre-line text-left first-letter:float-left first-letter:mr-2 first-letter:mt-1.5 first-letter:text-6xl first-letter:font-black first-letter:leading-[0.8] ${cap}`;
  const paragraphs =
    Array.isArray(parts) && parts.length > 0
      ? splitPartsByParagraphs(parts)
      : [];
  if (paragraphs.length === 0) {
    const longEnough = !noLead && String(fallback ?? "").length >= LEAD_MIN_CHARS;
    return <p className={longEnough ? leadCls : bodyCls}>{query ? highlightText(fallback, query) : fallback}</p>;
  }
  return (
    <div className="space-y-4">
      {paragraphs.map((paraParts, i) => {
        // Sem separadores na medição (o join com " " contava espaços que
        // não existem) e sem capitular quando o parágrafo abre com uma
        // entidade (o `first-letter` não a apanha).
        const text = paraParts
          .map((p) =>
            typeof p.value === "string" ? p.value : (p.label ?? ""),
          )
          .join("");
        const startsWithText = paraParts[0]?.type === "text";
        const isLead =
          !noLead && i === 0 && startsWithText && text.length >= LEAD_MIN_CHARS;
        return (
          <p key={i} className={isLead ? leadCls : bodyCls}>
            <RichNewsText
              parts={paraParts}
              fallback={fallback}
              teams={teams}
              onOpenTeamSquad={onOpenTeamSquad}
              onOpenPlayerHistory={onOpenPlayerHistory}
              query={query}
            />
          </p>
        );
      })}
    </div>
  );
}

/**
 * Barra lateral de cor por categoria — acento visual no painel de detalhe.
 * @param {{ category?: string, urgent?: boolean }} props
 * @returns {JSX.Element}
 */
export function CategoryAccentBar({ category, urgent }) {
  const tone = FILTER_TONES[category] || FILTER_TONES.all;
  return (
    <div
      className={`absolute left-0 top-0 bottom-0 w-1 ${urgent ? "bg-error" : tone.bar} rounded-l-md`}
      aria-hidden
    />
  );
}

/**
 * Metadados do artigo — só categoria e data. O selo «Ação necessária» vive
 * no painel de ação das pendências, para não aparecer duas vezes.
 * @param {{ item?: object, catLabel?: string }} props
 * @returns {JSX.Element}
 */
export function ArticleMeta({ item, catLabel }) {
  if (!item) return null;
  const tone = FILTER_TONES[item.cat] || FILTER_TONES.all;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-black uppercase tracking-widest">
      <span className={`flex items-center gap-1 ${tone.cap}`}>
        <span aria-hidden className="material-symbols-outlined text-[16px]">{tone.icon}</span>
        {catLabel || item.cat}
      </span>
      {item.date && <span className="text-on-surface-variant tabular-nums">{formatGroupLabel(item.date)}</span>}
    </div>
  );
}
