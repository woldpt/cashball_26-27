import { memo } from "react";
import { Tile, CompareStat } from "./Tile.jsx";
import { VersusHero } from "./VersusHero.jsx";
import { FormChips } from "./FormChips.jsx";
import { RecordText } from "./RecordText.jsx";

/* Dots de moral por chave semântica (getMoraleColor). */
const MORALE_DOT = {
  green: "bg-green-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
};

/**
 * Moral "eu vs adversário" com dot colorido + rótulo + valor em tooltip.
 * @param {{ morale: { value: number, label: string, color: string } }} props
 * @returns {JSX.Element}
 */
const MoraleValue = memo(function MoraleValue({ morale }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-black leading-none truncate"
      title={`Moral ${morale.value}`}
    >
      <span
        aria-hidden
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${MORALE_DOT[morale.color] ?? MORALE_DOT.amber}`}
      />
      <span className="truncate">{morale.label}</span>
    </span>
  );
});

/**
 * Linha de forma recente (nome clicável + chips) para uma das equipas.
 * @param {{ entry: { name: string, last5: string, team: Object|null }, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
const FormRow = memo(function FormRow({ entry, onOpenTeamSquad }) {
  return (
    <div className="flex w-full items-center justify-between gap-1 min-w-0">
      <button
        type="button"
        onClick={() => entry.team && onOpenTeamSquad?.(entry.team)}
        className="min-w-0 text-[9px] font-black text-white truncate hover:text-emerald-400 hover:underline transition-colors"
        aria-label={`Ver plantel de ${entry.name}`}
      >
        {entry.name}
      </button>
      <FormChips last5={entry.last5} />
    </div>
  );
});

/* Classes por resultado do último confronto. */
const LC_RESULT_STYLES = {
  V: "bg-green-500/15 text-green-400",
  D: "bg-red-500/15 text-red-400",
  E: "bg-gray-700/30 text-gray-500",
};

/**
 * Tile do mercado 1X2 — mesma fonte do servidor usada nas apostas em jogo.
 * @param {{ odds: { list: Array<Object> } }} props
 * @returns {JSX.Element}
 */
const OddsTiles = memo(function OddsTiles({ odds }) {
  return (
    <div className="flex w-full min-w-0 gap-1">
      {odds.list.map((o) => (
        <div
          key={o.key}
          className={`flex-1 rounded-md px-1 py-1 flex flex-col items-center gap-0.5 min-w-0 border ${
            o.key === "home"
              ? "bg-sky-500/10 border-sky-400/20"
              : o.key === "away"
                ? "bg-amber-500/10 border-amber-400/20"
                : "bg-gray-700/20 border-outline-variant/15"
          } ${o.isFavorite ? "ring-1 ring-amber-300/60" : ""}`}
          title={o.isFavorite ? "Favorito" : o.label}
        >
          <span className="text-[8px] text-gray-600 font-black uppercase truncate max-w-full">
            {o.label}
          </span>
          <span
            className={`text-[12px] font-black tabular-nums ${
              o.key === "home"
                ? "text-sky-400"
                : o.key === "away"
                  ? "text-amber-400"
                  : "text-gray-300"
            }`}
          >
            {o.display}
          </span>
          {o.prob != null && (
            <span className="text-[8px] font-black tabular-nums text-gray-500">
              {o.prob}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

/**
 * Card de antevisão do próximo confronto — comparação direta das duas
 * equipas, forma recente, registo, confronto direto, odds, árbitro e tempo.
 * Recebe o view-model já derivado (ordem casa/fora resolvida).
 * @param {{ vm: Object, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
export const NextMatchCard = memo(function NextMatchCard({ vm, onOpenTeamSquad }) {
  const ptsDiffColor =
    vm.ptsDiff > 0 ? "text-green-400" : vm.ptsDiff < 0 ? "text-red-400" : "text-gray-500";
  const lc = vm.lastConfrontation;

  return (
    <div className="h-full flex flex-col bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
      {/* Cabeçalho: competição + venue */}
      <div className="flex items-center justify-between px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
        <div className="flex items-center gap-2">
          {vm.isCup ? (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              <span aria-hidden>🏆</span> Taça
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">
              <span aria-hidden>⚽</span> Liga
            </span>
          )}
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
            {vm.competition}
          </span>
        </div>
        <span
          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${vm.venue === "Jamor" ? "bg-amber-500/15 text-amber-400" : vm.isHome ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}
        >
          {vm.venue === "Jamor" ? "🏟️ Jamor" : vm.isHome ? "Casa" : "Fora"}
        </span>
      </div>

      {/* Corpo */}
      <div className="flex-1 px-4 short:px-3 py-3 short:py-1.5 lg:py-4 flex flex-col gap-2.5 short:gap-1.5 lg:gap-3 lg:justify-evenly">
        <VersusHero slots={vm.slots} onOpenTeamSquad={onOpenTeamSquad} />

        {/* Grelha de stats comparativos */}
        <div className="flex items-center justify-between">
          <span className="text-[8px] uppercase tracking-widest text-gray-600 font-black">
            Tu vs Adversário
          </span>
          {vm.ptsDiff !== 0 && (
            <span className={`text-[9px] font-black tabular-nums ${ptsDiffColor}`}>
              {vm.ptsDiff > 0 ? "▲" : "▼"} {Math.abs(vm.ptsDiff)} pts
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 short:gap-1 lg:flex-1 lg:content-center">
          <CompareStat label="Posição" left={vm.compare.position[0]} right={vm.compare.position[1]} />
          <CompareStat label="Pontos" left={vm.compare.points[0]} right={vm.compare.points[1]} />
          <CompareStat
            label="Golos M:S"
            left={
              <span title="Golos marcados : sofridos">{vm.compare.goals[0]}</span>
            }
            right={
              <span title="Golos marcados : sofridos">{vm.compare.goals[1]}</span>
            }
          />
          <CompareStat
            label="Moral"
            left={<MoraleValue morale={vm.compare.morale[0]} />}
            right={<MoraleValue morale={vm.compare.morale[1]} />}
          />
          <CompareStat
            label="Qualidade"
            left={
              vm.compare.quality[0] == null ? (
                "—"
              ) : (
                <span>
                  {vm.compare.quality[0]}
                  <span className="text-[9px] text-gray-600 font-bold">/100</span>
                </span>
              )
            }
            right={
              vm.compare.quality[1] == null ? (
                "—"
              ) : (
                <span>
                  {vm.compare.quality[1]}
                  <span className="text-[9px] text-gray-600 font-bold">/100</span>
                </span>
              )
            }
          />
        </div>

        {/* Faixa de metadados compacta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 short:gap-1 lg:flex-1 lg:content-center">
          <Tile label="Forma recente">
            <FormRow entry={vm.form.mine} onOpenTeamSquad={onOpenTeamSquad} />
            <div className="mt-1 w-full">
              <FormRow entry={vm.form.theirs} onOpenTeamSquad={onOpenTeamSquad} />
            </div>
          </Tile>

          <Tile label="Registo">
            <div className="flex w-full items-center justify-between gap-1.5">
              <RecordText v={vm.record.mine.v} e={vm.record.mine.e} d={vm.record.mine.d} />
              <span aria-hidden className="w-px h-4 bg-outline-variant/25" />
              <RecordText v={vm.record.theirs.v} e={vm.record.theirs.e} d={vm.record.theirs.d} />
            </div>
          </Tile>

          <Tile label="Último confronto">
            {lc ? (
              <>
                <span className="text-lg font-black text-white tabular-nums leading-none whitespace-nowrap">
                  {lc.score}
                </span>
                <span
                  className={`mt-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${LC_RESULT_STYLES[lc.result] ?? LC_RESULT_STYLES.E}`}
                >
                  {lc.label}
                </span>
                <span className="block text-[8px] text-gray-600 uppercase font-bold truncate mt-1">
                  {lc.venue} · {lc.comp}
                  {lc.season ? ` · Época ${lc.season}` : ""}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-gray-700 font-bold italic">
                Sem histórico
              </span>
            )}
          </Tile>

          <Tile
            label={
              <span className="inline-flex items-center gap-1">
                Apostas
                <span
                  className="normal-case font-bold text-gray-700 cursor-help"
                  title="Calculadas pelo servidor — iguais às das apostas em jogo"
                >
                  ⓘ
                </span>
              </span>
            }
          >
            <OddsTiles odds={vm.odds} />
          </Tile>

          {vm.referee && (
            <Tile label="Árbitro">
              <span className="text-[10px] font-bold text-gray-400 truncate block">
                {vm.referee.name}
              </span>
            </Tile>
          )}

          {vm.weather && (
            <Tile label="Tempo">
              <span className="block text-center text-base leading-none" aria-hidden>
                {vm.weather.emoji}
              </span>
              <span className="block text-center text-[8px] text-gray-500 font-bold mt-0.5">
                {vm.weather.label}
              </span>
            </Tile>
          )}
        </div>
      </div>
    </div>
  );
});
