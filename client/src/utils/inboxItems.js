/**
 * inboxItems — mapeamento puro da caixa de entrada (hub estilo CM2001).
 *
 * Sem estado nem JSX: recebe linhas de notícias + estados locais e devolve
 * itens `{ id, cat, date, title, body, redFlag, kind, ref }`. As ações
 * (responder, aceitar, …) vivem no hook `useInbox`, que interpreta `kind`.
 *
 * Um evento = uma notícia: as linhas gémeas de um negócio (transfer_in /
 * transfer_out + histórico global) fundem-se num só item de Mercado.
 */
import { formatCurrency } from "./formatters.js";

/** Separadores da janela, centrados no treinador (tudo numa só linha). */
export const INBOX_CATS = [
  { id: "all", label: "Todas" },
  { id: "club", label: "O Meu Clube" },
  { id: "competitions", label: "Competições" },
  { id: "squad", label: "Plantel" },
  { id: "market", label: "Mercado" },
];

/** Títulos do humor pós-jogo (espelho mínimo do antigo modal de adeptos). */
export const MOOD_TITLES = {
  win: "Vitória!",
  win_big: "Vitória Épica!",
  win_upset: "Vitória Épica!",
  loss: "Adeptos Descontentes",
  loss_shameful: "Derrota Vergonhosa",
  loss_expected: "Derrota Esperada",
  draw: "Empate",
  draw_honorable: "Empate Honroso",
  draw_bitter: "Empate Amargo",
};

/**
 * Categoria de uma linha do `globalNews` (club_news ou transfer_history).
 * @param {object} n linha com `source`/`type`
 * @returns {string} id de categoria
 */
export function newsCategory(n) {
  if (!n) return "competitions";
  if (n.source === "transfer") return "market";
  const t = String(n.type || "");
  if (
    t === "transfer_in" ||
    t === "transfer_out" ||
    t === "auction_won" ||
    t === "auction_failed" ||
    t.includes("transfer") ||
    t.includes("auction")
  )
    return "market";
  if (
    t === "renegotiation" ||
    t === "ticket_revenue" ||
    t === "stadium_build" ||
    t === "cost_cut"
  )
    return "club";
  if (t === "academy") return "squad";
  return "competitions";
}

/**
 * Formata o marcador temporal usado nas linhas do Jornal.
 * @param {number} week semana do item
 * @param {number} year ano da época
 * @returns {string}
 */
export function formatInboxDate(week, year) {
  return `S${Math.max(1, Number(week) || 1)}/${Number(year) || 2026}`;
}

function formatNewsDate(news, fallbackDate) {
  return news?.matchweek != null && Number(news.year) > 0
    ? formatInboxDate(news.matchweek, news.year)
    : fallbackDate || formatInboxDate();
}

/**
 * Converte linhas do `globalNews.news` em itens informativos (só leitura).
 * Negócios fundidos: transfer_in/transfer_out + linha do histórico global
 * com o mesmo jogador e jornada viram UM item de Mercado (um evento =
 * uma notícia). A ordem do servidor é preservada.
 * @param {Array} rows linhas `{id, source, type, title, description, amount, matchweek}`
 * @param {string} fallbackDate data da semana actual para linhas antigas/incompletas
 * @returns {Array} itens de inbox
 */
export function newsRowsToItems(rows, fallbackDate) {
  const list = Array.isArray(rows) ? rows : [];
  const groups = new Map();
  for (const n of list) {
    const key = dealKey(n);
    if (!key) continue;
    const g = groups.get(key) || { transfer: null, clubs: [] };
    if (n.source === "transfer") g.transfer = n;
    else g.clubs.push(n);
    groups.set(key, g);
  }
  const done = new Set();
  const items = [];
  for (const n of list) {
    const key = dealKey(n);
    if (key) {
      if (done.has(key)) continue;
      done.add(key);
      const g = groups.get(key);
      if (g.transfer) items.push(dealToItem(g.transfer, fallbackDate));
      else for (const c of g.clubs) items.push(clubDealToItem(c, fallbackDate));
    } else {
      items.push(rowToItem(n, fallbackDate));
    }
  }
  return items;
}

/** Origem do negócio em linguagem de balneário. */
const DEAL_SOURCE_LABEL = {
  auction: "leilão",
  fixed: "mercado",
  market: "mercado",
  proposal: "cláusula",
  npc: "clube NPC",
};

/** Tipos de club_news que descrevem o MESMO negócio da linha de transfer_history. */
const DEAL_CLUB_TYPES = new Set([
  "transfer_in",
  "transfer_out",
  "auction_won",
]);

/**
 * Chave de desduplicação de um negócio (jogador + jornada) ou null.
 * @param {object} n linha do globalNews
 * @returns {string|null}
 */
