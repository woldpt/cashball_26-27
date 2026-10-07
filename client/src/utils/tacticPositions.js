const VALID_FORMATIONS = new Set([
  "4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-2-4", "5-4-1",
]);

/**
 * Tática "limpa": todos os jogadores do plantel ficam "Excluído", mas a
 * formação mantém-se. O servidor descarta qualquer `setTactic` sem uma
 * formação válida, por isso nunca se pode enviar `formation: ""`.
 *
 * @param {Object} prev Tática anterior (formation, style, positions…).
 * @param {Array<{id: number|string}>} squad Plantel atual.
 * @returns {Object} Nova tática, com a formação anterior (ou "4-4-2").
 */
export function buildClearedTactic(prev, squad) {
  const formation = VALID_FORMATIONS.has(prev?.formation)
    ? prev.formation
    : "4-4-2";
  return {
    ...prev,
    formation,
    positions: Object.fromEntries(
      (squad || []).map((p) => [p.id, "Excluído"]),
    ),
  };
}

/**
 * Conta quantos jogadores têm um dado estado na tática, ignorando ids que já
 * não estão no plantel (vendidos/leiloados) e o `excludeId`.
 *
 * @param {Object<string, string>} positions Mapa id → estado.
 * @param {string} status "Titular" | "Suplente" | "Excluído".
 * @param {Set<number>} squadIds Ids (Number) do plantel atual.
 * @param {number} [excludeId] Jogador a não contar (o que está a ser movido).
 * @returns {number}
 */
export function countStatus(positions, status, squadIds, excludeId) {
  return Object.entries(positions || {}).filter(
    ([id, s]) =>
      s === status && squadIds.has(Number(id)) && Number(id) !== excludeId,
  ).length;
}

/**
 * Estado das substituições da minha equipa tal como o servidor o tem
 * (`subsUsed`/`subbedOutIds` do payload de intervalo).
 *
 * @param {Object|null|undefined} fixture Fixture do payload de intervalo.
 * @param {number|string|null|undefined} myTeamId Id da minha equipa.
 * @param {Array<number|string>} mySquadIds Ids do plantel atual.
 * @returns {{subsMade: number, subbedOut: number[]}|null} `null` se o fixture
 *   não trouxer `subsUsed` (servidor antigo → o cliente não mexe no estado).
 */
export function subsStateFromFixture(fixture, myTeamId, mySquadIds) {
  if (!fixture?.subsUsed) return null;
  const squad = new Set((mySquadIds || []).map(Number));
  return {
    subsMade: Number(fixture.subsUsed[myTeamId] ?? 0),
    subbedOut: (fixture.subbedOutIds || []).map(Number).filter((id) => squad.has(id)),
  };
}

/**
 * Procura o fixture da minha equipa (liga: `homeTeamId`/`awayTeamId`; taça:
 * `homeTeam.id`/`awayTeam.id`) e devolve o seu estado de substituições.
 *
 * @param {Array<Object>|undefined} fixtures Fixtures do payload.
 * @param {number|string|null|undefined} myTeamId Id da minha equipa.
 * @param {Array<{id: number|string}>} mySquad Plantel atual.
 * @returns {{subsMade: number, subbedOut: number[]}|null}
 */
export function subsStateFromFixtures(fixtures, myTeamId, mySquad) {
  if (myTeamId == null) return null;
  const mine = (fixtures || []).find((fx) =>
    [fx.homeTeamId ?? fx.homeTeam?.id, fx.awayTeamId ?? fx.awayTeam?.id].some(
      (id) => Number(id) === Number(myTeamId),
    ),
  );
  return subsStateFromFixture(mine, myTeamId, (mySquad || []).map((p) => p.id));
}
