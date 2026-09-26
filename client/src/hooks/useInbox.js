/**
 * useInbox — a caixa de entrada do treinador (hub estilo CM2001).
 *
 * Junta numa só lista: pedidos de renovação (bandeira vermelha), convites
 * de clubes (bandeira vermelha), avisos da direção, sorteio da Taça, humor
 * pós-jogo, lesões/castigos do plantel e as notícias da época. Os itens
 * acionáveis reutilizam os emits existentes (contrato, convite) — o hub só
 * os revela e ordena.
 *
 * Lido/não lido persiste em localStorage por treinador+sala e é partilhado por
 * todas as instâncias (ver `inboxReadStore`), para que o badge do Jornal no
 * `GameLayout` acompanhe o que se abre no `JournalTab`. Itens com bandeira
 * vermelha contam sempre como não lidos até serem resolvidos (nessa altura
 * desaparecem da lista) e bloqueiam o Pronto.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useGame } from "../contexts/GameContext.jsx";
import { queueEmit } from "../socket.js";
import {
  INBOX_CATS,
  boardCovered,
  buildMoodNewsArticle,
  cupDrawCovered,
  cupDrawListParts,
  formatInboxDate,
  jobCovered,
  linkFirstMention,
  medicalCovered,
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
 *   answerContract: (playerId: number, accepted: boolean) => void,
 *   answerJobOffer: (accepted: boolean) => void,
 *   ackBoard: () => void,
 *   jobOffer: object|null,
 *   board: object|null,
 *   draw: object|null,
 *   newsYears: Array,
 *   visibleYears: Array,
 *   hasOlderSeasons: boolean,
 *   showOlderSeason: () => void,
 * }}
 */

/**
 * Prepara um título/parts com a bandeira 🚩, só se não a tiver já no início.
 * Evita duplicar a flag quando o título já nasce com 🚩 (ex. renovação/convite).
 * @param {string} title
 * @param {Array}|null titleParts
 * @returns {{title: string, parts: Array}}
 */
function withFlag(title, parts) {
  if (title.startsWith("🚩 ")) return { title, parts: parts ?? [] };
  return { title: `🚩 ${title}`, parts: [partText("🚩 "), ...(parts ?? [])] };
}

