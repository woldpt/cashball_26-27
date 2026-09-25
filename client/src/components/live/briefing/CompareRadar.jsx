import { memo } from "react";
import { getMoraleClasses } from "../../../utils/morale.js";
import { teamTextColor } from "../liveHelpers.js";
import { Tile } from "./Tile.jsx";
import { TeamCrest } from "../TeamCrest.jsx";
import { FormChips } from "./FormChips.jsx";
import { RecordText } from "./RecordText.jsx";
import { orderedPair } from "./orderedPair.js";

/**
 * Extrai golos marcados/sofridos "M:S" do par ordenado por local do jogo.
 * @param {Array<string>} pair par [casa, fora]
 * @returns {{ home: { gf: number, ga: number }, away: { gf: number, ga: number } }}
 */
function splitGoals(pair) {
  const parse = (s) => {
    const [gf, ga] = String(s ?? "0:0").split(":").map(Number);
    return {
      gf: Number.isFinite(gf) ? gf : 0,
      ga: Number.isFinite(ga) ? ga : 0,
    };
  };
  return { home: parse(pair?.[0]), away: parse(pair?.[1]) };
}

/**
 * Barra dupla casa vs fora (ordem do jogo: casa à esquerda, fora à
 * direita). Barras na cor principal da equipa; valores em `teamTextColor`
 * (primária se legível, secundária se escura). Para métricas invertidas
 * (menos é melhor) a quota calcula-se sobre o complementar.
 * @param {{ label: string, home: number|null, away: number|null, homeDisplay: string, awayDisplay: string, homeTeam: Object|null, awayTeam: Object|null, invert?: boolean }} props
 * @returns {JSX.Element|null}
 */
