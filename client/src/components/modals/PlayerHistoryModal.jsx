import { useContext, useEffect, useId, useRef } from "react";
import { TeamLink } from "../shared/TeamLink.jsx";
import { GameContext } from "../../contexts/GameContext.jsx";
import { contractWeekLabel } from "../../utils/slotLabel.js";
import { formatCurrency, seasonToYear } from "../../utils/formatters.js";
import { BadgeSkills } from "../shared/BadgeSkills.jsx";
import { Badge } from "../shared/Badge.jsx";
import { Button } from "../shared/Button.jsx";
import { ModalShell } from "../shared/ModalShell.jsx";
import { PlayerAvatar } from "../shared/PlayerAvatar.jsx";
import { TeamCrest } from "../shared/TeamCrest.jsx";
import { PlayerStatusBadges, StarMark } from "../shared/PlayerStatusBadges.jsx";
import { SkillLineChart } from "./SkillLineChart.jsx";
import {
  POSITION_BADGE_BG_CLASS,
  POSITION_BADGE_TEXT_CLASS,
  POSITION_BADGE_BORDER_CLASS,
  POSITION_LABEL_MAP,
  POSITION_FULL_LABEL_MAP,
  POSITION_ACCENT_HEX,
  SEASON_WEEKS,
  MODAL_Z,
} from "../../constants/index.js";

/**
 * Título de secção da ficha: ícone + rótulo + filete até à margem.
 *
 * @param {Object} props
 * @param {string} props.icon
 * @param {import("react").ReactNode} [props.meta]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
function SectionTitle({ icon, meta, children }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none text-primary">
        {icon}
      </span>
      <h3 className="shrink-0 text-[10px] font-black uppercase tracking-widest text-primary">
        {children}
      </h3>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-outline-variant/40 to-transparent" />
      {meta && (
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest tabular-nums text-on-surface-variant/60">
          {meta}
        </span>
      )}
    </div>
  );
}

/**
 * Estado vazio compacto (as secções da ficha são curtas — o EmptyState
 * grande ocupava meio ecrã por secção vazia).
 *
 * @param {Object} props
 * @param {string} props.icon
 * @param {string} props.children
 * @returns {JSX.Element}
 */
function EmptyLine({ icon, children }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-outline-variant/30 px-3 py-3 text-[11px] font-bold text-on-surface-variant/60">
      <span aria-hidden className="material-symbols-outlined text-[18px]! leading-none text-on-surface-variant/40">
        {icon}
      </span>
      {children}
    </p>
  );
}

