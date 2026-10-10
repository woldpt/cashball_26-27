import { POSITION_SHORT_LABELS } from "../../../../constants/index.js";
import { getPosStyle } from "../../matchConstants.js";
import {
  EventCard,
  OpponentGridCard,
  RefWeatherBar,
} from "../../shared/index.js";
import { TeamCrest } from "../../../live/TeamCrest.jsx";
import { ShotLine } from "../../shared/ShotLine.jsx";
import { BadgeSkills } from "../../../shared/BadgeSkills.jsx";
import { CaptainBadge } from "../../../shared/CaptainBadge.jsx";

function EventList({ events, hInfo, aInfo }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
        <span className="text-2xl text-on-surface-variant/60">⚽</span>
        <p className="text-on-surface-variant/70 text-[11px] font-medium">
          Sem eventos
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e, i) => {
        // Cor de fundo/aresta por equipa do evento; eventos sem equipa
        // (clima, fases) ficam neutros.
        const accent =
          e.team === "home"
            ? hInfo?.color_primary
            : e.team === "away"
              ? aInfo?.color_primary
              : undefined;
        return (
          <EventCard key={i} event={e} showTeamBadge={false} accent={accent} tint />
        );
      })}
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
        <RefWeatherBar
          attendance={fixture?.attendance}
          referee={referee}
          weatherEvent={weatherEvent}
          className="text-[10px]"
        />
        <EventList events={visibleEvts} hInfo={hInfo} aInfo={aInfo} />
      </div>
    </div>
  );
}

/**
 * Posse de bola em destaque: emblemas, percentagens grandes e a barra nas
 * cores dos clubes (3.ª coluna do intervalo, desktop).
 * @param {Object} props
 * @param {Object} props.fixture - Com homePossession/awayPossession.
 * @param {Object} props.hInfo - Equipa da casa (nome, cores, emblema).
 * @param {Object} props.aInfo - Equipa de fora.
 * @param {number} [props.liveMinute]
 * @param {string} [props.className]
 * @returns {JSX.Element|null}
 */
export function MatchSummaryBlock({ fixture, hInfo, aInfo, liveMinute, className = "" }) {
  if (!fixture || !hInfo?.name || !aInfo?.name) return null;
  const home = fixture.homePossession;
  const away = fixture.awayPossession ?? (home != null ? 100 - home : null);
  const side = (team, pct, align) => (
    <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <TeamCrest team={team} size="sm" />
      <div className="min-w-0">
        <p className="font-headline text-3xl font-black leading-none tabular-nums text-on-surface">
          {pct ?? "—"}
          <span className="text-base font-bold text-on-surface-variant">%</span>
        </p>
        <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {team.name}
        </p>
      </div>
    </div>
  );
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container/60 p-3 ${className}`}
      style={{
        // Brilho subtil das duas cores, uma de cada lado.
        backgroundImage: `radial-gradient(circle at 0% 0%, ${hInfo.color_primary || "#6366f1"}26, transparent 55%), radial-gradient(circle at 100% 0%, ${aInfo.color_primary || "#f43f5e"}26, transparent 55%)`,
      }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          Posse de bola
        </span>
        {liveMinute != null && (
          <span className="rounded-full bg-surface-container-high/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-on-surface-variant">
            {liveMinute}'
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {side(hInfo, home, "left")}
        {side(aInfo, away, "right")}
      </div>
      {home != null && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-container-high/80">
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${home}%`,
              background: hInfo.color_primary || "#6366f1",
              // Separador fino: quando as duas equipas têm a mesma cor,
              // a divisão da posse continuava visível.
              borderRight: "2px solid rgba(255,255,255,0.7)",
            }}
          />
          <div className="h-full flex-1" style={{ background: aInfo.color_primary || "#f43f5e" }} />
        </div>
      )}
      <ShotLine events={fixture.events} liveMinute={liveMinute} className="mt-2" />
    </div>
  );
}

export function AdversarioPanel({
  hasLineups,
  oppInfo,
  oppRows,
  oppBench,
}) {
  // Ordena cada linha de posição por skill descendente.
  const sortDesc = (arr) => [...arr].sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0));
  const gr = sortDesc(oppRows.GR);
  const def = sortDesc(oppRows.DEF);
  const med = sortDesc(oppRows.MED);
  const ata = sortDesc(oppRows.ATA);

  const hasAny = gr.length + def.length + med.length + ata.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Cabeçalho: emblema + nome + formação */}
      <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-outline-variant/15 bg-surface-container-high/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeamCrest team={oppInfo} />
          <span className="text-sm font-black font-headline uppercase tracking-tight text-on-surface truncate">
            {oppInfo?.name || "Adversário"}
          </span>
        </div>
      </div>

      {/* Contentor de scroll */}
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
    <div className="flex flex-col rounded-md border border-outline-variant/15 overflow-hidden">
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
      <div className="flex-1 flex flex-col justify-center p-1.5 space-y-1 min-h-[2rem]">
        {players.map((p) => (
          <OpponentGridCard
            key={p.id ?? p.name}
            player={p}
            posStyle={posStyle}
            hideStats
          />
        ))}
        {players.length === 0 && (
          <p className="text-center text-on-surface-variant/60 text-[10px] py-2 font-medium">
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
        {!!player.is_captain && <CaptainBadge className="ml-1 align-middle" />}
      </span>
      <BadgeSkills skill={player.skill} hideStats size="sm" />
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="rounded-md border border-outline-variant/25 bg-surface-container py-12 flex flex-col items-center gap-2">
      <span className="text-3xl text-on-surface-variant/60">{icon}</span>
      <p className="text-on-surface-variant/80 text-xs font-medium text-center px-4">
        {message}
      </p>
    </div>
  );
}
