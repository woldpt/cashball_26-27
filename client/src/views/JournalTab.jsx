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
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useInbox } from "../hooks/useInbox.js";
import { formatCurrency } from "../utils/formatters.js";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Button } from "../components/shared/Button.jsx";
import { Badge } from "../components/shared/Badge.jsx";
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
    bar: "bg-amber-500",
    badge: "warning",
    dot: "bg-amber-400",
  },
  competitions: {
    idle: "bg-sky-500/10 text-sky-300/80 hover:bg-sky-500/20",
    active: "bg-sky-500/25 text-sky-200",
    row: "bg-sky-500/10 hover:bg-sky-500/15",
    selected: "bg-sky-500/20 ring-1 ring-inset ring-sky-400/40",
    bar: "bg-sky-500",
    badge: "info",
    dot: "bg-sky-400",
  },
  squad: {
    idle: "bg-emerald-500/10 text-emerald-300/80 hover:bg-emerald-500/20",
    active: "bg-emerald-500/25 text-emerald-200",
    row: "bg-emerald-500/10 hover:bg-emerald-500/15",
    selected: "bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/40",
    bar: "bg-emerald-500",
    badge: "injured",
    dot: "bg-emerald-400",
  },
  market: {
    idle: "bg-violet-500/10 text-violet-300/80 hover:bg-violet-500/20",
    active: "bg-violet-500/25 text-violet-200",
    row: "bg-violet-500/10 hover:bg-violet-500/15",
    selected: "bg-violet-500/20 ring-1 ring-inset ring-violet-400/40",
    bar: "bg-violet-500",
    badge: "junior",
    dot: "bg-violet-400",
  },
};

const CATEGORY_EMOJIS = {
  all: "📰",
  club: "⚽",
  competitions: "🏆",
  squad: "👥",
  market: "💰",
};

function teamFromRef(teams, ref) {
  return teams.find((team) => String(team.id) === String(ref?.id)) || ref;
}

/**
 * Estima o tempo de leitura em minutos (1 min ≈ 230 palavras).
 */
function estimateReadTime(text) {
  if (!text) return "1 min";
  const words = String(text).split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 230));
  return `${mins} min`;
}

/**
 * Formata a data relativa (ex: "há 2 dias", "hoje", "amanhã").
 * A data vem no formato "S5/2026" — como não temos a data real,
 * mantemos o formato original mas com melhor apresentação.
 */
function formatDateRelative(dateStr) {
  return dateStr || "";
}

/**
 * Extrai o snippet do corpo (primeiros 80 chars).
 */
function getSnippet(body) {
  if (!body) return "";
  const clean = body.replace(/\n/g, " ");
  return clean.length > 80 ? clean.slice(0, 80) + "…" : clean;
}

/**
 * Destaca um termo de pesquisa num texto, envolvido em <mark>.
 */
function highlightText(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-tertiary/30 text-on-surface rounded px-0.5 font-black"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/**
 * Parte uma lista de parts em parágrafos com base em separadores "\n\n".
 * Cada texto que contém "\n\n" é dividido e os segmentos resultantes
 * ficam em parágrafos separados.
 */
function splitPartsByParagraphs(parts) {
  const paragraphs = [[]];
  for (const part of parts) {
    if (part.type === "text" && typeof part.value === "string" && part.value.includes("\n\n")) {
      const segments = part.value.split("\n\n");
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg || paragraphs[paragraphs.length - 1].length > 0) {
          paragraphs[paragraphs.length - 1].push({ ...part, value: seg });
        }
        if (i < segments.length - 1) {
          paragraphs.push([]);
        }
      }
    } else {
      paragraphs[paragraphs.length - 1].push(part);
    }
  }
  return paragraphs.filter((p) => p.length > 0);
}

/**
 * Texto de notícia com entidades clicáveis + suporte a parágrafos.
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
          className="font-black text-primary underline decoration-primary/40 underline-offset-2 hover:text-on-surface transition-colors"
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
          className="font-black text-primary underline decoration-primary/40 underline-offset-2 hover:text-on-surface transition-colors"
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
 * Corpo da notícia partido em parágrafos visíveis.
 * @param {{ parts?: Array, fallback?: string, teams: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function }} props
 */
