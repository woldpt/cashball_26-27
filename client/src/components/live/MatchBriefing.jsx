import { useMemo } from "react";
import { useTactics } from "../../contexts/TacticsContext.jsx";
import { useGame } from "../../contexts/GameContext.jsx";
import { PrimaryCTA } from "../shared/PrimaryCTA.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import {
  buildBriefingViewModel,
  NextMatchCard,
  DifficultyGauge,
  StadiumCard,
  OpponentFormation,
  ThreatGrid,
  BriefingSkeleton,
  PrepStepper,
} from "./briefing/index.js";

/* ────────────────────────────────────────────────────────────────────────────
 * MatchBriefing — Fase 1 do pré-jogo.
 *
 * Orquestrador fino: deriva o view-model (memoizado) do nextMatchSummary do
 * servidor e compõe os blocos da pasta `./briefing/` (herói + confronto +
 * scouting). Lógica de derivação vive em `briefingViewModel.js` (testada em
 * `scripts/briefingViewModelRegression.mjs`); apresentação vive nos
 * subcomponentes.
 *
 * Desktop (lg+): hero (manchete + dificuldade + CTA na mesma linha) seguido
 * de uma grelha de duas colunas (confronto + scouting). Ocupa toda a largura
 * e a altura útil da viewport (100dvh - header/paddings do GameLayout), com
 * os cards a esticar e as células centradas, sem barras de scroll no caso
 * normal. Mobile/tablet mantêm um fluxo vertical legível.
 *
 * @returns {JSX.Element|null}
 */
export function MatchBriefing() {
  const { nextMatchSummary, teamInfo, setPrepPhase } = useTactics();
  const { handleOpenTeamSquad, nextMatchSummaryLoading } = useGame();
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
    return null;
  }

  return (
    <div className="space-y-3 short:space-y-1.5 lg:space-y-0 lg:flex lg:flex-col lg:gap-4 short:lg:gap-2 lg:min-h-[max(540px,calc(100dvh-9.5rem))] short:lg:min-h-0">
      {/* Header: manchete + contexto + dificuldade + CTA */}
      <div className="lg:shrink-0 bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 short:px-3 py-2 short:py-1 lg:py-3 short:lg:py-2 border-b border-outline-variant/15">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            <span aria-hidden>📋</span> Briefing · {vm.competition}
          </span>
          <PrepStepper current="briefing" />
        </div>
        <div className="px-4 short:px-3 py-3 short:py-2 lg:py-5 short:lg:py-3 flex flex-col lg:flex-row lg:items-center gap-3 short:gap-2 lg:gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-sm short:text-xs lg:text-base font-bold text-white leading-snug line-clamp-4 lg:line-clamp-2">
              {vm.headline}
            </p>
            {vm.stakes && (
              <span className="mt-1.5 lg:mt-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-outline-variant/25 text-gray-300">
                <span aria-hidden>🎯</span> {vm.stakes}
              </span>
            )}
          </div>
          <div className="lg:w-44 shrink-0">
            <DifficultyGauge score={vm.difficulty.score} label={vm.difficulty.label} />
          </div>
          <div aria-hidden className="hidden lg:block w-px self-stretch bg-outline-variant/25" />
          <div className="flex flex-col items-center gap-1">
            <PrimaryCTA onClick={() => setPrepPhase("tactics")}>
              Avançar para a Tática
            </PrimaryCTA>
            <span className="text-[9px] text-gray-600 font-bold">
              Podes voltar atrás a qualquer momento
            </span>
          </div>
        </div>
      </div>

      {/* Faixa do amigável: só para testar */}
      {vm.cupRound === 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/25 bg-surface-container px-4 short:px-3 py-2.5 short:py-2">
          <span aria-hidden>🤝</span>
          <p className="text-[11px] short:text-[10px] font-bold text-gray-300">
            Amigável de pré-época — só para testar: sem cartões nem lesões.
          </p>
        </div>
      )}

      {/* Confronto + scouting (ou espião sem adversário) */}
      <div className="flex flex-col lg:flex-row gap-3 short:gap-1.5 items-stretch lg:flex-1">
        {vm.hasOpponent ? (
          <div className="flex-1 min-w-0 lg:flex lg:flex-col">
            <NextMatchCard vm={vm} onOpenTeamSquad={handleOpenTeamSquad} />
          </div>
        ) : vm.spyGames.length > 0 ? (
          <div className="flex-1 min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden lg:flex lg:flex-col">
            <div className="px-4 short:px-3 py-2 short:py-1.5 border-b border-outline-variant/15">
              <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
                <span aria-hidden>🔭</span> Jogos da ronda
              </span>
            </div>
            <ul className="px-3 short:px-2 py-2 short:py-1.5 flex flex-col gap-1.5 short:gap-1">
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
        ) : null}
        <div className="lg:w-72 shrink-0 flex flex-col gap-3 short:gap-1.5 lg:h-full">
          {vm.stadium ? (
            <StadiumCard stadium={vm.stadium} />
          ) : vm.hasOpponent ? (
            <div className="min-w-0 bg-surface-container border border-outline-variant/25 rounded-2xl px-4 py-2.5 flex items-center justify-between lg:flex-none">
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
          {vm.formation && (
            <OpponentFormation formation={vm.formation} teamColor={vm.opponentColor} />
          )}
          <ThreatGrid threats={vm.threats} />
        </div>
      </div>
    </div>
  );
}
