import { useState } from "react";
import { TeamCrest } from "./TeamCrest";

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
 * com a marca do patrocinador impressa no peito (`team.sponsorBrand`):
 * emblema + nome direto no tecido, sem fundo.
 *
 * O slug deriva do brasão (`/logos/<slug>.ext` → `/kits/<slug>.svg`), por isso
 * não precisa de mapa novo. Sem `crest` válido não renderiza nada; com erro
 * de carga da camisola cai para o `TeamCrest` (não deixa vazio). Sem marca,
 * a camisola aparece limpa.
 *
 * A marca é um SVG sobreposto no mesmo `viewBox` da camisola (100x100), por
 * isso escala com ela em qualquer sítio — em percentagens o tamanho do texto
 * não acompanhava o tamanho da camisola. O nome leva halo claro para se ler
 * em camisolas claras e escuras.
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
  if (!kit) return null;
  if (failedKit === kit)
    return <TeamCrest team={team} size="h-full w-full text-lg" className={className} />;
  const brand = team?.sponsorBrand;
  const lines = brand ? wrap2(brand.name || brand.short).map((l) => l.toUpperCase()) : [];
  // O texto encolhe para caber na largura do peito (~0,74 unidades por
  // carácter em 900); abaixo do mínimo, `textLength` aperta o que sobra.
  const inner = 38;
  const width = 0.74 * Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(6, Math.max(5, inner / width));
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
          <image href={`/sponsors/${brand.sponsorId}.svg`} x="38" y="26" width="24" height="24" />
          {lines.map((line, i) => {
            const over = 0.74 * line.length * size > inner;
            return (
              <text
                key={i}
                x="50"
                y={lines.length === 1 ? 57 : 54.5 + i * 5.5}
                textAnchor="middle"
                fontSize={size}
                fontWeight="900"
                fill="#1c1917"
                stroke="#ffffff"
                strokeOpacity="0.85"
                strokeWidth={size * 0.18}
                paintOrder="stroke"
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
