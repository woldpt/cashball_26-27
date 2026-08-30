import { isGoalType } from "../../live/liveHelpers.js";

/* ── MatchScoreboard — placar estilo transmissão (layout spectate) ──────
 *
 * Faixa full-width sobre os pitches:
 *   linha 1: [● nome casa]  [placar grande + minuto/FT]  [nome fora ●]
 *   linha 2: posse slim com % em cada extremo (só com dados).
 *
 * O resultado é derivado dos eventos até `liveMinute` (mesmo critério de
 * golo de LiveFixtureRow) ou, quando o jogo já tem resultado final
 * persistido, usa os valores finais diretamente.
 */
/* Props: fixture (events/posse/resultado final), teams (nomes+cores), liveMinute. */
export function MatchScoreboard({ fixture, teams, liveMinute }) {
  if (!fixture) return null;

  const hInfo = teams.find((t) => t.id === fixture.homeTeamId);
  const aInfo = teams.find((t) => t.id === fixture.awayTeamId);
  const hColor = hInfo?.color_primary || "#6366f1";
  const aColor = aInfo?.color_primary || "#f43f5e";

  const evts = fixture.events || [];
  const min = liveMinute ?? 0;
  const isFinished =
    fixture.finalHomeGoals != null && fixture.finalAwayGoals != null;

  const homeGoals = isFinished
    ? fixture.finalHomeGoals
    : evts.filter(
        (e) => e.minute <= min && isGoalType(e.type) && e.team === "home",
      ).length;
  const awayGoals = isFinished
    ? fixture.finalAwayGoals
    : evts.filter(
        (e) => e.minute <= min && isGoalType(e.type) && e.team === "away",
      ).length;

  const hasPossession = fixture.homePossession != null;

  return (
    <div className="shrink-0 border-b border-outline-variant/25 bg-surface-container-high/60">
      {/* ── Linha 1: equipas + placar ─────────────────────────────── */}
      <div
        className="flex items-center gap-3 sm:gap-4 px-3 sm:px-6 py-2.5"
        style={{
          background: `linear-gradient(90deg, ${hColor}1f 0%, transparent 38%, transparent 62%, ${aColor}1f 100%)`,
        }}
      >
        {/* Casa (nome volta-se para o placar) */}
        <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
          <span className="text-[11px] sm:text-sm font-black uppercase tracking-wide text-on-surface truncate">
            {hInfo?.name || "Casa"}
          </span>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: hColor, boxShadow: `0 0 8px ${hColor}80` }}
          />
        </div>

        {/* Placar */}
        <div className="shrink-0 flex flex-col items-center px-3 py-1 sm:px-5 sm:py-1.5 rounded-lg border border-outline-variant/25 bg-surface-container-low/80">
          <span className="flex items-center gap-2 sm:gap-3 font-headline font-black text-xl sm:text-3xl tabular-nums leading-none text-on-surface">
            <span className="min-w-[1ch] text-right">{homeGoals}</span>
            <span className="text-on-surface-variant/40 text-sm sm:text-lg">–</span>
            <span className="min-w-[1ch] text-left">{awayGoals}</span>
          </span>
          <span className="mt-0.5 text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-on-surface-variant tabular-nums">
            {isFinished ? "Fim" : `${min}'`}
          </span>
        </div>

        {/* Fora (espelha o lado da casa) */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: aColor, boxShadow: `0 0 8px ${aColor}80` }}
          />
          <span className="text-[11px] sm:text-sm font-black uppercase tracking-wide text-on-surface truncate">
            {aInfo?.name || "Fora"}
          </span>
        </div>
      </div>

      {/* ── Linha 2: posse slim (só com dados) ───────────────────── */}
      {hasPossession && (
        <div className="flex items-center gap-2 px-3 sm:px-6 pb-2">
          <span className="w-8 text-[9px] font-bold tabular-nums text-on-surface-variant/80">
            {fixture.homePossession}%
          </span>
          <div className="h-1.5 flex-1 rounded-full overflow-hidden bg-surface-container-high flex">
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                width: `${fixture.homePossession}%`,
                background: `linear-gradient(90deg, ${hColor}, ${hColor}cc)`,
                boxShadow: `0 0 8px ${hColor}66`,
              }}
            />
            <div
              className="h-full flex-1 transition-all duration-700 ease-out"
              style={{
                background: `linear-gradient(90deg, ${aColor}cc, ${aColor})`,
                boxShadow: `0 0 8px ${aColor}66`,
              }}
            />
          </div>
          <span className="w-8 text-right text-[9px] font-bold tabular-nums text-on-surface-variant/80">
            {fixture.awayPossession}%
          </span>
        </div>
      )}
    </div>
  );
}
