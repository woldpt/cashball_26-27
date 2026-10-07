/**
 * JournalTab — a caixa de entrada do treinador (hub estilo CM2001).
 *
 * Desktop: lista numa coluna estreita à esquerda (1/3), leitor à direita (2/3); sem filtros de categoria (só a pesquisa). A notícia mais antiga
 * por ler fica seleccionada (sem a marcar como lida) e o artigo tem
 * «Ler próxima». Só o clique na linha, o «Ler próxima» ou o Enter
 * marcam como lida.
 *
 * Os pedidos de renovação e os convites de clubes entram como linhas com
 * redFlag («Ação necessária») e bloqueiam o Pronto até serem respondidos. As
 * respostas reutilizam os fluxos existentes (diálogo do agente, emits).
 *
 * O detalhe segue registo de imprensa clássica: manchete em tinta forte,
 * entrada com capitular, corpo numa coluna de leitura (~70ch),
 * filetes a separar corpo e ações; links de entidades em pílula para nunca
 * colarem às margens e tabelas centradas. A ação vive numa barra única
 * sticky no fundo do artigo (pendências, botões do tipo ou «Resolvido»).
 *
 * Orquestrador fino: lista, corpo, tabelas, ações e tons vivem em
 * `client/src/views/journal/`.
 */
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useInbox } from "../hooks/useInbox.js";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Button } from "../components/shared/Button.jsx";
import { PostMatchPitch } from "../components/shared/PostMatchPitch.jsx";
import { SponsorChooseModal } from "../components/shared/SponsorChooseModal.jsx";
import { flagSummary, searchText } from "./journal/utils.jsx";
import { ArticleMeta, CategoryAccentBar, RichNewsText, RichParagraphs } from "./journal/ArticleBody.jsx";
import { CupDrawIntro, CupDrawTable, LeagueFinalTable, TrainingReportTable, WeeklyFinanceTable } from "./journal/ArticleTables.jsx";
import { ArticleActionBar } from "./journal/ArticleActions.jsx";
import { NewsMedia } from "./journal/NewsMedia.jsx";
import { TopicList } from "./journal/TopicList.jsx";

/**
 * Caixa de entrada do treinador.
 * @param {{ teams?: Array, onOpenTeamSquad?: Function, onOpenPlayerHistory?: Function, onOpenCupBracket?: Function }} props
 * @returns {JSX.Element}
 */
