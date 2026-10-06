import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";
import { LiveClock } from "../shared/LiveClock.jsx";
import { TeamCrest } from "../shared/TeamCrest.jsx";
import { isAdminCoach } from "../admin/adminApi.js";
import { liveScore } from "../live/liveHelpers.js";
import { rankStandings } from "../../utils/standingsRank.js";
import { formatCurrency } from "../../utils/formatters.js";
import { usePlayCta } from "./usePlayCta.js";
import { socket } from "../../socket.js";

const compactEuros = new Intl.NumberFormat("pt-PT", {
  notation: "compact",
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 1,
});

/**
 * Próximo jogo (md+): competição, adversário e casa/fora — o que o treinador
 * está a preparar, sempre à vista.
 *
 * @param {Object} props
 * @param {Object|null} props.summary `nextMatchSummary` do servidor.
 * @param {number} props.jornada Jornada da liga que aí vem.
 * @param {string} props.ink Cor do texto sobre a cor do clube.
 * @returns {JSX.Element|null}
 */
function NextMatch({ summary, jornada, ink }) {
  if (!summary) return null;
  const opp = summary.opponent;
  const competition = summary.isCup
    ? summary.cupRoundName || "Taça"
    : `Liga · J${jornada}`;
  return (
    <div className="hidden md:flex min-w-0 max-w-[min(30rem,40vw)] justify-center">
      <div
        className="flex items-center gap-2 min-w-0 rounded-full bg-black/25 pl-3 pr-1.5 py-1"
        style={{ color: ink }}
      >
        <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] opacity-70">
          {competition}
        </span>
        {opp ? (
          <>
            <span className="shrink-0 text-[10px] font-bold opacity-60">vs</span>
            <TeamCrest team={opp} size="w-6 h-6 text-[10px]" />
            <span className="min-w-0 truncate text-sm font-headline font-black uppercase tracking-tight">
              {opp.name}
            </span>
            {summary.venue && (
              <span className="shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                {summary.venue}
              </span>
            )}
          </>
        ) : (
          <span className="truncate pr-1.5 text-xs font-bold opacity-80">
            Sem jogo esta semana
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Valor compacto do header (orçamento, posição): rótulo por cima, valor por baixo.
 *
 * @param {Object} props
 * @param {string} props.label Rótulo.
 * @param {string} props.value Valor já formatado.
 * @param {string} props.ink Cor do texto sobre a cor do clube.
 * @param {string} [props.title] Tooltip com o valor por extenso.
 * @returns {JSX.Element}
 */
function HeaderStat({ label, value, ink, title, center = false }) {
  return (
    <div className={`flex flex-col ${center ? "items-center" : "items-end"} leading-tight px-2`} style={{ color: ink }} title={title}>
      <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">
        {label}
      </span>
      <span className="text-sm font-headline font-black tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Mini-gráfico do saldo: linha + área sobre os últimos pontos de `balanceHistory`,
 * com o último ponto realçado. Sem libs — SVG com viewBox fixo.
 *
 * @param {Object} props
 * @param {Array<{balance: number}>} props.points Saldo por jornada (do mais antigo ao mais recente).
 * @returns {JSX.Element}
 */
function BalanceSpark({ points }) {
  const W = 240;
  const H = 64;
  const P = 6;
  const vals = points.map((p) => p.balance);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const xy = vals.map((v, i) => [
    P + (i * (W - 2 * P)) / Math.max(1, vals.length - 1),
    H - P - ((v - min) / span) * (H - 2 * P),
  ]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 text-primary" role="img" aria-label="Evolução do saldo">
      <polygon points={`${P},${H} ${line} ${lx.toFixed(1)},${H}`} fill="currentColor" opacity="0.15" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Barra da jornada: o meu clube, o próximo jogo (ou o relógio do direto),
 * orçamento, posição, o botão JOGAR com o estado da jornada, sala/chat e
 * menu do utilizador. Lê tudo do `useGame()`; só recebe callbacks de fora.
 *
 * @param {{ handleLogout: () => void, setAuthPhase: (phase: string) => void, scrollToTop: () => void, replayTutorial?: () => void }} props
 */
export function GameHeader({ handleLogout, setAuthPhase, scrollToTop, replayTutorial }) {
  const {
    teams,
    seasonYear,
    calendarIndex,
    currentJornada,
    nextMatchSummary,
    me,
    leaveToMenu,
    teamInfo,
    avatarSeed,
    coachAvatars,
    coachAvatarSeeds,
    backendUrl,
    navigateTab,
    resetGameState,
    isMatchInProgress,
    isPlayingMatch,
    liveMinute,
    isCupMatch,
    cupPreMatch,
    cupMatchRoundName,
    cupExtraTimeBadge,
    setRoomHubOpen,
    roomHubOpen,
    unreadRoom,
    unreadGlobal,
    chatPeek,
    setRoomSettingsOpen,
    userDropdownOpen,
    setUserDropdownOpen,
    financeData,
    myMatch,
  } = useGame();
  const cta = usePlayCta(scrollToTop);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);

  // Dropdown do utilizador fecha com Escape (a saída animada trata o AnimatePresence no JSX).
  useEffect(() => {
    if (!userDropdownOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setUserDropdownOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userDropdownOpen, setUserDropdownOpen]);

  useEffect(() => {
    if (!standingsOpen && !budgetOpen) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setStandingsOpen(false);
      setBudgetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [standingsOpen, budgetOpen]);

  // Texto sobre a cor do clube (o fundo do header é a cor primária).
  const ink = teamInfo?.color_secondary || "var(--color-on-surface)";
  const week = (calendarIndex ?? 0) + 1;
  const division = teams.find((t) => Number(t.id) === Number(me?.teamId))?.division;
  const divisionTeams =
    division == null ? [] : rankStandings(teams.filter((t) => t.division === division));
  const position =
    divisionTeams.findIndex((t) => Number(t.id) === Number(me?.teamId)) + 1;
  const budget = teamInfo?.budget ?? 0;
  const nextOpponent = nextMatchSummary?.opponent;
  const homeT = myMatch && teams.find((t) => Number(t.id) === Number(myMatch.homeTeamId));
  const awayT = myMatch && teams.find((t) => Number(t.id) === Number(myMatch.awayTeamId));
  const score = myMatch?.events
    ? { ...liveScore(myMatch.events, liveMinute), homeName: homeT?.name, awayName: awayT?.name }
    : null;

  return (
    <header
      className="[grid-area:top] relative z-(--z-header) flex items-center border-b border-outline-variant/20 h-[var(--header-h)] pt-[env(safe-area-inset-top,0px)] shadow-md shadow-black/30"
      style={
        teamInfo?.color_primary
          ? {
              background: `linear-gradient(180deg, ${teamInfo.color_primary} 0%, color-mix(in srgb, ${teamInfo.color_primary} 84%, black) 100%)`,
            }
          : {
              background: "var(--color-surface-container-low)",
            }
      }
    >
      {teamInfo?.crest && (
        // Célula do brasão: sem tile, zoom grande, cortado e inclinado; o texto começa a seguir.
        <div aria-hidden className="absolute left-0 inset-y-0 w-28 overflow-hidden pointer-events-none">
          <img
            src={teamInfo.crest}
            alt=""
            className="absolute left-1/2 top-1/2 h-[260%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] drop-shadow-[2px_3px_3px_rgba(0,0,0,0.35)]"
          />
        </div>
      )}
      <div className={`relative flex items-center gap-3 w-full ${teamInfo?.crest ? "pl-32 pr-3 lg:pr-6" : "px-3 lg:px-6"} md:grid md:grid-cols-[1fr_auto_1fr]`}>
        {/* Esquerda: o meu clube + semana (no mobile, também o adversário) */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {!teamInfo?.crest && <TeamCrest team={teamInfo} size="w-9 h-9 text-sm" />}
          <div className="min-w-0" style={{ color: ink }}>
            <h1 className="truncate text-sm font-headline font-black uppercase tracking-tight leading-tight">
              {teamInfo?.name || "CashBall"}
            </h1>
            <p className="truncate text-[10px] font-bold uppercase tracking-widest leading-tight opacity-70">
              {seasonYear} · Semana {week}
              {nextOpponent && !isMatchInProgress && (
                <span className="md:hidden"> · vs {nextOpponent.name}</span>
              )}
            </p>
          </div>
        </div>

        {/* Centro: próximo jogo, ou o relógio do direto (absoluto, centrado).
            A partir de md o header é uma grelha 1fr·auto·1fr: as laterais têm
            a mesma largura, por isso o centro é o centro do ecrã. */}
        {isMatchInProgress ? (
          <LiveClock
            liveMinute={liveMinute}
            isPlayingMatch={isPlayingMatch}
            isCupMatch={isCupMatch}
            cupPreMatch={cupPreMatch}
            cupMatchRoundName={cupMatchRoundName}
            cupExtraTimeBadge={cupExtraTimeBadge}
            score={score}
          />
        ) : (
          <NextMatch summary={nextMatchSummary} jornada={currentJornada} ink={ink} />
        )}

        {/* Direita: números do clube, JOGAR, sala/chat e utilizador */}
        <div className="flex items-center gap-1 shrink-0 ml-auto md:col-start-3 md:justify-self-end">
          {!isMatchInProgress && (
            <div className="hidden lg:flex items-center gap-1 mr-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!budgetOpen && me?.teamId) socket.emit("requestFinanceData", { teamId: me.teamId });
                    setBudgetOpen((v) => !v);
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={budgetOpen}
                  title="Ver evolução do saldo"
                  className="rounded-lg hover:bg-white/10 transition-colors py-0.5"
                >
                  <HeaderStat
                    label="Orçamento"
                    value={compactEuros.format(budget)}
                    title={formatCurrency(budget)}
                    ink={ink}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {budgetOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-(--z-header-scrim)"
                        onClick={() => setBudgetOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 top-full mt-2 w-72 bg-surface-container border border-outline-variant/30 rounded-lg shadow-xl overflow-hidden z-(--z-header-menu)"
                        role="dialog"
                        aria-label="Evolução do saldo"
                      >
                        {(() => {
                          const hist = (financeData?.balanceHistory || []).slice(-10);
                          const delta = hist.length > 1 ? hist[hist.length - 1].balance - hist[hist.length - 2].balance : 0;
                          return (
                            <div className="px-3 pt-3 pb-2">
                              <div className="flex items-baseline justify-between">
                                <span className="text-lg font-headline font-black tabular-nums text-on-surface">
                                  {formatCurrency(budget)}
                                </span>
                                {hist.length > 1 && (
                                  <span className={`text-xs font-black tabular-nums ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {delta >= 0 ? "▲ +" : "▼ "}
                                    {compactEuros.format(delta)}
                                  </span>
                                )}
                              </div>
                              {hist.length > 1 ? (
                                <>
                                  <BalanceSpark points={hist} />
                                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                                    <span>{hist[0].label}</span>
                                    <span>{hist[hist.length - 1].label}</span>
                                  </div>
                                </>
                              ) : (
                                <p className="py-4 text-center text-xs text-on-surface-variant/70">
                                  {financeData?.balanceHistory ? "Ainda sem histórico." : "A carregar…"}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetOpen(false);
                            navigateTab("finances");
                            scrollToTop();
                          }}
                          className="w-full border-t border-outline-variant/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-surface-bright transition-colors"
                        >
                          Ver finanças
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              {position > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStandingsOpen((v) => !v)}
                    aria-haspopup="dialog"
                    aria-expanded={standingsOpen}
                    title="Ver classificação"
                    className="rounded-lg hover:bg-white/10 transition-colors py-0.5"
                  >
                    <HeaderStat label="Posição" value={`${position}.º`} ink={ink} center />
                  </button>
                  <AnimatePresence initial={false}>
                    {standingsOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-(--z-header-scrim)"
                          onClick={() => setStandingsOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="absolute right-0 top-full mt-2 w-72 bg-surface-container border border-outline-variant/30 rounded-lg shadow-xl overflow-hidden z-(--z-header-menu)"
                          role="dialog"
                          aria-label="Classificação da divisão"
                        >
                          <ul className="max-h-80 overflow-y-auto py-1">
                            {divisionTeams.map((t, i) => {
                              const mine = Number(t.id) === Number(me?.teamId);
                              return (
                                <li
                                  key={t.id}
                                  className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                                    mine ? "bg-primary/15 font-black text-on-surface" : "text-on-surface-variant font-bold"
                                  }`}
                                >
                                  <span className="w-5 tabular-nums text-right opacity-70">{i + 1}</span>
                                  <TeamCrest team={t} size="w-5 h-5 text-[9px]" />
                                  <span className="flex-1 truncate">{t.name}</span>
                                  <span className="tabular-nums opacity-70" title="Diferença de golos">
                                    {(t.goals_for || 0) - (t.goals_against || 0) > 0 ? "+" : ""}
                                    {(t.goals_for || 0) - (t.goals_against || 0)}
                                  </span>
                                  <span className="w-7 tabular-nums text-right font-black text-on-surface">{t.points || 0}</span>
                                </li>
                              );
                            })}
                          </ul>
                          <button
                            type="button"
                            onClick={() => {
                              setStandingsOpen(false);
                              navigateTab("standings");
                              scrollToTop();
                            }}
                            className="w-full border-t border-outline-variant/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-surface-bright transition-colors"
                          >
                            Ver classificação completa
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Slot do botão de continuar do MatchPage (intervalo/pausa) */}
          <div id="match-cta-slot" className="ml-2 flex items-center" />

          {/* RoomHub button — unified: Coaches + Chat */}
          <div className="relative">
          <button
            onMouseUp={(e) => e.stopPropagation()}
            onClick={() => setRoomHubOpen((v) => !v)}
            title="Sala e Chat"
            aria-label={`Sala e chat${unreadRoom + unreadGlobal > 0 ? `, ${unreadRoom + unreadGlobal} mensagens não lidas` : ""}`}
            aria-expanded={roomHubOpen}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70"
          >
            <span
              className="material-symbols-outlined text-[20px] leading-none"
              style={{ color: ink }}
            >
              chat
            </span>
            {/* Badge único: não-lidas vencem (acionável); senão nº de coaches na sala */}
            {unreadRoom + unreadGlobal > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black leading-none flex items-center justify-center px-1 tabular-nums">
                {unreadRoom + unreadGlobal > 9
                  ? "9+"
                  : unreadRoom + unreadGlobal}
              </span>
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] font-black leading-none flex items-center justify-center px-1 tabular-nums">
                {cta.totalCoaches}
              </span>
            )}
          </button>
          {/* Balão de banda desenhada (ex-toast 6): última msg não-lida. */}
          <AnimatePresence initial={false}>
            {chatPeek && !roomHubOpen && (
              <motion.button
                type="button"
                onMouseUp={(e) => e.stopPropagation()}
                onClick={() => setRoomHubOpen(true)}
                aria-label={`Nova mensagem de ${chatPeek.coachName}: abrir chat`}
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute top-full right-0 mt-3 w-64 max-w-[70vw] rounded-2xl border-2 border-black bg-white text-left text-zinc-900 shadow-2xl"
              >
                <span
                  aria-hidden
                  className="absolute -top-[7px] right-3 h-3 w-3 rotate-45 border-t-2 border-l-2 border-black bg-white"
                />
                <span className="flex items-center gap-1.5 px-3 pt-2">
                  <CoachAvatar
                    name={chatPeek.coachName}
                    seed={coachAvatarSeed(
                      chatPeek.coachName,
                      me.name,
                      avatarSeed,
                      coachAvatarSeeds,
                    )}
                    size="w-6 h-6"
                    coachAvatars={coachAvatars}
                    backendUrl={backendUrl}
                  />
                  <span className="block text-[11px] font-black tracking-widest text-emerald-700 uppercase truncate">
                    {chatPeek.coachName}
                  </span>
                </span>
                <span className="block px-3 pb-2.5 text-sm leading-snug break-words">
                  {chatPeek.preview}
                </span>
              </motion.button>
            )}
          </AnimatePresence>
          </div>

          {/* User dropdown — disabled during live match */}
          <div className="relative">
            <button
              onClick={() => {
                if (isPlayingMatch) return;
                setUserDropdownOpen((v) => !v);
              }}
              disabled={isPlayingMatch}
              aria-haspopup="menu"
              aria-expanded={userDropdownOpen}
              title={
                isPlayingMatch
                  ? "Definições bloqueadas durante o jogo"
                  : "Definições do Utilizador"
              }
              className={`flex items-center gap-1 transition-colors rounded-lg px-1.5 py-1 ${
                isPlayingMatch
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-white/10"
              }`}
            >
              <CoachAvatar
                name={me.name}
                seed={`${me.name}|${avatarSeed}`}
                size="sm"
                coachAvatars={coachAvatars}
                backendUrl={backendUrl}
              />
              <span
                className="material-symbols-outlined text-[16px] leading-none opacity-60"
                style={{ color: ink }}
              >
                {userDropdownOpen ? "expand_less" : "expand_more"}
              </span>
            </button>

            {/* Dropdown menu */}
            <AnimatePresence initial={false}>
            {userDropdownOpen && !isPlayingMatch && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-(--z-header-scrim)"
                  onClick={() => setUserDropdownOpen(false)}
                />
                {/* Menu */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-full mt-1 w-56 bg-surface-container border border-outline-variant/30 rounded-lg shadow-xl overflow-hidden z-(--z-header-menu)"
                  role="menu"
                  aria-label="Definições do utilizador"
                >
                  {/* Quem sou e em que sala (o header mostra o clube, não o treinador) */}
                  <div className="px-4 pt-3 pb-2 border-b border-outline-variant/20">
                    <p className="text-sm font-bold text-on-surface truncate">{me.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/70 truncate">
                      Sala {me.roomName || me.roomCode}
                    </p>
                  </div>
                  {/* A minha conta */}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigateTab("user_settings");
                      scrollToTop();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-bright transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      person
                    </span>
                    A minha conta
                  </button>

                  {/* Opções da sala — ritmo da simulação (todos veem, só o admin muda) */}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      setRoomSettingsOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-bright transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      settings
                    </span>
                    Opções
                  </button>

                  {/* Rever tutorial passo a passo */}
                  {replayTutorial && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        replayTutorial();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-bright transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                        school
                      </span>
                      Rever tutorial
                    </button>
                  )}

                  {/* Mudar de Jogo — vai para a landing sem logout */}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      resetGameState();
                      leaveToMenu();
                      setAuthPhase("mode");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-bright transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      swap_horiz
                    </span>
                    Mudar de Jogo
                  </button>

                  {/* Admin (apenas o coach admin — ver ADMIN_COACH_NAME) */}
                  {isAdminCoach(me?.name) && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigateTab("admin");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[18px] text-amber-400">
                        admin_panel_settings
                      </span>
                      Admin
                    </button>
                  )}

                  {/* Divider */}
                  <div className="border-t border-outline-variant/20" />

                  {/* Sair */}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[18px] text-red-400">
                      logout
                    </span>
                    Sair
                  </button>
                </motion.div>
              </>
            )}
            </AnimatePresence>
          </div>

          {/* JOGAR: sempre o último, à direita */}
          {!isMatchInProgress && (
            <button
              type="button"
              data-tour="nav-play"
              onClick={cta.onClick}
              className={`ml-2 hidden lg:flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
                cta.state === "waiting"
                  ? "bg-black/30 text-on-surface border border-primary/60"
                  : cta.state === "active"
                    ? "bg-primary text-on-primary ring-2 ring-white/40"
                    : "bg-primary text-on-primary shadow-lg shadow-black/30 hover:brightness-110"
              }`}
            >
              <span aria-hidden className={`material-symbols-outlined text-[18px] leading-none ${cta.state === "waiting" ? "text-primary" : ""}`}>
                {cta.icon}
              </span>
              {cta.label}
              {cta.totalCoaches > 1 && (
                <span
                  className="tabular-nums rounded-full bg-black/25 px-1.5 py-0.5 text-[10px]"
                  title="Treinadores prontos"
                >
                  {cta.readyCount}/{cta.totalCoaches}
                </span>
              )}
            </button>
          )}

          {/* Slot do botão Pausa do jogo ao vivo (onde está o JOGAR fora do jogo) */}
          <div id="match-pause-slot" className="ml-2 hidden lg:flex items-center" />
        </div>
      </div>
    </header>
  );
}