function RichParagraphs({
  parts,
  fallback = "",
  teams,
  onOpenTeamSquad,
  onOpenPlayerHistory,
}) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return (
      <p className="font-serif text-base short:text-sm leading-relaxed text-on-surface">
        {fallback}
      </p>
    );
  }
  const paragraphs = splitPartsByParagraphs(parts);
  if (paragraphs.length === 0) {
    return (
      <p className="font-serif text-base short:text-sm leading-relaxed text-on-surface">
        {fallback}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {paragraphs.map((paraParts, i) => (
        <p
          key={i}
          className="font-serif text-base short:text-sm leading-relaxed text-on-surface"
        >
          <RichNewsText
            parts={paraParts}
            fallback={fallback}
            teams={teams}
            onOpenTeamSquad={onOpenTeamSquad}
            onOpenPlayerHistory={onOpenPlayerHistory}
          />
        </p>
      ))}
    </div>
  );
}

/**
 * Barra de progresso de leitura — preenche conforme o utilizador scrola
 * o painel de detalhe.
 */
function ReadingProgressBar({ containerRef }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const pct = scrollHeight > clientHeight
        ? scrollTop / (scrollHeight - clientHeight)
        : 0;
      setProgress(Math.min(1, Math.max(0, pct)) * 100);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high/50">
      <motion.div
        className="h-full bg-primary"
        style={{ width: `${progress}%` }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        aria-hidden
      />
    </div>
  );
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
        className="flex min-w-20 max-w-32 flex-col items-center gap-1 rounded-sm border border-outline-variant/20 bg-surface-container-low px-2 py-1 text-center hover:bg-surface-container-high transition-colors"
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
          className="flex items-center gap-2 rounded-sm border border-outline-variant/20 bg-surface-container-low px-2 py-1 text-left hover:bg-surface-container-high transition-colors"
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
              className="flex items-center gap-2 rounded-sm border border-outline-variant/20 bg-surface-container-low px-2 py-1 text-left hover:bg-surface-container-high transition-colors"
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
 * Tabela da classificação final (notícia `league_final`, linhas em `rows`).
 * Nomes clicáveis com o mesmo comportamento das entidades do corpo.
 * @param {{ rows?: Array, teams: Array, onOpenTeamSquad?: Function }} props
 * @returns {JSX.Element|null}
 */
function LeagueFinalTable({ rows, teams, onOpenTeamSquad }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <div className="mt-2 overflow-x-auto rounded-sm border border-outline-variant/20">
      <table className="w-full max-w-md border-collapse text-sm text-on-surface">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-on-surface-variant bg-surface-container-high/60">
            <th className="px-2 py-1.5 text-right">#</th>
            <th className="px-2 py-1.5 text-left">Equipa</th>
            <th className="px-2 py-1.5 text-right">J</th>
            <th className="px-2 py-1.5 text-right">V</th>
            <th className="px-2 py-1.5 text-right">E</th>
            <th className="px-2 py-1.5 text-right">D</th>
            <th className="px-2 py-1.5 text-right">GM</th>
            <th className="px-2 py-1.5 text-right">GS</th>
            <th className="px-2 py-1.5 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = teamFromRef(teams, { id: r.id, label: r.name });
            const isChampion = i === 0;
            return (
              <tr
                key={r.id ?? r.pos}
                className={`border-t border-outline-variant/15 transition-colors hover:bg-surface-container/20 ${
                  isChampion
                    ? "bg-tertiary/10 font-black"
                    : i % 2 === 1
                      ? "bg-surface-container/15"
                      : ""
                }`}
              >
                <td className="px-2 py-1.5 text-right text-on-surface-variant">
                  {isChampion ? "🏆" : r.pos}
                </td>
                <td className="px-2 py-1.5 text-left">
                  <button
                    type="button"
                    className={`font-black text-primary underline decoration-primary/40 underline-offset-2 hover:text-on-surface transition-colors ${
                      isChampion ? "text-tertiary" : ""
                    }`}
                    onClick={() => team?.id && onOpenTeamSquad?.(team)}
                    disabled={!team?.id || !onOpenTeamSquad}
                  >
                    {r.name}
                  </button>
                </td>
                <td className="px-2 py-1.5 text-right">{r.j}</td>
                <td className="px-2 py-1.5 text-right">{r.v}</td>
                <td className="px-2 py-1.5 text-right">{r.e}</td>
                <td className="px-2 py-1.5 text-right">{r.d}</td>
                <td className="px-2 py-1.5 text-right">{r.gf}</td>
                <td className="px-2 py-1.5 text-right">{r.gs}</td>
                <td className="px-2 py-1.5 text-right font-black">{r.p}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    const busy = !!item.extra?.answering;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {busy && (
          <p className="w-full text-[11px] font-bold text-on-surface-variant">
            A falar com o agente…
          </p>
        )}
        <Button
          variant="success"
          size="sm"
          disabled={busy}
          onClick={() => inbox.answerContract(item.ref, true)}
        >
          Aceitar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          title="Se recusares, o jogador vai a leilão"
          onClick={() => inbox.answerContract(item.ref, false)}
        >
          Recusar
        </Button>
      </div>
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

/**
 * Barra lateral de cor por categoria — acento visual no painel de detalhe.
 */
function CategoryAccentBar({ category }) {
  const tone = FILTER_TONES[category] || FILTER_TONES.all;
  return (
    <div
      className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar} rounded-l-sm`}
      aria-hidden
    />
  );
}

/**
 * Metadados do artigo — categoria, data e tempo de leitura.
 */
function ArticleMeta({ item }) {
  const catLabel = item ? (
    <Badge variant={FILTER_TONES[item.cat]?.badge || "neutral"} size="sm">
      {CATEGORY_EMOJIS[item.cat] || "📰"} {item.cat}
    </Badge>
  ) : null;
  const readTime = item ? estimateReadTime(item.body) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-on-surface-variant">
      {catLabel}
      {item?.date && (
        <span className="flex items-center gap-1">
          📅 {formatDateRelative(item.date)}
        </span>
      )}
      {readTime && (
        <span className="flex items-center gap-1">
          ⏱ {readTime} de leitura
        </span>
      )}
    </div>
  );
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
  const [searchFocused, setSearchFocused] = useState(false);
  const detailRef = useRef(null);
  const listRef = useRef(null);

  // Seleção automática da primeira não lida ao montar
  useEffect(() => {
    if (initialReadRef.current || !selected) return;
    initialReadRef.current = true;
    if (!selected.redFlag && isUnread(selected)) {
      select(selected.id);
    }
  }, [isUnread, select, selected]);

  // Atalhos de teclado: Enter = próxima não lida, Esc = limpar seleção
  const handleKeyDown = useCallback(
    (e) => {
      if (searchFocused && e.key !== "Escape") return;
      if (e.key === "Escape") {
        if (selected) select(null);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (inbox.hasNextUnread) {
          inbox.selectNextUnread();
        }
      }
    },
    [searchFocused, selected, select, inbox],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const categoryItems =
    filter === "all"
      ? inbox.items
      : inbox.items.filter((it) => it.cat === filter);

  const query = searchText(search.trim());
  const visible = query
    ? categoryItems.filter((item) => {
        const searchTextBody = searchText(
          `${item.title} ${item.body} ${item.media?.player?.label || ""} ${
            (item.media?.teams || []).map((t) => t.label).join(" ")
          }`,
        );
        return searchTextBody.includes(query);
      })
    : categoryItems;

  const labelOf = (id) => inbox.cats.find((c) => c.id === id)?.label || id;
  const hasUnreadNonFlag = inbox.items.some(
    (item) => !item.redFlag && inbox.isUnread(item),
  );

  // Animação de entrada para a notícia selecionada (highlight de nova)
  const selectedId = selected?.id;

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
        {/* ── Coluna esquerda: Tópicos ───────────────────────────────── */}
        <section aria-label="Tópicos" className="min-w-0 space-y-2 rounded-sm bg-surface-container/40 p-2 lg:flex lg:min-h-0 lg:flex-col">
          <div className={`rounded-sm bg-surface-container-high/50 px-2 py-1.5 transition-colors ${searchFocused ? "bg-surface-container-high" : ""}`}>
            <label htmlFor="journal-topic-search" className="sr-only">
              Pesquisar notícias
            </label>
            <input
              id="journal-topic-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
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
                    : `Nada em ${labelOf(filter)}.`
              }
            />
          ) : (
            <ol
              ref={listRef}
              className="max-h-64 short:max-h-44 overflow-y-auto rounded-sm border border-outline-variant/20 bg-surface-container-low divide-y divide-outline-variant/15 lg:max-h-none lg:min-h-0 lg:flex-1"
            >
              <AnimatePresence initial={false}>
                {visible.map((it) => {
                  const active = inbox.selected?.id === it.id;
                  const unread = inbox.isUnread(it);
                  const tone = FILTER_TONES[it.cat] || FILTER_TONES.all;
                  const snippet = getSnippet(it.body);
                  const isNew = active && unread;

                  return (
                    <motion.li
                      key={it.id}
                      initial={isNew ? { opacity: 0, x: -20 } : false}
                      animate={isNew ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                      layout
                    >
                      <button
                        type="button"
                        onClick={() => inbox.select(it.id)}
                        aria-current={active}
                        className={`flex w-full items-start gap-2 px-2 py-1.5 text-left transition-colors ${
                          active
                            ? `${tone.selected} ${it.redFlag ? "ring-error/70 ring-1" : ""}`
                            : it.redFlag
                              ? "bg-error/10 hover:bg-error/15"
                              : tone.row
                        }`}
                      >
                        {/* Barra lateral de cor por categoria */}
                        <div
                          className={`mt-0.5 h-4 w-1 shrink-0 rounded-full ${tone.bar} ${active ? "opacity-100" : "opacity-0"} transition-opacity`}
                          aria-hidden
                        />
                        <span className="w-20 short:w-16 shrink-0 truncate text-[10px] font-bold text-on-surface-variant tabular-nums">
                          {it.date}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {it.redFlag && (
                              <span className="text-[10px]" aria-label="Prioridade">
                                🚩
                              </span>
                            )}
                            <span
                              className={`min-w-0 truncate text-xs ${
                                unread
                                  ? "font-black text-on-surface"
                                  : "font-medium text-on-surface-variant"
                              }`}
                            >
                              {query
                                ? highlightText(it.title, query)
                                : it.title}
                            </span>
                          </div>
                          {snippet && (
                            <p className="mt-0.5 truncate text-[10px] text-on-surface-variant/70">
                              {query
                                ? highlightText(snippet, query)
                                : snippet}
                            </p>
                          )}
                        </div>
                        {unread && !active && (
                          <span
                            aria-label="Não lida"
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone.dot} animate-pulse`}
                          />
                        )}
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
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

        {/* ── Coluna direita: Detalhe do artigo ──────────────────────── */}
        <section aria-label="Corpo da notícia" className="min-w-0 space-y-2 lg:flex lg:min-h-0 lg:flex-col">
          <AnimatePresence mode="wait">
            {inbox.selected && (
              <motion.section
                key={selectedId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                aria-live="polite"
                ref={detailRef}
                className="relative rounded-sm border border-outline-variant/20 bg-surface-container px-3 py-2.5 short:py-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col overflow-y-auto"
              >
                {/* Barra de progresso de leitura */}
                <ReadingProgressBar containerRef={detailRef} />

                {/* Acento lateral de cor por categoria */}
                <CategoryAccentBar category={inbox.selected.cat} />

                {/* Metadados: categoria, data, tempo de leitura */}
                <ArticleMeta item={inbox.selected} />

                {/* Título */}
                <h2 className="mt-1.5 font-headline text-base short:text-sm font-black tracking-tight text-tertiary text-left">
                  <RichNewsText
                    parts={inbox.selected.titleParts}
                    fallback={inbox.selected.title.replace(/^🚩\s*/, "")}
                    teams={teams}
                    onOpenTeamSquad={onOpenTeamSquad}
                    onOpenPlayerHistory={onOpenPlayerHistory}
                  />
                </h2>

                {/* Media (jogador/equipa/transferência) */}
                <NewsMedia
                  media={inbox.selected.media}
                  teams={teams}
                  onOpenTeamSquad={onOpenTeamSquad}
                  onOpenPlayerHistory={onOpenPlayerHistory}
                />

                {/* Corpo do artigo (parágrafos visíveis) */}
                {inbox.selected.body && (
                  <RichParagraphs
                    parts={inbox.selected.bodyParts}
                    fallback={inbox.selected.body}
                    teams={teams}
                    onOpenTeamSquad={onOpenTeamSquad}
                    onOpenPlayerHistory={onOpenPlayerHistory}
                  />
                )}

                {/* Tabela de classificação final */}
                {inbox.selected.newsType === "league_final" && (
                  <LeagueFinalTable
                    rows={inbox.selected.facts?.rows}
                    teams={teams}
                    onOpenTeamSquad={onOpenTeamSquad}
                  />
                )}

                {/* Botões de ação */}
                <div className="mt-3">
                  <InboxActions
                    item={inbox.selected}
                    inbox={inbox}
                    onOpenCupBracket={onOpenCupBracket}
                  />
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Estado vazio quando não há seleção */}
          {!inbox.selected && (
            <EmptyState
              emoji="👈"
              title="Seleciona uma notícia"
              description="Escolhe um tópico na lista para ler o artigo completo."
            />
          )}
        </section>
      </div>
    </div>
  );
}
