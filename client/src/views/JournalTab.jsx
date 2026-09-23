/**
 * JournalTab — a caixa de entrada do treinador (hub estilo CM2001).
 *
 * Tópicos à esquerda e detalhe à direita no desktop, uma só linha de filtros:
 * Todas, O Meu Clube, Competições, Plantel, Mercado. A notícia mais antiga
 * por ler fica seleccionada (sem a marcar como lida) e a lista tem
 * «Ler próxima». Só o clique na linha, o «Ler próxima» ou o Enter/Espaço
 * marcam como lida.
 *
 * Os pedidos de renovação e os convites de clubes entram como linhas com
 * bandeira vermelha 🚩 e bloqueiam o Pronto até serem respondidos. As
 * respostas reutilizam os fluxos existentes (diálogo do agente, emits).
 *
 * O detalhe segue registo de imprensa clássica: manchete em tinta forte,
 * entrada com capitular, filetes a separar corpo e ações.
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
import { PostMatchPitch } from "../components/shared/PostMatchPitch.jsx";

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
    bar: "bg-on-surface-variant/40",
    badge: "neutral",
    dot: "bg-on-surface-variant/40",
    cap: "text-on-surface",
  },
  club: {
    idle: "bg-amber-500/10 text-amber-300/80 hover:bg-amber-500/20",
    active: "bg-amber-500/25 text-amber-200",
    row: "bg-amber-500/10 hover:bg-amber-500/15",
    selected: "bg-amber-500/20 ring-1 ring-inset ring-amber-400/40",
    bar: "bg-amber-500",
    badge: "warning",
    dot: "bg-amber-400",
    cap: "text-amber-300",
  },
  competitions: {
    idle: "bg-sky-500/10 text-sky-300/80 hover:bg-sky-500/20",
    active: "bg-sky-500/25 text-sky-200",
    row: "bg-sky-500/10 hover:bg-sky-500/15",
    selected: "bg-sky-500/20 ring-1 ring-inset ring-sky-400/40",
    bar: "bg-sky-500",
    badge: "cooldown",
    dot: "bg-sky-400",
    cap: "text-sky-300",
  },
  squad: {
    idle: "bg-emerald-500/10 text-emerald-300/80 hover:bg-emerald-500/20",
    active: "bg-emerald-500/25 text-emerald-200",
    row: "bg-emerald-500/10 hover:bg-emerald-500/15",
    selected: "bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/40",
    bar: "bg-emerald-500",
    badge: "sold",
    dot: "bg-emerald-400",
    cap: "text-emerald-300",
  },
  market: {
    idle: "bg-violet-500/10 text-violet-300/80 hover:bg-violet-500/20",
    active: "bg-violet-500/25 text-violet-200",
    row: "bg-violet-500/10 hover:bg-violet-500/15",
    selected: "bg-violet-500/20 ring-1 ring-inset ring-violet-400/40",
    bar: "bg-violet-500",
    badge: "junior",
    dot: "bg-violet-400",
    cap: "text-violet-300",
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
 * Extrai o snippet do corpo (primeiros 80 chars).
 */
function getSnippet(body) {
  if (!body) return "";
  const clean = body.replace(/\n/g, " ");
  return clean.length > 80 ? clean.slice(0, 80) + "…" : clean;
}

/**
 * Destaca o termo pesquisado com <mark>. O match é insensível a acentos
 * e caixa (como o filtro, que usa `searchText`), mas pinta o texto
 * original. Sem regex: índice normalizado -> índice original, porque os
 * acentos mudam o comprimento da string.
 */
