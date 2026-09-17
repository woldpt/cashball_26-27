import { memo } from "react";
import { getMoraleClasses } from "../../../utils/morale.js";
import { Tile } from "./Tile.jsx";
import { FormChips } from "./FormChips.jsx";
import { RecordText } from "./RecordText.jsx";

/**
 * Extrai golos marcados/sofridos "M:S" do par ordenado por local do jogo.
 * @param {Array<string>} pair par [casa, fora]
 * @param {boolean} isHome sou a equipa da casa
 * @returns {{ mine: { gf: number, ga: number }, theirs: { gf: number, ga: number } }}
 */
function splitGoals(pair, isHome) {
  const parse = (s) => {
    const [gf, ga] = String(s ?? "0:0").split(":").map(Number);
    return {
      gf: Number.isFinite(gf) ? gf : 0,
      ga: Number.isFinite(ga) ? ga : 0,
    };
  };
  const [a, b] = [parse(pair?.[0]), parse(pair?.[1])];
  return isHome ? { mine: a, theirs: b } : { mine: b, theirs: a };
}

/**
 * Barra dupla "eu vs adversário" (eu: esmeralda à esquerda, adversário:
 * azul à direita). Para métricas invertidas (menos é melhor) a quota
 * calcula-se sobre o complementar.
 * @param {{ label: string, mine: number|null, theirs: number|null, mineDisplay: string, theirsDisplay: string, invert?: boolean }} props
 * @returns {JSX.Element|null}
 */
const DualBar = memo(function DualBar({
  label,
  mine,
  theirs,
  mineDisplay,
  theirsDisplay,
  invert = false,
}) {
  if (mine == null && theirs == null) return null;
  const a = mine ?? 0;
  const b = theirs ?? 0;
  const total = a + b;
  // Sem golos/pontos ainda (início de época): barras neutras a meio.
  const rawMine = total > 0 ? a / total : 0.5;
  const shareMine = invert ? 1 - rawMine : rawMine;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-black tabular-nums text-emerald-400 truncate">
          {mineDisplay}
        </span>
        <span className="shrink-0 text-[8px] uppercase tracking-widest text-gray-500 font-black">
          {label}
        </span>
        <span className="text-[10px] font-black tabular-nums text-sky-400 truncate">
          {theirsDisplay}
        </span>
      </div>
      <div className="mt-0.5 flex gap-1" aria-hidden>
        <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden flex justify-end">
          <div
            className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-600"
            style={{ width: `${Math.round(shareMine * 100)}%` }}
          />
        </div>
        <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600"
            style={{ width: `${Math.round((1 - shareMine) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
});

/**
 * Linha de forma recente (nome clicável + chips + registo V/E/D).
 * @param {{ name: string, last5: string, team: Object|null, record: { v: number, e: number, d: number }, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
const FormRow = memo(function FormRow({ name, last5, team, record, onOpenTeamSquad }) {
  return (
    <div className="flex w-full items-center justify-between gap-1.5 min-w-0">
      <div className="min-w-0 flex flex-col">
        <button
          type="button"
          onClick={() => team && onOpenTeamSquad?.(team)}
          className="min-w-0 text-left text-[10px] font-black text-white truncate hover:text-emerald-400 hover:underline transition-colors"
          aria-label={`Ver plantel de ${name}`}
        >
          {name}
        </button>
        <RecordText v={record.v} e={record.e} d={record.d} />
      </div>
      <FormChips last5={last5} />
    </div>
  );
});

/**
 * Radar comparativo — barras duplas derivadas só de dados reais (golos,
 * moral, qualidade média) + forma recente + registo + último confronto +
 * ambiente do balneário/estádio.
 * @param {{ vm: Object, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
export const CompareRadar = memo(function CompareRadar({ vm, onOpenTeamSquad }) {
  const iMine = vm.isHome ? 0 : 1;
  const iOpp = vm.isHome ? 1 : 0;
  const goals = splitGoals(vm.compare.goals, vm.isHome);
  const moraleMine = vm.compare.morale[iMine];
  const moraleOpp = vm.compare.morale[iOpp];
  const qualityMine = vm.compare.quality[iMine];
  const qualityOpp = vm.compare.quality[iOpp];
  const lc = vm.lastConfrontation;

  return (
    <div className="min-w-0 h-full flex flex-col bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
          <span aria-hidden>📊</span> Radar comparativo
        </span>
        <span className="text-[8px] uppercase tracking-widest text-gray-600 font-bold truncate">
          Tu vs {vm.form.theirs.name}
        </span>
      </div>

      <div className="flex-1 px-4 short:px-3 py-3 short:py-2 flex flex-col gap-2.5 short:gap-2">
        <DualBar
          label="Poder de ataque"
          mine={goals.mine.gf}
          theirs={goals.theirs.gf}
          mineDisplay={`${goals.mine.gf} golos`}
          theirsDisplay={`${goals.theirs.gf} golos`}
        />
        <DualBar
          label="Rigor defensivo"
          mine={goals.mine.ga}
          theirs={goals.theirs.ga}
          mineDisplay={`${goals.mine.ga} sofridos`}
          theirsDisplay={`${goals.theirs.ga} sofridos`}
          invert
        />
        <DualBar
          label="Moral do balneário"
          mine={moraleMine.value}
          theirs={moraleOpp.value}
          mineDisplay={`${moraleMine.value} · ${moraleMine.label}`}
          theirsDisplay={`${moraleOpp.label} · ${moraleOpp.value}`}
        />
        <DualBar
          label="Qualidade geral"
          mine={qualityMine}
          theirs={qualityOpp}
          mineDisplay={qualityMine == null ? "—" : `Nível ${qualityMine}`}
          theirsDisplay={qualityOpp == null ? "—" : `Nível ${qualityOpp}`}
        />

        <div className="pt-1 border-t border-outline-variant/15">
          <span className="text-[8px] uppercase tracking-widest text-gray-600 font-black">
            Forma recente (últimos 5)
          </span>
          <div className="mt-1 flex flex-col gap-1.5">
            <FormRow
              name={vm.form.mine.name}
              last5={vm.form.mine.last5}
              team={vm.form.mine.team}
              record={vm.record.mine}
              onOpenTeamSquad={onOpenTeamSquad}
            />
            <FormRow
              name={vm.form.theirs.name}
              last5={vm.form.theirs.last5}
              team={vm.form.theirs.team}
              record={vm.record.theirs}
              onOpenTeamSquad={onOpenTeamSquad}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-1.5">
          <Tile label="Último confronto" className="flex-1">
            {lc ? (
              <>
                <span className="text-lg font-black text-white tabular-nums leading-none whitespace-nowrap">
                  {lc.score}
                </span>
                <span className="mt-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-gray-700/30 text-gray-400">
                  {lc.label}
                </span>
                <span className="block text-[8px] text-gray-600 uppercase font-bold truncate mt-0.5">
                  {lc.comp}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-gray-700 font-bold italic">
                Sem histórico
              </span>
            )}
          </Tile>
          <Tile label="Ambiente" className="flex-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-white">
              <span
                aria-hidden
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${getMoraleClasses(moraleMine.value).dot}`}
              />
              {moraleMine.label}
            </span>
            {vm.stadium && (
              <span className="mt-0.5 block text-[8px] text-gray-500 font-bold tabular-nums">
                {vm.stadium.fill}% lotação esperada
              </span>
            )}
          </Tile>
        </div>
      </div>
    </div>
  );
});