function dealKey(n) {
  if (!n) return null;
  const isDeal =
    n.source === "transfer" ||
    DEAL_CLUB_TYPES.has(String(n.type || ""));
  if (!isDeal) return null;
  if (n.player_id == null || n.matchweek == null) return null;
  return `${n.player_id}|${n.matchweek}`;
}

/**
 * Corpo rico de um negócio a partir da linha de transfer_history:
 * perfil + rota + valor + via.
 * @param {object} t linha com `source === "transfer"`
 * @returns {string}
 */
function dealBody(t) {
  const bits = [];
  const profile = [
    t.description,
    t.skill != null ? `skill ${t.skill}` : null,
    t.is_star ? "⭐" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (profile) bits.push(profile);
  const route = [t.seller_team_name, t.buyer_team_name]
    .filter(Boolean)
    .join(" → ");
  const price = t.amount ? formatCurrency(t.amount) : null;
  const via = DEAL_SOURCE_LABEL[t.type] || t.type || null;
  if (route && price) bits.push(`${route} por ${price}${via ? ` (${via})` : ""}`);
  else if (route) bits.push(route);
  else if (price) bits.push(price);
  return bits.join(" — ");
}

/**
 * Item único de um negócio concluído.
 * @param {object} t linha com `source === "transfer"`
 */
function dealToItem(t, fallbackDate) {
  const buyer = t.buyer_team_name || t.related_team_name;
  return {
    id: `deal-${t.player_id}-${t.matchweek}`,
    cat: "market",
    date: formatNewsDate(t, fallbackDate),
    title:
      t.player_name && buyer
        ? `${t.player_name} reforça ${buyer}`
        : t.title || "Negócio fechado",
    body: dealBody(t) || t.title || "",
    redFlag: false,
    kind: "info",
    ref: null,
  };
}

/**
 * Linha órfã de negócio (transfer_in/out sem par no histórico): corpo
 * reconstruído da rota + valor em vez da descrição crua.
 * @param {object} c linha de club_news
 */
function clubDealToItem(c, fallbackDate) {
  const t = String(c.type || "");
  const other = c.related_team_name;
  const price = c.amount ? formatCurrency(c.amount) : null;
  let route = "";
  if (t === "transfer_in" && (other || price))
    route = `Chega do ${other || "?"}${price ? ` por ${price}` : ""}.`;
  else if (t === "transfer_out" && (other || price))
    route = `Ruma ao ${other || "?"}${price ? ` por ${price}` : ""}.`;
  return {
    id: `news-${c.source || "club"}-${c.id}`,
    cat: "market",
    date: formatNewsDate(c, fallbackDate),
    title: c.title || "Notícia",
    body: route || richBody(c),
    redFlag: false,
    kind: "info",
    ref: null,
  };
}

/**
 * Descrição + valor formatado (sem repetir o que já lá está).
 * @param {object} n linha do globalNews
 * @returns {string}
 */
function richBody(n) {
  const desc = String(n.description || "").trim();
  const amt = n.amount ? formatCurrency(n.amount) : null;
  if (desc && amt && !desc.includes("€")) return `${desc} · ${amt}.`;
  return desc || amt || "";
}

/**
 * Item genérico de notícia (só leitura, corpo enriquecido).
 * @param {object} n linha do globalNews
 */
function rowToItem(n, fallbackDate) {
  return {
    id: `news-${n.source || "club"}-${n.id}`,
    cat: newsCategory(n),
    date: formatNewsDate(n, fallbackDate),
    title: n.title || "Notícia",
    body: richBody(n),
    redFlag: false,
    kind: "info",
    ref: null,
  };
}

/**
 * Itens de lesões e castigos a partir do plantel do treinador.
 * @param {Array} squad jogadores com `injury_until_matchweek` / `suspension_until_matchweek`
 * @param {number} nowIdx relógio atual (calendarIndex)
 * @param {string} dateLabel data da semana actual
 * @returns {Array} itens de inbox
 */
export function squadToMedicalItems(squad, nowIdx, dateLabel) {
  const items = [];
  for (const p of Array.isArray(squad) ? squad : []) {
    const inj = Number(p?.injury_until_matchweek) || 0;
    const sus = Number(p?.suspension_until_matchweek) || 0;
    const profile = [p?.position, p?.skill != null ? `skill ${p.skill}` : null]
      .filter(Boolean)
      .join(" · ");
    const lead = profile ? `${profile} — ` : "";
    if (inj > nowIdx) {
      items.push({
        id: `inj-${p.id}-${inj}`,
        cat: "squad",
        date: dateLabel,
        title: `🩹 ${p.name} lesionado`,
        body: `${lead}de fora até à jornada ${inj + 1}.`,
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }
    if (sus > nowIdx) {
      items.push({
        id: `sus-${p.id}-${sus}`,
        cat: "squad",
        date: dateLabel,
        title: `🟥 ${p.name} castigado`,
        body: `${lead}suspenso até à jornada ${sus + 1}.`,
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }
  }
  return items;
}
