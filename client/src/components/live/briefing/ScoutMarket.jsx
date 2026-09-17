import { memo } from "react";
import { THREAT_ROLE_META } from "../../match/matchConstants.js";
import { Tile } from "./Tile.jsx";
import { ThreatGrid } from "./ThreatGrid.jsx";
import { OddsTiles } from "./OddsTiles.jsx";

/**
 * Conselho do adjunto — frase fixa (template por papel) preenchida com a
 * ameaça real sinalizada pelo servidor. Sem scouting inventado: se não há
 * ameaças, mostra o fallback neutro.
 * @param {{ threat?: { role: string, name: string, skill: number|null, form: number|null, goals: number|null }|null }} props
 * @returns {JSX.Element}
 */
const AssistantAdvice = memo(function AssistantAdvice({ threat }) {
  let text = "Sem ameaças sinalizadas — manter o plano e a concentração total.";
  if (threat) {
    if (threat.role === "goleador")
      text =
        `${threat.name} já leva ${threat.goals} ${threat.goals === 1 ? "golo" : "golos"}. ` +
        "Fechar linhas de passe e dobrar a marcação na área.";
    else if (threat.role === "forma")
      text =
        `${threat.name} chega em grande forma. ` +
        "Pressionar cedo e não dar espaço entre linhas.";
    else
      text =
        `${threat.name} (skill ${threat.skill ?? "—"}) decide na técnica. ` +
        "Tirar-lhe tempo e espaço na construção.";
  }
  return (
    <div className="min-w-0 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
      <span className="text-[8px] uppercase tracking-widest text-emerald-400 font-black">
        <span aria-hidden>🎙️</span> Conselho do adjunto
      </span>
      <p className="mt-1 text-[11px] font-bold text-gray-200 leading-snug italic">
        “{text}”
      </p>
    </div>
  );
});

/**
 * Coluna Scout & Mercado — ameaças reais do adversário, conselho do
 * adjunto derivado da principal ameaça, mercado 1X2 do servidor e árbitro.
 * @param {{ vm: Object }} props
 * @returns {JSX.Element}
 */
export const ScoutMarket = memo(function ScoutMarket({ vm }) {
  const meta = THREAT_ROLE_META[vm.threats?.[0]?.role];
  return (
    <div className="min-w-0 h-full flex flex-col gap-3 short:gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">
          <span aria-hidden>🕵️</span> Scout & mercado
        </span>
        {meta && (
          <span className="text-[8px] uppercase tracking-widest text-gray-600 font-bold">
            Alvo nº 1: {vm.threats[0].name}
          </span>
        )}
      </div>
      <ThreatGrid threats={vm.threats} />
      <AssistantAdvice threat={vm.threats?.[0] ?? null} />
      <Tile
        label={
          <span className="inline-flex items-center gap-1">
            Mercado 1X2
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
    </div>
  );
});
