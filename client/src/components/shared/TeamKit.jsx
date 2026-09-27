import { useState } from "react";

/** Parte o nome em 2 linhas equilibradas (o patch não cabe em mais). */
function wrap2(name) {
  const words = String(name).split(" ");
  if (words.length < 2) return [name];
  let cut = 1;
  let best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < best) {
      best = d;
      cut = i;
    }
  }
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

/**
 * TeamKit — camisola principal do clube (SVG paramétrico de `public/kits/`)
 * com o patch do patrocinador cosido no peito (`team.sponsorBrand`).
 *
 * O slug deriva do brasão (`/logos/<slug>.ext` → `/kits/<slug>.svg`), por isso
 * não precisa de mapa novo. Sem `crest` válido ou com erro de carga, não
 * renderiza nada (todos os 60 clubes têm brasão e camisola). Sem marca,
 * a camisola aparece limpa.
 *
 * O patch é um SVG sobreposto no mesmo `viewBox` da camisola (100x100), por
 * isso escala com ela em qualquer sítio — em percentagens o tamanho do texto
 * não acompanhava o tamanho da camisola.
 *
 * @param {{
 *   team?: { crest?: string|null, name?: string, sponsorBrand?: object|null }|null,
 *   className?: string,
 * }} props
 * @returns {JSX.Element|null}
 */
export function TeamKit({ team, className = "h-28 object-contain" }) {
  // Guarda o URL que falhou (não um booleano) para fazer reset sozinho
  // quando a equipa mudar — mesmo padrão do `TeamCrest`.
  const [failedKit, setFailedKit] = useState(null);
  const kit =
    team?.crest?.includes("/logos/")
      ? team.crest.replace("/logos/", "/kits/").replace(/\.\w+(\?.*)?$/, ".svg")
      : null;
  if (!kit || failedKit === kit) return null;
  const brand = team?.sponsorBrand;
  const lines = brand ? wrap2(brand.short || brand.name).map((l) => l.toUpperCase()) : [];
  // O texto encolhe para caber na largura do patch (~0,74 unidades por
  // carácter em 900); abaixo do mínimo, `textLength` aperta o que sobra.
  const inner = 19.2;
  const width = 0.74 * Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(4.4, Math.max(3.2, inner / width));
  return (
    <span className="relative inline-block">
      <img
        src={kit}
        alt={`Camisola do ${team?.name || "clube"}`}
        onError={() => setFailedKit(kit)}
        className={`aspect-square w-auto max-w-none ${className}`}
        loading="lazy"
      />
      {brand && (
        <svg viewBox="0 0 100 100" role="img" aria-label={brand.name} className="absolute inset-0 h-full w-full">
          <rect x="31" y="30" width="22" height="23" rx="2" fill="#fff" fillOpacity="0.94" stroke="#000" strokeOpacity="0.25" strokeWidth="0.6" />
          <image href={`/sponsors/${brand.sponsorId}.svg`} x="36.5" y="32" width="11" height="11" />
          {lines.map((line, i) => {
            const over = 0.74 * line.length * size > inner;
            return (
              <text
                key={i}
                x="42"
                y={lines.length === 1 ? 48.6 : 46.8 + i * 5}
                textAnchor="middle"
                fontSize={size}
                fontWeight="900"
                fill="#1c1917"
                fontFamily="system-ui,sans-serif"
                textLength={over ? inner : undefined}
                lengthAdjust={over ? "spacingAndGlyphs" : undefined}
              >
                {line}
              </text>
            );
          })}
        </svg>
      )}
    </span>
  );
}
