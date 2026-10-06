/**
 * Caixa de entrada do Jornal: lista agrupada por semana e épocas antigas.
 * A pesquisa e as ações («Próxima por ler», «Marcar tudo como lido») vivem
 * na barra do `TransferHeader`; «Ler próxima» também no artigo.
 */
import { EmptyState } from "../../components/shared/EmptyState.jsx";
import { Button } from "../../components/shared/Button.jsx";
import { FILTER_TONES } from "./tones.js";
import { flagSummary, formatGroupLabel, getSnippet, highlightText } from "./utils.jsx";

/**
 * @param {{
 *   inbox: object,
 *   selected?: object|null,
 *   visible: Array,
 *   query: string,
  *   onSelectItem?: Function,
 *   onPreviewItem?: Function
 * }} props
 * @returns {JSX.Element}
 */
export function TopicList({
  inbox,
  selected,
  visible,
  query,
  onSelectItem,
  onPreviewItem,
}) {
  // Setas/j/k movem foco e seleção sem marcar como lida (só o clique e o
  // Enter marcam). Roving tabindex: o Tab entra pelo item ativo.
  const activeId = selected?.id ?? visible[0]?.id;
  const handleListKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    const down = key === "ArrowDown" || key === "j";
    const up = key === "ArrowUp" || key === "k";
    if (!down && !up) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll("button"),
    );
    const idx = buttons.indexOf(document.activeElement);
    if (idx === -1) return;
    event.preventDefault();
    const next = down
      ? Math.min(buttons.length - 1, idx + 1)
      : Math.max(0, idx - 1);
    const id = visible[next]?.id;
    if (id) onPreviewItem?.(id);
    buttons[next]?.focus();
  };
  return (
    <section aria-label="Tópicos" className="min-w-0 space-y-2 rounded-md bg-surface-container/40 p-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      {/* ── Lista ───────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <EmptyState
          icon="newspaper"
          title={query ? "Nenhuma notícia encontrada" : "Sem notícias"}
          description={
            query
              ? "Tenta outro termo de pesquisa."
              : "Ainda não há notícias nesta época."
          }
        />
      ) : (
        <ol onKeyDown={handleListKeyDown} className="lg:overflow-y-auto rounded-md border border-outline-variant/20 bg-surface-container-low divide-y divide-outline-variant/15 lg:min-h-0 lg:flex-1">
          {visible.map((it, i) => {
            const active = selected?.id === it.id;
            const unread = inbox.isUnread(it);
            const tone = FILTER_TONES[it.cat] || FILTER_TONES.all;
            const snippet = getSnippet(it.body);
            const flagLine = it.redFlag ? flagSummary(it) : "";
            const sub = flagLine || snippet;
            // Cabeçalho de grupo quando a semana muda (a data é «S5/2026»).
            const newGroup = i === 0 || visible[i - 1].date !== it.date;

            return (
              <li key={it.id}>
                {newGroup && (
                  <div className="lg:sticky lg:top-0 z-10 border-b border-outline-variant/15 bg-surface-container px-2 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    {formatGroupLabel(it.date)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onSelectItem?.(it.id)}
                  aria-current={active}
                  tabIndex={it.id === activeId ? 0 : -1}
                  className={`flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors ${
                    active
                      ? `${tone.selected} ${it.redFlag ? "ring-error/70 ring-1" : ""}`
                      : it.redFlag
                        ? "bg-error/10 hover:bg-error/15"
                        : "hover:bg-surface-container-high"
                  }`}
                >
                  {/* Ícone da categoria, ou bandeira nas pendências */}
                  <span
                    aria-hidden
                    className={`material-symbols-outlined mt-px shrink-0 text-[18px] ${
                      it.redFlag ? "text-error flag-pulse" : `${tone.cap} ${unread || active ? "" : "opacity-50"}`
                    }`}
                  >
                    {it.redFlag ? "flag" : tone.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm short:text-xs ${
                        unread
                          ? "font-black text-on-surface"
                          : "font-medium text-on-surface-variant"
                      }`}
                    >
                      {it.redFlag && <span className="sr-only">Ação necessária: </span>}
                      {query && !flagLine
                        ? highlightText(it.title, query)
                        : it.title}
                    </span>
                    {sub && (
                      <p
                        className={`mt-0.5 truncate text-xs short:text-[10px] ${flagLine ? "font-bold text-error/90" : "text-on-surface-variant/70"}`}
                      >
                        {query && !flagLine
                          ? highlightText(sub, query)
                          : sub}
                      </p>
                    )}
                  </div>
                  {unread && !active && (
                    <span
                      aria-label="Não lida"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {inbox.hasOlderSeasons && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={inbox.showOlderSeason}
          >
            Mostrar época {inbox.newsYears[inbox.visibleYears.length] ?? "anterior"} ↓
          </Button>
        </div>
      )}
    </section>
  );
}
