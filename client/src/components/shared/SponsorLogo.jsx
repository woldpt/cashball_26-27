/**
 * SponsorLogo — monograma geométrico do patrocinador (mesma receita do
 * `sponsorLogo()` do servidor, sem `clipPath`).
 *
 * @param {{ brand: object|null, className?: string, title?: string }} props
 */
export function SponsorLogo({ brand, className = "h-12 w-12", title }) {
  if (!brand) return null;
  const bg = brand.bg || "#333";
  const fg = brand.fg || "#fff";
  const glyph = brand.glyph || "?";
  const shape = brand.shape || 0;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={title || brand.name || "Patrocinador"}
      aria-hidden={title === undefined && !brand.name ? "true" : undefined}
    >
      <rect width="100" height="100" fill={bg} />
      {shape === 0 && (
        <circle cx="50" cy="50" r="30" fill="none" stroke={fg} strokeWidth="6" />
      )}
      {shape === 1 && (
        <rect x="14" y="14" width="72" height="72" fill="none" stroke={fg} strokeWidth="6" />
      )}
      {shape === 2 && <rect y="38" width="100" height="24" fill={fg} opacity="0.85" />}
      {shape === 3 && (
        <rect
          x="22"
          y="22"
          width="56"
          height="56"
          fill="none"
          stroke={fg}
          strokeWidth="6"
          transform="rotate(45 50 50)"
        />
      )}
      <text
        x="50"
        y="62"
        fontSize="38"
        fontWeight="900"
        textAnchor="middle"
        fill={fg}
        fontFamily="system-ui,sans-serif"
      >
        {glyph}
      </text>
    </svg>
  );
}
