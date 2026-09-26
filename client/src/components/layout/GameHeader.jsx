import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { CoachAvatar } from "../shared/CoachAvatar.jsx";
import { coachAvatarSeed } from "../../utils/coachAvatar.js";
import { LiveClock } from "../shared/LiveClock.jsx";
import { isAdminCoach } from "../admin/adminApi.js";
import { useMobileLandscape } from "../../hooks/useIsMobile.js";

/**
 * Barra superior do jogo: marca, relógio de direto, sala/chat e menu do utilizador.
 * Lê tudo do `useGame()`; só recebe callbacks de fora.
 *
 * @param {{ handleLogout: () => void, setAuthPhase: (phase: string) => void, scrollToTop: () => void }} props
 */
export function GameHeader({ handleLogout, setAuthPhase, scrollToTop }) {
  const {
    players,
    awaitingCoaches,
    seasonYear,
    calendarIndex,
    me,
    setMe,
    teamInfo,
    avatarSeed,
    coachAvatars,
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
    setAdminPanelOpen,
    userDropdownOpen,
    setUserDropdownOpen,
  } = useGame();

  // Telemóvel em landscape (abaixo de lg): header compacto.
  const isMobileLandscape = useMobileLandscape();

  const totalCoaches =
    players.length +
    awaitingCoaches.filter((n) => !players.some((p) => p.name === n)).length;

  // Dropdown do utilizador fecha com Escape (a saída animada trata o AnimatePresence no JSX).
  useEffect(() => {
    if (!userDropdownOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setUserDropdownOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userDropdownOpen, setUserDropdownOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-160 flex items-center border-b border-outline-variant/20 h-[var(--header-h)] pt-[env(safe-area-inset-top,0px)] shadow-md shadow-black/30`}
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
      <div className={`relative flex items-center justify-between w-full ${isMobileLandscape ? "px-3" : "px-4 lg:px-6"}`}>
        {/* Left: brand + session info */}
        <div className="flex items-center gap-3">
          {/* Ícone principal — enorme mas recortado à altura da barra
              (overflow-hidden). Encostado à extrema esquerda e até ao fim
              da bola na direita, fazendo efeito de semi-círculo. */}
          <div
            className={`hidden md:flex shrink-0 overflow-hidden items-center justify-start ${isMobileLandscape ? "h-10 w-[72px] -ml-3" : "h-14 w-[99px] -ml-4 lg:-ml-6"}`}
          >
            <img
              src="/icon-512.png"
              alt="Logotipo CashBall"
              className={`${isMobileLandscape ? "h-24 w-24 -ml-[24px]" : "h-[132px] w-[132px] -ml-[33px]"} max-w-none shrink-0`}
            />
          </div>
          <h1
            className={`${isMobileLandscape ? "text-sm" : "text-base"} font-headline font-black tracking-tighter uppercase`}
            style={{
              color: teamInfo?.color_secondary || "var(--color-on-surface)",
            }}
          >
            CashBall <span style={{ opacity: 0.55 }}>26/27</span>
          </h1>
          <span
            className="hidden md:block text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{
              color: teamInfo?.color_secondary || "var(--color-on-surface)",
              opacity: 0.7,
            }}
          >
            {seasonYear} · S{(calendarIndex ?? 0) + 1} · {me.roomName || me.roomCode}
          </span>
        </div>

        {/* Center: live clock (absolute so it's always centered) */}
        {isMatchInProgress && (
          <LiveClock
            liveMinute={liveMinute}
            isPlayingMatch={isPlayingMatch}
            isCupMatch={isCupMatch}
            cupPreMatch={cupPreMatch}
            cupMatchRoundName={cupMatchRoundName}
            cupExtraTimeBadge={cupExtraTimeBadge}
          />
        )}

        {/* Right: user menu + chat */}
        <div className="flex items-center gap-1">
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
              style={{
                color: teamInfo?.color_secondary || "var(--color-on-surface)",
              }}
            >
              chat
            </span>
            {/* Badge único: não-lidas vencem (acionável); senão nº de coaches na sala */}
            {unreadRoom + unreadGlobal > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black leading-none flex items-center justify-center px-1 tabular-nums">
                {unreadRoom + unreadGlobal > 9
                  ? "9+"
                  : unreadRoom + unreadGlobal}
              </span>
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black leading-none flex items-center justify-center px-1 tabular-nums">
                {totalCoaches}
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
              className={`flex items-center gap-2 transition-colors rounded-lg px-2 py-1 ${
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
              <div className="hidden lg:flex flex-col items-start">
                <span
                  className="text-sm font-bold leading-tight"
                  style={{
                    color:
                      teamInfo?.color_secondary || "var(--color-on-surface)",
                  }}
                >
                  {me.name}
                </span>
                <span
                  className="text-xs leading-tight opacity-70"
                  style={{
                    color:
                      teamInfo?.color_secondary || "var(--color-on-surface)",
                  }}
                >
                  {teamInfo?.name}
                </span>
              </div>
              <span
                className="material-symbols-outlined text-[16px] leading-none opacity-60"
                style={{
                  color:
                    teamInfo?.color_secondary || "var(--color-on-surface)",
                }}
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
                  className="fixed inset-0 z-170"
                  onClick={() => setUserDropdownOpen(false)}
                />
                {/* Menu */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-full mt-1 w-56 bg-surface-container border border-outline-variant/30 rounded-lg shadow-xl overflow-hidden z-180"
                  role="menu"
                  aria-label="Definições do utilizador"
                >
                  {/* Contexto da época (único sítio visível no mobile) */}
                  <p className="px-4 pt-3 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/70 border-b border-outline-variant/20 truncate">
                    {seasonYear} · S{(calendarIndex ?? 0) + 1} · {me.roomName || me.roomCode}
                  </p>
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

                  {/* Mudar de Jogo — vai para a landing sem logout */}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      if (me?.roomCode) {
                        socket.emit("leaveRoom");
                        try {
                          const s = JSON.parse(
                            window.localStorage.getItem(
                              "cashballSession",
                            ) || "{}",
                          );
                          window.localStorage.setItem(
                            "cashballSession",
                            JSON.stringify({
                              name: s.name,
                              token: s.token,
                              roomCode: "",
                            }),
                          );
                        } catch {
                          /* ignorar */
                        }
                      }
                      resetGameState();
                      setMe(null);
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
                        setAdminPanelOpen(true);
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
        </div>
      </div>
    </header>
  );
}
