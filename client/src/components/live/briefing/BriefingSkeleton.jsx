import { memo } from "react";

/**
 * Esqueleto de carregamento do briefing — blocos pulsantes com o mesmo
 * esqueleto do layout real (herói + confronto + scouting).
 * @returns {JSX.Element}
 */
export const BriefingSkeleton = memo(function BriefingSkeleton() {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-label="A carregar briefing da jornada"
    >
      <span className="sr-only">A carregar briefing da jornada…</span>
      <div
        aria-hidden
        className="bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-outline-variant/15">
          <div className="h-3 w-40 rounded bg-surface-bright animate-pulse" />
        </div>
        <div className="px-4 py-4 flex flex-col lg:flex-row gap-4">
          <div className="flex-1 h-5 rounded bg-surface-bright animate-pulse" />
          <div className="lg:w-44 h-6 rounded bg-surface-bright animate-pulse" />
          <div className="lg:w-60 h-12 rounded-2xl bg-surface-bright animate-pulse" />
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-3">
        <div
          aria-hidden
          className="flex-1 h-72 rounded-2xl bg-surface-container border border-outline-variant/25 animate-pulse"
        />
        <div
          aria-hidden
          className="lg:w-72 h-72 rounded-2xl bg-surface-container border border-outline-variant/25 animate-pulse"
        />
      </div>
    </div>
  );
});
