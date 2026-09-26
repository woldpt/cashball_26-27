import { useMemo } from "react";
import { readableColor } from "../utils/colorHelpers.js";
import { TeamCrest } from "../components/shared/TeamCrest.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { TabBar } from "../components/shared/TabBar.jsx";
import { Badge } from "../components/shared/Badge.jsx";

const CREST_SIZE = "w-9 h-9 text-xs sm:w-11 sm:h-11 sm:text-base";

/**
 * Linha de resultado em horizontal (brasão ao lado do nome), no espírito
 * do PlayerRow: compacta e sem truncar nomes de forma agressiva.
 */
function ResultCard({ r, roundName, isFinal, hInfo, aInfo, isMyMatch }) {
  const winnerInfo = r.winnerId === r.homeTeamId ? hInfo : aInfo;
  const finalNote = r.decidedByPenalties
    ? "Decidido nos penáltis"
    : r.wentToET
      ? "Após prolongamento"
      : null;
  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isMyMatch
          ? "border-primary/40 bg-primary/10"
          : "border-outline-variant/25 bg-surface-container-low"
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
        <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
          <span
            title={hInfo?.name || r.homeTeamId}
            className="font-black text-sm text-right truncate min-w-0"
            style={{ color: readableColor(hInfo?.color_primary) || "#fff" }}
          >
            {hInfo?.name || r.homeTeamId}
          </span>
          <TeamCrest team={hInfo} size={CREST_SIZE} />
        </div>

        <div className="flex flex-col items-center shrink-0">
          <span className="text-xl sm:text-2xl font-black text-on-surface tabular-nums tracking-tight">
            {r.homeGoals}–{r.awayGoals}
          </span>
          {r.decidedByPenalties && (
            <span className="text-[10px] text-amber-400 font-bold tabular-nums">
              ({r.penaltyHomeGoals}–{r.penaltyAwayGoals} g.p.)
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <TeamCrest team={aInfo} size={CREST_SIZE} />
          <span
            title={aInfo?.name || r.awayTeamId}
            className="font-black text-sm text-left truncate min-w-0"
            style={{ color: readableColor(aInfo?.color_primary) || "#fff" }}
          >
            {aInfo?.name || r.awayTeamId}
          </span>
        </div>
      </div>

      {(isFinal || r.winnerId) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 sm:px-4 pb-3">
          <Badge variant="neutral" title={roundName}>
            {roundName}
          </Badge>
          {finalNote && <Badge variant="warning">{finalNote}</Badge>}
          {isFinal ? (
            <Badge variant="warning">🏆 Campeão — {winnerInfo?.name}</Badge>
          ) : (
            r.winnerId && (
              <Badge variant="info" title={winnerInfo?.name}>
                ✓ {winnerInfo?.name}
              </Badge>
            )
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   cupRoundResults?: { results?: object[], round?: number, roundName?: string, isFinal?: boolean }|null,
 *   cupDraw?: { fixtures?: object[], roundName?: string, season?: string|number }|null,
 *   me?: { teamId?: string }|null,
 *   teams?: object[],
 *   cupResultsFilter?: string,
 *   setCupResultsFilter?: (f: string) => void,
 * }} props
 */
export function CupTab({
  cupRoundResults,
  cupDraw,
  me,
  teams = [],
  cupResultsFilter = "all",
  setCupResultsFilter,
}) {
  // Lookup O(1) em vez de `teams.find` dentro do map.
  const teamById = useMemo(
    () => new Map((teams || []).map((t) => [t.id, t])),
    [teams],
  );
  const myTeamId = me?.teamId;

  if (!cupRoundResults && !cupDraw) {
    return (
      <EmptyState
        emoji="🏆"
        title="Sem dados de Taça disponíveis neste momento."
        description="Os resultados da Taça aparecem aqui após cada eliminatória."
      />
    );
  }

  const allResults = cupRoundResults?.results || [];
  const myResults = allResults.filter(
    (r) => r.homeTeamId === myTeamId || r.awayTeamId === myTeamId,
  );
  // Se a equipa do utilizador já foi eliminada, ignorar o filtro "mine"
  // para não prender o utilizador numa vista vazia.
  const shown =
    cupResultsFilter === "mine" && myResults.length > 0 ? myResults : allResults;
  const competition =
    cupRoundResults?.round === 0 ? "Amigável" : "Taça de Portugal";

  return (
    <div className="space-y-4">
      {cupRoundResults && (
        <Panel
          icon="trophy"
          title="Resultados"
          meta={cupRoundResults.roundName}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <Badge variant="info">{competition}</Badge>
            {myResults.length > 0 && (
              <TabBar
                tabs={[
                  { key: "all", label: "Todos" },
                  { key: "mine", label: "O meu jogo" },
                ]}
                active={cupResultsFilter}
                onChange={setCupResultsFilter}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shown.map((r, idx) => (
              <ResultCard
                key={r.id ?? `${r.homeTeamId}-${r.awayTeamId}-${idx}`}
                r={r}
                roundName={cupRoundResults.roundName}
                isFinal={cupRoundResults.isFinal}
                hInfo={r.homeTeam || teamById.get(r.homeTeamId)}
                aInfo={r.awayTeam || teamById.get(r.awayTeamId)}
                isMyMatch={
                  r.homeTeamId === myTeamId || r.awayTeamId === myTeamId
                }
              />
            ))}
          </div>
        </Panel>
      )}

      {cupDraw && !cupRoundResults && (
        <Panel
          icon="trophy"
          title={`Sorteio — ${cupDraw.roundName}`}
          meta={`Taça de Portugal · ${cupDraw.season}`}
        >
          <div className="space-y-3">
            {(cupDraw.fixtures || []).map((fixture, idx) => {
              const hInfo = fixture.homeTeam;
              const aInfo = fixture.awayTeam;
              const isMine =
                hInfo?.id === myTeamId || aInfo?.id === myTeamId;
              return (
                <div
                  key={fixture.id ?? idx}
                  className={`relative flex items-center gap-4 rounded-xl border px-5 py-3.5 ${
                    isMine
                      ? "border-amber-500/50 bg-amber-950/20"
                      : "border-outline-variant/25 bg-surface-container-low"
                  }`}
                >
                  {isMine && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 rounded-full text-[10px] font-black text-black uppercase tracking-widest whitespace-nowrap">
                      O meu jogo
                    </span>
                  )}
                  <div className="flex-1 min-w-0 flex items-center justify-end gap-3">
                    <span
                      title={hInfo?.name || "?"}
                      className="font-black text-sm text-right truncate min-w-0"
                      style={{
                        color: readableColor(hInfo?.color_primary) || "#fff",
                      }}
                    >
                      {hInfo?.name || "?"}
                    </span>
                    <TeamCrest team={hInfo} size="w-9 h-9 text-sm" />
                  </div>
                  <div className="shrink-0 w-8 h-8 rounded-full bg-surface-bright border border-outline-variant/25 flex items-center justify-center">
                    <span className="text-on-surface-variant text-[10px] font-black uppercase">
                      vs
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <TeamCrest team={aInfo} size="w-9 h-9 text-sm" />
                    <span
                      title={aInfo?.name || "?"}
                      className="font-black text-sm text-left truncate min-w-0"
                      style={{
                        color: readableColor(aInfo?.color_primary) || "#fff",
                      }}
                    >
                      {aInfo?.name || "?"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
