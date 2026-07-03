/* eslint-disable react-refresh/only-export-components */
/* ── Weather labels ─────────────────────────────────────────────────────── */
export const WEATHER_LABELS = {
  "☀️": "Sol",
  "🌧️": "Chuva",
  "⛈️": "Chuva forte",
  "💨": "Vento",
  "🥶": "Frio",
  "🌫️": "Nevoeiro",
  "❄️": "Neve",
};

/* ── Referee / Weather / Attendance bar ───────────────────────────────────
 * Inserts visible • separators between the three contextual segments so
 * they no longer visually merge into one string. Emojis sized down to
 * match label text instead of dominating it. */
export function RefWeatherBar({ attendance, referee, weatherEvent, teamStadium, className }) {
  if (!attendance && !referee?.refereeName && !weatherEvent) return null;

  const refBalance = referee?.balance ?? 50;
  const refBalanceColor =
    refBalance >= 60 ? "text-emerald-400"
      : refBalance <= 40 ? "text-red-400"
        : "text-on-surface-variant";

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 rounded-md border border-outline/40 bg-surface-container text-[10px] font-semibold ${className || ""}`}>
      {attendance && (
        <span className="text-on-surface-variant flex items-center gap-1.5">
          <span className="text-[11px]">🏟️</span>
          {teamStadium && <span className="text-on-surface">{teamStadium}</span>}
          <span className="text-on-surface-variant/40">·</span>
          <span className="text-on-surface tabular-nums">
            {attendance.toLocaleString("pt-PT")}
          </span>
          <span className="text-on-surface-variant/80">adeptos</span>
        </span>
      )}

      {attendance && referee?.refereeName && (
        <span className="text-on-surface-variant/30" aria-hidden="true">•</span>
      )}

      {referee?.refereeName && (
        <span className="text-on-surface-variant flex items-center gap-1.5">
          <span className="text-[11px]">👤</span>
          <span className="text-on-surface">{referee.refereeName}</span>
          <span
            className={`font-bold tabular-nums ${refBalanceColor}`}
            title="Equilíbrio do árbitro"
          >
            {refBalance}
          </span>
        </span>
      )}

      {weatherEvent && (attendance || referee?.refereeName) && (
        <span className="text-on-surface-variant/30" aria-hidden="true">•</span>
      )}

      {weatherEvent && (
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="text-[11px]">{weatherEvent.emoji}</span>
          <span>{WEATHER_LABELS[weatherEvent.emoji] || ""}</span>
        </span>
      )}
    </div>
  );
}
