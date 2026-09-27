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
  // Patch de 30x26 centrado no peito (cabe no corpo da camisola, x28-72).
  const inner = 26;
  const width = 0.74 * Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(5, Math.max(4.2, inner / width));
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
          {/* Patch cosido: branco opaco sem rebordo (o stroke escuro parecia sombra). */}
          <rect x="35" y="29" width="30" height="26" rx="2" fill="#fff" />
          <image href={`/sponsors/${brand.sponsorId}.svg`} x="44" y="31" width="12" height="12" />
          {lines.map((line, i) => {
            const over = 0.74 * line.length * size > inner;
            return (
              <text
                key={i}
                x="50"
                y={lines.length === 1 ? 51.5 : 48.5 + i * 5}
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