const SECTION = "border-t border-outline-variant/15 px-4 py-4 sm:px-6 sm:py-5";

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
 *   respondContractRequest?: function,
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
  respondContractRequest,
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
  const titleId = useId();
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
  const posColor = POSITION_ACCENT_HEX[pos] || POSITION_ACCENT_HEX.MED;
  const teamPrimary = player.team_color_primary || player.color_primary || "#333333";
  const teamSecondary = player.team_color_secondary || player.color_secondary || "#ffffff";
  const isStar = player.is_star === 1;
  const skill = player.skill ?? 0;
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

  // Mosaicos de desempenho (época em destaque, carreira por baixo)
  const perfTiles = [
    { label: "Jogos", icon: "stadium", season: sGames, career: cGames, cls: "text-on-surface" },
    { label: "Golos", icon: "sports_soccer", season: sGoals, career: cGoals, cls: sGoals > 0 ? "text-tertiary" : "text-on-surface" },
    { label: "Vermelhos", icon: "style", season: sReds, career: cReds, cls: sReds > 0 ? "text-error" : "text-on-surface" },
    { label: "Lesões", icon: "healing", season: sInjuries, career: cInjuries, cls: sInjuries > 0 ? "text-amber-400" : "text-on-surface" },
  ];

  // Contract management — only shown for own team
  const isMyPlayer =
    myTeamId != null &&
    player.team_id != null &&
    Number(myTeamId) === Number(player.team_id);
  const nowIdx = ctxIdx ?? matchweekCount;
  const currentEpoch = (Math.max(1, season) - 1) * SEASON_WEEKS + Math.min(SEASON_WEEKS, nowIdx + 1);
  const contractStart = player.contract_start_epoch || 0;
  const isLocked = contractStart > 0 && currentEpoch < contractStart + SEASON_WEEKS;
  const contractEndEpoch = contractStart > 0 ? contractStart + SEASON_WEEKS : 0;
  const contractEndSeason = contractStart > 0 ? Math.ceil(contractEndEpoch / SEASON_WEEKS) : 0;
  const contractEndSlot = contractStart > 0
    ? contractEndEpoch - (contractEndSeason - 1) * SEASON_WEEKS
    : 0;
  const contractEndLabel = contractStart > 0 ? contractWeekLabel(contractEndSlot) : "";
  const contractEndYear = contractStart > 0 ? seasonToYear(contractEndSeason) : 0;
  const matchInProgress = isPlayingMatch || showHalftimePanel;
  // Server uses >= to prevent re-auction in same calendar slot (startAuction
  // grava game.calendarIndex em last_auctioned_matchweek). nowIdx =
  // calendarIndex ?? matchweekCount, espelhando a guarda do servidor.
  const alreadyAuctionedThisWeek =
    nowIdx > 0 &&
    (player.last_auctioned_matchweek || 0) >= nowIdx;

  // Pedido de renovação pendente (red flag): só os dois botões da notícia —
  // aceitar pelo exigido ou mandar a leilão. O payload vem fresco do
  // requestPlayerHistory em cada abertura.
  const hasPendingRequest = isMyPlayer && !!player.contract_request_pending;
  const requestedWage = Number(player.contract_requested_wage) || null;

  // Market purchase — only when player belongs to *another* team and is listed
  const isListedInMarket =
    !isMyPlayer &&
    (player.transfer_status === "auction" ||
      player.transfer_status === "fixed");
  const marketPrice = player.marketPrice ?? player.value ?? 0;
  const canAfford = myBudget >= marketPrice;

  const afterMatches = "Disponível após as partidas";
  const lockedTitle = `Contrato até ${contractEndYear}, ${contractEndLabel}`;
  const rating = Number(player.last_rating);
  const hasRating = player.last_rating != null && Number.isFinite(rating) && rating > 0;

  const kpis = [
    { label: "Valor de mercado", value: formatCurrency(player.value || 0), cls: "text-tertiary" },
    { label: "Ordenado/sem", value: formatCurrency(player.wage || 0), cls: "text-on-surface" },
    {
      label: "Contrato até",
      value: contractStart > 0 ? contractEndYear : "—",
      sub: contractStart > 0 ? contractEndLabel : "Sem registo",
      icon: isLocked ? "lock" : null,
      cls: "text-on-surface",
    },
    {
      label: "Última nota",
      value: hasRating ? String(Math.round(rating * 2) / 2).replace(".", ",") : "—",
      sub: hasRating ? "de 10" : "Sem jogos",
      icon: hasRating ? "star" : null,
      cls: "text-on-surface",
    },
  ];

  const clubLabel = player.team_name
    ? player.transfer_status === "auction" && player.isExClub
      ? `ex-${player.team_name}`
      : player.team_name
    : "Sem clube";

  return (
    <ModalShell
      visible={!!playerHistoryModal}
      onClose={closeModal}
      z={MODAL_Z.default}
      variant="wide"
      labelledBy={titleId}
      dismissable
    >
      <div className="flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* ── CABEÇALHO (carta do jogador) ──
            shrink-0: o container pai tem altura indefinida (max-height: 90vh),
            pelo que o flex-basis 0% do body (flex-1) é tratado como auto e o
            flex-shrink distribui o excesso pelo header — sem shrink-0 o header
            encolhe abaixo do conteúdo e o overflow-hidden corta as linhas
            envoltas (nome longo + insígnias). */}
        <header className="relative shrink-0 overflow-hidden bg-surface-container-high">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(120% 100% at 0% 0%, ${posColor}2e 0%, transparent 55%), radial-gradient(90% 120% at 100% 0%, ${teamPrimary}33 0%, transparent 65%)`,
            }}
          />
          {/* Filete nas cores do clube */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${teamPrimary}, ${teamSecondary})` }}
          />
          {/* Marca d'água da posição */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-2 overflow-clip select-none font-headline text-[96px] font-black leading-[0.8] tracking-tighter text-on-surface opacity-[0.04] sm:text-[140px]"
          >
            {POSITION_LABEL_MAP[pos] || pos}
          </span>

          <button
            type="button"
            onClick={closeModal}
            title="Fechar"
            aria-label="Fechar"
            className="absolute right-3 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-on-surface-variant backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-on-surface sm:right-4 sm:top-4"
          >
            <span aria-hidden className="material-symbols-outlined text-[20px]! leading-none">
              close
            </span>
          </button>

          <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
            <div className="flex items-start gap-3 sm:gap-5">
              <div
                className="shrink-0 rounded-full p-0.5 shadow-lg shadow-black/40"
                style={{ background: `linear-gradient(140deg, ${posColor}, ${posColor}00 75%)` }}
              >
                <PlayerAvatar
                  seed={player.id}
                  position={pos}
                  teamColor={player.team_color_primary || player.color_primary || null}
                  nationality={player.nationality}
                  size="w-16 h-16 sm:w-24 sm:h-24"
                  photo={player.photo || null}
                />
              </div>

              <div className="min-w-0 flex-1 pr-10">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  <span
                    className={`rounded-sm border px-1.5 py-px ${POSITION_BADGE_BG_CLASS[pos] || "bg-surface-bright"} ${POSITION_BADGE_TEXT_CLASS[pos] || "text-on-surface"} ${POSITION_BADGE_BORDER_CLASS[pos] || "border-outline-variant/30"}`}
                  >
                    {POSITION_LABEL_MAP[pos] || pos}
                  </span>
                  <span>{POSITION_FULL_LABEL_MAP[pos] || pos}</span>
                  {player.age ? <span className="tabular-nums">· {player.age} anos</span> : null}
                  {player.nationality ? <span className="normal-case">· {player.nationality}</span> : null}
                </div>
                <h2
                  id={titleId}
                  className="mt-1 break-words font-headline text-xl font-black uppercase leading-[0.95] tracking-tight text-on-surface sm:text-3xl"
                >
                  {player.name}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1 empty:hidden">
                  {isStar && <StarMark className="ml-0" />}
                  <PlayerStatusBadges
                    player={player}
                    matchweekCount={matchweekCount}
                    season={season}
                  />
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  {player.team_name ? (
                    <TeamCrest
                      team={{
                        crest: player.team_crest,
                        name: player.team_name,
                        color_primary: teamPrimary,
                        color_secondary: teamSecondary,
                      }}
                      size="w-6 h-6 text-[10px]"
                    />
                  ) : null}
                  <span className="min-w-0 truncate text-xs font-black text-tertiary" title={player.team_name || undefined}>
                    <TeamLink teamId={player.team_id} onNavigate={closeModal}>
                      {clubLabel}
                    </TeamLink>
                  </span>
                </div>
              </div>
            </div>

            <BadgeSkills
              size="lg"
              className="mt-4 w-fit max-w-full"
              skill={skill}
              resistance={player.resistance}
              form={player.form}
              morale={player.morale}
              aggressiveness={player.aggressiveness}
              prevSkill={player.prev_skill}
            />
          </div>
        </header>

        {/* ── CORPO (rola) ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Faixa de números — filetes de 1px pela grelha (gap-px) */}
          <dl className="grid grid-cols-2 gap-px border-t border-outline-variant/20 bg-outline-variant/15 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="min-w-0 bg-surface-container px-4 py-3 sm:px-5">
                <dt className="truncate text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
                  {k.label}
                </dt>
                <dd className={`mt-1 flex min-w-0 items-center gap-1 font-headline text-lg font-black leading-tight tracking-tight tabular-nums ${k.cls}`}>
                  {k.icon && (
                    <span
                      aria-hidden
                      className={`material-symbols-outlined text-[16px]! leading-none ${k.icon === "star" ? "text-amber-400" : "text-amber-400/80"}`}
                    >
                      {k.icon}
                    </span>
                  )}
                  <span className="truncate">{k.value}</span>
                </dd>
                {k.sub && (
                  <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    {k.sub}
                  </p>
                )}
              </div>
            ))}
          </dl>

          {/* ── GESTÃO CONTRATUAL (só o meu jogador) ── */}
          {isMyPlayer && (
            <section className={SECTION}>
              <SectionTitle icon="contract_edit">Gestão contratual</SectionTitle>
              {isLocked && (
                <p className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-300">
                  <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">lock</span>
                  Contrato em vigor até {contractEndYear}, {contractEndLabel} — não pode ser transferido.
                </p>
              )}
              {hasPendingRequest ? (
                <div className="rounded-lg border border-error/30 bg-error-container/20 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="error" size="md">Ação necessária</Badge>
                    {requestedWage != null && (
                      <p className="text-xs font-bold text-on-surface-variant">
                        Exige{" "}
                        <span className="font-headline font-black tabular-nums text-on-surface">
                          {formatCurrency(requestedWage)}
                        </span>
                        /sem
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="success"
                      disabled={matchInProgress}
                      title={matchInProgress ? afterMatches : "Aceitar a renovação pelo valor exigido"}
                      onClick={() => {
                        respondContractRequest?.(player.id, true, requestedWage);
                        closeModal();
                      }}
                    >
                      <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">check</span>
                      Aceitar renovação
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={matchInProgress}
                      title={matchInProgress ? afterMatches : "Recusar — o jogador vai a leilão"}
                      onClick={() => {
                        respondContractRequest?.(player.id, false);
                        closeModal();
                      }}
                    >
                      <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">gavel</span>
                      Enviar para leilão
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    variant="primary"
                    disabled={matchInProgress}
                    title={matchInProgress ? afterMatches : "Renovar Contrato"}
                    onClick={() => {
                      renewPlayerContract?.(player);
                      closeModal();
                    }}
                  >
                    <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">edit_document</span>
                    Renovar contrato
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={matchInProgress || alreadyAuctionedThisWeek || isLocked}
                    title={
                      matchInProgress
                        ? afterMatches
                        : isLocked
                          ? lockedTitle
                          : alreadyAuctionedThisWeek
                            ? "Já foi a leilão nesta semana"
                            : "Vender em Leilão"
                    }
                    onClick={() => {
                      listPlayerAuction?.(player);
                      closeModal();
                    }}
                  >
                    <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">gavel</span>
                    Vender em leilão
                  </Button>
                  {player.transfer_status === "fixed" ? (
                    <Button
                      variant="dangerSoft"
                      disabled={matchInProgress}
                      title={matchInProgress ? afterMatches : "Retirar da Lista"}
                      onClick={() => {
                        removeFromTransferList?.(player);
                        closeModal();
                      }}
                    >
                      <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">close</span>
                      Retirar da lista
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={matchInProgress || isLocked}
                      title={
                        matchInProgress
                          ? afterMatches
                          : isLocked
                            ? lockedTitle
                            : "Listar para Transferência"
                      }
                      onClick={() => {
                        listPlayerFixed?.(player);
                        closeModal();
                      }}
                    >
                      <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">sell</span>
                      Pôr à venda
                    </Button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── MERCADO (jogador de outra equipa, listado) ── */}
          {isListedInMarket && (
            <section className={SECTION}>
              <SectionTitle icon="storefront">Mercado</SectionTitle>
              <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
                    {player.transfer_status === "auction" ? "Em leilão · base" : "Preço pedido"}
                  </p>
                  <p className="mt-1 font-headline text-2xl font-black leading-none tracking-tight tabular-nums text-on-surface">
                    {formatCurrency(marketPrice)}
                  </p>
                  {!canAfford && (
                    <p className="mt-1 text-[10px] font-bold text-error">
                      Faltam {formatCurrency(marketPrice - myBudget)}
                    </p>
                  )}
                </div>
                {player.transfer_status === "auction" ? (
                  <Button
                    variant="primary"
                    full
                    className="sm:w-auto"
                    disabled={!canAfford || matchInProgress}
                    title={matchInProgress ? afterMatches : undefined}
                    onClick={() => {
                      openAuctionBid?.(player);
                      closeModal();
                    }}
                  >
                    <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">gavel</span>
                    {canAfford ? "Licitar no leilão" : "Saldo insuficiente"}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    full
                    className="sm:w-auto"
                    disabled={!canAfford || matchInProgress}
                    title={matchInProgress ? afterMatches : undefined}
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
                    <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none">shopping_cart</span>
                    {canAfford ? "Comprar jogador" : "Saldo insuficiente"}
                  </Button>
                )}
              </div>
            </section>
          )}

          {/* ── EVOLUÇÃO + DESEMPENHO (2 colunas em md+) ── */}
          <div className="md:grid md:grid-cols-2 md:divide-x md:divide-outline-variant/15 md:border-t md:border-outline-variant/15">
            <section className={`${SECTION} md:border-t-0`}>
              <SectionTitle icon="monitoring">Evolução da skill</SectionTitle>
              <SkillLineChart
                skillHistory={playerHistoryModal.skillHistory || []}
                skill={skill}
                position={pos}
              />
            </section>

            <section className={`${SECTION} md:border-t-0`}>
              <SectionTitle icon="leaderboard" meta="Época · carreira">
                Desempenho
              </SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {perfTiles.map((t) => (
                  <div
                    key={t.label}
                    className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
                        {t.label}
                      </span>
                      <span aria-hidden className="material-symbols-outlined text-[16px]! leading-none text-on-surface-variant/35">
                        {t.icon}
                      </span>
                    </div>
                    <p className={`mt-1.5 font-headline text-2xl font-black leading-none tabular-nums ${t.cls}`}>
                      {t.season}
                    </p>
                    <p className="mt-1.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                      Carreira{" "}
                      <span className="font-black tabular-nums text-on-surface-variant">{t.career}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── PRÉMIOS ── */}
          <section className={SECTION}>
            <SectionTitle icon="emoji_events" meta={awards.length > 0 ? awards.length : null}>
              Prémios individuais
            </SectionTitle>
            {awards.length === 0 ? (
              <EmptyLine icon="emoji_events">Sem prémios individuais registados.</EmptyLine>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {awards.map((a, i) => (
                  <li
                    key={`${a.season ?? "?"}-${a.achievement ?? "?"}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-amber-500/5 px-3 py-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/15 ring-1 ring-amber-400/40">
                      <span aria-hidden className="material-symbols-outlined text-[18px]! leading-none text-amber-300">
                        military_tech
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-amber-200" title={a.achievement}>
                        {a.achievement}
                      </p>
                      <p className="text-[10px] font-bold tabular-nums text-on-surface-variant/70">
                        {a.season ?? "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── TRANSFERÊNCIAS (linha do tempo, mais recente primeiro) ── */}
          <section className={SECTION}>
            <SectionTitle icon="swap_horiz" meta={transfers.length > 0 ? transfers.length : null}>
              Historial de transferências
            </SectionTitle>
            {transfers.length === 0 ? (
              <EmptyLine icon="swap_horiz">Sem transferências registadas.</EmptyLine>
            ) : (
              <ol className="ml-1.5 border-l border-outline-variant/30">
                {[...transfers].reverse().map((t, i) => {
                  const isOut = t.type === "transfer_out";
                  const fromTeam = isOut ? t.team_name : t.related_team_name;
                  const toTeam = isOut ? t.related_team_name : t.team_name;
                  const fromId = isOut ? t.team_id : t.related_team_id;
                  const toId = isOut ? t.related_team_id : t.team_id;
                  return (
                    <li
                      key={`${t.year ?? "?"}-${t.matchweek ?? "?"}-${t.related_team_name ?? "?"}-${t.team_name ?? "?"}-${i}`}
                      className="relative pb-2 pl-4 last:pb-0"
                    >
                      <span
                        aria-hidden
                        className={`absolute -left-[5px] top-3.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-container ${i === 0 ? "bg-tertiary" : "bg-outline-variant"}`}
                      />
                      <div className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-black uppercase tracking-widest tabular-nums text-on-surface-variant/60">
                            {t.year ?? "—"}
                            {t.matchweek ? ` · J${t.matchweek}` : ""}
                          </p>
                          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                            <span className="min-w-0 font-bold text-on-surface-variant">
                              <TeamLink teamId={fromId} onNavigate={closeModal}>{fromTeam || "—"}</TeamLink>
                            </span>
                            <span aria-hidden className="material-symbols-outlined shrink-0 text-[14px]! leading-none text-on-surface-variant/50">
                              arrow_forward
                            </span>
                            <span className="min-w-0 font-black text-on-surface">
                              <TeamLink teamId={toId} onNavigate={closeModal}>{toTeam || "?"}</TeamLink>
                            </span>
                          </p>
                        </div>
                        <span className="shrink-0 font-headline text-sm font-black tabular-nums text-tertiary">
                          {t.amount > 0 ? formatCurrency(t.amount) : "—"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </ModalShell>
  );
}
