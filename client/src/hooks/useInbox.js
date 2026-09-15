/**
 * useInbox — a caixa de entrada do treinador (hub estilo CM2001).
 *
 * Junta numa só lista: pedidos de renovação (bandeira vermelha), convites
 * de clubes (bandeira vermelha), avisos da direção, sorteio da Taça, humor
 * pós-jogo, lesões/castigos do plantel e as notícias da época. Os itens
 * acionáveis reutilizam os fluxos existentes (GameDialog de contratos,
 * emits de convite) — o hub só os revela e ordena.
 *
 * Lido/não lido persiste em localStorage por treinador+sala. Itens com
 * bandeira vermelha contam sempre como não lidos até serem resolvidos
 * (nessa altura desaparecem da lista) e bloqueiam o Pronto.
 */
import { useCallback, useMemo, useState } from "react";
import { useGame } from "../contexts/GameContext.jsx";
import { queueEmit } from "../socket.js";
import {
  INBOX_CATS,
  MOOD_TITLES,
  newsRowsToItems,
  squadToMedicalItems,
} from "../utils/inboxItems.js";

function readStoreKey(roomCode, coachName) {
  return `cashball_inbox_read:${roomCode || "?"}:${coachName || "?"}`;
}

function loadRead(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * @returns {{
 *   cats: Array,
 *   items: Array,
 *   unreadCount: number,
 *   redFlags: number,
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
  } = useGame();

  const storeKey = readStoreKey(me?.roomCode, me?.name);
  const [readIds, setReadIds] = useState(() => loadRead(storeKey));
  const [selectedId, setSelectedId] = useState(null);

  const markRead = useCallback(
    (id) => {
      if (!id) return;
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        if (next.size > 400) {
          // Teto barato: apaga os mais antigos (ordem de inserção do Set).
          for (const old of next) {
            if (next.size <= 400) break;
            next.delete(old);
          }
        }
        try {
          window.localStorage.setItem(storeKey, JSON.stringify([...next]));
        } catch {
          /* armazenamento cheio/bloqueado: segue sem persistir */
        }
        return next;
      });
    },
    [storeKey],
  );

  // ── Construção da lista (acionáveis primeiro, resto por ordem) ──────────
  const items = useMemo(() => {
    const list = [];

    for (const d of contractQueue || []) {
      list.push({
        id: `contract-${d.playerId}`,
        cat: "contracts",
        date: "Agente",
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
        cat: "jobs",
        date: "Convite",
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
        cat: "messages",
        date: "Direção",
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
        date: cupDraw.roundName || "Taça",
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
        cat: "messages",
        date: postMatchMood.roundLabel || "Pós-jogo",
        title: `${title} ${postMatchMood.myGoals ?? ""}–${postMatchMood.oppGoals ?? ""} ${postMatchMood.opponentName || ""}`.trim(),
        body: "Reação dos adeptos ao último jogo.",
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }

    list.push(...squadToMedicalItems(mySquad, calendarIndex ?? 0));
    list.push(...newsRowsToItems(globalNews?.news));

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
      for (const it of pool) if (!it.redFlag) markRead(it.id);
    },
    [items, markRead],
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
