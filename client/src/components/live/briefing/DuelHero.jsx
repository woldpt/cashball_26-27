import { memo } from "react";
import { TeamCrest } from "../TeamCrest.jsx";
import { TeamKit } from "../../shared/TeamKit.jsx";
import { useKitClash } from "../../../hooks/useKitClash.js";
import { DifficultyGauge } from "./DifficultyGauge.jsx";

/**
 * Slot de equipa no duelo (emblema grande + posição + nome + estatuto).
 * @param {{ slot: { id: number|null, team: Object|null, name: string, isMine: boolean }, side: "home"|"away", coach?: string|null, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
const DuelSlot = memo(function DuelSlot({ slot, side, coach, onOpenTeamSquad }) {
  const position = slot.team?.position ? `${slot.team.position}º lugar` : "—";
  return (
    <div
      className={`relative z-10 flex-1 min-w-0 flex flex-col items-center gap-1 text-center ${
        side === "home" ? "duel-in-left" : "duel-in-right"
      }`}
    >
      <span
        className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-px rounded border ${
          slot.isMine
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
        className="max-w-full text-base sm:text-lg short:text-base lg:text-3xl font-headline font-black uppercase tracking-tight text-white leading-none line-clamp-2 break-words hover:text-emerald-400 hover:underline transition-colors"
        title={`Ver plantel de ${slot.name}`}
        aria-label={`Ver plantel de ${slot.name}`}
      >
        {slot.name}
      </button>
      {!slot.isMine && coach && (
        <span className="max-w-full truncate px-1.5 py-px bg-amber-400/15 text-amber-400 text-[9px] font-black rounded-sm border border-amber-400/30">
          {coach}
        </span>
      )}
      <span className={`text-[9px] font-bold ${slot.isMine ? "text-emerald-400" : "text-gray-500"}`}>
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
 * @param {{ vm: Object, coachOf?: (teamId: number|null) => string|undefined, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
export const DuelHero = memo(function DuelHero({ vm, coachOf, onOpenTeamSquad }) {
  const [home, away] = vm.slots;
  // Empate de camisolas de casa: a equipa de fora veste a sua de fora.
  const clash = useKitClash(home?.team?.crest, away?.team?.crest);
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
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-outline-variant/25 text-gray-300">
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
        {/* brilho das cores de cada clube a "colidir" ao centro */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background: `linear-gradient(90deg, ${home?.team?.color_primary || "transparent"} 0%, transparent 45%, transparent 55%, ${away?.team?.color_primary || "transparent"} 100%)`,
          }}
        />
        {/* marcas de água dos emblemas (laterais, escuras e desvanecidas) */}
        {home?.team?.crest && (
          <div
            aria-hidden
            className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-10 sm:opacity-[0.13] pointer-events-none select-none"
            style={{
              /* crest-shadow mesclado: o `filter` inline anula a classe */
              filter: "brightness(0.6) saturate(0.9) drop-shadow(0 1px 2px rgb(0 0 0 / 0.45)) drop-shadow(0 2px 4px rgb(0 0 0 / 0.25))",
              maskImage: "linear-gradient(to right, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, black 55%, transparent 100%)",
            }}
          >
            {home.team.crest.includes("/logos/") ? (
              <TeamKit team={home.team} className="h-28 sm:h-40 lg:h-56 object-contain" />
            ) : (
              <img
                src={home.team.crest}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="h-28 sm:h-40 lg:h-56 w-auto object-contain"
              />
            )}
          </div>
        )}
        {away?.team?.crest && (
          <div
            aria-hidden
            className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-10 sm:opacity-[0.13] pointer-events-none select-none"
            style={{
              filter: "brightness(0.6) saturate(0.9) drop-shadow(0 1px 2px rgb(0 0 0 / 0.45)) drop-shadow(0 2px 4px rgb(0 0 0 / 0.25))",
              maskImage: "linear-gradient(to left, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to left, black 55%, transparent 100%)",
            }}
          >
            {away.team.crest.includes("/logos/") ? (
              <TeamKit team={away.team} className="h-28 sm:h-40 lg:h-56 object-contain" away={clash} />
            ) : (
              <img
                src={away.team.crest}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="h-28 sm:h-40 lg:h-56 w-auto object-contain"
              />
            )}
          </div>
        )}
        {home && <DuelSlot slot={home} side="home" coach={coachOf?.(home.id)} onOpenTeamSquad={onOpenTeamSquad} />}
        <div className="relative z-10 shrink-0 flex flex-col items-center gap-1 px-1 lg:px-4">
          <span
            aria-hidden
            className="duel-vs-pop text-sm lg:text-2xl font-headline font-black italic text-white px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border border-emerald-400/40 bg-surface-container-low shadow-[0_0_18px_rgb(52_211_153/0.25)]"
          >
            VS
          </span>
        </div>
        {away && <DuelSlot slot={away} side="away" coach={coachOf?.(away.id)} onOpenTeamSquad={onOpenTeamSquad} />}
      </div>

      {/* Dificuldade em mobile: linha própria, fora do frente a frente */}
      <div className="sm:hidden px-4 short:px-3 pb-3 short:pb-2 flex justify-center">
        <div className="w-48">
          <DifficultyGauge score={vm.difficulty.score} label={vm.difficulty.label} />
        </div>
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
