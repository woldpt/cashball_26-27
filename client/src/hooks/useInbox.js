/**
 * useInbox — a caixa de entrada do treinador (hub estilo CM2001).
 *
 * Junta numa só lista: pedidos de renovação (bandeira vermelha), convites
 * de clubes (bandeira vermelha), avisos da direção, sorteio da Taça, humor
 * pós-jogo, lesões/castigos do plantel e as notícias da época. Os itens
 * acionáveis reutilizam os fluxos existentes (GameDialog de contratos,
 * emits de convite) — o hub só os revela e ordena.
 *
 * Lido/não lido persiste em localStorage por treinador+sala e é partilhado por
 * todas as instâncias (ver `inboxReadStore`), para que o badge do Jornal no
 * `GameLayout` acompanhe o que se abre no `JournalTab`. Itens com bandeira
 * vermelha contam sempre como não lidos até serem resolvidos (nessa altura
 * desaparecem da lista) e bloqueiam o Pronto.
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useGame } from "../contexts/GameContext.jsx";
import { queueEmit } from "../socket.js";
import {
  INBOX_CATS,
  MOOD_TITLES,
  formatInboxDate,
  newsRowsToItems,
  squadToMedicalItems,
} from "../utils/inboxItems.js";
import {
  inboxReadKey,
  markInboxRead,
  markInboxReadMany,
  readIdsFor,
  subscribeInboxReads,
} from "../utils/inboxReadStore.js";

/**
 * @returns {{
 *   cats: Array,
 *   items: Array,
 *   unreadCount: number,
 *   redFlags: number,
 *   weeklyBriefing: { date: string, title: string, body: string, summary: string },
 *   selected: object|null,
 *   select: (id: string) => void,
 *   selectNextUnread: () => void,
 *   stepSelection: (dir: 1|-1) => void,
 *   markAllRead: () => void,
 *   answerContract: (playerId: number) => void,
 *   answerJobOffer: (accepted: boolean) => void,
 *   ackBoard: () => void,
 *   openCupDraw: () => void,
 *   jobOffer: object|null,
 *   board: object|null,
 *   draw: object|null,
 * }}
 */
