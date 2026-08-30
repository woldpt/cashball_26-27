import { POSITION_RING_CLASS } from "../constants/index.js";

export function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  const clean = hex.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean}`;
  return null;
}

/**
 * Returns a version of `hex` that is readable as TEXT on the app's dark
 * surfaces. Team primary colors can be near-black (e.g. Académica), which is
 * invisible on the dark theme, so low-luma colors are brightened toward white
 * instead of being used as-is. Non-hex/invalid values pass through untouched.
 *
 * @param {string|null|undefined} hex
 * @returns {string}
 */
export function readableColor(hex) {
  const n = normalizeHex(hex);
  if (!n) return hex || "#94a3b8";
  const r = Number.parseInt(n.slice(1, 3), 16);
  const g = Number.parseInt(n.slice(3, 5), 16);
  const b = Number.parseInt(n.slice(5, 7), 16);
  // Perceived luma (ITU-R BT.709).
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luma >= 0.28) return n;
  // Brighten toward white until luma clears the threshold.
  const target = 0.45;
  const t = Math.min(1, (target - luma) / (1 - luma));
  const mix = (c) => Math.round(c + (255 - c) * t);
  return `#${[r, g, b].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgba(hex, alpha) {
  const n = normalizeHex(hex);
  if (!n) return `rgba(149,212,179,${alpha})`;
  const r = Number.parseInt(n.slice(1, 3), 16);
  const g = Number.parseInt(n.slice(3, 5), 16);
  const b = Number.parseInt(n.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function posRingClass(pos) {
  return POSITION_RING_CLASS[pos] || "ring-zinc-400/50 border-zinc-500/35";
}
