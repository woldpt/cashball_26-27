import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { getPosStyle } from "../matchConstants.js";
import {
  EventCard,
  OpponentGridCard,
  PossessionBar,
  RefWeatherBar,
} from "../shared/index.js";
import { TeamCrest } from "../../live/TeamCrest.jsx";

function EventList({ events }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
        <span className="text-2xl text-on-surface-variant/40">⚽</span>
        <p className="text-on-surface-variant/60 text-[11px] font-medium">
          Sem eventos
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <EventCard key={i} event={e} showTeamBadge={false} />
      ))}
    </div>
  );
}

/* ── Cronologia tab ────────────────────────────────────────────────────── */
export function CronologiaPanel({
  visibleEvts,
  fixture,
  hInfo,
  aInfo,
  referee,
  weatherEvent,
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <PossessionBar
          homePossession={fixture.homePossession}
          awayPossession={fixture.awayPossession}
          homeColor={hInfo?.color_primary}
          awayColor={aInfo?.color_primary}
          compact
        />
        <RefWeatherBar
          attendance={fixture?.attendance}
          referee={referee}
          weatherEvent={weatherEvent}
          className="text-[10px]"
        />
        <EventList events={visibleEvts} />
      </div>
    </div>
  );
}

/**
 * Scoreline + possession + minute. Fills the Mentalidade column's dead
 * space with decision-relevant context.
 *
 * @param {object} fixture - Fixture data (score, possession).
 * @param {object} hInfo - Home team info (name, color_primary).
 * @param {object} aInfo - Away team info (name, color_primary).
 * @param {number} liveMinute - Current match minute.
 * @param {string} className - Extra classes (e.g. "mt-auto").
 */
export function MatchSummaryBlock({ fixture, hInfo, aInfo, liveMinute, className = "" }) {
  if (!fixture || !hInfo?.name || !aInfo?.name) return null;
  return (
    <div
      className={`rounded-md border border-outline-variant/25 bg-surface-container/60 p-3 space-y-2.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          Posse de Bola
        </span>
        {liveMinute != null && (
          <span className="text-[10px] font-bold tabular-nums text-on-surface-variant">
            {liveMinute}'
          </span>
        )}
      </div>
      {fixture.homePossession != null && (
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-container-high/80 flex">
          <div
            className="h-full"
            style={{
              width: `${fixture.homePossession}%`,
              background: hInfo.color_primary || "#6366f1",
              // Separador fino: quando as duas equipas têm a mesma cor,
              // a divisão da posse continuava visível.
              borderRight: "2px solid rgba(255,255,255,0.7)",
            }}
          />
          <div
            className="h-full flex-1"
            style={{ background: aInfo.color_primary || "#f43f5e" }}
          />
        </div>
      )}
    </div>
  );
}

export function AdversarioPanel({
  hasLineups,
  oppInfo,
  oppRows,
  oppBench,
}) {
  // Sort each position row by skill descending
  const sortDesc = (arr) => [...arr].sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0));
  const gr = sortDesc(oppRows.GR);
  const def = sortDesc(oppRows.DEF);
  const med = sortDesc(oppRows.MED);
  const ata = sortDesc(oppRows.ATA);

  const hasAny = gr.length + def.length + med.length + ata.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header: crest + nome + formação */}
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-outline-variant/15 bg-surface-container-high/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeamCrest team={oppInfo} />
          <span className="text-sm font-black font-headline uppercase tracking-tight text-on-surface truncate">
            {oppInfo?.name || "Adversário"}
          </span>
        </div>
      </div>

      {/* Scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4">
        {!hasLineups ? (
          <EmptyState
            icon="📋"
            message="Escalações indisponíveis durante a simulação"
          />
        ) : !hasAny ? (
          <EmptyState
            icon="🤷"
            message="Sem dados da escalação do adversário"
          />
        ) : (
          <div className="space-y-3">
            {/* Grid 4 colunas: GR | DEF | MED | ATA */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              <PositionColumn
                posStyle={getPosStyle("GR")}
                players={gr}
                label="Guarda-redes"
              />
              <PositionColumn
                posStyle={getPosStyle("DEF")}
                players={def}
                label="Defesa"
              />
              <PositionColumn
                posStyle={getPosStyle("MED")}
                players={med}
                label="Médio"
              />
              <PositionColumn
                posStyle={getPosStyle("ATA")}
                players={ata}
                label="Avançado"
              />
            </div>

            {/* Suplentes — faixa horizontal */}
            {oppBench.length > 0 && (
              <div className="rounded-md border border-outline-variant/15 bg-surface-container-high/20">
                <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Suplentes
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60 tabular-nums">
                    {oppBench.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                  {oppBench.map((p) => (
                    <BenchChip
                      key={p.id ?? p.name}
                      player={p}
                      posStyle={getPosStyle(p.position)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Coluna de posição: header + lista de jogadores ─────────────────── */
function PositionColumn({ posStyle, players, label }) {
  return (
    <div className="rounded-md border border-outline-variant/15 overflow-hidden">
      {/* Header com cor da posição */}
      <div
        className={`shrink-0 flex items-center justify-between px-2.5 py-1.5 border-b ${posStyle.badgeBorder} bg-gradient-to-r ${posStyle.bgGrad} to-transparent`}
      >
        <span
          className={`text-[9px] font-black uppercase tracking-widest ${posStyle.badgeText}`}
        >
          {label}
        </span>
        <span className="text-[9px] text-on-surface-variant/60 tabular-nums">
          {players.length}
        </span>
      </div>
      {/* Lista de jogadores */}
      <div className="p-1.5 space-y-1 min-h-[2rem]">
        {players.map((p) => (
          <OpponentGridCard
            key={p.id ?? p.name}
            player={p}
            posStyle={posStyle}
            hideResForm
          />
        ))}
        {players.length === 0 && (
          <p className="text-center text-on-surface-variant/40 text-[10px] py-2 font-medium">
            —
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Chip de suplente (compacto, inline) ─────────────────────────────── */
function BenchChip({ player, posStyle }) {
  const s = posStyle;
  return (
    <div
      className={`flex items-center gap-1.5 rounded border border-outline-variant/15 ${s.bgGrad} via-surface-container/40 to-transparent bg-gradient-to-r px-2 py-1`}
    >
      <span
        className={`shrink-0 w-4 text-center text-[8px] font-bold uppercase tracking-widest rounded px-1 border ${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`}
      >
        {POSITION_SHORT_LABELS[player.position] || "?"}
      </span>
      <span className="truncate text-[11px] font-semibold text-on-surface max-w-[100px]">
        {player.name}
        {!!player.is_star && (player.position === "MED" || player.position === "ATA") && (
          <span className="ml-0.5 text-amber-400" aria-label="Craque">★</span>
        )}
      </span>
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
      <span className="text-3xl text-on-surface-variant/40">{icon}</span>
      <p className="text-on-surface-variant/80 text-xs font-medium text-center px-4">
        {message}
      </p>
    </div>
  );
}