export function JournalTab({
  teams = [],
  onOpenTeamSquad,
  onOpenPlayerHistory,
  onOpenCupBracket,
}) {
  const inbox = useInbox();
  const { selected: inboxSelected, selectNextUnread } = inbox;
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Mobile: lista e artigo são vistas separadas (no desktop ficam lado a lado).
  const [mobileDetail, setMobileDetail] = useState(false);

  // Atalho de teclado: Enter fora de controlos = próxima não lida.
  // Dentro de botões/links/inputs o teclado comporta-se nativamente.
  // Com um modal aberto, o Enter é do modal.
  const handleKeyDown = useCallback(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(
          "button, a, input, select, textarea, [role='button'], [contenteditable]",
        )
      )
        return;
      if (e.key === "Enter") {
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

  const query = searchText(search.trim());
  const visible = query
    ? inbox.items.filter((item) => {
        const searchTextBody = searchText(
          `${item.title} ${item.body} ${flagSummary(item)} ${item.media?.player?.label || ""} ${
            (item.media?.teams || []).map((t) => t.label).join(" ")
          }`,
        );
        return searchTextBody.includes(query);
      })
    : inbox.items;

  // Seleção coerente: o detalhe mostra sempre uma notícia visível. Se a
  // seleção sair do filtro/pesquisa, cai na primeira visível sem a marcar
  // como lida (só os cliques marcam).
  const selected =
    inboxSelected && visible.some((it) => it.id === inboxSelected.id)
      ? inboxSelected
      : visible[0] ?? null;
  const detailIndex = selected
    ? visible.findIndex((it) => it.id === selected.id)
    : -1;
  const newerItem = detailIndex > 0 ? visible[detailIndex - 1] : null;
  const olderItem =
    detailIndex >= 0 && detailIndex < visible.length - 1
      ? visible[detailIndex + 1]
      : null;

  const firstFlag = inbox.redFlags > 0 ? inbox.items.find((it) => it.redFlag) : null;
  const labelOf = (id) => inbox.cats.find((c) => c.id === id)?.label || id;
  const hasUnreadNonFlag = inbox.items.some(
    (item) => !item.redFlag && inbox.isUnread(item),
  );

  const handleSelectItem = useCallback(
    (id) => {
      inbox.select(id);
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setMobileDetail(true);
        window.scrollTo({ top: 0 });
      }
    },
    [inbox],
  );

  return (
    <div className="space-y-2 short:space-y-1.5">
      {/* ── Barra de ações numa só linha (sem cabeçalho de página: o espaço é da lista) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="journal-topic-search" className="sr-only">
          Pesquisar notícias
        </label>
        <input
          id="journal-topic-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar (jogadores, equipas)…"
          className="min-w-0 flex-1 basis-48 rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary/60 focus:outline-none"
        />
        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest tabular-nums text-on-surface-variant">
          <span className={inbox.unreadCount > 0 ? "text-primary" : undefined}>{inbox.unreadCount} por ler</span>
          {" · "}
          {query ? `${visible.length} resultados` : `${inbox.items.length} mensagens`}
        </span>
        <Button
          size="sm"
          onClick={() => {
            selectNextUnread();
            if (!window.matchMedia("(min-width: 1024px)").matches) setMobileDetail(true);
          }}
          disabled={!inbox.hasNextUnread}
        >
          Próxima por ler
        </Button>
        <Button variant="ghost" size="sm" onClick={() => inbox.markAllRead()} disabled={!hasUnreadNonFlag}>
          Marcar tudo como lido
        </Button>
      </div>

      {/* Pendências: uma faixa só, com atalho para a primeira */}
      {firstFlag && (
        <div className="flex items-center gap-2 rounded-md border border-error/40 bg-error/10 px-3 py-1.5">
          <span aria-hidden className="material-symbols-outlined text-[18px] text-error">flag</span>
          <p className="min-w-0 flex-1 text-[11px] font-bold text-error">
            {inbox.redFlags === 1
              ? "Tens 1 assunto por resolver"
              : `Tens ${inbox.redFlags} assuntos por resolver`}{" "}
            — o Pronto fica bloqueado até responderes.
          </p>
          {selected?.id !== firstFlag.id && (
            <Button variant="secondary" size="sm" onClick={() => handleSelectItem(firstFlag.id)}>
              Ver
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        {/* ── Inbox (coluna estreita à esquerda, ~1/3) ───────────────── */}
        <div className={`${mobileDetail ? "max-lg:hidden " : ""}lg:sticky lg:top-2 lg:flex lg:h-[calc(100dvh-9rem)] lg:flex-col`}>
        <TopicList
          inbox={inbox}
          selected={selected}
          visible={visible}
          query={query}
          onSelectItem={handleSelectItem}
          onPreviewItem={inbox.preview}
        />
        </div>

        {/* ── Leitor (à direita, ~2/3) ───────────────────────────────── */}
        <section aria-label="Corpo da notícia" className={`${mobileDetail ? "" : "max-lg:hidden"} min-w-0 space-y-2`}>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileDetail(false)}
          >
            ‹ Notícias
          </Button>
          <AnimatePresence>
            {!selected && (
              <div className="rounded-md border border-outline-variant/20 bg-surface-container px-4 py-8">
                <EmptyState
                  icon="newspaper"
                  title={query ? "Nenhuma notícia encontrada" : "Nada para ler"}
                  description={
                    query
                      ? "Tenta outro termo ou limpa a pesquisa."
                      : "Escolhe uma notícia na lista."
                  }
                />
              </div>
            )}
            {selected && (
              <motion.section
                key={selected.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="relative rounded-md border border-outline-variant/20 bg-surface-container-high px-4 py-3 short:py-2 sm:px-6 sm:py-4 lg:min-h-[22rem]"
              >
                {/* Faixa lateral: categoria, ou error nas pendências */}
                <CategoryAccentBar category={selected.cat} urgent={selected.redFlag} />

                {/* Coluna de leitura: meta, manchete, corpo e ações com
                    largura de imprensa, centrada; tabelas centram-se a si */}
                <div>
                <div className="w-full max-w-5xl">
                {/* Metadados: categoria e data */}
                <ArticleMeta item={selected} catLabel={labelOf(selected.cat)} />

                {/* Título */}
                <h2 className="mt-2 font-headline text-2xl sm:text-3xl short:text-xl leading-tight font-black tracking-tight text-balance text-left text-on-surface">
                  <RichNewsText
                    parts={selected.titleParts}
                    fallback={selected.title}
                    teams={teams}
                    bareLinks
                    onOpenTeamSquad={onOpenTeamSquad}
                    onOpenPlayerHistory={onOpenPlayerHistory}
                    query={query}
                  />
                </h2>

                {/* Media (jogador/equipa/transferência) */}
                <NewsMedia
                  media={selected.media}
                  teams={teams}
                  onOpenTeamSquad={onOpenTeamSquad}
                  onOpenPlayerHistory={onOpenPlayerHistory}
                />

                {/* Corpo do artigo (entrada + parágrafos) — no sorteio da
                    Taça, um parágrafo com o que nos calhou e só depois a
                    tabela completa */}
                {selected.kind === "cupdraw" &&
                Array.isArray(selected.facts?.fixtures) &&
                selected.facts.fixtures.length > 0 ? (
                  <div className="mt-3 border-t border-outline-variant/25 pt-3">
                    <CupDrawIntro
                      fixtures={selected.facts.fixtures}
                      viewerTeamId={selected.facts.viewerTeamId}
                      roundName={selected.facts.roundName}
                      titleFallback={selected.title}
                      teams={teams}
                      onOpenTeamSquad={onOpenTeamSquad}
                    />
                    <CupDrawTable
                      fixtures={selected.facts.fixtures}
                      viewerTeamId={selected.facts.viewerTeamId}
                      teams={teams}
                      onOpenTeamSquad={onOpenTeamSquad}
                    />
                  </div>
                ) : selected.body && (
                  <div className="mt-3 space-y-3 border-t border-outline-variant/25 pt-3">
                    <RichParagraphs
                      parts={selected.bodyParts}
                      fallback={selected.body}
                      teams={teams}
                      category={selected.cat}
                      onOpenTeamSquad={onOpenTeamSquad}
                      onOpenPlayerHistory={onOpenPlayerHistory}
                      noLead={selected.kind === "cupdraw"}
                      query={query}
                    />
                  </div>
                )}

                {/* Pitch com as classificações 0–10 (fim do corpo do rescaldo) */}
                {Array.isArray(selected.pitch) &&
                  selected.pitch.length > 0 && (
                    <PostMatchPitch players={selected.pitch} />
                  )}

                {/* Tabela de classificação final */}
                {selected.newsType === "league_final" && (
                  <LeagueFinalTable
                    rows={selected.facts?.rows}
                    viewerTeamId={selected.facts?.viewerTeamId}
                    teams={teams}
                    onOpenTeamSquad={onOpenTeamSquad}
                  />
                )}

                {/* Tabela do relatório de treino (skill) */}
                {selected.newsType === "training_report" && (
                  <TrainingReportTable rows={selected.facts?.rows} />
                )}

                {/* Tabela do resumo financeiro semanal */}
                {selected.newsType === "weekly_finance" && (
                  <WeeklyFinanceTable facts={selected.facts} />
                )}

                {/* Barra de ação única, sticky no fundo (pendências,
                    botões do tipo ou nota «Resolvido») */}
                <ArticleActionBar
                  item={selected}
                  inbox={inbox}
                  onOpenCupBracket={onOpenCupBracket}
                  onOpenSponsor={() => setSponsorOpen(true)}
                />

                </div>
                </div>

                {/* Rodapé fixo no fundo do cartão: mais recente / mais antiga + próxima por ler */}
                <div className="mt-2 w-full max-w-5xl shrink-0 border-t border-outline-variant/25 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => newerItem && handleSelectItem(newerItem.id)}
                    disabled={!newerItem}
                    aria-label="Notícia mais recente"
                  >
                    ‹ Recente
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tabular-nums text-on-surface-variant">
                      {detailIndex + 1} / {visible.length}
                    </span>
                    <Button
                      size="sm"
                      onClick={selectNextUnread}
                      disabled={!inbox.hasNextUnread}
                    >
                      Ler próxima
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => olderItem && handleSelectItem(olderItem.id)}
                    disabled={!olderItem}
                    aria-label="Notícia mais antiga"
                  >
                    Antiga ›
                  </Button>
                </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </section>
      </div>
      <SponsorChooseModal open={sponsorOpen} onClose={() => setSponsorOpen(false)} />
    </div>
  );
}
