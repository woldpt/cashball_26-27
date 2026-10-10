import { buildShotStats } from "../matchConstants.js";

const fmtXg = (n) => n.toFixed(1).replace(".", ",");

/**
 * Remates e golos esperados das duas equipas numa linha (casa–fora), até ao minuto.
 * @param {Object} props
 * @param {Array<Object>} [props.events] - fixture.events (lances com `xg`).
 * @param {number} [props.liveMinute]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function ShotLine({ events, liveMinute, className = "" }) {
  const s = buildShotStats(events, liveMinute);
  return (
    <p className={`text-center text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant tabular-nums ${className}`}>
      Remates {s.home.shots}–{s.away.shots} · Golos esp. {fmtXg(s.home.xg)}–{fmtXg(s.away.xg)}
    </p>
  );
}
