import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";
import { CelebrationBurst } from "../shared/CelebrationBurst.jsx";
import { MODAL_Z } from "../../constants/index.js";

const DIVISION_NAMES = {
  1: "Primeira Liga",
  2: "Segunda Liga",
  3: "Liga 3",
  4: "Campeonato de Portugal",
  5: "Distritais",
};

function fmt(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * @param {{teamId: number|string, teamName?: string, teams: array, size?: "lg"|"sm"}} props
 */
function TeamBadge({ teamId, teamName, teams, size = "lg" }) {
  const team = teams?.find((t) => t.id === teamId || t.id === Number(teamId));
  const [crestFailed, setCrestFailed] = useState(false);
  const sz = size === "sm" ? "w-5 h-5 text-[9px]" : "w-8 h-8 text-xs";
  if (team?.crest && !crestFailed) {
    return (
      <img
        src={team.crest}
        alt={teamName || "crest"}
        onError={() => setCrestFailed(true)}
        className={`${sz} rounded-full object-contain bg-white p-0.5 border border-white/10 shrink-0`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-black shrink-0 border border-white/10`}
      style={{
        background: team?.color_primary || "#27272a",
        color: team?.color_secondary || "#fff",
      }}
    >
      {teamName?.[0] || "?"}
    </div>
  );
}

/**
 * @param {{ data: object|null, teams: array, me: object, onClose: function }} props
 */
export function SeasonEndModal({ data, teams, me, onClose }) {
  // Identidade do `data` para o qual o reveal já disparou — evita o reset
  // síncrono dentro do useEffect (cascading render). Quando `data` muda,
  // revealedFor ainda aponta para o valor anterior → revealed fica false.
  const [revealedFor, setRevealedFor] = useState(null);

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setRevealedFor(data), 250);
    return () => clearTimeout(t);
  }, [data]);

  const revealed = revealedFor === data;

  const myTeamId = me?.teamId;

  const isMyTeam = (teamId) =>
    teamId === myTeamId ||
    teamId === Number(myTeamId) ||
    String(teamId) === String(myTeamId);

  const myPromotion = data?.promotions?.find((p) => isMyTeam(p.teamId));
  const isPromotion = myPromotion && myPromotion.toDiv < myPromotion.fromDiv;

  // ── Cena de troféu: quando a MINHA equipa vence o campeonato da sua
  // divisão ou a Taça de Portugal ───────────────────────────────────────────
  const championDiv = (data?.divisionChampions || []).find((c) =>
    isMyTeam(c.teamId),
  );
  const wonCup = data?.cupWinner ? isMyTeam(data.cupWinner.teamId) : false;
  const showTitleLift = !!(championDiv || wonCup);
  const liftTitle = championDiv
    ? championDiv.divId === 1
      ? "CAMPEÕES DE PORTUGAL"
      : "CAMPEÕES"
    : "VENCEDORES DA TAÇA";
  const liftSub = championDiv ? championDiv.divName : "Taça de Portugal";

  // Ocultar apenas movimentos dentro da Div 5 (NPC internos);
  // mostrar descidas do Campeonato de Portugal (Div 4 → 5) e tudo o resto.
  const visiblePromotions = (data?.promotions || []).filter(
    (p) => p.toDiv !== 5 || p.fromDiv === 4,
  );

  const displayYear = data?.year ?? 0;
  const handleContinue = () => {
    onClose();
    window.location.reload();
  };

  return (
    <ModalShell
      visible={!!data}
      onClose={onClose}
      z={MODAL_Z.default}
      variant="fullscreen"
    >
      {data && (
      <div className="w-full max-w-lg sm:max-w-xl my-auto">
        {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="text-center mb-6">
              <motion.span
                className="material-symbols-outlined text-amber-400 block mb-3"
                style={{
                  fontSize: 56,
                  filter: "drop-shadow(0 0 18px rgba(245,158,11,0.65))",
                }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 280 }}
              >
                emoji_events
              </motion.span>
              <motion.p
                className="text-amber-400/70 text-[10px] font-black uppercase tracking-[0.3em] mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                Temporada {displayYear}
              </motion.p>
              <motion.h1
                className="text-3xl font-headline font-black text-on-surface"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Fim de Época
              </motion.h1>
              <motion.p
                className="text-on-surface-variant/45 text-sm mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                Prémios e galardões entregues
              </motion.p>
            </div>

            {/* ── Cena de troféu (quando vences o campeonato/taça) ── */}
            {showTitleLift && (
              <motion.div
                className="relative mb-6 rounded-2xl overflow-hidden border border-amber-500/30 text-center px-4 pt-8 pb-6"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(245,158,11,0.12) 0%, rgba(32,31,31,0.4) 70%)",
                }}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{
                  opacity: revealed ? 1 : 0,
                  y: revealed ? 0 : 14,
                  scale: revealed ? 1 : 0.98,
                }}
                transition={{ delay: 0.1 }}
              >
                {revealed && (
                  <CelebrationBurst
                    seed={`season-${displayYear}`}
                    showChampagne={false}
                  />
                )}
                <motion.span
                  className="block text-[64px] leading-none mb-2"
                  style={{
                    filter:
                      "drop-shadow(0 0 26px rgba(245,158,11,0.6)) drop-shadow(0 8px 14px rgba(0,0,0,0.4))",
                  }}
                  initial={{ scale: 0.3, rotate: -18, y: 10 }}
                  animate={{ scale: 1, rotate: 0, y: 0 }}
                  transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 220,
                    damping: 14,
                  }}
                >
                  🏆
                </motion.span>
                <motion.p
                  className="text-2xl sm:text-3xl font-headline font-black text-amber-400 uppercase tracking-[0.25em]"
                  style={{ textShadow: "0 0 22px rgba(245,158,11,0.55)" }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32 }}
                >
                  {liftTitle}
                </motion.p>
                <motion.p
                  className="text-[10px] font-black uppercase tracking-widest text-on-surface/70 mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.42 }}
                >
                  {liftSub}
                </motion.p>
                {championDiv && (
                  <motion.p
                    className="text-sm font-black text-amber-300 tabular-nums mt-2"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    +{fmt(championDiv.prize)} de prémio
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* ── Awards card ─────────────────────────────────────────────── */}
            <div className="bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden divide-y divide-outline-variant/15">
              {/* Division Champions */}
              {data.divisionChampions?.length > 0 && (
                <div className="p-4 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">
                    Campeões das Divisões
                  </p>
                  {data.divisionChampions.map((champ, i) => (
                    <motion.div
                      key={champ.divId}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                        isMyTeam(champ.teamId)
                          ? "bg-amber-500/10 border border-amber-500/30"
                          : "bg-surface-container-high"
                      }`}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{
                        opacity: revealed ? 1 : 0,
                        x: revealed ? 0 : -16,
                      }}
                      transition={{ delay: 0.1 + i * 0.07 }}
                    >
                      <span
                        className="material-symbols-outlined text-amber-400 shrink-0"
                        style={{ fontSize: 20 }}
                      >
                        {champ.divId === 1
                          ? "workspace_premium"
                          : "military_tech"}
                      </span>
                      <TeamBadge
                        teamId={champ.teamId}
                        teamName={champ.teamName}
                        teams={teams}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-on-surface truncate">
                          {champ.teamName}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/50 font-bold">
                          {champ.divName}
                        </p>
                      </div>
                      <span className="text-[11px] font-black text-amber-400 shrink-0">
                        +{fmt(champ.prize)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Cup Winner */}
              {data.cupWinner && (
                <div className="p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">
                    Taça de Portugal
                  </p>
                  <motion.div
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                      isMyTeam(data.cupWinner.teamId)
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "bg-surface-container-high"
                    }`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{
                      opacity: revealed ? 1 : 0,
                      x: revealed ? 0 : -16,
                    }}
                    transition={{ delay: 0.42 }}
                  >
                    <span
                      className="material-symbols-outlined text-amber-400 shrink-0"
                      style={{ fontSize: 20 }}
                    >
                      emoji_events
                    </span>
                    <TeamBadge
                      teamId={data.cupWinner.teamId}
                      teamName={data.cupWinner.teamName}
                      teams={teams}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-on-surface truncate">
                        {data.cupWinner.teamName}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/50 font-bold">
                        Vencedor da Taça
                      </p>
                    </div>
                    <span className="text-[11px] font-black text-amber-400 shrink-0">
                      +{fmt(data.cupWinner.prize)}
                    </span>
                  </motion.div>
                </div>
              )}

              {/* Top Scorer */}
              {data.topScorer && (
                <div className="p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">
                    Melhor Marcador
                  </p>
                  <motion.div
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                      isMyTeam(data.topScorer.teamId)
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-surface-container-high"
                    }`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{
                      opacity: revealed ? 1 : 0,
                      x: revealed ? 0 : -16,
                    }}
                    transition={{ delay: 0.52 }}
                  >
                    <span
                      className="material-symbols-outlined text-emerald-400 shrink-0"
                      style={{ fontSize: 20 }}
                    >
                      sports_soccer
                    </span>
                    <TeamBadge
                      teamId={data.topScorer.teamId}
                      teamName={data.topScorer.teamName}
                      teams={teams}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-on-surface truncate">
                        {data.topScorer.name}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/50 font-bold">
                        {data.topScorer.teamName} · {data.topScorer.goals} golos
                      </p>
                    </div>
                    <span className="text-[11px] font-black text-emerald-400 shrink-0">
                      +{fmt(data.topScorer.prize)}
                    </span>
                  </motion.div>
                </div>
              )}

              {/* Promotions / Relegations */}
              {visiblePromotions.length > 0 && (
                <div className="p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3">
                    Subidas e Descidas
                  </p>
                  <div className="space-y-1.5">
                    {visiblePromotions.map((p, i) => {
                      const goingUp = p.toDiv < p.fromDiv;
                      const isMe = isMyTeam(p.teamId);
                      return (
                        <motion.div
                          key={i}
                          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                            isMe
                              ? goingUp
                                ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                                : "bg-rose-500/10 border border-rose-500/25 text-rose-400"
                              : goingUp
                                ? "bg-surface-container-high text-emerald-400/70"
                                : "bg-surface-container-high text-rose-400/60"
                          }`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: revealed ? 1 : 0 }}
                          transition={{ delay: 0.6 + i * 0.04 }}
                        >
                          <span
                            className="material-symbols-outlined shrink-0"
                            style={{ fontSize: 14 }}
                          >
                            {goingUp ? "arrow_upward" : "arrow_downward"}
                          </span>
                          <TeamBadge
                            teamId={p.teamId}
                            teamName={p.teamName}
                            teams={teams}
                            size="sm"
                          />
                          <span className="font-bold flex-1 truncate">
                            {p.teamName}
                          </span>
                          <span className="text-[9px] shrink-0 opacity-60">
                            {DIVISION_NAMES[p.fromDiv] || `Div. ${p.fromDiv}`}
                            {" → "}
                            {DIVISION_NAMES[p.toDiv] || `Div. ${p.toDiv}`}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── My team movement highlight ──────────────────────────────── */}
            {myPromotion && (
              <motion.div
                className={`mt-3 rounded-xl px-4 py-3 text-center border ${
                  isPromotion
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/40 text-rose-300"
                }`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: revealed ? 1 : 0,
                  scale: revealed ? 1 : 0.95,
                }}
                transition={{ delay: 0.75 }}
              >
                <p className="font-black text-sm">
                  {isPromotion
                    ? "🎉 O teu clube sobe de divisão!"
                    : "😔 O teu clube desce de divisão."}
                </p>
                <p className="text-[10px] opacity-60 mt-0.5">
                  {DIVISION_NAMES[myPromotion.toDiv] ||
                    `Divisão ${myPromotion.toDiv}`}{" "}
                  na próxima época
                </p>
              </motion.div>
            )}

            {/* ── Continue button ─────────────────────────────────────────── */}
            <motion.button
              onClick={handleContinue}
              className="mt-4 w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-sm py-4 rounded-md transition-colors shadow-lg shadow-amber-500/25 uppercase tracking-widest"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 16 }}
              transition={{ delay: 0.85 }}
            >
              Continuar para a Época {(data?.year ?? 0) + 1}
            </motion.button>
      </div>
      )}
    </ModalShell>
  );
}
