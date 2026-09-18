import { useMemo } from "react";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { useGame } from "../../contexts/GameContext.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import {
  buildBriefingViewModel,
  DuelHero,
  PrepCtaCard,
  CompareRadar,
  StadiumCard,
  OpponentFormation,
  ThreatGrid,
  BriefingSkeleton,
} from "./briefing/index.js";

/* ────────────────────────────────────────────────────────────────────────────
 * MatchBriefing — Fase 1 do pré-jogo (estilo emissão).
 *
 * Orquestrador fino: deriva o view-model (memoizado) do nextMatchSummary do
 * servidor e compõe os blocos da pasta `./briefing/`. Lógica de derivação
 * vive em `briefingViewModel.js` (testada em
 * `scripts/briefingViewModelRegression.mjs`); apresentação vive nos
 * subcomponentes. Só se apresentam dados reais do view-model — sem
 * countdowns, hot-zones ou conselhos inventados.
 *
 * Desktop (lg+): herói de duelo nas duas primeiras colunas com o cartão de
 * ação ao lado, seguidos de radar + campo + scout. Mobile/tablet: os mesmos
 * blocos empilhados (herói → ação → radar → campo → scout). Sem adversário
 * não há duelo: mostra só a ação e os jogos da ronda.
 *
 * @returns {JSX.Element|null}
 */
export function MatchBriefing() {
  const { teamInfo, setPrepPhase } = useTactics();
  const { nextMatchSummary, handleOpenTeamSquad, nextMatchSummaryLoading } = useGame();
  const vm = useMemo(
    () => buildBriefingViewModel(nextMatchSummary, teamInfo),
    [nextMatchSummary, teamInfo],
  );

  if (!vm) {
    if (nextMatchSummaryLoading) return <BriefingSkeleton />;
    if (!nextMatchSummary)
      return (
        <EmptyState
          emoji="📋"
          title="Sem briefing disponível"
          description="A aguardar os dados do próximo jogo…"
        />
      );
    // vm nulo mas nextMatchSummary existe → inconsistência de dados
    console.warn(
      "[MatchBriefing] buildBriefingViewModel retornou null para nextMatchSummary existente",
      { nextMatchSummary },
    );
    return null;
  }

  const advance = () => setPrepPhase("tactics");

  return (
    <div className="space-y-3 short:space-y-1.5 lg:space-y-4 short:lg:space-y-2">
      {/* Faixa do amigável: só para testar */}
      {vm.cupRound === 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/25 bg-surface-container px-4 short:px-3 py-2.5 short:py-2">
          <span aria-hidden>🤝</span>
          <p className="text-[11px] short:text-[10px] font-bold text-gray-300">
            Amigável de pré-época — só para testar: sem cartões nem lesões.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 short:gap-1.5 items-stretch">
        {vm.hasOpponent ? (
          <>
            <div className="min-w-0 lg:col-span-2">
              <DuelHero vm={vm} onOpenTeamSquad={handleOpenTeamSquad} />
            </div>
            <PrepCtaCard onAdvance={advance} />
            <CompareRadar vm={vm} onOpenTeamSquad={handleOpenTeamSquad} />
            <div className="min-w-0 flex flex-col gap-3 short:gap-1.5">
              {vm.formation ? (
                <OpponentFormation
                  formation={vm.formation}
                  teamColor={vm.opponentColor}
                  weather={vm.weather}
                />
              ) : (
                <div className="min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-gray-600 font-black">
                    <span aria-hidden>🏟️</span> Estádio e ambiente
                  </span>
                  <span className="text-[11px] font-black text-white">
                    {vm.venue === "Jamor"
                      ? "Neutro — Jamor"
                      : vm.venue === "Casa"
                        ? "Jogas em casa"
                        : "Jogas fora"}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex flex-col gap-3 short:gap-1.5">
              {vm.stadium ? (
                <StadiumCard stadium={vm.stadium} />
              ) : vm.formation ? (
                <div className="min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-gray-600 font-black">
                    <span aria-hidden>🏟️</span> Estádio e ambiente
                  </span>
                  <span className="text-[11px] font-black text-white">
                    {vm.venue === "Jamor"
                      ? "Neutro — Jamor"
                      : vm.venue === "Casa"
                        ? "Jogas em casa"
                        : "Jogas fora"}
                  </span>
                </div>
              ) : null}
              <ThreatGrid threats={vm.threats} />
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 lg:col-span-1">
              <PrepCtaCard onAdvance={advance} />
            </div>
            {vm.spyGames.length > 0 && (
              <div className="min-w-0 lg:col-span-2 bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
                <div className="px-4 short:px-3 py-2 short:py-1.5 border-b border-outline-variant/15">
                  <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
                    <span aria-hidden>🔭</span> Jogos da ronda
                  </span>
                </div>
                <ul className="px-3 short:px-2 py-2 short:py-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 short:gap-1">
                  {vm.spyGames.map((g, i) => (
                    <li
                      key={`${g.homeTeamId}-${g.awayTeamId}-${i}`}
                      className="min-w-0 bg-surface-container-low/60 border border-outline-variant/25 rounded-xl px-2.5 py-2 flex items-center gap-2 text-[11px] font-black text-white"
                    >
                      <span className="flex-1 min-w-0 truncate text-right">{g.homeName}</span>
                      <span aria-hidden className="shrink-0 text-gray-600 text-[9px]">VS</span>
                      <span className="flex-1 min-w-0 truncate">{g.awayName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
