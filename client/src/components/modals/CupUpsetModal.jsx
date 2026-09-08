import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";
import { CelebrationBurst } from "../shared/CelebrationBurst.jsx";
import { MODAL_Z, DIVISION_NAMES } from "../../constants/index.js";
import { playNotification } from "../../utils/audio.js";

/**
 * Brasão da equipa (crest) com fallback para círculo de iniciais —
 * mesmo footprint/padrão do TeamBadge em SeasonEndModal.
 *
 * @param {{ team: object|null, teams: array, size?: "md"|"lg" }} props
 */
function Crest({ team, teams, size = "md" }) {
  const sz = size === "lg" ? "w-10 h-10 text-[11px]" : "w-8 h-8 text-[10px]";
  const t =
    team ||
    (teams?.find((x) => Number(x.id) === Number(team?.id)) ?? null);
  const [failed, setFailed] = useState(false);
  if (t?.crest && !failed) {
    return (
      <img
        src={t.crest}
        alt={t.name || "crest"}
        onError={() => setFailed(true)}
        className={`${sz} rounded-full object-contain bg-white p-0.5 border border-white/10 shrink-0`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-black shrink-0 border border-white/10`}
      style={{
        background: t?.color_primary || "#27272a",
        color: t?.color_secondary || "#fff",
      }}
    >
      {t?.name?.[0] || "?"}
    </div>
  );
}

/**
 * Badge de escalão (DIVISION_NAMES) — formato dos badges inline (STYLE.md §5).
 *
 * @param {{ div: number, tone?: "hot"|"cold" }} props
 */
function DivBadge({ div, tone = "cold" }) {
  const toneCls =
    tone === "hot"
      ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
      : "bg-white/8 text-on-surface-variant border-outline-variant/30";
  return (
    <span
      className={`inline-block text-[9px] font-black uppercase tracking-widest px-1.5 py-px rounded border ${toneCls}`}
    >
      {DIVISION_NAMES[div] || `Div ${div}`}
    </span>
  );
}

/**
 * CupUpsetModal — celebração das "surpresas" da Taça (equipa de escalão
 * inferior elimina uma de escalão superior).
 *
 * Substitui o antigo toast `⚡ SURPRESA NA TAÇA! ...` (o servidor deixou de o
 * emitir; as surpresas agora viajam no payload `cupRoundResults.upsets`).
 *
 * Comportamento:
 *  - só aparece quando chega um payload novo (identidade época+ronda) com
 *    surpresas — nunca volta a mostrar para a mesma ronda;
 *  - aguarda o PostMatchMoodModal estar confirmado antes de revelar (evita
 *    modais sobrepostos); se não há mood modal aberto (jogo do utilizador
 *    não foi dessa ronda), revela diretamente;
 *  - fecho via botão "Continuar" (sem auto-fecho);
 *  - som de notificação + partículas de festejo (CelebrationBurst).
 *
 * @param {{
 *   cupRoundResults: object|null, // { round, roundName, results, season, isFinal, upsets }
 *   teams: array,
 *   postMatchMood: object|null, // mood modal aberto (PostMatchMoodModal)
 *   onDismiss?: function, // chamado ao fechar a celebração desta ronda
 * }} props
 */
export function CupUpsetModal({ cupRoundResults, teams, postMatchMood, onDismiss }) {
  const key = cupRoundResults
    ? `${cupRoundResults.season}:${cupRoundResults.round}`
    : null;
  // visibleKey — ronda atualmente em exibição; dismissedKey — última ronda que
  // o utilizador fechou (persiste após o fecho, impedindo re-exibição da mesma
  // ronda mesmo que postMatchMood volte a oscilar). O modal só mostra quando
  // chega um payload novo (visibleKey === key) e nunca repete a mesma ronda.
  const [visibleKey, setVisibleKey] = useState(null);
  const [dismissedKey, setDismissedKey] = useState(null);

  const upsets = cupRoundResults?.upsets || [];

  // Guard de identidade + gate do mood modal: dispara apenas quando chega
  // um payload novo (ronda ainda não consumida) com surpresas e o
  // PostMatchMoodModal já não está aberto (mesmo padrão do SeasonEndModal —
  // setState só em callback de timeout, nunca síncrono no corpo do effect).
  // O timer é rearmado quando o mood muda ou após fecho (dismissedKey).
  useEffect(() => {
    if (!key || !upsets.length || dismissedKey === key || postMatchMood) return;
    const t = setTimeout(() => {
      setVisibleKey(key);
      playNotification();
    }, 250);
    return () => clearTimeout(t);
  }, [key, postMatchMood, dismissedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!key || visibleKey !== key || !upsets.length) return null;

  const results = cupRoundResults.results || [];
  const rows = upsets.map((u) => {
    const fx =
      results.find(
        (r) =>
          (r.homeTeamId === u.winnerId && r.awayTeamId === u.loserId) ||
          (r.awayTeamId === u.winnerId && r.homeTeamId === u.loserId),
      ) || null;
    const winner =
      fx && fx.homeTeamId === u.winnerId
        ? fx.homeTeam
        : fx && fx.awayTeamId === u.winnerId
          ? fx.awayTeam
          : teams?.find((t) => Number(t.id) === Number(u.winnerId)) || null;
    const loser =
      fx && fx.homeTeamId === u.loserId
        ? fx.homeTeam
        : fx && fx.awayTeamId === u.loserId
          ? fx.awayTeam
          : teams?.find((t) => Number(t.id) === Number(u.loserId)) || null;
    const winnerGoals = fx
      ? fx.homeTeamId === u.winnerId
        ? fx.homeGoals
        : fx.awayGoals
      : null;
    const loserGoals = fx
      ? fx.homeTeamId === u.loserId
        ? fx.homeGoals
        : fx.awayGoals
      : null;
    return { ...u, winner, loser, winnerGoals, loserGoals };
  });

  const handleClose = () => {
    setDismissedKey(key);
    setVisibleKey(null);
    onDismiss?.(key);
  };

  return (
    <ModalShell
      visible
      onClose={handleClose}
      z={MODAL_Z.cupUpset}
      variant="card"
      cardClassName="!bg-surface"
    >
      <div
        className="relative px-5 py-7 sm:px-8 sm:py-8 text-center overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(251,191,36,0.18) 0%, rgba(15,19,32,0) 62%)",
        }}
      >
        {/* ── Pulso de brilho por trás de tudo ────────────────────────── */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(251,191,36,0.10) 0%, rgba(15,19,32,0) 55%)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* ── Partículas de festejo ──────────────────────────────────── */}
        <CelebrationBurst seed={key} />

        {/* ── Cabeçalho ─────────────────────────────────────────────── */}
        <motion.span
          className="inline-block text-5xl sm:text-6xl select-none"
          style={{ filter: "drop-shadow(0 0 18px rgba(251,191,36,0.55))" }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [1, 1.12, 1], opacity: 1 }}
          transition={{
            scale: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 0.4 },
          }}
        >
          ⚡
        </motion.span>

        <span className="mt-3 inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm bg-amber-400/15 text-amber-300 border border-amber-400/25">
          Taça de Portugal · {cupRoundResults.roundName || `Ronda ${cupRoundResults.round}`}
        </span>

        <h2 className="mt-2 text-2xl sm:text-3xl font-black font-headline tracking-tight text-on-surface">
          SURPRESA{upsets.length > 1 ? "S" : ""} NA TAÇA
        </h2>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
          {upsets.length > 1
            ? `${upsets.length} equipas de escalão inferior avanaram`
            : "Escalão inferior elimina o mais alto"}
        </p>

        {/* ── Surpresas (stagger) ───────────────────────────────────── */}
        <div className="mt-5 space-y-2.5">
          {rows.map((r, i) => (
            <motion.div
              key={`${r.winnerId}-${r.loserId}`}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.18, duration: 0.4, ease: "easeOut" }}
              className="flex items-center gap-2.5 rounded-lg border border-amber-400/15 bg-white/4 px-3 py-2.5"
            >
              <Crest team={r.winner} teams={teams} size="lg" />
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-sm font-black text-on-surface">
                  {r.winnerName}
                </p>
                <DivBadge div={r.winnerDiv} tone="hot" />
              </div>
              <div className="shrink-0 text-center px-1">
                <span className="block text-sm font-black tabular-nums text-amber-300">
                  {r.winnerGoals != null && r.loserGoals != null
                    ? `${r.winnerGoals}–${r.loserGoals}`
                    : "—"}
                </span>
                <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60">
                  eliminou
                </span>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="truncate text-sm font-black text-on-surface/75">
                  {r.loserName}
                </p>
                <DivBadge div={r.loserDiv} tone="cold" />
              </div>
              <Crest team={r.loser} teams={teams} />
            </motion.div>
          ))}
        </div>

        {/* ── Fechar ───────────────────────────────────────────────── */}
        <div className="mt-6">
          <Button variant="accent" size="md" onClick={handleClose}>
            Continuar
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
