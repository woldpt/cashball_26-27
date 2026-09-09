/**
 * orderedPair — ordena um par "eu vs adversário" pela perspetiva do local:
 * em casa devolve [eu, adversário], fora devolve [adversário, eu].
 *
 * Elimina os ternários `isHome ? ... : ...` espalhados pelos tiles do
 * briefing, que eram propensos a inversões silenciosas.
 *
 * @template T
 * @param {boolean} isHome - true quando se joga em casa
 * @param {T} mine - valor da equipa do utilizador
 * @param {T} theirs - valor do adversário
 * @returns {[T, T]} par ordenado [esquerda, direita] para renderizar
 */
export function orderedPair(isHome, mine, theirs) {
  return isHome ? [mine, theirs] : [theirs, mine];
}
