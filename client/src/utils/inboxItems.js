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
    t === "welcome" ||
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

const partText = (value) => ({ type: "text", value: String(value ?? "") });
const partPlayer = (player) => ({ type: "player", ...player });
const partTeam = (team) => ({ type: "team", ...team });

function plainParts(parts) {
  return parts
    .map((part) => (part.type === "text" ? part.value : part.label))
    .join("");
}

function newsPlayer(n) {
  return n?.player_id && n.player_name
    ? {
        id: n.player_id,
        label: n.player_name,
        photo: n.player_photo || n.photo || null,
        position: n.player_position || n.position || "ATA",
      }
    : null;
}

function newsTeam(id, name) {
  return id && name ? { id, label: name } : null;
}

function uniqueTeams(...teams) {
  return teams.filter(
    (team, index, all) =>
      team && all.findIndex((candidate) => candidate?.id === team.id) === index,
  );
}

function newsVariant(n, count) {
  const seed = Number(n?.id) || String(n?.title || "").length;
  return Math.abs(seed) % count;
}

function makeArticle(titleParts, bodyParts, player, teams, transfer) {
  return {
    title: plainParts(titleParts),
    body: plainParts(bodyParts),
    titleParts,
    bodyParts,
    media: { player, teams: uniqueTeams(...teams), transfer },
  };
}

