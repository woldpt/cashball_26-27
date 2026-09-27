/**
 * SponsorLogo — emblema do patrocinador (ficheiro fixo de
 * `public/sponsors/<id>.svg`: ícone + nome). Com erro de carga, cai no
 * monograma geométrico dos parâmetros (mesma receita do servidor).
 *
 * @param {{ brand: object|null, className?: string }} props
 */
import { useState } from "react";

export function SponsorLogo({ brand, className = "h-12 w-12" }) {
  const [failed, setFailed] = useState(null);
  if (!brand) return null;
  const src = brand.sponsorId ? `/sponsors/${brand.sponsorId}.svg` : null;
  if (!src || failed === src) {
    const bg = brand.bg || "#333";
    const fg = brand.fg || "#fff";
    return (
      <svg viewBox="0 0 100 100" className={className} role="img" aria-label={brand.name || "Patrocinador"}>
        <rect width="100" height="100" fill={bg} />
        <text x="50" y="62" fontSize="38" fontWeight="900" textAnchor="middle" fill={fg} fontFamily="system-ui,sans-serif">
          {brand.glyph || "?"}
        </text>
      </svg>
    );
  }
  return (
    <img
      src={src}
      alt={brand.name || "Patrocinador"}
      className={`${className} object-contain`}
      loading="lazy"
      onError={() => setFailed(src)}
    />
  );
}
