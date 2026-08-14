/* ── Button — action button primitives (unificados com shared/Button) ────
 *
 * Re-exporta o botão partilhado da app com a API do módulo de match:
 *   - PrimaryButton: CTA principal (tone "emerald" → success, "indigo" → primary)
 *   - GhostButton: acção secundária text-only
 */

import { Button } from "../../shared/Button.jsx";

/**
 * Primary call-to-action button.
 *
 * @param {Object} props
 * @param {import("react").ReactNode} [props.children] - Button label.
 * @param {import("react").ReactNode} [props.icon] - Optional leading icon.
 * @param {boolean} [props.disabled]
 * @param {"emerald"|"indigo"} [props.tone="emerald"] - Visual tone.
 * @param {string} [props.className] - Extra classes appended last.
 * @param {Function} [props.onClick]
 * @param {string} [props.type]
 */
export function PrimaryButton({
  children,
  icon,
  disabled = false,
  tone = "emerald",
  className = "",
  onClick,
  type = "button",
  ...rest
}) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      variant={tone === "indigo" ? "primary" : "success"}
      size="lg"
      uppercase={false}
      className={className}
      {...rest}
    >
      {icon}
      {children}
    </Button>
  );
}

/**
 * Ghost / secondary text button.
 *
 * @param {Object} props
 * @param {import("react").ReactNode} [props.children]
 * @param {import("react").ReactNode} [props.icon]
 * @param {string} [props.className]
 * @param {Function} [props.onClick]
 * @param {string} [props.type]
 */
export function GhostButton({
  children,
  icon,
  className = "",
  onClick,
  type = "button",
  ...rest
}) {
  return (
    <Button
      type={type}
      onClick={onClick}
      variant="ghost"
      size="md"
      uppercase={false}
      className={className}
      {...rest}
    >
      {icon}
      {children}
    </Button>
  );
}
