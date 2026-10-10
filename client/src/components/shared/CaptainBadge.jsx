/**
 * Braçadeira de capitão ("C" dourado).
 * @param {Object} props
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function CaptainBadge({ className = "" }) {
  return (
    <span
      title="Capitão"
      aria-label="Capitão"
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] bg-amber-400 text-[9px] font-black leading-none text-black ${className}`}
    >
      C
    </span>
  );
}
