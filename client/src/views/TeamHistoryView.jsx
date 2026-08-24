import { formatCurrency } from "../utils/formatters.js";

const EVENT_META = {
  transfer_in: {
    icon: "south_west",
    color: "text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-400",
    label: "Contratação",
  },
  transfer_out: {
    icon: "north_east",
    color: "text-red-400",
    chip: "bg-red-500/15 text-red-400",
    label: "Saída",
  },
  auction_won: {
    icon: "gavel",
    color: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-400",
    label: "Leilão",
  },
  prize: {
    icon: "emoji_events",
    color: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-400",
    label: "Prémio",
  },
  manager_dismissed: {
    icon: "person_remove",
    color: "text-rose-400",
    chip: "bg-rose-500/15 text-rose-400",
    label: "Despedimento de treinador",
  },
  manager_hired: {
    icon: "person_add",
    color: "text-sky-400",
    chip: "bg-sky-500/15 text-sky-400",
    label: "Novo treinador",
  },
};

/**
 * @param {{
 *   selectedTeam: object|null,
 *   clubHistory: object|null,
 *   clubHistoryTeamId: number|null,
 * }} props
 */
export function TeamHistoryView({ selectedTeam, clubHistory, clubHistoryTeamId }) {
  if (!clubHistory || clubHistoryTeamId !== selectedTeam?.id) {
    return (
      <div className="p-8 text-center text-on-surface-variant font-bold">
        A carregar histórico...
      </div>
    );
  }

  const { trophies = [], events = [], seasonRecords = [] } = clubHistory;
  const hasAnything =
    trophies.length > 0 || events.length > 0 || seasonRecords.length > 0;

  if (!hasAnything) {
    return (
      <div className="p-12 text-center">
        <span
          className="material-symbols-outlined text-on-surface-variant/30 text-4xl mb-2"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          history
        </span>
        <p className="text-zinc-500 font-bold">
          Sem histórico registado para esta equipa.
        </p>
      </div>
    );
  }

  const bestSeason = [...seasonRecords].sort(
    (a, b) => a.position - b.position || b.season - a.season,
  )[0];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── ÉPOCA A ÉPOCA ─────────────────────────────────────── */}
      {seasonRecords.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            Época a época (Liga)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {seasonRecords.map((rec) => {
              const isBest =
                bestSeason && rec.season === bestSeason.season;
              return (
                <div
                  key={rec.season}
                  className={`rounded-lg p-3 bg-surface-container border ${
                    isBest
                      ? "border-amber-500/40"
                      : "border-outline-variant/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-on-surface">
                      Época {rec.year}
                    </p>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                        rec.position === 1
                          ? "bg-amber-500/20 text-amber-400"
                          : rec.position <= 3
                            ? "bg-sky-500/20 text-sky-400"
                            : "bg-surface-bright text-on-surface-variant/70"
                      }`}
                    >
                      {rec.position === 1 && (
                        <span className="material-symbols-outlined text-[12px]">
                          emoji_events
                        </span>
                      )}
                      {rec.position}º lugar
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-black">
                    <span className="text-emerald-400">{rec.wins}V</span>
                    <span className="text-amber-400">{rec.draws}E</span>
                    <span className="text-red-400">{rec.losses}D</span>
                    <span className="text-on-surface-variant/50 ml-auto tabular-nums">
                      {rec.goalsFor}:{rec.goalsAgainst}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/70 font-bold mt-1">
                    {rec.points} pontos
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── PALMARÉS ─────────────────────────────────────────── */}
      {trophies.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              emoji_events
            </span>
            Palmarés
          </h3>
          <div className="flex flex-wrap gap-2">
            {trophies.map((trophy, idx) => {
              const isTopScorer = trophy.achievement.includes("Melhor Marcador");
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-amber-500/20 bg-amber-500/5"
                >
                  <span
                    className="material-symbols-outlined text-amber-400 text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {isTopScorer ? "sports_soccer" : "emoji_events"}
                  </span>
                  <div>
                    <p className="text-amber-400 font-black text-xs">
                      {trophy.achievement}
                    </p>
                    {trophy.season ? (
                      <p className="text-on-surface-variant text-[10px] font-bold">
                        {trophy.season}
                      </p>
                    ) : null}
                    {trophy.coach_name && trophy.is_human_coach && (
                      <p className="text-on-surface-variant/60 text-[9px] mt-0.5">
                        Treinador: {trophy.coach_name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── LINHA DO TEMPO ───────────────────────────────────── */}
      {events.length > 0 && (
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">history</span>
            Linha do tempo
          </h3>
          <div className="flex flex-col gap-1.5">
            {events.map((evt, idx) => {
              const meta = EVENT_META[evt.type] || {
                icon: "info",
                color: "text-on-surface-variant",
                chip: "bg-surface-bright text-on-surface-variant/70",
                label: evt.type,
              };
              const subtitle =
                evt.player_name ||
                (evt.type === "manager_hired" || evt.type === "manager_dismissed"
                  ? evt.related_team_name
                  : evt.related_team_name
                    ? `De ${evt.related_team_name}`
                    : "");
              return (
                <div
                  key={`${evt.year}-${evt.matchweek}-${evt.id ?? idx}`}
                  className="flex items-center gap-3 rounded-lg bg-surface-container px-4 py-3"
                >
                  <span
                    className={`shrink-0 w-8 h-8 rounded flex items-center justify-center ${meta.chip}`}
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {meta.icon}
                    </span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-on-surface truncate">
                        {evt.title || meta.label}
                      </p>
                      <span
                        className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${meta.chip}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    {subtitle && (
                      <p className="text-[11px] text-on-surface-variant/70 font-bold truncate">
                        {subtitle}
                      </p>
                    )}
                    <p className="text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest">
                      Jornada {evt.matchweek ?? "—"} · Ano {evt.year ?? "—"}
                    </p>
                  </div>
                  {evt.amount > 0 && (
                    <span className="shrink-0 text-xs text-tertiary font-black tabular-nums">
                      {formatCurrency(evt.amount)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