function newsArticle(n, { owner, related, seller, buyer } = {}) {
  const player = newsPlayer(n);
  const type = String(n?.type || "");
  const amount = n?.amount ? formatCurrency(n.amount) : null;
  const description = String(n?.description || "").trim();
  const teams = [owner, related, seller, buyer];
  const transfer =
    type === "transfer_out"
      ? { from: owner, to: related }
      : type === "transfer_in" || type === "auction_won" || n?.source === "transfer"
        ? { from: seller || related, to: buyer || owner || related }
        : null;
  const p = player ? partPlayer(player) : partText(n?.player_name || "O jogador");
  const o = owner ? partTeam(owner) : partText(n?.team_name || "o clube");
  const r = related ? partTeam(related) : partText(n?.related_team_name || "o novo clube");
  const b = buyer ? partTeam(buyer) : owner ? partTeam(owner) : r;
  const s = seller ? partTeam(seller) : related ? partTeam(related) : null;
  const value = amount || "um valor não divulgado";
  let titleParts = [partText(n?.title || "Notícia")];
  let bodyParts = [partText(description || n?.title || "Há novidades no clube.")];

  if (type === "transfer_in" || type === "auction_won" || n?.source === "transfer") {
    titleParts = [p, partText(" reforça "), b];
    bodyParts = newsVariant(n, 3) === 0
      ? [p, partText(" chega a "), b, partText(" vindo de "), s || partText("outro clube"), partText(` por ${value}.`)]
      : newsVariant(n, 3) === 1
        ? [partText("O mercado mexeu: "), p, partText(" é a nova aposta de "), b, partText(` numa operação de ${value}.`)]
        : [p, partText(" muda-se para "), b, partText(` e dá mais opções ao plantel${amount ? ` por ${value}` : ""}.` )];
  } else if (type === "transfer_out") {
    titleParts = [p, partText(" deixa "), o];
    bodyParts = [p, partText(" segue para "), r, partText(` numa transferência de ${value}.`)];
  } else if (type === "auction_failed") {
    titleParts = [partText("Leilão sem negócio: "), p];
    bodyParts = [partText("A licitação de "), p, partText(" terminou sem comprador. "), partText(description || "O jogador continua disponível para uma próxima oportunidade.")];
  } else if (type === "ticket_revenue") {
    titleParts = [partText("Bilheteira de "), o];
    bodyParts = [o, partText(` abriu as portas e arrecadou ${value}. `), partText(description || "A receita ajuda a financiar a próxima jornada.")];
  } else if (type === "weekly_income") {
    titleParts = [partText("Rendimento de "), o];
    bodyParts = [o, partText(` recebeu ${value} de rendimento base. `), partText("Uma almofada importante para a semana de trabalho.")];
  } else if (type === "wages") {
    titleParts = [partText("Folha salarial: "), o];
    bodyParts = [partText("A semana fecha com "), o, partText(` a pagar ${value} em salários. `), partText("É hora de manter o balneário competitivo sem perder o controlo das contas.")];
  } else if (type === "stadium_upkeep") {
    titleParts = [partText("Manutenção em "), o];
    bodyParts = [o, partText(` investiu ${value} na manutenção do estádio. `), partText("Uma casa cuidada recebe melhor os seus adeptos.")];
  } else if (type === "loan_interest" || type === "loan_principal") {
    const label = type === "loan_interest" ? "juros" : "capital do empréstimo";
    titleParts = [partText("Contas bancárias: "), o];
    bodyParts = [o, partText(` pagou ${value} em ${label}. `), partText(description || "A dívida continua a pesar no orçamento semanal.")];
  } else if (type === "stadium_build") {
    titleParts = [partText("A casa cresce: "), o];
    bodyParts = [o, partText(` ganhou mais lugares com um investimento de ${value}. `), partText(description || "Mais bancadas significam mais margem para a receita de bilheteira.")];
  } else if (type === "academy") {
    titleParts = [partText("Nova aposta: "), p];
    bodyParts = [p, partText(" sobe da academia de "), o, partText(` e chega com margem para crescer${amount ? ` após um investimento de ${value}` : ""}.` )];
  } else if (type === "renegotiation") {
    titleParts = [p, partText(" renova com "), o];
    bodyParts = [p, partText(" prolonga a ligação a "), o, partText(". O agente conseguiu melhores condições para manter o jogador focado.")];
  } else if (type === "cost_cut") {
    titleParts = [partText("Corte no plantel: "), p];
    bodyParts = [o, partText(" libertou "), p, partText(" para aliviar a folha salarial. "), partText(description || "A tesouraria falou mais alto.")];
  } else if (type === "cup_upset") {
    titleParts = [o, partText(" elimina "), r];
    bodyParts = [o, partText(" assinou a surpresa da ronda frente a "), r, partText(description ? `. ${description}.` : ". O favoritismo ficou pelo caminho.")];
  } else if (type === "prize") {
    titleParts = [partText("Prémio para "), o];
    bodyParts = [o, partText(` recebe ${value}. `), partText(description || "O mérito desportivo também se sente nas contas do clube.")];
  } else if (owner || player) {
    titleParts = player && owner ? [p, partText(" — "), o] : [partText(n?.title || "Notícia")];
    bodyParts = [owner ? o : p, partText(description ? `: ${description}.` : ". Há novidades a acompanhar no Jornal.")];
  }

  return makeArticle(titleParts, bodyParts, player, teams, transfer);
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
/**
 * Item único de um negócio concluído.
 * @param {object} t linha com `source === "transfer"`
 */
function dealToItem(t, fallbackDate) {
  const buyer = newsTeam(t.buyer_team_id || t.related_team_id, t.buyer_team_name || t.related_team_name);
  const seller = newsTeam(t.seller_team_id, t.seller_team_name);
  const article = newsArticle(t, {
    owner: buyer,
    buyer,
    seller,
    related: seller,
  });
  return {
    id: `deal-${t.player_id}-${t.matchweek}`,
    cat: "market",
    date: formatNewsDate(t, fallbackDate),
    ...article,
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
  const owner = newsTeam(c.team_id, c.team_name);
  const related = newsTeam(c.related_team_id, c.related_team_name);
  const article = newsArticle(c, { owner, related });
  return {
    id: `news-${c.source || "club"}-${c.id}`,
    cat: "market",
    date: formatNewsDate(c, fallbackDate),
    ...article,
    redFlag: false,
    kind: "info",
    ref: null,
  };
}

/**
 * Item genérico de notícia (só leitura, corpo enriquecido).
 * @param {object} n linha do globalNews
 */
function rowToItem(n, fallbackDate) {
  const owner = newsTeam(n.team_id, n.team_name);
  const related = newsTeam(n.related_team_id, n.related_team_name);
  const article = newsArticle(n, { owner, related });
  return {
    id: `news-${n.source || "club"}-${n.id}`,
    cat: newsCategory(n),
    date: formatNewsDate(n, fallbackDate),
    ...article,
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
