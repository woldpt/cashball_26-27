import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/* ── Pre-match intro (5s pause) + kickoff moments ────────────────────────
 *
 * Durante a pausa de 5s antes do pontapé de saída (liveMinute === 0) o hero
 * mostra as características pre-match — clima, tácticas — como chips
 * escaneáveis + uma linha narrativa (a frase táctica, que é a mesma que
 * passa a ser o comentário ao vivo no minuto 1). As odds ficam apenas no
 * badge por cima do scoreboard (LiveMatchHero).
 *
 * Ao kickoff os cards saem com animação em cascade (colapso de altura, sem
 * salto de layout) e um badge "⚽ 1ª PARTE" pulsa no mesmo slot antes da
 * cronologia assumir. KickoffBadge anuncia igualmente o início da 2ª parte
 * (45') e do prolongamento (90').
 */

const INTRO_TYPES = ["weather", "phase_start"];

const WEATHER_LABELS = {
  "☀️": "Sol",
  "🌧️": "Chuva",
  "⛈️": "Chuva forte",
  "💨": "Vento",
  "🥶": "Frio",
  "🌫️": "Nevoeiro",
  "❄️": "Neve",
};

/* Strip "[NN']"/"[HT]" prefix plus the leading emoji token. */
const stripPrefix = (text) =>
  text.replace(/^\[(?:\d+'|HT)\]\s*\S*\s*/, "").trim();

const BADGE_HOLD_MS = 1500;

export function PreMatchIntro({
  matchEvents,
  liveMinute,
  isPlayingMatch,
  hInfo,
  aInfo,
}) {
  const [kickoff, setKickoff] = useState(false);
  const sawZeroRef = useRef(false);
  const kickoffAnnouncedRef = useRef(false);

  const introEvts = (matchEvents || [])
    .filter((e) => e.minute <= 1 && INTRO_TYPES.includes(e.type) && e.text)
    .sort(
      (a, b) => INTRO_TYPES.indexOf(a.type) - INTRO_TYPES.indexOf(b.type),
    );

  useEffect(() => {
    if (!isPlayingMatch) return;
    if (liveMinute === 0) {
      sawZeroRef.current = true;
      kickoffAnnouncedRef.current = false;
    }
    if (sawZeroRef.current && liveMinute > 0 && !kickoffAnnouncedRef.current) {
      kickoffAnnouncedRef.current = true;
      setKickoff(true);
      setTimeout(() => setKickoff(false), BADGE_HOLD_MS);
    }
  }, [liveMinute, isPlayingMatch]);

  if (introEvts.length === 0) return null;

  const weatherEvt = introEvts.find((e) => e.type === "weather");
  const phaseEvt = introEvts.find((e) => e.type === "phase_start");

  const weatherLabel = weatherEvt
    ? WEATHER_LABELS[weatherEvt.emoji] || stripPrefix(weatherEvt.text).slice(0, 24)
    : null;
  const narrative = phaseEvt?.text || null;

  return (
    <>
      <AnimatePresence>
        {liveMinute === 0 && isPlayingMatch && (
          <motion.div
            key="prematch-cards"
            className="w-full max-w-md mt-4 space-y-2 overflow-hidden"
            exit={{ opacity: 0, y: -8, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut", delay: 0.3 }}
          >
            {narrative && (
              <motion.p
                key={`narrative-${narrative.slice(0, 24)}`}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeIn" }}
                className="text-[11px] sm:text-[13px] leading-snug italic font-medium tracking-wide text-on-surface/85 text-center"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {stripPrefix(narrative)}
              </motion.p>
            )}

            {weatherLabel && (
              <motion.div
                key="prematch-chips"
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeIn", delay: 0.12 }}
                className="flex flex-wrap justify-center gap-2"
              >
                <IntroChip
                  emoji={weatherEvt.emoji}
                  label={weatherLabel}
                  accent="text-sky-300/90 border-sky-400/25"
                />
              </motion.div>
            )}

            <motion.div
              key="prematch-label"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeIn", delay: 0.24 }}
              className="flex items-center justify-center gap-1.5"
            >
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-on-surface-variant/70">
                Análise pré-jogo
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {kickoff && (
          <div key="prematch-kickoff" className="flex justify-center mt-4">
            <KickoffPill
              label="1ª PARTE"
              hColor={hInfo?.color_primary || "#6366f1"}
              aColor={aInfo?.color_primary || "#f43f5e"}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function KickoffBadge({ active, label, hColor, aColor }) {
  const [shown, setShown] = useState(false);
  const announcedRef = useRef(null);

  useEffect(() => {
    if (!active || announcedRef.current === label) return;
    announcedRef.current = label;
    setShown(true);
    setTimeout(() => setShown(false), BADGE_HOLD_MS);
  }, [active, label]);

  return (
    <AnimatePresence>
      {shown && (
        <div key={`kickoff-${label}`} className="flex justify-center mt-4">
          <KickoffPill label={label} hColor={hColor} aColor={aColor} />
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function IntroChip({ emoji, label, accent }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-low/60 border text-[10px] font-black uppercase tracking-widest ${accent}`}
    >
      <span className="text-sm leading-none">{emoji}</span>
      {label}
    </span>
  );
}

function KickoffPill({ label, hColor, aColor }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="animate-heartbeat px-5 py-2 rounded-full border bg-surface-container-high/85 backdrop-blur-sm"
      style={{
        borderColor: `${hColor}55`,
        boxShadow: `0 0 26px ${hColor}30, 0 0 10px ${aColor}25`,
      }}
    >
      <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-on-surface">
        <span style={{ color: hColor }}>⚽</span>
        <span>{label}</span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: aColor, boxShadow: `0 0 8px ${aColor}80` }}
        />
      </span>
    </motion.div>
  );
}
