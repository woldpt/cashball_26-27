import { memo } from "react";

/* FormDots — 5 pontinhos de forma, o mais recente à direita.
 *
 * `form` é uma string tipo "VVEDE" (V=vitória, E=empate, resto=derrota;
 * omissões/truncamento = placeholder cinzento). Acessível: role="img" com
 * a forma descrita por extenso (os dots eram antes só cor).
 *
 * size: "md" (w-2, tabelas) | "sm" (w-1.5, LiveStandings).
 */

const DOT_COLOR = { V: "bg-emerald-500", E: "bg-amber-500" };

/**
 * @param {{
 *   form?: string,
 *   size?: "sm"|"md",
 *   className?: string,
 * }} props
 */
function FormDotsBase({ form = "", size = "md", className = "" }) {
  const chars = form.split("").slice(-5);
  while (chars.length < 5) chars.unshift(null);
  const label =
    chars
      .map((c) =>
        c === "V" ? "Vitória" : c === "E" ? "Empate" : c ? "Derrota" : null,
      )
      .filter(Boolean)
      .join(", ") || "sem resultados";
  return (
    <div
      className={`flex justify-end gap-0.75 ${className}`}
      role="img"
      aria-label={`Forma: ${label}`}
    >
      {chars.map((r, i) => (
        <span
          key={i}
          className={`${size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full ${
            DOT_COLOR[r] || (r ? "bg-red-500" : "bg-surface-container-high")
          }`}
        />
      ))}
    </div>
  );
}

export const FormDots = memo(FormDotsBase);
