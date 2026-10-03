import { useMemo } from "react";
import { Badge } from "./Badge.jsx";

/**
 * TrophyCabinet — sala de troféus agrupada por conquista.
 *
 * Fonte única do bloco de palmarés (antes duplicado em `ClubTab` e
 * `TeamHistoryView`): um troféu por chip repetia o mesmo texto N vezes
 * ("Campeão Nacional" ×5 épocas = 5 chips iguais); aqui agrupa por
 * conquista com contagem (×N) e os anos como chips.
 *
 * Os `trophies` vêm de `palmares` (ClubTab) ou de `clubHistory` (tab
 * História) com a mesma forma: { season, achievement, coach_name,
 * is_human_coach, player_id? }.
 *
 * @param {{
 *   trophies?: object[],
 *   onOpenPlayer?: (playerId: number) => void,
 *   className?: string,
 * }} props
 */
export function TrophyCabinet({ trophies = [], onOpenPlayer, className = "" }) {
  const groups = useMemo(() => groupTrophies(trophies), [trophies]);

  if (groups.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {groups.map((group) => {
        const canOpenPlayer =
          group.playerId != null && typeof onOpenPlayer === "function";
        // Conquista de jogador (Melhor Marcador) com link: a linha inteira
        // vira botão. Sem `player_id` (ex.: dados do ClubTab) fica um card.
        const Row = canOpenPlayer ? "button" : "div";
        return (
          <Row
            key={group.key}
            {...(canOpenPlayer
              ? {
                  type: "button",
                  onClick: () => onOpenPlayer(group.playerId),
                  title: "Abrir histórico do jogador",
                }
              : {})}
            className={`group flex w-full items-center gap-3 rounded-md border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.07] via-surface-container-low to-surface-container-low px-3 py-2.5 text-left transition-colors relative ${
              canOpenPlayer
                ? "cursor-pointer hover:border-amber-500/40 hover:from-amber-500/[0.12]"
                : ""
            }`}
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {group.icon}
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-xs font-black text-amber-300">
                  {group.label}
                </p>
                {group.count > 1 && (
                  <Badge variant="warning">×{group.count}</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {group.seasons.map((season) => (
                  <span
                    key={season}
                    title={`Época ${season}`}
                    className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-px text-[9px] font-black tabular-nums tracking-wider text-amber-200/90"
                  >
                    {season}
                  </span>
                ))}
                {group.coach && (
                  <span className="truncate text-[9px] font-bold text-on-surface-variant/70">
                    · Treinador: {group.coach}
                  </span>
                )}
              </div>
            </div>

            {canOpenPlayer && (
              <span
                aria-hidden
                className="material-symbols-outlined shrink-0 text-[16px] text-amber-400/60 group-hover:text-amber-300"
              >
                person
              </span>
            )}
            <span aria-hidden className="trophy-shine" />
          </Row>
        );
      })}
    </div>
  );
}

/**
 * Normaliza a conquista em tipo de troféu (ícone + chave de agrupamento).
 * `Campeão <divisão>` mantém o texto original como chave (cada divisão é
 * um troféu distinto); "Melhor Marcador — <divisão> (N golos)" também agrupa
 * por divisão, sem os golos (que variam por época).
 *
 * @param {string} achievement
 * @returns {{ key: string, label: string, icon: string }}
 */
function trophyKind(achievement = "") {
  if (achievement.startsWith("Melhor Marcador")) {
    // A divisão faz parte do troféu (como «Campeão Liga 3» já faz); os golos
    // variam por época e saem da chave para o ×N agrupar as repetições.
    const label = achievement.replace(/\s*\(\d+\s*golos\)\s*$/, "");
    return { key: label, label, icon: "sports_soccer" };
  }
  return { key: achievement, label: achievement, icon: "emoji_events" };
}

/** Prestígio: Campeão Nacional → Taça → títulos de divisão → resto. */
function trophyRank(label) {
  if (label === "Campeão Nacional") return 0;
  if (label.startsWith("Vencedor da Taça")) return 1;
  if (label.startsWith("Campeão")) return 2;
  return 3;
}

/**
 * @param {object[]} trophies lista DESC por época (mais recente primeiro)
 * @returns {Array<{ key: string, label: string, icon: string, count: number, seasons: number[], coach: string|null, playerId: number|null }>}
 */
function groupTrophies(trophies) {
  const groups = new Map();
  for (const trophy of trophies) {
    const kind = trophyKind(trophy.achievement);
    let group = groups.get(kind.key);
    if (!group) {
      group = {
        ...kind,
        count: 0,
        seasons: [],
        coach: null,
        playerId: null,
      };
      groups.set(kind.key, group);
    }
    group.count += 1;
    if (trophy.season != null) group.seasons.push(trophy.season);
    // A lista vem DESC: o primeiro preenchido é o mais recente.
    if (!group.coach && trophy.coach_name && trophy.is_human_coach) {
      group.coach = trophy.coach_name;
    }
    if (group.playerId == null && trophy.player_id != null) {
      group.playerId = trophy.player_id;
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      trophyRank(a.label) - trophyRank(b.label) ||
      b.count - a.count ||
      (b.seasons[0] ?? 0) - (a.seasons[0] ?? 0),
  );
}
