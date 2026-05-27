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

export function hexToRgba(hex, alpha) {
  const n = normalizeHex(hex);
  if (!n) return `rgba(149,212,179,${alpha})`;
  const r = Number.parseInt(n.slice(1, 3), 16);
  const g = Number.parseInt(n.slice(3, 5), 16);
  const b = Number.parseInt(n.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function posRingClass(pos) {
  return (
    {
      GR: "ring-yellow-400/60 border-yellow-400/35",
      DEF: "ring-blue-400/60 border-blue-400/35",
      MED: "ring-emerald-400/60 border-emerald-400/35",
      ATA: "ring-rose-400/60 border-rose-400/35",
    }[pos] || "ring-zinc-400/50 border-zinc-500/35"
  );
}
