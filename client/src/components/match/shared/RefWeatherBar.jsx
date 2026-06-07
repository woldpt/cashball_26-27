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

/* ── Referee / Weather / Attendance bar ─────────────────────────────────── */
export function RefWeatherBar({ attendance, referee, weatherEvent, teamStadium, className }) {
  if (!attendance && !referee?.refereeName && !weatherEvent) return null;

  const refBalance = referee?.balance ?? 50;

  return (
    <div className={`flex flex-wrap items-center gap-2 px-4 py-3 rounded-md border border-outline/40 bg-surface-container text-[10px] font-black ${className || ""}`}>
      {attendance && (
        <span className="text-on-surface-variant flex items-center gap-1.5">
          <span className="text-base">🏟️</span>
          <span>{teamStadium ? `${teamStadium} · ` : ""}</span>
          <span className="text-on-surface tabular-nums">
            {attendance.toLocaleString("pt-PT")}
          </span>
          <span className="text-on-surface-variant/80">adeptos</span>
        </span>
      )}
      {referee?.refereeName && (
        <span className="text-on-surface-variant flex items-center gap-1.5">
          <span className="text-base">👤</span>
          <span className="text-on-surface">{referee.refereeName}</span>
          <span
            className={`ml-1 font-black tabular-nums ${refBalance >= 60 ? "text-emerald-400" : refBalance <= 40 ? "text-red-400" : "text-on-surface-variant"}`}
          >
            {refBalance}
          </span>
        </span>
      )}
      {weatherEvent && (
        <span className="text-on-surface-variant flex items-center gap-1">
          <span className="text-sm">{weatherEvent.emoji}</span>
          <span>{WEATHER_LABELS[weatherEvent.emoji] || ""}</span>
        </span>
      )}
    </div>
  );
}
