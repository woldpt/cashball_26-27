import { memo } from "react";
import { TeamCrest } from "../TeamCrest.jsx";
import { DifficultyGauge } from "./DifficultyGauge.jsx";

/**
 * Slot de equipa no duelo (emblema grande + posição + nome + estatuto).
 * @param {{ slot: { id: number|null, team: Object|null, name: string, isMine: boolean }, side: "home"|"away", onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
const DuelSlot = memo(function DuelSlot({ slot, side, onOpenTeamSquad }) {
  const position = slot.team?.position ? `${slot.team.position}º lugar` : "—";
  return (
    <div className="relative z-10 flex-1 min-w-0 flex flex-col items-center gap-1 text-center">
      <span
        className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-px rounded border ${
          side === "home"
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : "bg-sky-500/10 text-sky-400 border-sky-500/30"
        }`}
      >
        {position}
      </span>
      <TeamCrest team={slot.team} size="lg" isMine={slot.isMine} />
      <button
        type="button"
        onClick={() => slot.team && onOpenTeamSquad?.(slot.team)}
        className="max-w-full text-lg short:text-base lg:text-3xl font-headline font-black uppercase tracking-tight text-white leading-none truncate hover:text-emerald-400 hover:underline transition-colors"
        title={`Ver plantel de ${slot.name}`}
        aria-label={`Ver plantel de ${slot.name}`}
      >
        {slot.name}
      </button>
      <span className="text-[9px] font-bold text-gray-500">
        {slot.isMine ? "A minha equipa" : "Adversário direto"}
        {" · "}
        {side === "home" ? "Casa" : "Fora"}
      </span>
    </div>
  );
});

/**
 * DuelHero — herói de duelo do briefing (estilo emissão): etiquetas da
 * jornada em cima, frente a frente casa/fora com VS central, manchete como
 * linha "flash" em baixo. Só usa dados reais do view-model (sem countdown
 * nem hot-zones inventadas).
 * @param {{ vm: Object, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
export const DuelHero = memo(function DuelHero({ vm, onOpenTeamSquad }) {
  const [home, away] = vm.slots;
  const metaLine = vm.weather ? `${vm.weather.emoji} ${vm.weather.label}` : "";

  return (
    <section
      aria-label="Duelo do próximo jogo"
      className="bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden"
    >
      {/* Etiquetas + dificuldade + stepper */}
      <div className="flex items-center justify-between gap-2 px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            <span aria-hidden>📋</span> Briefing · {vm.competition}
          </span>
          {vm.isCup && vm.cupRound === 0 ? (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              <span aria-hidden>🤝</span> Amigável
            </span>
          ) : vm.isCup ? (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              <span aria-hidden>🏆</span> Taça
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">
              <span aria-hidden>⚽</span> Liga
            </span>
          )}
          {vm.stakes && (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-outline-variant/25 text-gray-300">
              <span aria-hidden>🎯</span> {vm.stakes}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block w-32 lg:w-40">
            <DifficultyGauge score={vm.difficulty.score} label={vm.difficulty.label} />
          </div>
        </div>
      </div>

      {/* Frente a frente */}
      <div className="relative overflow-hidden px-4 short:px-3 py-3 short:py-2 lg:py-5 flex items-center gap-2 lg:gap-6">
        {/* marcas de água dos emblemas (laterais, escuras e desvanecidas) */}
        {home?.team?.crest && (
          <img
            src={home.team.crest}
            alt=""
            aria-hidden
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="absolute -left-6 top-1/2 -translate-y-1/2 w-40 h-40 lg:w-56 lg:h-56 object-contain opacity-[0.13] pointer-events-none select-none hidden sm:block"
            style={{
              filter: "brightness(0.45) saturate(0.9)",
              maskImage: "linear-gradient(to right, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, black 55%, transparent 100%)",
            }}
          />
        )}
        {away?.team?.crest && (
          <img
            src={away.team.crest}
            alt=""
            aria-hidden
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="absolute -right-6 top-1/2 -translate-y-1/2 w-40 h-40 lg:w-56 lg:h-56 object-contain opacity-[0.13] pointer-events-none select-none hidden sm:block"
            style={{
              filter: "brightness(0.45) saturate(0.9)",
              maskImage: "linear-gradient(to left, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to left, black 55%, transparent 100%)",
            }}
          />
        )}
        {home && <DuelSlot slot={home} side="home" onOpenTeamSquad={onOpenTeamSquad} />}
        <div className="relative z-10 shrink-0 flex flex-col items-center gap-1 px-1 lg:px-4">
          <span
            aria-hidden
            className="text-[10px] lg:text-xs font-black text-gray-600 px-2.5 py-1 rounded-full border border-outline-variant/25 bg-surface-container-low"
          >
            VS
          </span>
          <span className="sm:hidden w-20">
            <DifficultyGauge score={vm.difficulty.score} label={vm.difficulty.label} />
          </span>
        </div>
        {away && <DuelSlot slot={away} side="away" onOpenTeamSquad={onOpenTeamSquad} />}
      </div>

      {/* Linha flash: manchete + contexto real */}
      <div className="px-4 short:px-3 py-2 short:py-1.5 border-t border-outline-variant/15 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <p className="flex-1 min-w-0 text-[11px] short:text-[10px] font-bold text-gray-300 leading-snug">
          <span aria-hidden>📣</span> <span className="text-white">Flash:</span> {vm.headline}
        </p>
        {metaLine && <p className="shrink-0 text-[9px] font-bold text-gray-500">{metaLine}</p>}
      </div>
    </section>
  );
});
