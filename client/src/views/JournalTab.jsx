/**
 * JournalTab — a caixa de entrada do treinador (hub estilo CM2001).
 *
 * Lista em cima (data + título), detalhe em baixo, uma só linha de filtros:
 * Todas, O Meu Clube, Competições, Plantel, Mercado. Botões de
 * Anterior/Seguinte e «Próxima não lida», como na janela de notícias do
 * Championship Manager.
 *
 * Os pedidos de renovação e os convites de clubes entram como linhas com
 * bandeira vermelha 🚩 e bloqueiam o Pronto até serem respondidos. As
 * respostas reutilizam os fluxos existentes (diálogo do agente, emits).
 */
import { useState } from "react";
import { useInbox } from "../hooks/useInbox.js";
import { formatCurrency } from "../utils/formatters.js";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Button } from "../components/shared/Button.jsx";
import { PlayerAvatar } from "../components/shared/PlayerAvatar.jsx";
import { TeamCrest } from "../components/live/TeamCrest.jsx";

const FILTERS = ["all", "club", "competitions", "squad", "market"];

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
 * @param {{ item: object, inbox: object }} props
 */
function InboxActions({ item, inbox }) {
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
      <Button variant="accent" size="sm" onClick={inbox.openCupDraw}>
        Ver sorteio
      </Button>
    );
  }
  return null;
}

export function JournalTab({
  teams = [],
  onOpenTeamSquad,
  onOpenPlayerHistory,
}) {
  const inbox = useInbox();
  const [filter, setFilter] = useState("all");

  const visible =
    filter === "all"
      ? inbox.items
      : inbox.items.filter((it) => it.cat === filter);
  const labelOf = (id) =>
    inbox.cats.find((c) => c.id === id)?.label || id;
  const hasUnreadNonFlag = inbox.items.some(
    (item) => !item.redFlag && inbox.isUnread(item),
  );
  const tabBtn = (id) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      aria-pressed={filter === id}
      className={`shrink-0 px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${
        filter === id
          ? "bg-primary text-on-primary"
          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
      }`}
    >
      {labelOf(id)}
    </button>
  );

  return (
    <div className="space-y-2 short:space-y-1.5">
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

      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inbox.markAllRead()}
          disabled={!hasUnreadNonFlag}
        >
          Marcar tudo como lido
        </Button>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <section aria-label="Tópicos" className="min-w-0 space-y-2">
          <div className="flex items-center justify-between rounded-sm bg-surface-container-high/50 px-2 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-tertiary">
              Tópicos
            </span>
            <span className="text-[10px] font-bold tabular-nums text-on-surface-variant">
              {visible.length}
            </span>
          </div>

          {/* ── Lista ───────────────────────────────────────────────── */}
          {visible.length === 0 ? (
        <EmptyState
          emoji="📰"
          title="Sem notícias"
          description={
            filter === "all"
              ? "Ainda não há notícias nesta época."
              : `Nada em ${labelOf(filter)}.`
          }
        />
      ) : (
        <ol className="max-h-64 short:max-h-44 overflow-y-auto rounded-sm border border-outline-variant/20 bg-surface-container-low divide-y divide-outline-variant/15">
          {visible.map((it) => {
            const active = inbox.selected?.id === it.id;
            const unread = inbox.isUnread(it);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => inbox.select(it.id)}
                  aria-current={active}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                    active
                      ? "bg-primary/15"
                      : it.redFlag
                        ? "bg-error/10 hover:bg-error/15"
                        : "hover:bg-surface-container-high"
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

      {/* ── Próxima não lida ────────────────────────────────────────── */}
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => inbox.selectNextUnread(filter)}
              disabled={inbox.unreadCount === 0}
            >
              Próxima não lida
            </Button>
          </div>
        </section>

        <section aria-label="Corpo da notícia" className="min-w-0 space-y-2">
          {/* ── Detalhe ──────────────────────────────────────────────── */}
      {inbox.selected && (
        <section
          aria-live="polite"
          className="rounded-sm border border-outline-variant/20 bg-surface-container px-3 py-2.5 short:py-2"
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
            <p className="mt-1.5 text-center text-xs short:text-[11px] leading-relaxed text-on-surface">
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
            <InboxActions item={inbox.selected} inbox={inbox} />
          </div>
        </section>
      )}

      {/* ── Anterior / Seguinte ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-px rounded-sm overflow-hidden border border-outline-variant/20">
            <button
              type="button"
              onClick={() => inbox.stepSelection(-1, filter)}
              className="bg-surface-container-high px-3 py-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => inbox.stepSelection(1, filter)}
              className="bg-surface-container-high px-3 py-2 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Seguinte →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