export function useInbox() {
  const {
    contractQueue,
    focusContractDialog,
    jobOfferModal,
    setJobOfferModal,
    boardWarning,
    setBoardWarning,
    cupDraw,
    setShowCupDrawPopup,
    postMatchMood,
    globalNews,
    mySquad,
    me,
    calendarIndex,
    seasonYear,
  } = useGame();

  const storeKey = inboxReadKey(me?.roomCode, me?.name);
  const readIds = useSyncExternalStore(subscribeInboxReads, () =>
    readIdsFor(storeKey),
  );
  const [selectedId, setSelectedId] = useState(null);

  const markRead = useCallback(
    (id) => {
      markInboxRead(storeKey, id);
    },
    [storeKey],
  );

  const currentDate = formatInboxDate((calendarIndex ?? 0) + 1, seasonYear);

  // ── Construção da lista (acionáveis primeiro, resto por ordem) ──────────
  const items = useMemo(() => {
    const list = [];

    for (const d of contractQueue || []) {
      list.push({
        id: `contract-${d.playerId}`,
        cat: "club",
        date: currentDate,
        title: `🚩 ${d.title || "Pedido de renovação"}`,
        body: d.description || "",
        redFlag: true,
        kind: "contract",
        ref: d.playerId,
      });
    }

    if (jobOfferModal?.toTeam) {
      const to = jobOfferModal.toTeam;
      list.push({
        id: `job-${to.id}`,
        cat: "club",
        date: currentDate,
        title: `🚩 Convite: ${to.name}`,
        body: "Um clube quer-te como treinador. Responde antes do próximo jogo.",
        redFlag: true,
        kind: "job",
        ref: null,
        extra: {
          position: jobOfferModal.toTeamDivisionPosition ?? "?",
          points: to.points ?? "?",
          record: `${to.wins ?? 0}V ${to.draws ?? 0}E ${to.losses ?? 0}D`,
        },
      });
    }

    if (boardWarning) {
      const final = boardWarning.level === 3;
      list.push({
        id: `board-${boardWarning.level}-${boardWarning.streak ?? 1}`,
        cat: "club",
        date: currentDate,
        title: final ? "⚠️ Último aviso da direção" : "⚠️ Aviso da direção",
        body: "Orçamento negativo — carrega em Ok para confirmar leitura.",
        redFlag: false,
        kind: "board",
        ref: null,
        extra: {
          budget: boardWarning.budget ?? 0,
          streak: boardWarning.streak ?? 1,
          final,
        },
      });
    }

    if (cupDraw?.fixtures) {
      const mine = (cupDraw.fixtures || []).find(
        (f) =>
          f.homeTeam?.id === me?.teamId || f.awayTeam?.id === me?.teamId,
      );
      const label = mine
        ? `${mine.homeTeam?.name || "?"} – ${mine.awayTeam?.name || "?"}`
        : `${(cupDraw.fixtures || []).length} eliminatórias`;
      list.push({
        id: `cupdraw-${cupDraw.season || "?"}-${cupDraw.roundName || "sorteio"}`,
        cat: "competitions",
        date: currentDate,
        title: `🏆 Sorteio: ${cupDraw.roundName || "Taça"}`,
        body: label,
        redFlag: false,
        kind: "cupdraw",
        ref: null,
      });
    }

    if (postMatchMood) {
      const title =
        MOOD_TITLES[postMatchMood.variant] ||
        MOOD_TITLES[postMatchMood.outcome] ||
        "Resultado";
      list.push({
        id: `mood-${postMatchMood.key || "jogo"}`,
        cat: "club",
        date: currentDate,
        title: `${title} ${postMatchMood.myGoals ?? ""}–${postMatchMood.oppGoals ?? ""} ${postMatchMood.opponentName || ""}`.trim(),
        body: "Reação dos adeptos ao último jogo.",
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }

    list.push(...squadToMedicalItems(mySquad, calendarIndex ?? 0, currentDate));
    list.push(...newsRowsToItems(globalNews?.news, currentDate));

    return list;
  }, [
    contractQueue,
    jobOfferModal,
    boardWarning,
    cupDraw,
    postMatchMood,
    mySquad,
    globalNews,
    calendarIndex,
    currentDate,
    me?.teamId,
  ]);

  const isUnread = useCallback(
    (it) => it.redFlag || !readIds.has(it.id),
    [readIds],
  );

  const unreadCount = useMemo(
    () => items.filter(isUnread).length,
    [items, isUnread],
  );
  const redFlags = useMemo(
    () => items.filter((it) => it.redFlag).length,
    [items],
  );

  const weeklyBriefing = useMemo(() => {
    const weeklyItems = items.filter(
      (it) => !it.redFlag && it.date === currentDate,
    );
    const moodItem = weeklyItems.find((it) => it.id.startsWith("mood-"));
    const headlineItem =
      moodItem ||
      weeklyItems.find((it) => it.kind === "info") ||
      weeklyItems[0];
    const marketCount = weeklyItems.filter((it) => it.cat === "market").length;
    const squadCount = weeklyItems.filter((it) => it.cat === "squad").length;
    const moodTitle = postMatchMood
      ? MOOD_TITLES[postMatchMood.variant] ||
        MOOD_TITLES[postMatchMood.outcome] ||
        "Resultado"
      : null;
    const score = postMatchMood
      ? `${postMatchMood.myGoals ?? 0}–${postMatchMood.oppGoals ?? 0}`
      : null;

    return {
      date: currentDate,
      title: postMatchMood
        ? postMatchMood.outcome === "win"
          ? "A bancada celebra"
          : postMatchMood.outcome === "loss"
            ? "A bancada pede resposta"
            : "Equilíbrio no fim da jornada"
        : headlineItem?.title || "A semana ainda está a começar",
      body: postMatchMood
        ? `${moodTitle} ${score} frente a ${postMatchMood.opponentName || "um adversário"}.`
        : headlineItem?.body || "Ainda não há acontecimentos para resumir.",
      summary:
        weeklyItems.length > 0
          ? `${weeklyItems.length} acontecimento${weeklyItems.length === 1 ? "" : "s"}${marketCount ? ` · ${marketCount} de mercado` : ""}${squadCount ? ` · ${squadCount} do plantel` : ""}`
          : "Sem acontecimentos novos nesta semana.",
    };
  }, [items, currentDate, postMatchMood]);

  const selected = useMemo(
    () =>
      items.find((it) => it.id === selectedId) ||
      items.find(isUnread) ||
      items[0] ||
      null,
    [items, selectedId, isUnread],
  );

  const select = useCallback(
    (id) => {
      setSelectedId(id);
      const it = items.find((i) => i.id === id);
      // Bandeira vermelha só sai da lista ao responder — ler não chega.
      if (it && !it.redFlag) markRead(id);
    },
    [items, markRead],
  );

  const visibleIds = useCallback(
    (filter) =>
      (filter === "all"
        ? items
        : items.filter((it) => it.cat === filter)
      ).map((it) => it.id),
    [items],
  );

  const selectNextUnread = useCallback(
    (filter = "all") => {
      const pool =
        filter === "all"
          ? items
          : items.filter((it) => it.cat === filter);
      const next = pool.find(isUnread);
      if (next) select(next.id);
    },
    [items, isUnread, select],
  );

  const stepSelection = useCallback(
    (dir, filter = "all") => {
      const ids = visibleIds(filter);
      if (ids.length === 0) return;
      const cur = selected?.id;
      const i = ids.indexOf(cur);
      const next = ids[(i + dir + ids.length) % ids.length];
      select(next);
    },
    [visibleIds, selected, select],
  );

  const markAllRead = useCallback(
    (filter = "all") => {
      const pool =
        filter === "all"
          ? items
          : items.filter((it) => it.cat === filter);
      markInboxReadMany(
        storeKey,
        pool.filter((it) => !it.redFlag).map((it) => it.id),
      );
    },
    [items, storeKey],
  );

  // ── Ações (reutilizam os fluxos existentes) ─────────────────────────────
  const answerContract = useCallback(
    (playerId) => {
      focusContractDialog(playerId);
    },
    [focusContractDialog],
  );

  const answerJobOffer = useCallback(
    (accepted) => {
      queueEmit(accepted ? "acceptJobOffer" : "declineJobOffer");
      setJobOfferModal(null);
    },
    [setJobOfferModal],
  );

  const ackBoard = useCallback(() => {
    setBoardWarning(null);
  }, [setBoardWarning]);

  const openCupDraw = useCallback(() => {
    setShowCupDrawPopup(true);
  }, [setShowCupDrawPopup]);

  return {
    cats: INBOX_CATS,
    items,
    unreadCount,
    redFlags,
    weeklyBriefing,
    selected,
    isUnread,
    select,
    selectNextUnread,
    stepSelection,
    markAllRead,
    answerContract,
    answerJobOffer,
    ackBoard,
    openCupDraw,
    jobOffer: jobOfferModal,
    board: boardWarning,
    draw: cupDraw,
  };
}
