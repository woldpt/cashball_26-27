/**
 * Coluna de tópicos do Jornal: pesquisa, lista de notícias e atalhos de
 * leitura («Marcar tudo como lido», «Ler próxima», épocas antigas).
 */
import { EmptyState } from "../../components/shared/EmptyState.jsx";
import { Button } from "../../components/shared/Button.jsx";
import { Badge } from "../../components/shared/Badge.jsx";
import { FILTER_TONES } from "./tones.js";
import { flagSummary, getSnippet, highlightText } from "./utils.jsx";

/**
 * @param {{
 *   inbox: object,
 *   selected?: object|null,
 *   visible: Array,
 *   query: string,
 *   search: string,
 *   onSearchChange?: Function,
 *   filter: string,
 *   filterLabel?: string,
 *   onSelectItem?: Function,
 *   onPreviewItem?: Function,
 *   hasUnreadNonFlag?: boolean
 * }} props
 * @returns {JSX.Element}
 */
export function TopicList({
  inbox,
  selected,
  visible,
  query,
  search,
  onSearchChange,
  filter,
  filterLabel,
  onSelectItem,
  onPreviewItem,
  hasUnreadNonFlag,
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
    <section aria-label="Tópicos" className="min-w-0 space-y-2 rounded-sm bg-surface-container/40 p-2 lg:flex lg:min-h-0 lg:flex-col">
      <div className="rounded-sm bg-surface-container-high/50 px-2 py-1.5 transition-colors focus-within:bg-surface-container-high">
        <label htmlFor="journal-topic-search" className="sr-only">
          Pesquisar notícias
        </label>
        <input
          id="journal-topic-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Pesquisar notícias (jogadores, equipas)…"
          className="w-full bg-transparent text-xs font-bold text-on-surface outline-none placeholder:text-on-surface-variant/70"
        />
        {query && (
          <p className="mt-1 text-[9px] font-bold text-on-surface-variant">
            {visible.length} resultado{visible.length !== 1 ? "s" : ""} para{" "}
            <span className="text-on-surface font-black">{search.trim()}</span>
          </p>
        )}
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <EmptyState
          emoji="📰"
          title={query ? "Nenhuma notícia encontrada" : "Sem notícias"}
          description={
            query
              ? "Tenta outro termo de pesquisa."
              : filter === "all"
                ? "Ainda não há notícias nesta época."
                : `Nada em ${filterLabel}.`
          }
        />
      ) : (
        <ol onKeyDown={handleListKeyDown} className="max-h-64 short:max-h-44 overflow-y-auto rounded-sm border border-outline-variant/20 bg-surface-container-low divide-y divide-outline-variant/15 lg:max-h-none lg:min-h-0 lg:flex-1">
          {visible.map((it) => {
            const active = selected?.id === it.id;
            const unread = inbox.isUnread(it);
            const tone = FILTER_TONES[it.cat] || FILTER_TONES.all;
            const snippet = getSnippet(it.body);
            const flagLine = it.redFlag ? flagSummary(it) : "";
            const sub = flagLine || snippet;

            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem?.(it.id)}
                  aria-current={active}
                  tabIndex={it.id === activeId ? 0 : -1}
                  className={`flex w-full items-start gap-2 px-2 py-1.5 text-left transition-colors ${
                    active
                      ? `${tone.selected} ${it.redFlag ? "ring-error/70 ring-1" : ""}`
                      : it.redFlag
                        ? "bg-error/10 hover:bg-error/15"
                        : tone.row
                  }`}
                >
                  {/* Faixa lateral: categoria, ou error sempre visível nas pendências */}
                  <div
                    className={`mt-0.5 h-4 w-1 shrink-0 rounded-full transition-opacity ${it.redFlag ? "bg-error opacity-100 flag-pulse" : `${tone.bar} ${active ? "opacity-100" : "opacity-0"}`}`}
                    aria-hidden
                  />
                  <span className="w-20 short:w-16 shrink-0 truncate text-[10px] font-bold text-on-surface-variant tabular-nums">
                    {it.date}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {it.redFlag && (
                        <Badge variant="error" size="sm" title="Ação necessária">
                          Ação necessária
                        </Badge>
                      )}
                      <span
                        className={`min-w-0 truncate text-xs ${
                          unread
                            ? "font-black text-on-surface"
                            : "font-medium text-on-surface-variant"
                        }`}
                      >
                        {query && !flagLine
                          ? highlightText(it.title, query)
                          : it.title}
                      </span>
                    </div>
                    {sub && (
                      <p
                        className={`mt-0.5 truncate text-[10px] ${flagLine ? "font-bold text-error/90" : "text-on-surface-variant/70"}`}
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
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* ── Próxima notícia por ler ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inbox.markAllRead()}
          disabled={!hasUnreadNonFlag}
        >
          Marcar tudo como lido
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={inbox.selectNextUnread}
          disabled={!inbox.hasNextUnread}
        >
          Ler próxima
        </Button>
      </div>
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