const DualBar = memo(function DualBar({
  label,
  home,
  away,
  homeDisplay,
  awayDisplay,
  homeTeam,
  awayTeam,
  invert = false,
}) {
  if (home == null && away == null) return null;
  const a = home ?? 0;
  const b = away ?? 0;
  const total = a + b;
  // Sem golos/pontos ainda (início de época): barras neutras a meio.
  const rawHome = total > 0 ? a / total : 0.5;
  const shareHome = invert ? 1 - rawHome : rawHome;
  const homeBar = homeTeam?.color_primary || "#34d399";
  const awayBar = awayTeam?.color_primary || "#38bdf8";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-black tabular-nums truncate" style={{ color: teamTextColor(homeTeam) }}>
          {homeDisplay}
        </span>
        <span className="shrink-0 text-[8px] uppercase tracking-widest text-gray-500 font-black">
          {label}
        </span>
        <span className="text-[10px] font-black tabular-nums truncate" style={{ color: teamTextColor(awayTeam) }}>
          {awayDisplay}
        </span>
      </div>
      <div className="mt-0.5 flex gap-1" aria-hidden>
        <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden flex justify-end">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(shareHome * 100)}%`, background: homeBar }}
          />
        </div>
        <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round((1 - shareHome) * 100)}%`, background: awayBar }}
          />
        </div>
      </div>
    </div>
  );
});

/**
 * Rótulo do momento a partir dos últimos resultados (dados reais).
 * @param {string} last5 sequência V/E/D
 * @returns {{ label: string, detail: string, cls: string }|null}
 */
function formStatus(last5) {
  const results = String(last5 ?? "").split("").filter(Boolean);
  if (results.length === 0) return null;
  const v = results.filter((r) => r === "V").length;
  const d = results.filter((r) => r === "D").length;
  const e = results.length - v - d;
  if (d === 0)
    return { label: "Invencível", detail: `${v}V · ${e}E`, cls: "text-emerald-400" };
  if (v === 0)
    return { label: "Sem vencer", detail: `${e}E · ${d}D`, cls: "text-red-400" };
  return { label: "Irregular", detail: `${v}V · ${e}E · ${d}D`, cls: "text-gray-400" };
}

/**
 * Cartão de forma de uma equipa (emblema + nome + momento + chips + registo).
 * @param {{ name: string, last5: string, team: Object|null, record: { v: number, e: number, d: number }, side: "home"|"away", isMine?: boolean, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element}
 */
const FormBlock = memo(function FormBlock({ name, last5, team, record, side, isMine = false, onOpenTeamSquad }) {
  const status = formStatus(last5);
  return (
    <div className="min-w-0 rounded-xl border border-outline-variant/25 bg-surface-container-low/60 px-2.5 py-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        {team && <TeamCrest team={team} size="sm" isMine={isMine} />}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => team && onOpenTeamSquad?.(team)}
            className="block w-full min-w-0 text-left text-[10px] font-black text-white truncate hover:text-emerald-400 hover:underline transition-colors"
            aria-label={`Ver plantel de ${name}`}
          >
            {name}
          </button>
          {status && (
            <span className={`block text-[8px] font-bold tabular-nums truncate ${status.cls}`}>
              {status.label} <span className="text-gray-600">({status.detail})</span>
            </span>
          )}
        </div>
        <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-gray-600">
          {side === "home" ? "Casa" : "Fora"}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <FormChips last5={last5} />
        <RecordText v={record.v} e={record.e} d={record.d} />
      </div>
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
  // Ordem do jogo: casa à esquerda, fora à direita. `vm.compare.*` já vem
  // ordenado [casa, fora] pelo `orderedPair` do view-model; forma e registo
  // vêm como eu/adversário e ordenam-se aqui com o mesmo helper.
  const goals = splitGoals(vm.compare.goals);
  const [moraleHome, moraleAway] = vm.compare.morale;
  const [qualityHome, qualityAway] = vm.compare.quality;
  const [formHome, formAway] = orderedPair(vm.isHome, vm.form.mine, vm.form.theirs);
  const [recordHome, recordAway] = orderedPair(vm.isHome, vm.record.mine, vm.record.theirs);
  const homeTeam = vm.slots?.[0]?.team ?? null;
  const awayTeam = vm.slots?.[1]?.team ?? null;
  const moraleMine = vm.isHome ? moraleHome : moraleAway;
  const lc = vm.lastConfrontation;

  return (
    <div className="min-w-0 h-full flex flex-col bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 short:px-3 py-2 short:py-1 border-b border-outline-variant/15">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
          <span aria-hidden>📊</span> Radar comparativo
        </span>
        <span className="text-[8px] uppercase tracking-widest text-gray-600 font-bold truncate">
          {formHome.name} vs {formAway.name}
        </span>
      </div>

      <div className="flex-1 px-4 short:px-3 py-3 short:py-2 flex flex-col gap-2.5 short:gap-2">
        <DualBar
          label="Poder de ataque"
          home={goals.home.gf}
          away={goals.away.gf}
          homeDisplay={`${goals.home.gf} golos`}
          awayDisplay={`${goals.away.gf} golos`}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
        <DualBar
          label="Rigor defensivo"
          home={goals.home.ga}
          away={goals.away.ga}
          homeDisplay={`${goals.home.ga} sofridos`}
          awayDisplay={`${goals.away.ga} sofridos`}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          invert
        />
        <DualBar
          label="Moral do balneário"
          home={moraleHome.value}
          away={moraleAway.value}
          homeDisplay={`${moraleHome.value} · ${moraleHome.label}`}
          awayDisplay={`${moraleAway.label} · ${moraleAway.value}`}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
        <DualBar
          label="Qualidade geral"
          home={qualityHome}
          away={qualityAway}
          homeDisplay={qualityHome == null ? "—" : `Nível ${qualityHome}`}
          awayDisplay={qualityAway == null ? "—" : `Nível ${qualityAway}`}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />

        <div className="pt-1 border-t border-outline-variant/15">
          <span className="text-[8px] uppercase tracking-widest text-gray-600 font-black">
            Forma recente (últimos 5)
          </span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <FormBlock
              name={formHome.name}
              last5={formHome.last5}
              team={formHome.team}
              record={recordHome}
              side="home"
              isMine={vm.isHome}
              onOpenTeamSquad={onOpenTeamSquad}
            />
            <FormBlock
              name={formAway.name}
              last5={formAway.last5}
              team={formAway.team}
              record={recordAway}
              side="away"
              isMine={!vm.isHome}
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
