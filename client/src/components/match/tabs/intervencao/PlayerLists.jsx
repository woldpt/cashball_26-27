import { MAX_MATCH_SUBS } from "../../../constants/index.js";
import { getPosStyle } from "../matchConstants.js";
import {
  CompactPlayerCard,
  MatchPlayerCard,
} from "../shared/index.js";
import {
  getBenchCardState,
  getPitchCardState,
} from "./subsSelection.js";
import { MatchSummaryBlock } from "./Panels.jsx";

/* ── Subs counter (halftime) ───────────────────────────────────────────── */
export function SubsCounter({ subsMade }) {
  return (
    <div
      className="shrink-0 flex items-center gap-1.5"
      title={`${subsMade} de ${MAX_MATCH_SUBS} substituições usadas`}
    >
      <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
        Subs
      </span>
      {Array.from({ length: MAX_MATCH_SUBS }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i < subsMade ? "bg-emerald-400" : "bg-outline-variant/40"
          }`}
        />
      ))}
      <span className="text-[10px] font-black tabular-nums text-on-surface-variant ml-0.5">
        {subsMade}/{MAX_MATCH_SUBS}
      </span>
    </div>
  );
}

/* ── Titulares column ──────────────────────────────────────────────────── */
export function TitularesColumn({
  className,
  players,
  isHalftime,
  isEmergencyGk = false,
  cardCtx,
  handlePickIn,
  grLockedNoReplacement,
  pickOut,
  dragFrom,
  dragOverSide,
  handleDragStart,
  handleDragOver,
  handleDropOnPitch,
  handleDragEnd,
  flat = false,
}) {
  // `flat` (mobile): lista em altura natural dentro do scroll único da página —
  // sem cabeçalho de coluna e sem scroll interno; cartão compacto de uma
  // linha. Desktop: cabeçalho + scroll próprio + cartão expandido.
  const Card = flat ? CompactPlayerCard : MatchPlayerCard;
  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      {!flat && (
        <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            Titulares
          </h3>
          <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
            {players.length}
          </span>
        </div>
      )}
      {isEmergencyGk && (
        <p className={`px-4 py-1.5 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border-b border-amber-500/20 ${flat ? "" : "shrink-0"}`}>
          Sem GR disponível — escolhe um jogador em campo para a baliza 🧤
        </p>
      )}
      {grLockedNoReplacement && (
        <p className={`px-4 py-1.5 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border-b border-amber-500/20 ${flat ? "" : "shrink-0"}`}>
          Sem GR no banco — o guarda-redes não pode sair
        </p>
      )}
      <div className={flat ? "space-y-2 px-3 pt-2 pb-3" : "flex-1 overflow-y-auto px-3 py-2.5 space-y-2"}>
        {players.map((p) => {
          const { disabled, selected, forcedOut, stats } = getPitchCardState(
            p,
            cardCtx,
          );

          return (
            <Card
              key={p.id}
              player={p}
              posStyle={getPosStyle(p.position)}
              selected={selected}
              disabled={disabled}
              selectable={!disabled}
              onPick={() => (isEmergencyGk ? handlePickIn(p) : pickOut(p))}
              showFatigue={false}
              showMatchStats
              goals={stats?.goals ?? 0}
              yellowCards={stats?.yellowCards ?? 0}
              swapIndicator={isHalftime}
              forcedOut={forcedOut}
              draggable={!disabled}
              onDragStart={handleDragStart(p, "pitch")}
              onDragOver={handleDragOver("pitch")}
              onDragDrop={handleDropOnPitch(p)}
              onDragEnd={handleDragEnd}
              dragOver={dragOverSide === "pitch" && dragFrom?.side === "bench"}
            />
          );
        })}
        {players.length === 0 && (
          <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">
            Sem opções em campo
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Suplentes column ──────────────────────────────────────────────────── */
export function SuplentesColumn({
  className,
  players,
  isEmergencyGk = false,
  cardCtx,
  handlePickIn,
  dragFrom,
  dragOverSide,
  handleDragStart,
  handleDragOver,
  handleDropOnBench,
  handleDragEnd,
  summary,
  flat = false,
}) {
  // `flat` (mobile): lista em altura natural dentro do scroll único da página.
  const Card = flat ? CompactPlayerCard : MatchPlayerCard;
  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      {!flat && (
        <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-surface-container-high/50 border-b border-outline-variant/15">
          <h3 className="text-sm font-bold font-headline tracking-tight text-tertiary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            Suplentes
          </h3>
          <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-widest">
            {players.length}
          </span>
        </div>
      )}
      {isEmergencyGk && (
        <p className={`px-4 py-1.5 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border-b border-amber-500/20 ${flat ? "" : "shrink-0"}`}>
          Sem GR no banco — a escolha é em campo
        </p>
      )}
      <div className={flat ? "space-y-2 px-3 pt-2 pb-3" : "flex-1 overflow-y-auto px-3 py-2.5 space-y-2"}>
        {players.map((p) => {
          const { disabled, selected, stats } = getBenchCardState(p, cardCtx);

          return (
            <Card
              key={p.id}
              player={p}
              posStyle={getPosStyle(p.position)}
              selected={selected}
              disabled={disabled}
              selectable={!disabled}
              onPick={() => handlePickIn(p)}
              showFatigue={false}
              showMatchStats
              goals={stats?.goals ?? 0}
              yellowCards={stats?.yellowCards ?? 0}
              draggable={!disabled}
              onDragStart={handleDragStart(p, "bench")}
              onDragOver={handleDragOver("bench")}
              onDragDrop={handleDropOnBench(p)}
              onDragEnd={handleDragEnd}
              dragOver={dragOverSide === "bench" && dragFrom?.side === "pitch"}
            />
          );
        })}
        {players.length === 0 && (
          <p className="text-center text-on-surface-variant/60 text-xs font-medium py-6">
            Sem suplentes disponíveis
          </p>
        )}
      </div>
      {/* Posse de Bola — só desktop; no mobile mudou para a linha de 2px do
       * banner intermitente no topo do ecrã. */}
      {!flat &&
        summary && (
          <div className="shrink-0 p-3 border-t border-outline-variant/15 bg-surface-container-high/30">
            <MatchSummaryBlock {...summary} />
          </div>
        )}
    </div>
  );
}
