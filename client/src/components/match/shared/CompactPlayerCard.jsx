import { POSITION_SHORT_LABELS } from "../../../constants/index.js";
import { POSITION_FULL_LABELS, getPosStyle } from "../matchConstants.js";
import { FatigueIndicator } from "./FatigueIndicator.jsx";
import { BadgeSkills } from "../../shared/BadgeSkills.jsx";

/**
 * Compact player card — versão de uma linha do `MatchPlayerCard`, pensada para
 * listas mobile onde a coluna expandida (skill + RES + forma) fica
 * apertada e corta o nome.
 *
 * Preserva TODOS os dados relevantes, mas compridos na mesma linha:
 *   [POS] Nome ★  ⚽n 🟨n  [fadiga] | BadgeSkills
 *
 * Diferenças vs. o card expandido:
 *  - Tudo numa só linha (sem empilhamento nome/estatística/fadiga) → ~60% menos altura.
 *  - Número de skill em `text-base` (não `text-lg`) e métricas agrupadas à direita.
 *  - Globs de golos/amarelos inline junto do nome, sem segunda linha.
 *
 * @param {object} props.player - Jogador (id, name, position, skill, res, form…).
 * @param {object} props.posStyle - Estilo da posição (getPosStyle).
 * @param {boolean} [props.selected] - Selecionado (destaque branco).
 * @param {boolean} [props.disabled] - Desativado (não clicável).
 * @param {boolean} [props.selectable] - Permite pick.
 * @param {Function} [props.onPick] - Callback de seleção.
 * @param {boolean} [props.showFatigue] - Mostrar indicador de fadiga inline.
 * @param {boolean} [props.hideStats] - Ocultar o badge de skills (jogadores adversários).
 * @param {boolean} [props.skillLast] - SKILL em último (Intervenção em vertical).
 * @param {boolean} [props.posRight] - Posição à extrema direita (banco mobile).
 * @param {boolean} [props.forcedOut] - Substitução obrigatória (destaque vermelho).
 * @param {boolean} [props.draggable] - Arrastável (DnD desktop).
 */
export function CompactPlayerCard({
  player,
  posStyle,
  selected = false,
  disabled = false,
  selectable = true,
  onPick,
  showFatigue = true,
  hideStats = false,
  skillLast = false,
  posRight = false,
  goals = 0,
  yellowCards = 0,
  forcedOut = false,
  draggable = false,
  dragOver = false,
  onDragStart,
  onDragOver,
  onDragDrop,
  onDragEnd,
}) {
  const s = posStyle || getPosStyle(player.position);

  const hasStar = !!player.is_star && (player.position === "MED" || player.position === "ATA");

  // Fundo/estado — mesma linguagem visual do card expandido.
  const cardBg = forcedOut
    ? "border-red-500/70 ring-2 ring-red-500/40 bg-red-500/10"
    : selected
      ? "border-white/60 bg-white/10"
      : disabled
        ? "opacity-40 cursor-not-allowed border-outline-variant/15 bg-surface-container/40"
        : `cursor-pointer border-outline-variant/25 bg-gradient-to-r ${s.bgGrad} via-surface-container/70 to-surface/30 hover:-translate-y-px hover:shadow-lg ${s.glow} shadow-sm shadow-black/30`;

  // Chip de posição — à esquerda por omissão; com `posRight` (banco
  // mobile) rende-se à extrema direita, após o BadgeSkills, para o peek
  // da stack mostrar Skill + Posição sem virar a lista.
  const posBadge = (
    <span
      title={POSITION_FULL_LABELS[player.position]}
      className={`shrink-0 px-1.5 py-0.5 self-center rounded text-[10px] font-bold uppercase tracking-widest border ${
        selected
          ? "bg-white/20 text-white border-white/40"
          : `${s.badgeBg} ${s.badgeText} ${s.badgeBorder}`
      } ${disabled ? "opacity-40" : ""}`}
    >
      {POSITION_SHORT_LABELS[player.position] || "?"}
    </span>
  );

  return (
    <button
      onClick={() => selectable && !disabled && onPick?.()}
      draggable={draggable && !disabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDragDrop}
      onDragEnd={onDragEnd}
      className={`relative group flex items-center h-10 rounded-md overflow-hidden border transition-all duration-200 select-none w-full text-left ${cardBg} ${
        dragOver
          ? "ring-2 ring-emerald-400/70 border-emerald-400/70 shadow-[0_0_16px_rgba(52,211,153,0.35)]"
          : ""
      }`}
    >
      {/* Forced swap label */}
      {forcedOut && (
        <span className="absolute top-0 right-10 px-1.5 py-px bg-red-500/90 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-md">
          Obrigatório
        </span>
      )}
      {/* Position accent bar */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${selected ? "from-white via-white to-white/60" : s.bar}`} />

      {/* Position badge — à esquerda por omissão; no banco mobile (`posRight`) vai para a extrema direita. */}
      {!posRight && posBadge}

      {/* Nome + globs inline (golos/amarelos) + fadiga — ocupa o espaço disponível */}
      <span className="flex flex-1 min-w-0 items-center gap-1 ml-2">
        <span
          className={`truncate text-sm font-semibold leading-none ${
            selected ? "text-white" : disabled ? "text-on-surface-variant/60" : "text-on-surface"
          }`}
        >
          {player.name}
          {hasStar && !disabled && (
            <span className="ml-0.5 text-amber-400" title="Craque" aria-label="Craque">★</span>
          )}
        </span>
        {goals > 0 && (
          <span className="inline-flex items-center gap-px text-[10px] leading-none text-on-surface-variant/80" title="Golos">
            {Array.from({ length: Math.min(goals, 3) }).map((_, i) => (
              <span key={`goal-${i}`} aria-hidden="true">
                ⚽
              </span>
            ))}
            {goals > 3 && <span className="tabular-nums">+{goals - 3}</span>}
          </span>
        )}
        {yellowCards > 0 && (
          <span className="inline-flex items-center gap-px text-[10px] leading-none text-on-surface-variant/80" title="Cartões amarelos">
            {Array.from({ length: Math.min(yellowCards, 3) }).map((_, i) => (
              <span key={`yc-${i}`} aria-hidden="true">
                🟨
              </span>
            ))}
            {yellowCards > 3 && <span className="tabular-nums">+{yellowCards - 3}</span>}
          </span>
        )}
        {showFatigue && <FatigueIndicator player={player} compact />}
      </span>

      {/* Métricas à direita: badge único de skills */}
      <div className="shrink-0 flex items-center gap-1.5 mr-2">
        {!hideStats && (
          <BadgeSkills
            skill={player.skill}
            resistance={player.resistance}
            form={player.form}
            morale={player.morale}
            aggressiveness={player.aggressiveness}
            prevSkill={player.prev_skill}
            skillLast={skillLast}
            size="sm"
          />
        )}
        {posRight && posBadge}
      </div>
    </button>
  );
}