export function useInbox() {
  const {
    contractAnswering,
    respondContractRequest,
    jobOfferModal,
    setJobOfferModal,
    boardWarning,
    setBoardWarning,
    cupDraw,
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
  const uploadOnceRef = useRef(null);

  // Leituras vindas do servidor (fonte da verdade): união silenciosa com a
  // cache local (sem re-emitir — já estão gravadas).
  const serverReads = globalNews?.reads;
  useEffect(() => {
    if (Array.isArray(serverReads) && serverReads.length > 0) {
      markInboxReadMany(storeKey, serverReads);
    }
  }, [storeKey, serverReads]);

  // Migração única: leituras antigas do localStorage sobem para a BD.
  useEffect(() => {
    if (uploadOnceRef.current === storeKey) return;
    uploadOnceRef.current = storeKey;
    const local = [...readIdsFor(storeKey)];
    if (local.length > 0) queueEmit("markInboxRead", { keys: local });
  }, [storeKey]);

  const emitMark = useCallback((ids) => {
    const keys = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (keys.length > 0) queueEmit("markInboxRead", { keys });
  }, []);

  const markRead = useCallback(
    (id) => {
      markInboxRead(storeKey, id);
      emitMark(id);
    },
    [storeKey, emitMark],
  );

  const currentDate = formatInboxDate((calendarIndex ?? 0) + 1, seasonYear);

  // ── Paginação por época: mostra a mais recente, revela uma a pedido ────
  // (o servidor envia todas as épocas; linhas sem ano caem na época atual).
  const allNewsRows = globalNews?.news;
  const newsYears = useMemo(() => {
    const years = new Set();
    for (const n of Array.isArray(allNewsRows) ? allNewsRows : []) {
      const y = Number(n?.year) || seasonYear || 0;
      if (y) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  }, [allNewsRows, seasonYear]);
  // A contagem reinicia ao trocar de treinador/sala (ajuste durante o
  // render — padrão React para estado derivado de chave).
  const [pageState, setPageState] = useState({ key: storeKey, count: 1 });
  if (pageState.key !== storeKey) {
    setPageState({ key: storeKey, count: 1 });
  }
  const visibleSeasons = pageState.key === storeKey ? pageState.count : 1;
  const visibleYears = useMemo(
    () => newsYears.slice(0, Math.max(1, visibleSeasons)),
    [newsYears, visibleSeasons],
  );
  const newsRows = useMemo(() => {
    const set = new Set(visibleYears);
    return (Array.isArray(allNewsRows) ? allNewsRows : []).filter((n) =>
      set.has(Number(n?.year) || seasonYear || 0),
    );
  }, [allNewsRows, visibleYears, seasonYear]);

  // ── Construção da lista (acionáveis primeiro, resto por ordem) ──────────
  // As linhas persistidas visíveis (BD, data fixa) são a fonte; os
  // transitórios só aparecem sem par gravado (pendências anteriores a esta
  // versão).
  const items = useMemo(() => {
    const list = [];
    const answering = new Set(
      (contractAnswering || []).map((x) => Number(x)),
    );

    // Transitórios: pendentes no plantel sem par gravado (BDs anteriores à
    // notícia `contract_request`). Respondem na hora como os persistidos.
    const persistedContractIds = new Set(
      newsRows
        .filter((n) => String(n?.type || "") === "contract_request")
        .map((n) => Number(n?.player_id)),
    );
    for (const p of mySquad || []) {
      if (!p?.contract_request_pending) continue;
      if (persistedContractIds.has(Number(p.id))) continue;
      const player = {
        id: p.id,
        label: p.name || "O jogador",
        photo: p.photo ?? null,
        position: p.position || "ATA",
      };
      const title = `🚩 Pedido de renovação — ${player.label}`;
      const body = `O agente de ${player.label} exige resposta antes do próximo jogo.`;
      list.push({
        id: `contract-${p.id}`,
        cat: "squad",
        date: currentDate,
        title,
        body,
        titleParts: linkFirstMention(title, partPlayer(player)),
        bodyParts: linkFirstMention(body, partPlayer(player)),
        media: { player, teams: [] },
        redFlag: true,
        kind: "contract",
        ref: p.id,
        extra: {
          requestedWage: Number(p.contract_requested_wage) || null,
          answering: answering.has(Number(p.id)),
        },
      });
    }

    if (jobOfferModal?.toTeam && !jobCovered(newsRows, jobOfferModal.toTeam.id)) {
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

    if (
      boardWarning &&
      !boardCovered(newsRows, boardWarning.teamId, boardWarning.level, boardWarning.streak)
    ) {
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
        // Transitório sem par gravado: id estável por nível/sequência
        // (o id antigo recalculava-se com a semana atual e «deslia»).
        id: `board-live-${boardWarning.level}-${boardWarning.streak}`,
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

    if (
      cupDraw?.fixtures &&
      !cupDrawCovered(newsRows, cupDraw.season, cupDraw.round)
    ) {
      const { mine, body, bodyParts } = cupDrawListParts(
        (cupDraw.fixtures || []).map((f) => ({
          homeId: f.homeTeam?.id,
          homeName: f.homeTeam?.name,
          awayId: f.awayTeam?.id,
          awayName: f.awayTeam?.name,
        })),
        me?.teamId,
      );
      const title = `🏆 Sorteio: ${cupDraw.roundName || "Taça"}`;
      const home =
        mine ? { id: mine.homeId, label: mine.homeName || "?" } : null;
      const away =
        mine ? { id: mine.awayId, label: mine.awayName || "?" } : null;
      list.push({
        id: `cupdraw-${cupDraw.season || "?"}-${cupDraw.roundName || "sorteio"}`,
        cat: "competitions",
        // Data do sorteio, não da semana atual (senão "muda" de semana).
        date: formatInboxDate(
          (cupDraw.drawWeek ?? calendarIndex ?? 0) + 1,
          cupDraw.year ?? seasonYear,
        ),
        title,
        body,
        titleParts:
          home && away
            ? [
                partText(`${title} — `),
                partTeam(home),
                partText(" – "),
                partTeam(away),
              ]
            : [partText(title)],
        bodyParts,
        // Pares para a tabela do detalhe (mesmo shape dos facts persistidos);
        // viewerTeamId marca o jogo do treinador na linha.
        facts: {
          fixtures: (cupDraw.fixtures || []).map((f) => ({
            homeTeamId: f.homeTeam?.id,
            homeName: f.homeTeam?.name,
            awayTeamId: f.awayTeam?.id,
            awayName: f.awayTeam?.name,
          })),
          viewerTeamId: me?.teamId ?? null,
        },
        media: { player: null, teams: [] },
        redFlag: false,
        kind: "cupdraw",
        ref: null,
      });
    }

    // O rescaldo transitório esconde-se quando a linha persistida do mesmo
    // jogo já chegou (evita o último jogo em duplicado no Jornal).
    const savedMoodKeys = persistedMoodKeys(newsRows);
    if (postMatchMood && !savedMoodKeys.has(postMatchMood.key)) {
      const article = buildMoodNewsArticle(postMatchMood);
      list.push({
        id: `mood-${postMatchMood.key || "jogo"}`,
        cat: "club",
        // Data do jogo, não da semana atual (senão "muda" de semana).
        date: formatInboxDate(
          (postMatchMood.weekIdx ?? calendarIndex ?? 0) + 1,
          postMatchMood.year ?? seasonYear,
        ),
        ...article,
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }

    for (const mi of squadToMedicalItems(mySquad, calendarIndex ?? 0, currentDate)) {
      const m = String(mi.id).match(/^(inj|sus)-(-?\d+)-(\d+)$/);
      if (
        m &&
        medicalCovered(
          newsRows,
          m[1] === "inj" ? "injury" : "suspension",
          Number(m[2]),
          Number(m[3]),
          seasonYear,
        )
      )
        continue;
      list.push(mi);
    }
    list.push(...newsRowsToItems(newsRows, currentDate, me?.teamId));

    // Linhas persistidas acionáveis: identidade e data da BD, pendência e
    // ação do estado vivo (fila de renovações, modal de convite/aviso).
    const pendingContractIds = new Set(
      (mySquad || [])
        .filter((p) => p?.contract_request_pending)
        .map((p) => Number(p?.id)),
    );
    const pendingJobToId =
      jobOfferModal?.toTeam?.id != null ? String(jobOfferModal.toTeam.id) : null;
    for (const it of list) {
      if (!it.facts || !it.newsType) continue;
      if (it.newsType === "contract_request") {
        const pid = it.media?.player?.id;
        const pending = pid != null && pendingContractIds.has(Number(pid));
        it.redFlag = pending;
        it.kind = pending ? "contract" : "info";
        it.ref = pid ?? null;
        if (pending) {
          it.title = withFlag(it.title, it.titleParts).title;
          it.titleParts = withFlag(it.title, it.titleParts).parts;
          it.extra = {
            requestedWage: it.facts?.requestedWage ?? null,
            answering: answering.has(Number(pid)),
          };
        }
      } else if (it.newsType === "job_offer") {
        const toId = it.media?.teams?.[0]?.id;
        const pending =
          pendingJobToId != null && toId != null && String(toId) === pendingJobToId;
        it.redFlag = pending;
        it.kind = pending ? "job" : "info";
        it.extra = {
          position: it.facts.position ?? "?",
          points: it.facts.points ?? "?",
          record: it.facts.record ?? "",
        };
        if (pending) {
          it.title = withFlag(it.title, it.titleParts).title;
          it.titleParts = withFlag(it.title, it.titleParts).parts;
        }
      } else if (it.newsType === "board_warning") {
        const active =
          boardWarning != null &&
          Number(boardWarning.level) === Number(it.facts.level) &&
          Number(boardWarning.streak) === Number(it.facts.streak);
        it.kind = active ? "board" : "info";
        it.extra = {
          budget: it.facts.budget ?? 0,
          streak: it.facts.streak ?? 1,
          final: !!it.facts.final,
        };
      } else if (it.newsType === "cup_draw") {
        it.kind = "cupdraw";
      }
    }

    return list;
  }, [
    contractAnswering,
    jobOfferModal,
    boardWarning,
    cupDraw,
    postMatchMood,
    mySquad,
    newsRows,
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
      // Marca sempre (servidor + cache): a bandeira vermelha continua a
      // contar como não lida via isUnread até ser respondida, mas ao
      // resolver já está lida e não reaparece como novidade.
      markRead(id);
    },
    [markRead],
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
    if (selected && isUnread(selected)) {
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
      const ids = pool.filter((it) => !it.redFlag).map((it) => it.id);
      markInboxReadMany(storeKey, ids);
      emitMark(ids);
    },
    [items, storeKey, emitMark],
  );

  // ── Ações (reutilizam os emits existentes) ───────────────────────────────
  const answerContract = useCallback(
    (playerId, accepted) => {
      const pid = Number(playerId);
      const it = items.find(
        (x) => x?.kind === "contract" && Number(x?.ref) === pid,
      );
      respondContractRequest(pid, accepted, it?.extra?.requestedWage ?? null);
    },
    [items, respondContractRequest],
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
    jobOffer: jobOfferModal,
    board: boardWarning,
    draw: cupDraw,
    newsYears,
    visibleYears,
    hasOlderSeasons: visibleSeasons < newsYears.length,
    showOlderSeason: () =>
      setPageState((p) => ({
        key: storeKey,
        count: (p.key === storeKey ? p.count : 0) + 1,
      })),
  };
}
