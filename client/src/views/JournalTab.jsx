/**
 * JournalTab — a caixa de entrada do treinador (hub estilo CM2001).
 *
 * Tópicos à esquerda e detalhe à direita no desktop, uma só linha de filtros:
 * Todas, O Meu Clube, Competições, Plantel, Mercado. A notícia mais antiga
 * por ler fica seleccionada e a lista tem «Ler próxima».
 *
 * Os pedidos de renovação e os convites de clubes entram como linhas com
 * bandeira vermelha 🚩 e bloqueiam o Pronto até serem respondidos. As
 * respostas reutilizam os fluxos existentes (diálogo do agente, emits).
 */
import { useEffect, useRef, useState } from "react";
import { useInbox } from "../hooks/useInbox.js";
import { formatCurrency } from "../utils/formatters.js";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Button } from "../components/shared/Button.jsx";
import { PlayerAvatar } from "../components/shared/PlayerAvatar.jsx";
import { TeamCrest } from "../components/live/TeamCrest.jsx";

const FILTERS = ["all", "club", "competitions", "squad", "market"];

function searchText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const FILTER_TONES = {
  all: {
    idle: "bg-surface-container-high/40 text-on-surface-variant hover:bg-surface-container-high",
    active: "bg-surface-container-high text-on-surface",
    row: "bg-surface-container/40 hover:bg-surface-container-high",
    selected: "bg-surface-container-high/80 ring-1 ring-inset ring-outline-variant/50",
  },
  club: {
    idle: "bg-amber-500/10 text-amber-300/80 hover:bg-amber-500/20",
    active: "bg-amber-500/25 text-amber-200",
    row: "bg-amber-500/10 hover:bg-amber-500/15",
    selected: "bg-amber-500/20 ring-1 ring-inset ring-amber-400/40",
  },
  competitions: {
    idle: "bg-sky-500/10 text-sky-300/80 hover:bg-sky-500/20",
    active: "bg-sky-500/25 text-sky-200",
    row: "bg-sky-500/10 hover:bg-sky-500/15",
    selected: "bg-sky-500/20 ring-1 ring-inset ring-sky-400/40",
  },
  squad: {
    idle: "bg-emerald-500/10 text-emerald-300/80 hover:bg-emerald-500/20",
    active: "bg-emerald-500/25 text-emerald-200",
    row: "bg-emerald-500/10 hover:bg-emerald-500/15",
    selected: "bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/40",
  },
  market: {
    idle: "bg-violet-500/10 text-violet-300/80 hover:bg-violet-500/20",
    active: "bg-violet-500/25 text-violet-200",
    row: "bg-violet-500/10 hover:bg-violet-500/15",
    selected: "bg-violet-500/20 ring-1 ring-inset ring-violet-400/40",
  },
};

function teamFromRef(teams, ref) {
  return teams.find((team) => String(team.id) === String(ref?.id)) || ref;
}

/**
 * Texto de notícia com entidades clicáveis.
 * @param {{ parts?: Array, fallback?: string, teams: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function }} props
 */
function RichNewsText({
  parts,
  fallback = "",
  teams,
  onOpenTeamSquad,
  onOpenPlayerHistory,
}) {
  if (!Array.isArray(parts)) return fallback;
  return parts.map((part, index) => {
    const key = `${part.type}-${part.id ?? index}`;
    if (part.type === "player") {
      const content = (
        <button
          type="button"
          className="font-black text-primary underline decoration-primary/40 underline-offset-2 hover:text-on-surface"
          onClick={() => onOpenPlayerHistory?.(part)}
        >
          {part.label}
        </button>
      );
      return <span key={key}>{content}</span>;
    }
    if (part.type === "team") {
      const team = teamFromRef(teams, part);
      return (
        <button
          key={key}
          type="button"
          className="font-black text-primary underline decoration-primary/40 underline-offset-2 hover:text-on-surface"
          onClick={() => team?.id && onOpenTeamSquad?.(team)}
          disabled={!team?.id || !onOpenTeamSquad}
        >
          {part.label}
        </button>
      );
    }
    return <span key={key}>{part.value}</span>;
  });
}

/**
 * Imagens editoriais do artigo seleccionado.
 * @param {{ media?: object, teams: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function }} props
 */
