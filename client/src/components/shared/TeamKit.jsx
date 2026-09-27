import { useState } from "react";
import { SponsorLogo } from "./SponsorLogo.jsx";

/**
 * TeamKit — camisola principal do clube (SVG paramétrico de `public/kits/`)
 * com o patch do patrocinador cosido no peito (`team.sponsorBrand`).
 *
 * O slug deriva do brasão (`/logos/<slug>.ext` → `/kits/<slug>.svg`), por isso
 * não precisa de mapa novo. Sem `crest` válido ou com erro de carga, não
 * renderiza nada (todos os 60 clubes têm brasão e camisola). Sem marca,
 * a camisola aparece limpa.
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
  return (
    <span className="relative inline-block">
      <img
        src={kit}
        alt={`Camisola do ${team?.name || "clube"}`}
        onError={() => setFailedKit(kit)}
        className={className}
        loading="lazy"
      />
      {team?.sponsorBrand && (
        <SponsorLogo
          brand={team.sponsorBrand}
          className="absolute left-1/2 top-[52%] w-1/4 -translate-x-1/2 -translate-y-1/2 rounded-[2px] shadow-md"
        />
      )}
    </span>
  );
}