function highlightText(text, query) {
  const original = String(text ?? "");
  const needle = searchText(query).trim();
  if (!needle) return original;
  const normChars = [];
  const indexMap = [];
  for (let i = 0; i < original.length; i++) {
    const norm = searchText(original[i]);
    for (let j = 0; j < norm.length; j++) {
      normChars.push(norm[j]);
      indexMap.push(i);
    }
  }
  const haystack = normChars.join("");
  const out = [];
  let pos = 0;
  let key = 0;
  for (;;) {
    const found = haystack.indexOf(needle, pos);
    if (found === -1) break;
    const start = indexMap[found];
    const end = indexMap[found + needle.length - 1] + 1;
    if (start > pos) out.push(original.slice(pos, start));
    out.push(
      <mark
        key={key++}
        className="bg-tertiary/30 text-on-surface rounded px-0.5 font-black"
      >
        {original.slice(start, end)}
      </mark>,
    );
    pos = end;
  }
  if (pos === 0) return original;
  out.push(original.slice(pos));
  return out;
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
    return <span key={key} className={part.bold ? "font-black" : undefined}>{part.value}</span>;
  });
}

/**
 * Corpo da notícia partido em parágrafos visíveis, em registo de imprensa
 * clássica: o primeiro parágrafo é a entrada (maior, com capitular na cor
 * da categoria) e os restantes correm em corpo uniforme. A capitular exige
 * uma entrada com algum fôlego — em avisos de uma linha ficaria
 * desproporcional.
 * @param {{ parts?: Array, fallback?: string, teams: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function, category?: string }} props
 */
const LEAD_MIN_CHARS = 140;

