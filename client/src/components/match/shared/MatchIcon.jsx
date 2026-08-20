/* ── MatchIcon — Inline SVG icon set for the match module ───────────────
 *
 * Why: replaces functional emojis (⚽🔙, 🔄, 🤕, ↔, ↺, ✓, →) that render
 * differently per OS / don't scale cleanly. All icons inherit `currentColor`
 * so callers control the color via Tailwind text-* classes on the SVG.
 *
 * Usage:
 *   <MatchIcon name="goal" className="h-4 w-4 text-on-surface" />
 *   <MatchIcon name="yellow-card" className="h-3.5 w-3.5 text-yellow-400" />
 *
 * Sizes default to 1em (scales with parent text size).
 */

/**
 * @typedef {"goal"|"own-goal"|"penalty-goal"|"penalty-miss"|"yellow-card"|"red-card"|"injury"|"swap"|"phase-start"|"confirm"|"reset"|"chevron-right"|"close"|"form-up"|"form-down"|"form-flat"} MatchIconName
 */

const ICON_PATHS = {
  /* Football — a goal (or penalty goal with dot for the latter). */
  goal: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L17 7 L15 13 L9 13 L7 7 Z" />
      <path d="M12 21 L9 13 M12 21 L15 13 M3 12 L7 7 M21 12 L17 7" />
    </>
  ),
  "own-goal": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L17 7 L15 13 L9 13 L7 7 Z" />
      <path d="M4 4 L20 20" />
    </>
  ),
  "penalty-goal": (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 3 L17 7 L15 13 L9 13 L7 7 Z" />
      <path d="M3 12 L7 7 M21 12 L17 7 M12 21 L9 13 M12 21 L15 13" />
    </>
  ),
  "penalty-miss": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L17 7 L15 13 L9 13 L7 7 Z" />
      <path d="M9 9 L15 15 M15 9 L9 15" />
    </>
  ),
  "yellow-card": (
    <rect x="6" y="4" width="9" height="14" rx="1.5" fill="currentColor" stroke="none" />
  ),
  "red-card": (
    <rect x="6" y="4" width="9" height="14" rx="1.5" fill="currentColor" stroke="none" />
  ),
  injury: (
    <>
      <path d="M9 3 V8 M9 8 H4 M9 8 H14 M9 8 V21 M4 8 H14" />
      <path d="M14 5 H19 V21" />
    </>
  ),
  /* Two opposing arrows — used for substitution events AND swap affordance. */
  swap: (
    <>
      <path d="M7 4 L3 8 L7 12" />
      <path d="M3 8 H17" />
      <path d="M17 12 L21 16 L17 20" />
      <path d="M21 16 H7" />
    </>
  ),
  "phase-start": (
    <>
      <path d="M5 21 V4" />
      <path d="M5 4 L18 7 L5 10 Z" fill="currentColor" stroke="none" />
    </>
  ),
  confirm: <path d="M5 12 L10 17 L19 7" />,
  reset: (
    <>
      <path d="M3 12 A9 9 0 1 1 6 18.7" />
      <path d="M3 18 V12 H9" />
    </>
  ),
  "chevron-right": <path d="M9 5 L16 12 L9 19" />,
  close: (
    <>
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </>
  ),
  "form-up": (
    <>
      <path d="M3 17 L9 11 L13 15 L21 7" />
      <path d="M14 7 H21 V14" />
    </>
  ),
  "form-down": (
    <>
      <path d="M3 7 L9 13 L13 9 L21 17" />
      <path d="M14 17 H21 V10" />
    </>
  ),
  "form-flat": (
    <>
      <path d="M3 12 H21" />
    </>
  ),
};

/**
 * Render a match-related icon as inline SVG. The SVG inherits text color via
 * `currentColor`; pass a Tailwind `text-*` class to control color.
 *
 * @param {Object} props
 * @param {MatchIconName} props.name - Icon identifier.
 * @param {string} [props.className] - Tailwind classes applied to the SVG
 *   (e.g. "h-4 w-4 text-yellow-400"). Defaults to "h-4 w-4".
 * @param {string} [props.title] - Accessible label for screen readers.
 */
export function MatchIcon({ name, className = "h-4 w-4", title }) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      {...(title ? { "aria-label": title } : {})}
    >
      {paths}
    </svg>
  );
}