function NewsMedia({ media, teams, onOpenTeamSquad, onOpenPlayerHistory }) {
  if (!media?.player && !media?.teams?.length) return null;
  const transferFrom = media.transfer?.from;
  const transferTo = media.transfer?.to;
  const isTransfer = Boolean(media.transfer);
  const renderTransferTeam = (ref, label) => {
    if (!ref) return null;
    const team = teamFromRef(teams, ref);
    return (
      <button
        key={`${label}-${ref.id}`}
        type="button"
        aria-label={`${label}: ${ref.label}`}
        className="flex min-w-20 max-w-32 flex-col items-center gap-1 rounded-sm border border-outline-variant/20 bg-surface-container-low px-2 py-1 text-center hover:bg-surface-container-high"
        onClick={() => team?.id && onOpenTeamSquad?.(team)}
        disabled={!team?.id || !onOpenTeamSquad}
      >
        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        <TeamCrest team={team} size="sm" />
        <span className="w-full truncate text-[10px] font-black text-primary">
          {ref.label}
        </span>
      </button>
    );
  };

  return (
    <div
      className={`mt-2 flex items-center justify-center ${
        isTransfer ? "flex-col gap-2" : "flex-wrap gap-3"
      }`}
    >
      {media.player && (
        <button
          type="button"
          className="flex items-center gap-2 rounded-sm border border-outline-variant/20 bg-surface-container-low px-2 py-1 text-left hover:bg-surface-container-high"
          onClick={() => onOpenPlayerHistory?.(media.player)}
        >
          <PlayerAvatar
            seed={media.player.id}
            position={media.player.position}
            photo={media.player.photo}
            size="mdR"
          />
          <span className="max-w-32 truncate text-[10px] font-black text-primary">
            {media.player.label}
          </span>
        </button>
      )}
      {isTransfer ? (
        <div
          className="flex items-center justify-center gap-2"
          aria-label="Percurso da transferência"
        >
          {renderTransferTeam(transferFrom, "Origem")}
          {transferFrom && transferTo && (
            <span
              aria-hidden="true"
              className="text-xl font-black leading-none text-tertiary"
            >
              →
            </span>
          )}
          {renderTransferTeam(transferTo, "Destino")}
        </div>
      ) : (
        media.teams?.map((ref) => {
          const team = teamFromRef(teams, ref);
          return (
            <button
              key={ref.id}
              type="button"
              className="flex items-center gap-2 rounded-sm border border-outline-variant/20 bg-surface-container-low px-2 py-1 text-left hover:bg-surface-container-high"
              onClick={() => team?.id && onOpenTeamSquad?.(team)}
              disabled={!team?.id || !onOpenTeamSquad}
            >
              <TeamCrest team={team} size="sm" />
              <span className="max-w-32 truncate text-[10px] font-black text-primary">
                {ref.label}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

/**
 * Botões de ação por tipo de notícia.
 * @param {{ item: object, inbox: object, onOpenCupBracket?: Function }} props
 */
function InboxActions({ item, inbox, onOpenCupBracket }) {
  if (!item) return null;
  if (item.kind === "contract") {
    return (
      <Button
        variant="danger"
        size="sm"
        onClick={() => inbox.answerContract(item.ref)}
      >
        Responder ao agente
      </Button>
    );
  }
  if (item.kind === "job") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {item.extra && (
          <p className="w-full text-[11px] text-on-surface-variant">
            {item.extra.position}.º · {item.extra.points} pts ·{" "}
            {item.extra.record}
          </p>
        )}
        <Button variant="success" size="sm" onClick={() => inbox.answerJobOffer(true)}>
          Aceitar
        </Button>
        <Button variant="secondary" size="sm" onClick={() => inbox.answerJobOffer(false)}>
          Recusar
        </Button>
      </div>
    );
  }
  if (item.kind === "board") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {item.extra && (
          <p className="w-full text-[11px] text-on-surface-variant">
            Orçamento: {formatCurrency(item.extra.budget)} ·{" "}
            {item.extra.streak} semana
            {item.extra.streak === 1 ? "" : "s"} no vermelho
          </p>
        )}
        <Button variant="primary" size="sm" onClick={inbox.ackBoard}>
          Ok, lido
        </Button>
      </div>
    );
  }
  if (item.kind === "cupdraw") {
    return (
      <Button variant="accent" size="sm" onClick={() => onOpenCupBracket?.()}>
        Ver quadro da Taça
      </Button>
    );
  }
  return null;
}

export function JournalTab({
  teams = [],
  onOpenTeamSquad,
  onOpenPlayerHistory,
  onOpenCupBracket,
}) {
  const inbox = useInbox();
  const { selected, isUnread, select } = inbox;
  const initialReadRef = useRef(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (initialReadRef.current || !selected) return;
    initialReadRef.current = true;
    if (!selected.redFlag && isUnread(selected)) {
      select(selected.id);
    }
  }, [isUnread, select, selected]);

  const categoryItems =
    filter === "all"
      ? inbox.items
      : inbox.items.filter((it) => it.cat === filter);
  const query = searchText(search.trim());
  const visible = query
    ? categoryItems.filter((item) =>
        searchText(`${item.title} ${item.body}`).includes(query),
      )
    : categoryItems;
  const labelOf = (id) =>
    inbox.cats.find((c) => c.id === id)?.label || id;
  const hasUnreadNonFlag = inbox.items.some(
    (item) => !item.redFlag && inbox.isUnread(item),
  );
  const tabBtn = (id) => {
    const tone = FILTER_TONES[id] || FILTER_TONES.all;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setFilter(id);
          setSearch("");
        }}
        aria-pressed={filter === id}
        className={`shrink-0 px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${
          filter === id ? tone.active : tone.idle
        }`}
      >
        {labelOf(id)}
      </button>
    );
  };

  return (
    <div className="space-y-2 short:space-y-1.5 lg:flex lg:min-h-[calc(100dvh-var(--header-h)-3rem)] lg:flex-col">
      {/* ── Barra de título ─────────────────────────────────────────── */}
      <div className="rounded-sm bg-surface-container border border-outline-variant/20 px-3 py-2 short:py-1.5 flex items-center justify-between gap-2">
        <h1 className="min-w-0 truncate font-headline text-base short:text-sm font-black uppercase tracking-tight text-tertiary">
          Jornal do Clube
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          {inbox.redFlags > 0 && (
            <span className="rounded-sm bg-error-container px-1.5 py-0.5 text-[10px] font-black text-on-error-container uppercase tracking-widest">
              🚩 {inbox.redFlags}
            </span>
          )}
          {inbox.unreadCount > 0 && (
            <span className="rounded-sm bg-surface-container-high border border-outline-variant/25 px-1.5 py-0.5 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
              {inbox.unreadCount} nova
              {inbox.unreadCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {inbox.redFlags > 0 && (
        <p className="rounded-sm border border-error/40 bg-error/10 px-3 py-1.5 text-[11px] font-bold text-error">
          🚩 Tens assuntos por resolver — o Pronto fica bloqueado até
          responderes.
        </p>
      )}

      {/* ── Filtros (uma só linha) ──────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Filtrar notícias"
        className="flex gap-px overflow-x-auto rounded-sm bg-surface-container-low border border-outline-variant/20"
      >
        {FILTERS.map(tabBtn)}
      </div>

      <div className="grid gap-2 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-stretch">
        <section aria-label="Tópicos" className="min-w-0 space-y-2 rounded-sm bg-surface-container/40 p-2 lg:flex lg:min-h-0 lg:flex-col">
          <div className="rounded-sm bg-surface-container-high/50 px-2 py-1.5">
            <label htmlFor="journal-topic-search" className="sr-only">
              Pesquisar notícias
            </label>
            <input
              id="journal-topic-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar notícias..."
              className="w-full bg-transparent text-xs font-bold text-on-surface outline-none placeholder:text-on-surface-variant/70"
            />
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
                : `Nada em ${labelOf(filter)}.`
          }
        />
      ) : (
        <ol className="max-h-64 short:max-h-44 overflow-y-auto rounded-sm border border-outline-variant/20 bg-surface-container-low divide-y divide-outline-variant/15 lg:max-h-none lg:min-h-0 lg:flex-1">
          {visible.map((it) => {
            const active = inbox.selected?.id === it.id;
            const unread = inbox.isUnread(it);
            const tone = FILTER_TONES[it.cat] || FILTER_TONES.all;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => inbox.select(it.id)}
                  aria-current={active}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                    active
                      ? `${tone.selected} ${it.redFlag ? "ring-error/70" : ""}`
                      : it.redFlag
                        ? "bg-error/10 hover:bg-error/15"
                        : tone.row
                  }`}
                >
                  <span className="w-24 short:w-20 shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                    {it.date}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-xs ${
                      unread
                        ? "font-black text-on-surface"
                        : "font-medium text-on-surface-variant"
                    }`}
                  >
                    {it.title}
                  </span>
                  {unread && !active && (
                    <span
                      aria-label="Não lida"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* ── Próxima notícia por ler ─────────────────────────────────── */}
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
        </section>

        <section aria-label="Corpo da notícia" className="min-w-0 space-y-2 lg:flex lg:min-h-0 lg:flex-col">
          {/* ── Detalhe ──────────────────────────────────────────────── */}
      {inbox.selected && (
        <section
          aria-live="polite"
          className="rounded-sm border border-outline-variant/20 bg-surface-container px-3 py-2.5 short:py-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
        >
          <h2 className="text-center font-headline text-base short:text-sm font-black tracking-tight text-tertiary">
            <RichNewsText
              parts={inbox.selected.titleParts}
              fallback={inbox.selected.title.replace(/^🚩\s*/, "")}
              teams={teams}
              onOpenTeamSquad={onOpenTeamSquad}
              onOpenPlayerHistory={onOpenPlayerHistory}
            />
          </h2>
          <NewsMedia
            media={inbox.selected.media}
            teams={teams}
            onOpenTeamSquad={onOpenTeamSquad}
            onOpenPlayerHistory={onOpenPlayerHistory}
          />
          {inbox.selected.body && (
            <p className="mt-1.5 whitespace-pre-line text-center font-serif text-base short:text-sm leading-relaxed text-on-surface">
              <RichNewsText
                parts={inbox.selected.bodyParts}
                fallback={inbox.selected.body}
                teams={teams}
                onOpenTeamSquad={onOpenTeamSquad}
                onOpenPlayerHistory={onOpenPlayerHistory}
              />
            </p>
          )}
          <div className="mt-2.5 flex justify-center">
            <InboxActions item={inbox.selected} inbox={inbox} onOpenCupBracket={onOpenCupBracket} />
          </div>
        </section>
      )}

        </section>
      </div>
    </div>
  );
}