function RichParagraphs({
  parts,
  fallback = "",
  teams,
  onOpenTeamSquad,
  onOpenPlayerHistory,
  category,
  noLead,
}) {
  const cap = (FILTER_TONES[category] || FILTER_TONES.all).cap;
  const bodyCls =
    "font-newsreader text-base short:text-sm leading-relaxed whitespace-pre-line text-justify text-on-surface";
  const leadCls = `font-newsreader text-lg short:text-base leading-relaxed whitespace-pre-line text-justify first-letter:float-left first-letter:mr-2 first-letter:mt-1.5 first-letter:font-newsreader first-letter:text-6xl first-letter:font-black first-letter:leading-[0.8] ${cap}`;
  if (!Array.isArray(parts) || parts.length === 0) {
    const longEnough = !noLead && String(fallback ?? "").length >= LEAD_MIN_CHARS;
    return <p className={longEnough ? leadCls : bodyCls}>{fallback}</p>;
  }
  const paragraphs = splitPartsByParagraphs(parts);
  if (paragraphs.length === 0) {
    const longEnough = !noLead && String(fallback ?? "").length >= LEAD_MIN_CHARS;
    return <p className={longEnough ? leadCls : bodyCls}>{fallback}</p>;
  }
  return (
    <div className="space-y-4">
      {paragraphs.map((paraParts, i) => {
        const text = paraParts
          .map((p) =>
            typeof p.value === "string" ? p.value : (p.label ?? ""),
          )
          .join(" ");
        const isLead = !noLead && i === 0 && text.length >= LEAD_MIN_CHARS;
        return (
          <p key={i} className={isLead ? leadCls : bodyCls}>
            <RichNewsText
              parts={paraParts}
              fallback={fallback}
              teams={teams}
              onOpenTeamSquad={onOpenTeamSquad}
              onOpenPlayerHistory={onOpenPlayerHistory}
            />
          </p>
        );
      })}
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
    <div className="sticky top-0 z-10 bg-surface-container pb-1.5">
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high/50">
        <motion.div
          className="h-full bg-primary"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          aria-hidden
        />
      </div>
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
        className="flex min-w-24 max-w-36 flex-col items-center gap-1.5 rounded border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-center shadow-sm shadow-black/30 hover:bg-surface-container-high transition-colors"
        onClick={() => team?.id && onOpenTeamSquad?.(team)}
        disabled={!team?.id || !onOpenTeamSquad}
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        <TeamCrest team={team} size="md" />
        <span className="w-full truncate text-xs font-black text-primary">
          {ref.label}
        </span>
      </button>
    );
  };

  return (
    <div
      className={`mt-3 flex items-center justify-center ${
        isTransfer ? "flex-col gap-2" : "flex-wrap gap-3"
      }`}
    >
      {media.player && (
        <button
          type="button"
          className="flex items-center gap-3 rounded border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-left shadow-sm shadow-black/30 hover:bg-surface-container-high transition-colors"
          onClick={() => onOpenPlayerHistory?.(media.player)}
        >
          <PlayerAvatar
            seed={media.player.id}
            position={media.player.position}
            photo={media.player.photo}
            size="md"
          />
          <span className="max-w-40 truncate text-xs font-black text-primary">
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
              className="flex items-center gap-3 rounded border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-left shadow-sm shadow-black/30 hover:bg-surface-container-high transition-colors"
              onClick={() => team?.id && onOpenTeamSquad?.(team)}
              disabled={!team?.id || !onOpenTeamSquad}
            >
              <TeamCrest team={team} size="md" />
              <span className="max-w-40 truncate text-xs font-black text-primary">
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
    <div className="mt-3 overflow-x-auto rounded-sm border border-outline-variant/20">
      <table className="w-full max-w-md border-collapse text-sm tabular-nums text-on-surface">
        <thead>
          <tr className="bg-surface-container-high/60 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
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
 * Tabela do sorteio da Taça: pares por ordem do sorteio, equipas clicáveis,
 * o jogo do treinador marcado com 📍 e tinta dourada.
 * @param {{ fixtures?: Array, viewerTeamId?: number|string|null, teams: Array, onOpenTeamSquad?: Function }} props
 * @returns {JSX.Element|null}
 */
function CupDrawTable({ fixtures, viewerTeamId, teams, onOpenTeamSquad }) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) return null;
  const vId = viewerTeamId == null ? null : String(viewerTeamId);
  const teamCell = (id, label, mine) => {
    const team = teamFromRef(teams, { id, label });
    return (
      <td className={`px-2 py-1.5 text-left ${mine ? "font-black" : ""}`}>
        <button
          type="button"
          className={`font-black text-primary underline decoration-primary/40 underline-offset-2 hover:text-on-surface transition-colors ${
            mine ? "text-tertiary" : ""
          }`}
          onClick={() => team?.id && onOpenTeamSquad?.(team)}
          disabled={!team?.id || !onOpenTeamSquad}
        >
          {label}
        </button>
      </td>
    );
  };
  return (
    <div className="mt-3 overflow-x-auto rounded-sm border border-outline-variant/20">
      <table className="w-full max-w-md border-collapse text-sm tabular-nums text-on-surface">
        <thead>
          <tr className="bg-surface-container-high/60 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            <th className="px-2 py-1.5 text-right">Jogo</th>
            <th className="px-2 py-1.5 text-left">Casa</th>
            <th className="px-2 py-1.5 text-left">Fora</th>
          </tr>
        </thead>
        <tbody>
          {fixtures.map((f, i) => {
            const mine =
              vId != null &&
              (String(f.homeTeamId) === vId || String(f.awayTeamId) === vId);
            return (
              <tr
                key={i}
                className={`border-t border-outline-variant/15 transition-colors hover:bg-surface-container/20 ${
                  mine
                    ? "bg-tertiary/15"
                    : i % 2 === 1
                      ? "bg-surface-container/15"
                      : ""
                }`}
              >
                <td className="px-2 py-1.5 text-right text-on-surface-variant">
                  {mine ? "📍" : i + 1}
                </td>
                {teamCell(f.homeTeamId, f.homeName, mine)}
                {teamCell(f.awayTeamId, f.awayName, mine)}
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
function ArticleMeta({ item, catLabel }) {
  const badge = item ? (
    <Badge variant={FILTER_TONES[item.cat]?.badge || "neutral"} size="sm">
      {CATEGORY_EMOJIS[item.cat] || "📰"} {catLabel || item.cat}
    </Badge>
  ) : null;
  const readTime = item ? estimateReadTime(item.body) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-on-surface-variant">
      {badge}
      {item?.date && (
        <span className="flex items-center gap-1">
          📅 {item.date}
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
  const { selected, selectNextUnread } = inbox;
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const detailRef = useRef(null);

  // Atalho de teclado: Enter/Espaço fora de controlos = próxima não lida.
  // Dentro de botões/links/inputs o teclado comporta-se nativamente
  // (senão o Espaço no "Aceitar" saltava de notícia em vez de aceitar).
  const handleKeyDown = useCallback(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(
          "button, a, input, select, textarea, [role='button'], [contenteditable]",
        )
      )
        return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectNextUnread();
      }
    },
    [selectNextUnread],
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
          <div className="rounded-sm bg-surface-container-high/50 px-2 py-1.5 transition-colors focus-within:bg-surface-container-high">
            <label htmlFor="journal-topic-search" className="sr-only">
              Pesquisar notícias
            </label>
            <input
              id="journal-topic-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
            <ol className="max-h-64 short:max-h-44 overflow-y-auto rounded-sm border border-outline-variant/20 bg-surface-container-low divide-y divide-outline-variant/15 lg:max-h-none lg:min-h-0 lg:flex-1">
                {visible.map((it) => {
                  const active = inbox.selected?.id === it.id;
                  const unread = inbox.isUnread(it);
                  const tone = FILTER_TONES[it.cat] || FILTER_TONES.all;
                  const snippet = getSnippet(it.body);

                  return (
                    <li key={it.id}>
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
              onClick={selectNextUnread}
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
                key={selected?.id}
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
                <ArticleMeta item={inbox.selected} catLabel={labelOf(inbox.selected.cat)} />

                {/* Título */}
                <h2 className="mt-2 font-headline text-xl short:text-lg font-black tracking-tight text-balance text-left text-on-surface">
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

                {/* Corpo do artigo (entrada + parágrafos) — ou a tabela do
                    sorteio da Taça, em vez da lista seca */}
                {inbox.selected.kind === "cupdraw" &&
                Array.isArray(inbox.selected.facts?.fixtures) &&
                inbox.selected.facts.fixtures.length > 0 ? (
                  <div className="mt-3 border-t border-outline-variant/25 pt-3">
                    <CupDrawTable
                      fixtures={inbox.selected.facts.fixtures}
                      viewerTeamId={inbox.selected.facts.viewerTeamId}
                      teams={teams}
                      onOpenTeamSquad={onOpenTeamSquad}
                    />
                  </div>
                ) : inbox.selected.body && (
                  <div className="mt-3 lg:px-6 space-y-3 border-t border-outline-variant/25 pt-3">
                    <RichParagraphs
                      parts={inbox.selected.bodyParts}
                      fallback={inbox.selected.body}
                      teams={teams}
                      category={inbox.selected.cat}
                      onOpenTeamSquad={onOpenTeamSquad}
                      onOpenPlayerHistory={onOpenPlayerHistory}
                      noLead={inbox.selected.kind === "cupdraw"}
                    />
                  </div>
                )}

                {/* Pitch com as classificações 1–5★ (fim do corpo do rescaldo) */}
                {Array.isArray(inbox.selected.pitch) &&
                  inbox.selected.pitch.length > 0 && (
                    <PostMatchPitch players={inbox.selected.pitch} />
                  )}

                {/* Tabela de classificação final */}
                {inbox.selected.newsType === "league_final" && (
                  <LeagueFinalTable
                    rows={inbox.selected.facts?.rows}
                    teams={teams}
                    onOpenTeamSquad={onOpenTeamSquad}
                  />
                )}

                {/* Botões de ação, sob filete */}
                {["contract", "job", "board", "cupdraw"].includes(
                  inbox.selected.kind,
                ) && (
                  <div className="mt-4 border-t border-outline-variant/25 pt-3">
                    <InboxActions
                      item={inbox.selected}
                      inbox={inbox}
                      onOpenCupBracket={onOpenCupBracket}
                    />
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
