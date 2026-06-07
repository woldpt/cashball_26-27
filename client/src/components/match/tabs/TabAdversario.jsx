import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { getPosStyle } from "../matchConstants.js";
import { PitchFormation, BenchPlayers } from "../shared/index.js";

const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };

const _sortByPos = (arr) =>
  [...arr].sort(
    (a, b) =>
      (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) ||
      (b.skill ?? 0) - (a.skill ?? 0),
  );

/* ── TabAdversario — Opponent formation + bench ─────────────────────────── */
export function TabAdversario({ fixture, myTeamId, teams }) {
  if (!fixture) return null;

  const hasLineups = fixture?.homeLineup && fixture?.awayLineup;
  const isHome = fixture.homeTeamId === myTeamId;
  const oppLineup = isHome ? fixture.awayLineup : fixture.homeLineup;
  const oppTeamId = isHome ? fixture.awayTeamId : fixture.homeTeamId;
  const oppInfo = teams.find((t) => t.id === oppTeamId);

  const oppTactic = isHome ? fixture._t2 : fixture._t1;
  const formation = oppTactic?.formation || null;
  const styleRaw = oppTactic?.style?.toUpperCase?.() || null;
  const styleLabel =
    styleRaw === "OFENSIVO" ? "Ofensivo"
      : styleRaw === "DEFENSIVO" ? "Defensivo"
        : styleRaw === "EQUILIBRADO" ? "Equilibrado"
          : null;

  const starters = _sortByPos(oppLineup.filter((p) => p.is_starter === true).slice(0, 11));
  const bench = _sortByPos(oppLineup.filter((p) => p.is_starter === false));

  const rows = {
    ATA: starters.filter((p) => p.position === "ATA"),
    MED: starters.filter((p) => p.position === "MED"),
    DEF: starters.filter((p) => p.position === "DEF"),
    GR: starters.filter((p) => p.position === "GR"),
  };

  const posColors = {
    GR: "bg-amber-500 text-zinc-950",
    DEF: "bg-sky-500 text-zinc-950",
    MED: "bg-emerald-500 text-zinc-950",
    ATA: "bg-rose-500 text-white",
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
      {/* ── Opponent header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-md bg-surface-container border border-outline-variant/25">
        <span
          className="text-base font-black font-headline tracking-tight uppercase truncate"
          style={{ color: oppInfo?.color_primary || "#f59e0b" }}
        >
          {oppInfo?.name || "Adversário"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {(formation || styleLabel) && (
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/80 shrink-0">
              {[formation, styleLabel].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>

      {!hasLineups ? (
        <EmptyState icon="📋" message="Escalações indisponíveis durante a simulação" />
      ) : starters.length === 0 ? (
        <EmptyState icon="🤷" message="Sem dados da escalação do adversário" />
      ) : (
        <div className="flex gap-3 flex-1 min-h-0">
          {/* ── Pitch / formation ──────────────────────────────────────── */}
          <div className="flex-1 relative rounded-lg overflow-hidden border border-outline/40 bg-[linear-gradient(180deg,#05430e_0%,#0b5e1a_50%,#05430e_100%)] shadow-[0_0_30px_rgba(5,67,14,0.3)]" style={{ aspectRatio: "9/16", maxHeight: "420px" }}>
            <PitchFormation rows={rows} posColors={posColors} />
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
          </div>

          {/* ── Bench ──────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 px-1">Banco</p>
            <div className="flex-1 overflow-y-auto space-y-1">
              {bench.map((player) => (
                <BenchPlayerCard key={player.id ?? player.name} player={player} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function EmptyState({ icon, message }) {
  return (
    <div className="rounded-lg border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
      <span className="text-3xl text-on-surface-variant/40">{icon}</span>
      <p className="text-on-surface-variant/80 text-xs font-bold text-center px-4">{message}</p>
    </div>
  );
}

function BenchPlayerCard({ player }) {
  const s = getPosStyle(player.position);
  return (
    <div
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${s.glow} shadow-sm shadow-black/30`}
    >
      <div className={`shrink-0 w-1 bg-gradient-to-b ${s.bar}`} />
      <div className="flex items-center gap-2 flex-1 py-1.5 px-2.5">
        <span className={`shrink-0 px-1.5 py-px rounded text-[9px] font-black uppercase tracking-widest border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}>
          {POSITION_SHORT_LABELS[player.position] || "?"}
        </span>
        <span className="flex-1 truncate text-[10px] font-black text-on-surface">
          {player.name}
          {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
            <span className="ml-0.5 text-amber-400 font-black">*</span>
          )}
        </span>
        <span className="text-[9px] font-black tabular-nums text-on-surface-variant/80 shrink-0">
          {player.skill ?? "—"}
        </span>
      </div>
    </div>
  );
}
