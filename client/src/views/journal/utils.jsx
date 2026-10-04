/**
 * Utilitários de texto do Jornal: normalização de pesquisa, resumos de
 * pendência, destaque do termo e medição de entidades. Sem JSX de layout —
 * só o <mark> do destaque.
 */
import { formatCurrency } from "../../utils/formatters.js";

/**
 * Normaliza para pesquisa (sem acentos, minúsculas).
 * @param {string} value
 * @returns {string}
 */
export function searchText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Resolve uma referência de equipa contra a lista da sala.
 * @param {Array} teams
 * @param {{ id?: number|string }} ref
 * @returns {object}
 */
export function teamFromRef(teams, ref) {
  return teams.find((team) => String(team.id) === String(ref?.id)) || ref;
}

/**
 * Normaliza o corpo para uma linha (o `truncate` do CSS trata do corte).
 * @param {string} body
 * @returns {string}
 */
export function getSnippet(body) {
  if (!body) return "";
  return body.replace(/\n/g, " ");
}

/**
 * Linha secundária das pendências: dado útil por tipo para a lista e o
 * painel de ação. Genérico: qualquer item com redFlag tem resumo.
 * @param {object} it item do inbox
 * @returns {string}
 */
export function flagSummary(it) {
  if (!it?.redFlag) return "";
  if (it.kind === "contract") {
    const wage = it.extra?.requestedWage != null
      ? formatCurrency(it.extra.requestedWage)
      : null;
    return wage
      ? `Exige ${wage}/sem · sem resposta vai a leilão`
      : "Exige resposta · sem resposta vai a leilão";
  }
  if (it.kind === "job") {
    const rec = it.extra?.record ? ` · ${it.extra.record}` : "";
    return `${it.extra?.position ?? "?"}.º · ${it.extra?.points ?? "?"} pts${rec}`;
  }
  if (it.kind === "sponsor") return "Sem escolha não há Pronto · marca única";
  if (it.kind === "board") {
    const streak = it.extra?.streak ?? 1;
    return `Orçamento ${formatCurrency(it.extra?.budget ?? 0)} · ${streak} semana${streak === 1 ? "" : "s"} no vermelho`;
  }
  return "Responde antes do próximo jogo.";
}

/**
 * Destaca o termo pesquisado com <mark>. O match é insensível a acentos
 * e caixa (como o filtro, que usa `searchText`), mas pinta o texto
 * original. Sem regex: índice normalizado -> índice original, porque os
 * acentos mudam o comprimento da string.
 * @param {string} text
 * @param {string} query
 * @returns {string|Array}
 */
export function highlightText(text, query) {
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
 * Prefixo da ronda («dos Quartos de final», «das Meias-finais»).
 * @param {string} roundName
 * @returns {string}
 */
export function cupDrawRoundPrefix(roundName) {
  if (!roundName) return "da próxima eliminatória";
  if (/^meias/i.test(roundName)) return `das ${roundName}`;
  if (/^final/i.test(roundName)) return `da ${roundName}`;
  return `dos ${roundName}`;
}

/**
 * Parte uma lista de parts em parágrafos com base em separadores "\n\n".
 * Cada texto que contém "\n\n" é dividido e os segmentos resultantes
 * ficam em parágrafos separados.
 * @param {Array} parts
 * @returns {Array<Array>}
 */
export function splitPartsByParagraphs(parts) {
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
