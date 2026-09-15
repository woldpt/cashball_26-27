/**
 * inboxItems — mapeamento puro da caixa de entrada (hub estilo CM2001).
 *
 * Sem estado nem JSX: recebe linhas de notícias + estados locais e devolve
 * itens `{ id, cat, date, title, body, redFlag, kind, ref }`. As ações
 * (responder, aceitar, …) vivem no hook `useInbox`, que interpreta `kind`.
 */

/** Separadores da janela, como no CM2001 (cima + baixo fundidos em lista). */
export const INBOX_CATS = [
  { id: "all", label: "Todas" },
  { id: "messages", label: "Mensagens" },
  { id: "competitions", label: "Competições" },
  { id: "injuries", label: "Lesões e Castigos" },
  { id: "contracts", label: "Contratos e Media" },
  { id: "transfers", label: "Transferências" },
  { id: "jobs", label: "Trabalhos" },
  { id: "records", label: "Recordes" },
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
  if (!n) return "messages";
  if (n.source === "transfer") return "transfers";
  const t = String(n.type || "");
  if (t === "cup_upset") return "competitions";
  if (t === "prize") return "records";
  if (t === "manager_dismissed" || t === "manager_hired")
    return "jobs";
  if (
    t === "transfer_in" ||
    t === "transfer_out" ||
    t === "auction_won" ||
    t.includes("transfer") ||
    t.includes("auction")
  )
    return "transfers";
  if (t === "renegotiation") return "contracts";
  return "messages";
}

/**
 * Converte linhas do `globalNews.news` em itens informativos (só leitura).
 * @param {Array} rows linhas `{id, source, type, title, description, amount, matchweek}`
 * @returns {Array} itens de inbox
 */
export function newsRowsToItems(rows) {
  return (Array.isArray(rows) ? rows : []).map((n) => ({
    id: `news-${n.source || "club"}-${n.id}`,
    cat: newsCategory(n),
    date:
      n.matchweek != null ? `Jornada ${n.matchweek}` : "Direção",
    title: n.title || "Notícia",
    body: n.description || "",
    redFlag: false,
    kind: "info",
    ref: null,
  }));
}

/**
 * Itens de lesões e castigos a partir do plantel do treinador.
 * @param {Array} squad jogadores com `injury_until_matchweek` / `suspension_until_matchweek`
 * @param {number} nowIdx relógio atual (calendarIndex)
 * @returns {Array} itens de inbox
 */
export function squadToMedicalItems(squad, nowIdx) {
  const items = [];
  for (const p of Array.isArray(squad) ? squad : []) {
    const inj = Number(p?.injury_until_matchweek) || 0;
    const sus = Number(p?.suspension_until_matchweek) || 0;
    if (inj > nowIdx) {
      items.push({
        id: `inj-${p.id}-${inj}`,
        cat: "injuries",
        date: "Departamento médico",
        title: `🩹 ${p.name} lesionado`,
        body: `De fora até à jornada ${inj + 1}.`,
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }
    if (sus > nowIdx) {
      items.push({
        id: `sus-${p.id}-${sus}`,
        cat: "injuries",
        date: "Castigos",
        title: `🟥 ${p.name} castigado`,
        body: `Suspenso até à jornada ${sus + 1}.`,
        redFlag: false,
        kind: "info",
        ref: null,
      });
    }
  }
  return items;
}
