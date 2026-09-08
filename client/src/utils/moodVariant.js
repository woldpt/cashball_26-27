/* ── moodVariant — variação emocional do humor pós-jogo ───────────────────
 *
 * Refina o resultado (vitória/derrota/empate) com o contexto do adversário,
 * para o modal de humor diferenciar cenários:
 *   - Liga: posição do adversário na sua divisão (líder vs lanterna).
 *     Perder com o líder é "esperado"; perder com o último é "vergonhoso".
 *   - Taça: diferença de escalão. Perder com equipa de divisão superior
 *     (número menor) é uma derrota esperada — os adeptos não ficam furiosos.
 *
 * Função pura (sem acesso a estado) para facilitar testes.
 */

/**
 * @param {{
 *   outcome: "win"|"loss"|"draw",
 *   source: "league"|"cup",
 *   myDivision?: number,
 *   opponentDivision?: number,
 *   opponentRank?: number,      // 1 = líder da divisão
 *   opponentTeamCount?: number, // nº de equipas na divisão do adversário
 * }} params
 * @returns {string} variante (ex.: "loss_expected", "win_upset", "draw")
 */
export function computeMoodVariant({
  outcome,
  source,
  myDivision,
  opponentDivision,
  opponentRank,
  opponentTeamCount,
}) {
  // ── Taça: knockout sem empates; o fator é a diferença de escalão ──────
  if (source === "cup") {
    const oppHigher =
      myDivision != null &&
      opponentDivision != null &&
      opponentDivision < myDivision; // divisão menor = escalão superior
    if (outcome === "loss") return oppHigher ? "loss_expected" : "loss";
    if (outcome === "win") return oppHigher ? "win_upset" : "win";
    return "draw";
  }

  // ── Liga: o fator é a posição do adversário na sua divisão ────────────
  const rank = Number(opponentRank) || 0;
  const total = Number(opponentTeamCount) || 0;
  const isTop = rank > 0 && rank <= 2;
  const isBottom = total > 0 && rank >= total - 1;

  if (outcome === "loss") {
    if (isBottom) return "loss_shameful";
    if (isTop) return "loss_expected";
    return "loss";
  }
  if (outcome === "win") {
    if (isTop) return "win_big";
    return "win";
  }
  // draw
  if (isTop) return "draw_honorable";
  if (isBottom) return "draw_bitter";
  return "draw";
}
