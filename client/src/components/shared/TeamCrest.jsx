import { useState } from "react";

/**
 * TeamCrest — brasão da equipa com fallback para a inicial.
 *
 * Fonte única do padrão antes duplicado em `CupTab` e `CupDrawPopup`:
 * o fallback usa estado React em vez do `onError` imperativo que
 * manipulava `style.display` no DOM.
 *
 * @param {{
 *   team?: { crest?: string|null, name?: string, color_primary?: string, color_secondary?: string }|null,
 *   size?: string,
 *   revealed?: boolean,
 *   className?: string,
 * }} props
 */
export function TeamCrest({
  team,
  size = "w-9 h-9 text-sm",
  revealed = true,
  className = "",
}) {
  // Brasão que falhou a carregar: ao mudar de equipa/brasão, a comparação
  // deixa de bater e a imagem tem nova oportunidade — sem useEffect.
  const [failedCrest, setFailedCrest] = useState(null);
  const failed = failedCrest === team?.crest;

  const circle = `${size} rounded-full shrink-0 border border-outline-variant/25 ${className}`;

  if (!revealed) {
    return <div aria-hidden className={`${circle} bg-surface-bright`} />;
  }

  if (team?.crest && !failed) {
    return (
      <img
        src={team.crest}
        alt={team?.name || "brasão"}
        onError={() => setFailedCrest(team.crest)}
        className={`${circle} object-contain bg-white p-1`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${circle} flex items-center justify-center font-black`}
      style={{
        background: team?.color_primary || "#333",
        color: team?.color_secondary || "#fff",
      }}
    >
      {team?.name?.[0] ?? "?"}
    </div>
  );
}
