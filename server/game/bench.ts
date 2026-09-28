import type { MatchFixture, PlayerRow } from "../types";

type DeriveBenchArgs = {
  roster: PlayerRow[];
  tacticPositions?: Record<number, string>;
  lineupIds: Set<number>;
  fixture?: MatchFixture;
  /** Quando true (lesões/expulsões), banco vazio na tática = todo o roster. */
  allowUnlisted?: boolean;
};

/**
 * ÚNICA derivação de banco (F2): tática → Set de Suplente + filter.
 * Antes em 3 cópias (lesão, GR expulso, pausa de subs) com o mesmo
 * `benchIds/availableBench/grBench` e uma divergência subtil: a pausa
 * de subs é estrita (`benchIds.has`), as outras aceitam roster todo
 * quando a tática não lista banco (`benchIds.size === 0`).
 */
export function deriveBench({
  roster,
  tacticPositions,
  lineupIds,
  fixture,
  allowUnlisted = true,
}: DeriveBenchArgs): { availableBench: PlayerRow[]; grBench: PlayerRow[]; benchIds: Set<number> } {
  const positions: Record<number, string> = tacticPositions || {};
  const benchIds = new Set(
    Object.entries(positions)
      .filter(([, status]) => status === "Suplente")
      .map(([id]) => Number(id)),
  );
  const subbedOut = (fixture?._subbedOut as Set<number> | undefined);
  const availableBench = (roster || []).filter(
    (p) =>
      !lineupIds.has(p.id) &&
      (allowUnlisted ? benchIds.size === 0 || benchIds.has(p.id) : benchIds.has(p.id)) &&
      !(subbedOut?.has(p.id)),
  );
  return { availableBench, grBench: availableBench.filter((p) => p.position === "GR"), benchIds };
}
