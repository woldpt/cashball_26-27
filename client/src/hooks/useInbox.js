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
  boardNewsId,
  buildMoodNewsArticle,
  formatInboxDate,
  linkFirstMention,
  newsRowsToItems,
  partPlayer,
  persistedMoodKeys,
  partTeam,
  partText,
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
 *   selected: object|null,
 *   select: (id: string) => void,
 *   selectNextUnread: () => void,
 *   hasNextUnread: boolean,
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
      const squadPlayer = (mySquad || []).find(
        (p) => Number(p?.id) === Number(d.playerId),
      );
      const label =
        squadPlayer?.name ||
        String(d.title || "").split("—").pop().trim() ||
        "O jogador";
      const player = {
        id: d.playerId,
        label,
        photo: squadPlayer?.photo ?? null,
        position: squadPlayer?.position || "ATA",
      };
      const title = `🚩 ${d.title || "Pedido de renovação"}`;
      const body = d.description || "";
      list.push({
        id: `contract-${d.playerId}`,
        cat: "club",
        date: currentDate,
        title,
        body,
        titleParts: linkFirstMention(title, partPlayer(player)),
        bodyParts: linkFirstMention(body, partPlayer(player)),
        media: { player, teams: [] },
        redFlag: true,
        kind: "contract",
        ref: d.playerId,
      });
    }

    if (jobOfferModal?.toTeam) {
      const to = jobOfferModal.toTeam;
      const from = jobOfferModal.fromTeam;
      const team = { id: to.id, label: to.name };
      const body = `${to.name} quer-te como treinador. Responde antes do próximo jogo.`;
      list.push({
        id: `job-${to.id}`,
        cat: "club",
        date: currentDate,
        title: `🚩 Convite: ${to.name}`,
        body,
        titleParts: [partText("🚩 Convite: "), partTeam(team)],
        bodyParts: linkFirstMention(body, partTeam(team)),
        media: {
          player: null,
          teams:
            from?.id != null
              ? [team, { id: from.id, label: from.name }]
              : [team],
        },
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
      const title = final ? "⚠️ Último aviso da direção" : "⚠️ Aviso da direção";
      const team =
        boardWarning.teamId != null
          ? {
              id: boardWarning.teamId,
              label: boardWarning.teamName || "O teu clube",
            }
          : null;
      const body = "Orçamento negativo — carrega em Ok para confirmar leitura.";
      list.push({
        id: boardNewsId(
          seasonYear,
          calendarIndex,
          boardWarning.level,
          boardWarning.streak,
        ),
        cat: "club",
        date: currentDate,
        title,
        body,
        titleParts: team
          ? [partText(`${title} — `), partTeam(team)]
          : [partText(title)],
        bodyParts: team
          ? [
              partTeam(team),
              partText(`: ${body.charAt(0).toLowerCase()}${body.slice(1)}`),
            ]
          : [partText(body)],
        media: { player: null, teams: team ? [team] : [] },
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
      const title = `🏆 Sorteio: ${cupDraw.roundName || "Taça"}`;
      const home =
        mine?.homeTeam?.id != null
          ? { id: mine.homeTeam.id, label: mine.homeTeam.name || "?" }
          : null;
      const away =
        mine?.awayTeam?.id != null
          ? { id: mine.awayTeam.id, label: mine.awayTeam.name || "?" }
          : null;
      list.push({
        id: `cupdraw-${cupDraw.season || "?"}-${cupDraw.roundName || "sorteio"}`,
        cat: "competitions",
        date: currentDate,
        title,
        body: label,
        titleParts:
          home && away
            ? [
                partText(`${title} — `),
                partTeam(home),
                partText(" – "),
                partTeam(away),
              ]
            : [partText(title)],
        bodyParts:
          home && away
            ? [partTeam(home), partText(" – "), partTeam(away)]
            : [partText(label)],
        media: { player: null, teams: home && away ? [home, away] : [] },
        redFlag: false,
        kind: "cupdraw",
        ref: null,
      });
    }

    // O rescaldo transitório esconde-se quando a linha persistida do mesmo
    // jogo já chegou (evita o último jogo em duplicado no Jornal).
    const savedMoodKeys = persistedMoodKeys(globalNews?.news);
    if (postMatchMood && !savedMoodKeys.has(postMatchMood.key)) {
      const article = buildMoodNewsArticle(postMatchMood);
      list.push({
        id: `mood-${postMatchMood.key || "jogo"}`,
        cat: "club",
        date: currentDate,
        ...article,
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
    seasonYear,
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

  const selected = useMemo(
    () =>
      items.find((it) => it.id === selectedId) ||
      items.slice().reverse().find(isUnread) ||
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

  const nextUnread = useMemo(() => {
    const unread = items.filter(isUnread);
    const currentIndex = selected
      ? unread.findIndex((item) => item.id === selected.id)
      : -1;
    // O servidor entrega as notícias da mais recente para a mais antiga;
    // depois de abrir a mais antiga, sobe-se uma posição para ler a seguinte.
    return (
      unread[currentIndex >= 0 ? currentIndex - 1 : unread.length - 1] || null
    );
  }, [items, isUnread, selected]);

  const selectNextUnread = useCallback(() => {
    if (!nextUnread) return;
    if (selected && isUnread(selected) && !selected.redFlag) {
      markRead(selected.id);
    }
    select(nextUnread.id);
  }, [isUnread, markRead, nextUnread, select, selected]);

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
    selected,
    isUnread,
    select,
    selectNextUnread,
    hasNextUnread: Boolean(nextUnread),
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
