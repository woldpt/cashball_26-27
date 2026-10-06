import { otherGoals, teamTextColor } from "./liveHelpers.js";

/* ── LiveGoalTicker — "Multiplex": últimos golos dos outros campos ───────
 *
 * Estilo relato de rádio: cada golo noutro jogo entra no topo com o minuto,
 * o resultado logo a seguir e o marcador. Clicar abre o detalhe do jogo.
 */

/**
 * @param {Object} props
 * @param {Array<Object>} props.fixtures - matchResults.results
 * @param {Array<{id:number,name:string,color_primary?:string,color_secondary?:string}>} props.teams
 * @param {number} props.liveMinute
 * @param {(fixture: Object) => boolean} props.skip - jogos a excluir (o meu)
 * @param {(fixture: Object) => void} props.onOpenDetail
 * @returns {JSX.Element}
 */
export function LiveGoalTicker({ fixtures, teams, liveMinute, skip, onOpenDetail }) {
  const goals = otherGoals(fixtures, liveMinute, skip);
  const teamById = (id) => teams.find((t) => t.id === id);

  return (
    <section
      aria-label="Golos noutros campos"
      className="rounded-lg bg-surface-container-low border border-outline-variant/10 overflow-hidden"
    >
      <header className="px-3 py-2 border-b border-outline-variant/10 bg-surface-container-high flex items-center gap-1.5">
        <span aria-hidden className="material-symbols-outlined text-[16px] leading-none text-primary">
          radio
        </span>
        <h3 className="font-headline font-extrabold text-[11px] tracking-tight uppercase text-primary">
          Multiplex
        </h3>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
          Outros campos
        </span>
      </header>
      {goals.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-on-surface-variant/60 text-center italic">
          Sem golos noutros campos.
        </p>
      ) : (
        <ol aria-live="polite" className="flex flex-col divide-y divide-outline-variant/10">
          {goals.map((g) => {
            const home = teamById(g.fixture.homeTeamId);
            const away = teamById(g.fixture.awayTeamId);
            const scorer = g.side === "home" ? home : away;
            return (
              <li key={g.key} style={{ animation: "commentaryFadeIn 0.6s ease" }}>
                <button
                  type="button"
                  onClick={() => onOpenDetail(g.fixture)}
                  className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-surface-container-high/60 transition-colors"
                >
                  <span className="shrink-0 w-7 text-[11px] leading-5 font-black tabular-nums text-on-surface-variant/70">
                    {g.minute}&apos;
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[12px] leading-5 font-bold text-on-surface">
                      <span className={`min-w-0 truncate ${g.side === "home" ? "" : "opacity-60"}`}>
                        {home?.name ?? "—"}
                      </span>
                      <span className="shrink-0 tabular-nums font-black">
                        {g.home}-{g.away}
                      </span>
                      <span className={`min-w-0 truncate ${g.side === "away" ? "" : "opacity-60"}`}>
                        {away?.name ?? "—"}
                      </span>
                    </span>
                    <span className="block text-[11px] leading-4 truncate" style={{ color: teamTextColor(scorer) }}>
                      ⚽ {g.playerName || scorer?.name}
                      {g.type === "own_goal" ? " (auto-golo)" : g.type === "penalty_goal" ? " (pen.)" : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
