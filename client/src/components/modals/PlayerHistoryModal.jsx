import { useContext, useEffect, useRef } from "react";
import { GameContext } from "../../contexts/GameContext.jsx";
import { slotLabel } from "../../utils/slotLabel.js";
import { formatCurrency, seasonToYear } from "../../utils/formatters.js";
import { AggBadge } from "../shared/AggBadge.jsx";
import { Badge } from "../shared/Badge.jsx";
import { Button } from "../shared/Button.jsx";
import { ModalShell } from "../shared/ModalShell.jsx";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { aggLabel } from "../../utils/playerHelpers.js";
import { SkillLineChart } from "./SkillLineChart.jsx";
import { POS_BAR } from "./positionConstants.js";
import {
  POSITION_TEXT_CLASS,
  POSITION_BORDER_CLASS,
  MODAL_Z,
} from "../../constants/index.js";

// Position config
const POS_LABEL = { GR: "GR", DEF: "DEF", MED: "MED", ATA: "ATA" };
const POS_FULL = {
  GR: "Guarda-redes",
  DEF: "Defesa",
  MED: "Médio",
  ATA: "Avançado",
};


function SkillBar({ label, value, maxValue = 50, color, valueLabel }) {
  const pct = Math.min(100, Math.round((value / maxValue) * 100));
  return (
    <div>
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        <span className="font-black font-headline text-base" style={{ color }}>
          {valueLabel ?? value}
        </span>
      </div>
      <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

/**
 * @param {{
 *   playerHistoryModal: object|null,
 *   setPlayerHistoryModal: function,
 *   myTeamId?: number|string,
 *   matchweekCount?: number,
 *   season?: number,
 *   isPlayingMatch?: boolean,
 *   showHalftimePanel?: boolean,
 *   renewPlayerContract?: function,
 *   listPlayerAuction?: function,
 *   listPlayerFixed?: function,
 *   removeFromTransferList?: function,
 *   buyPlayer?: function,
 *   openAuctionBid?: function,
 *   myBudget?: number,
 *   setGameDialog?: function,
 * }} props
 */
export function PlayerHistoryModal({
  playerHistoryModal,
  setPlayerHistoryModal,
  myTeamId,
  matchweekCount = 0,
  season = 1,
  isPlayingMatch = false,
  showHalftimePanel = false,
  renewPlayerContract,
  listPlayerAuction,
  listPlayerFixed,
  removeFromTransferList,
  buyPlayer,
  openAuctionBid,
  myBudget = 0,
  setGameDialog,
}) {
  // Relógio único primeiro (regras dos hooks: antes de qualquer return).
  const ctxIdx = useContext(GameContext)?.calendarIndex;
  // History API: push an entry when the modal opens so the browser back
  // button closes it, keeping navigation state consistent.
  const wasOpen = useRef(false);
  useEffect(() => {
    const isOpen = !!playerHistoryModal;
    if (isOpen && !wasOpen.current) {
      window.history.pushState({ playerHistoryModal: true }, "");
    }
    wasOpen.current = isOpen;
  }, [playerHistoryModal]);

  useEffect(() => {
    const onPopState = (e) => {
      if (!e.state?.playerHistoryModal) {
        setPlayerHistoryModal(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setPlayerHistoryModal]);

  const closeModal = () => {
    if (window.history.state?.playerHistoryModal) {
      window.history.back();
    }
    setPlayerHistoryModal(null);
  };

  if (!playerHistoryModal) return null;

  const { player, transfers: rawTransfers, awards: rawAwards } = playerHistoryModal;
  const transfers = rawTransfers || [];
  const awards = rawAwards || [];
  if (!player) return null;

  const pos = player.position;
  const barColor = POS_BAR[pos] || "#95d4b3";
  const isStar = player.is_star === 1;
  const skill = player.skill ?? 0;

  // Atributos — agressividade numa escala de 1–5, o resto em 0–50
  const aggKey = aggLabel(player.aggressiveness);
  const AGG_ORDER = ["Acólito", "Tranquilo", "Zen", "Lenhador", "Triturador"];
  const aggNum =
    typeof player.aggressiveness === "number"
      ? Math.max(1, Math.min(5, Math.round(player.aggressiveness)))
      : Math.max(1, AGG_ORDER.indexOf(aggKey) + 1);
  const formVal = player.form ?? 32;
  const formHex = formVal >= 41 ? "#34d399" : formVal <= 22 ? "#fb7185" : "#71717a";

  // Season stats
  const sGames = player.games_played ?? 0;
  const sGoals = player.goals ?? 0;
  const sReds = player.red_cards ?? 0;
  const sInjuries = player.injuries ?? 0;

  // Career totals. ATENÇÃO à assimetria: career_goals/career_reds/career_injuries
  // são contadores VITALÍCIOS — o flush jogo a jogo incrementa-os (engine.ts
  // queueMatchDeltaWrites → `career_goals = career_goals + ?`) e o fecho de
  // época NÃO os reseta, por isso já incluem a época atual. Só career_games é
  // pré-época (é atualizado exclusivamente no fecho com
  // `career_games = career_games + games_played`), pelo que soma games_played.
  const cGames = (player.career_games ?? 0) + sGames;
  const cGoals = player.career_goals ?? 0;
  const cReds = player.career_reds ?? 0;
  const cInjuries = player.career_injuries ?? 0;

  // Linhas da tabela de desempenho (época vs carreira)
  const perfRows = [
    { label: "Jogos", season: sGames, career: cGames, seasonClass: "text-on-surface", careerClass: "text-on-surface" },
    { label: "Golos", season: sGoals, career: cGoals, seasonClass: "text-tertiary", careerClass: "text-tertiary" },
    { label: "Vermelhos", season: sReds, career: cReds, seasonClass: sReds > 0 ? "text-error" : "text-on-surface", careerClass: cReds > 0 ? "text-error" : "text-on-surface" },
    { label: "Lesões", season: sInjuries, career: cInjuries, seasonClass: sInjuries > 0 ? "text-amber-400" : "text-on-surface", careerClass: cInjuries > 0 ? "text-amber-400" : "text-on-surface" },
  ];

  // Contract management — only shown for own team
  const isMyPlayer =
    myTeamId != null &&
    player.team_id != null &&
    Number(myTeamId) === Number(player.team_id);
  const nowIdx = ctxIdx ?? matchweekCount;
  const currentEpoch = (Math.max(1, season) - 1) * 20 + Math.min(20, nowIdx + 1);
  const contractStart = player.contract_start_epoch || 0;
  const isLocked = contractStart > 0 && currentEpoch < contractStart + 20;
  const contractEndEpoch = contractStart > 0 ? contractStart + 20 : 0;
  const contractEndSeason = contractStart > 0 ? Math.ceil(contractEndEpoch / 20) : 0;
  const contractEndMatchweek = contractStart > 0
    ? contractEndEpoch - (contractEndSeason - 1) * 20
    : 0;
  const contractEndLabel = contractStart > 0 ? slotLabel(contractEndMatchweek) : "";
  const contractEndYear = contractStart > 0 ? seasonToYear(contractEndSeason) : 0;
  const matchInProgress = isPlayingMatch || showHalftimePanel;
  // Server uses >= to prevent re-auction in same matchweek (auctionHelpers.ts:459)
  // Guarda anti-releilão: servidor escreve/lê em matchweek da liga (rótulo).
  const alreadyAuctionedThisWeek =
    matchweekCount > 0 &&
    (player.last_auctioned_matchweek || 0) >= matchweekCount;

  // Market purchase — only when player belongs to *another* team and is listed
  const isListedInMarket =
    !isMyPlayer &&
    (player.transfer_status === "auction" ||
      player.transfer_status === "fixed");
  const marketPrice = player.marketPrice ?? player.value ?? 0;
  const canAfford = myBudget >= marketPrice;

  // Availability badge
  let availBadge = null;
  if ((player.suspension_until_matchweek ?? 0) > nowIdx) {
    const jLeft = player.suspension_until_matchweek - nowIdx + 1;
    availBadge = (
      <Badge variant="suspended" size="md">
        🟥 Suspenso · {jLeft}J
      </Badge>
    );
  } else if ((player.injury_until_matchweek ?? 0) > nowIdx) {
    const jLeft = player.injury_until_matchweek - nowIdx + 1;
    availBadge = (
      <Badge variant="injured" size="md">
        🩹 Lesionado · {jLeft}J
      </Badge>
    );
  }

  return (
    <ModalShell
      visible={!!playerHistoryModal}
      onClose={closeModal}
      z={MODAL_Z.default}
      variant="wide"
      dismissable
    >
      <div className="flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* ── IDENTITY HEADER ──
            shrink-0: o container pai tem altura indefinida (max-height: 90vh),
            pelo que o flex-basis 0% do body (flex-1) é tratado como auto e o
            flex-shrink distribui o excesso pelo header — sem shrink-0 o header
            encolhe abaixo do conteúdo e o overflow-hidden corta as linhas
            envoltas (ex.: 🛡️ resistência / 👍 forma). */}
        <div className="relative shrink-0 bg-surface-container overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at top left, ${barColor}18 0%, transparent 70%)`,
            }}
          />
          <div className="relative flex items-start gap-2 sm:gap-4 px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-5">
            <div className="shrink-0">
              <PlayerAvatar seed={player.id} position={pos} teamColor={player.team_color_primary || player.color_primary || null} nationality={player.nationality} size="w-10 h-10 sm:w-24 sm:h-24" photo={player.photo || null} />
            </div>
            <div className="shrink-0 mt-0.5 sm:mt-1">
              <div
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-sm bg-surface-bright border-l-2 ${POSITION_BORDER_CLASS[pos] || "border-zinc-500"} ${POSITION_TEXT_CLASS[pos] || "text-zinc-300"} text-[10px] sm:text-xs font-black uppercase tracking-wider`}
              >
                {POS_LABEL[pos] || pos}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="font-black font-headline text-lg sm:text-2xl tracking-tight text-on-surface uppercase leading-none">
                  {player.name}
                </h2>
                {isStar && (
                  <span className="text-amber-400 text-sm" title="Craque">
                    ★
                  </span>
                )}
                {availBadge}
              </div>
              <p className="text-on-surface-variant text-[10px] sm:text-xs font-medium mt-0.5 sm:mt-1 tracking-wide">
                {POS_FULL[pos] || pos}
                {player.nationality ? ` · ${player.nationality}` : ""}
              </p>
              <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                <span className="text-on-surface-variant text-xs">Clube:</span>
                {player.team_crest ? (
                  <img src={player.team_crest} alt={player.team_name || "crest"} onError={(e) => { e.currentTarget.style.display = "none"; }} className="w-5 h-5 object-contain bg-white rounded-sm p-0.5 shrink-0 border border-outline-variant/20" loading="lazy" />
                ) : player.team_name ? (
                  <span className="w-5 h-5 rounded-sm flex items-center justify-center text-[8px] font-black shrink-0 border border-white/10" style={{ background: player.team_color_primary || player.color_primary || "#333", color: player.team_color_secondary || player.color_secondary || "#fff" }}>{player.team_name[0]}</span>
                ) : null}
                <span className="font-bold text-tertiary text-xs">
                  {player.team_name
                    ? player.transfer_status === "auction" && player.isExClub
                      ? `ex-${player.team_name}`
                      : player.team_name
                    : "Sem clube"}
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={closeModal}
            >
              ← Voltar
            </Button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="overflow-y-auto flex-1">          {/* ── 2-COLUMN LAYOUT (md+) ── */}
          <div className="md:grid md:grid-cols-2 md:divide-x md:divide-outline-variant/10">
            {/* LEFT COLUMN: Attributes + Financial + Contract */}
            <div className="flex flex-col">
              {/* ── ATRIBUTOS ── */}
              <div className="px-6 py-5 border-b border-outline-variant/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
                  Atributos
                </p>
                <div className="flex flex-col gap-4">
                  <SkillBar label="Qualidade" value={skill} color={barColor} />
                  <SkillBar
                    label="Agressividade"
                    value={aggNum}
                    maxValue={5}
                    color={barColor}
                    valueLabel={<AggBadge value={player.aggressiveness} />}
                  />
                  {player.resistance != null && (
                    <SkillBar
                      label="Resistência"
                      value={player.resistance}
                      color="#22d3ee"
                    />
                  )}
                  {player.form != null && (
                    <SkillBar
                      label="Forma"
                      value={player.form}
                      color={formHex}
                    />
                  )}
                </div>
              </div>

              {/* Value / Wage */}
              <div className="px-6 py-5 border-b border-outline-variant/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
                  Financeiro
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      Valor de mercado
                    </p>
                    <p className="font-black font-headline text-lg tracking-tighter text-tertiary truncate">
                      {formatCurrency(player.value || 0)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                      Ordenado/sem
                    </p>
                    <p className="font-bold font-mono text-sm text-on-surface truncate">
                      {formatCurrency(player.wage || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Market purchase — for players from other teams listed in the market */}
              {isListedInMarket && (
                <div className="px-6 py-5 border-b border-outline-variant/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
                    Mercado
                  </p>
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-on-surface-variant font-medium">
                      Preço
                    </span>
                    <span className="font-black text-on-surface font-mono tabular-nums">
                      {formatCurrency(marketPrice)}
                    </span>
                  </div>
                  {player.transfer_status === "auction" ? (
                    <Button
                      variant="primary"
                      full
                      disabled={!canAfford || matchInProgress}
                      title={
                        matchInProgress
                          ? "Disponível após as partidas"
                          : undefined
                      }
                      onClick={() => {
                        openAuctionBid?.(player);
                        closeModal();
                      }}
                    >
                      {canAfford
                        ? "🔨 Licitar no Leilão"
                        : "Saldo Insuficiente"}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      full
                      disabled={!canAfford || matchInProgress}
                      title={
                        matchInProgress
                          ? "Disponível após as partidas"
                          : undefined
                      }
                      onClick={() => {
                        if (!canAfford) return;
                        setGameDialog?.({
                          mode: "confirm",
                          title: `Comprar ${player.name}`,
                          description: `${player.position} · Qualidade ${player.skill} · Preço: ${formatCurrency(marketPrice)}`,
                          confirmLabel: "Confirmar Compra",
                          onConfirm: () => buyPlayer?.(player.id),
                          onCancel: () => {},
                        });
                        closeModal();
                      }}
                    >
                      {canAfford ? "💰 Comprar Jogador" : "Saldo Insuficiente"}
                    </Button>
                  )}
                </div>
              )}

              {/* Contract management */}
              {isMyPlayer && (
                <div className="px-6 py-5 border-b border-outline-variant/10 md:border-b-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
                    Gestão Contratual
                  </p>
                  <div className="flex flex-col gap-2">
                    {isLocked && (
                      <p className="text-[11px] text-amber-400/90 font-bold">
                        🔒 Contrato em vigor até {contractEndYear}, {contractEndLabel} — não pode ser transferido.
                      </p>
                    )}
                    <Button
                      variant="primary"
                      full
                      disabled={matchInProgress}
                      title={
                        matchInProgress
                          ? "Disponível após as partidas"
                          : "Renovar Contrato"
                      }
                      onClick={() => {
                        renewPlayerContract?.(player);
                        closeModal();
                      }}
                    >
                      📝 Renovar Contrato
                    </Button>
                    <Button
                      variant="secondary"
                      full
                      disabled={matchInProgress || alreadyAuctionedThisWeek || isLocked}
                      title={
                        matchInProgress
                          ? "Disponível após as partidas"
                          : isLocked
                            ? `Contrato até ${contractEndYear}, ${contractEndLabel}`
                            : alreadyAuctionedThisWeek
                              ? "Já foi a leilão nesta semana"
                              : "Vender em Leilão"
                      }
                      onClick={() => {
                        listPlayerAuction?.(player);
                        closeModal();
                      }}
                    >
                      🔨 Vender em Leilão
                    </Button>
                    {player.transfer_status === "fixed" ? (
                      <Button
                        variant="danger"
                        full
                        disabled={matchInProgress}
                        title={
                          matchInProgress
                            ? "Disponível após as partidas"
                            : "Retirar da Lista"
                        }
                        onClick={() => {
                          removeFromTransferList?.(player);
                          closeModal();
                        }}
                      >
                        ✕ Retirar da Lista
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        full
                        disabled={matchInProgress || isLocked}
                        title={
                          matchInProgress
                            ? "Disponível após as partidas"
                            : isLocked
                              ? `Contrato até ${contractEndYear}, ${contractEndLabel}`
                              : "Listar para Transferência"
                        }
                        onClick={() => {
                          listPlayerFixed?.(player);
                          closeModal();
                        }}
                      >
                        🏷️ Listar para Transferência
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Performance */}
            <div className="flex flex-col">
              {/* ── DESEMPENHO (época vs carreira) ── */}
              <div className="px-6 py-5 border-b border-outline-variant/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
                  Desempenho
                </p>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                      <th className="py-1 pr-3 font-black"></th>
                      <th className="py-1 px-3 text-right font-black">Época</th>
                      <th className="py-1 pl-3 text-right font-black">Carreira</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfRows.map((r) => (
                      <tr
                        key={r.label}
                        className="border-t border-outline-variant/10"
                      >
                        <td className="py-2 pr-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                          {r.label}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-black font-headline text-base tabular-nums ${r.seasonClass}`}
                        >
                          {r.season}
                        </td>
                        <td
                          className={`pl-3 py-2 text-right font-black font-headline text-base tabular-nums ${r.careerClass}`}
                        >
                          {r.career}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Skill evolution chart */}
              <SkillLineChart
                skillHistory={playerHistoryModal.skillHistory || []}
                skill={skill}
                position={pos}
              />
            </div>
          </div>

          {/* ── AWARDS (full width) ── */}
          <div className="px-6 py-5 border-t border-outline-variant/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
              Prémios Individuais
            </p>
            {awards.length === 0 ? (
              <p className="text-on-surface-variant text-sm italic">
                Sem prémios individuais registados.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {awards.map((a, i) => (
                  <div
                    key={`${a.season ?? "?"}-${a.achievement ?? "?"}-${i}`}
                    className="flex items-center gap-2 px-3 py-2 rounded border border-amber-500/20 bg-amber-500/5"
                  >
                    <span className="text-amber-400 text-sm" title="Prémio">
                      🏆
                    </span>
                    <div>
                      <p className="text-amber-400 font-black text-xs">
                        {a.achievement}
                      </p>
                      <p className="text-on-surface-variant text-[10px] font-bold tabular-nums">
                        {a.season ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TRANSFER HISTORY (full width below) ── */}
          <div className="px-6 py-5 border-t border-outline-variant/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
              Historial de Transferências
            </p>
            {transfers.length === 0 ? (
              <p className="text-on-surface-variant text-sm italic">
                Sem transferências registadas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-container-high/50">
                      <th className="px-3 py-2">Época</th>
                      <th className="px-3 py-2">De</th>
                      <th className="px-3 py-2">Para</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((t, i) => {
                      const isOut = t.type === "transfer_out";
                      const fromTeam = isOut ? t.team_name : t.related_team_name;
                      const toTeam = isOut ? t.related_team_name : t.team_name;
                      return (
                        <tr
                          key={`${t.year ?? "?"}-${t.matchweek ?? "?"}-${t.related_team_name ?? "?"}-${t.team_name ?? "?"}-${i}`}
                          className="border-t border-outline-variant/10 hover:bg-primary-container/10 transition-colors text-sm"
                        >
                          <td className="px-3 py-2.5 text-on-surface-variant text-xs tabular-nums">
                            {t.year ?? "—"}
                            {t.matchweek ? (
                              <span className="opacity-50"> J{t.matchweek}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-on-surface-variant text-xs truncate max-w-22.5">
                            {fromTeam || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-on-surface truncate max-w-22.5">
                            {toTeam || "?"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-tertiary font-black text-xs tabular-nums">
                            {t.amount > 0 ? formatCurrency(t.amount) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
