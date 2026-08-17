import { useEffect, useMemo, useState } from "react";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";
import {
  MODAL_Z,
  POSITION_BADGE_BG_CLASS,
  POSITION_BADGE_TEXT_CLASS,
  POSITION_BADGE_BORDER_CLASS,
  POSITION_LABEL_MAP,
} from "../../constants/index.js";

/** Timeout (s) do servidor em `engine.ts` (`timeoutMs: 12000`) */
const AUTO_RESOLVE_SECONDS = 12;

/**
 * Popup simplificado de escolha do marcador de penálti.
 *
 * Quando um penálti é marcado a favor da nossa equipa, o servidor emite
 * `matchActionRequired` (`type: "penalty"`). Em vez de abrir o painel de
 * substituições a ecrã inteiro, este popup sobrepõe-se ao jogo ao vivo e
 * permite escolher o marcador em 1 passo (selecionar + confirmar).
 *
 * ⚠️ Regressão: `panelMode` (GameContext) exclui `type === "penalty"` para
 * não abrir o `MatchPage`; se isso voltar a acontecer o popup aparece em cima
 * do painel de substituições — não remover o guard sem o testar.
 *
 * @param {{ matchAction: object|null, teams: Array, onResolveAction: function }} props
 */
export function PenaltyTakerPopup({ matchAction, teams, onResolveAction }) {
  const isPenalty = matchAction?.type === "penalty";
  const [selectedId, setSelectedId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RESOLVE_SECONDS);

  // Nota: o estado é resetado por remount — o GameLayout passa
  // `key={matchAction?.actionId}`, garantindo estado fresco por penálti.

  // Contagem decrescente — a decisão automática ocorre no servidor ao fim
  // de 12s (emite `matchActionResolved` → o popup fecha).
  useEffect(() => {
    if (!isPenalty) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPenalty]);

  const teamName = useMemo(
    () => teams.find((t) => Number(t.id) === Number(matchAction?.teamId))?.name || null,
    [teams, matchAction?.teamId],
  );

  const candidates = useMemo(() => {
    const list = Array.isArray(matchAction?.takerCandidates) ? matchAction.takerCandidates : [];
    return [...list].sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0));
  }, [matchAction]);

  if (!isPenalty) return null;

  const bestId = candidates[0]?.id ?? null;
  const score = matchAction?.currentScore;
  const selected = candidates.find((c) => c.id === selectedId) || null;
  const progress = secondsLeft * (100 / AUTO_RESOLVE_SECONDS);
  return (
    <ModalShell visible={true} z={MODAL_Z.penalty} variant="md">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-amber-600/25 via-amber-500/10 to-transparent px-6 py-4 border-b border-amber-500/25 text-center">
        <p className="text-[10px] text-amber-400 uppercase font-black tracking-widest">
          ⚽ Penálti · {matchAction?.minute ?? "—"}&apos;
        </p>
        <h2 className="text-lg font-black font-headline text-on-surface mt-1 truncate">
          Escolhe o marcador
        </h2>
        {teamName && (
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mt-0.5">
            {teamName}
          </p>
        )}
        {score && (
          <p className="text-[11px] font-black tabular-nums text-on-surface-variant/70 mt-1">
            {score.home} : {score.away}
          </p>
        )}
      </div>

      {/* ── Lista de candidatos ── */}
      <div className="p-4 max-h-[45vh] overflow-y-auto">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-3xl">🤷</span>
            <p className="text-on-surface-variant/80 text-xs font-medium">
              Sem candidatos disponíveis.
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => onResolveAction(null)}
            >
              Deixar o motor decidir
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => {
              const pos = c.position || "MED";
              const posKey = pos.toUpperCase();
              const isSelected = selectedId === c.id;
              const isBest = c.id === bestId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                    isSelected
                      ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40"
                      : "border-outline-variant/25 bg-surface-container-high/60 hover:bg-surface-container-high hover:border-outline-variant/50"
                  }`}
                >
                  <span
                    className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md border ${
                      POSITION_BADGE_BG_CLASS[posKey] || "bg-surface-bright"
                    } ${POSITION_BADGE_TEXT_CLASS[posKey] || ""} ${
                      POSITION_BADGE_BORDER_CLASS[posKey] || "border-outline-variant/30"
                    } text-[10px] font-black`}
                  >
                    {POSITION_LABEL_MAP[posKey] || posKey}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-bold text-on-surface truncate">
                        {c.name}
                      </span>
                      {isBest && (
                        <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-px rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest">
                          ★ Recomendado
                        </span>
                      )}
                    </span>
                    <span className="text-[9px] text-on-surface-variant/60 font-semibold uppercase tracking-widest">
                      Qualidade {c.skill ?? "—"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-outline-variant/40"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-on-primary" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Rodapé: contagem + confirmar ── */}
      <div className="px-6 pb-5 pt-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70 shrink-0">
            Decisão automática
          </span>
          <div className="flex-1 h-1 bg-outline-variant/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-black tabular-nums text-amber-400 shrink-0">
            {secondsLeft}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            disabled={!selectedId}
            onClick={() => setSelectedId(null)}
          >
            Limpar
          </Button>
          <Button
            variant="accent"
            size="lg"
            full
            disabled={!selected}
            onClick={() => onResolveAction(selected.id)}
          >
            {selected
              ? `Confirmar marcador · ${selected.name}`
              : "Confirmar marcador"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
