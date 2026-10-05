import { AnimatePresence, motion } from "framer-motion";

/* ── Pre-match intro: análise pré-jogo durante a pausa do 0' ── */

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

export function PreMatchIntro({
  matchEvents,
  liveMinute,
  isPlayingMatch,
}) {

  const introEvts = (matchEvents || [])
    .filter((e) => e.minute <= 1 && INTRO_TYPES.includes(e.type) && e.text)
    .sort(
      (a, b) => INTRO_TYPES.indexOf(a.type) - INTRO_TYPES.indexOf(b.type),
    );

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

    </>
  );
}

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
