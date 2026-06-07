/* ── Match module shared constants ─────────────────────────────────────── */

export const POS_ORDER = { GR: 0, DEF: 1, MED: 2, ATA: 3 };

export const POS_STYLES = {
  GR: { bar: "from-amber-300 via-amber-400 to-amber-600", glow: "hover:border-amber-400/70 hover:shadow-amber-400/30", bgGrad: "from-amber-500/8", badgeBg: "bg-amber-400/20", badgeText: "text-amber-400", badgeBorder: "border-amber-400/30", accent: "#eab308" },
  DEF: { bar: "from-blue-300 via-blue-400 to-blue-600", glow: "hover:border-blue-400/70 hover:shadow-blue-400/30", bgGrad: "from-blue-500/8", badgeBg: "bg-blue-400/20", badgeText: "text-blue-400", badgeBorder: "border-blue-400/30", accent: "#3b82f6" },
  MED: { bar: "from-emerald-300 via-emerald-400 to-emerald-600", glow: "hover:border-emerald-400/70 hover:shadow-emerald-400/30", bgGrad: "from-emerald-500/8", badgeBg: "bg-emerald-400/20", badgeText: "text-emerald-400", badgeBorder: "border-emerald-400/30", accent: "#10b981" },
  ATA: { bar: "from-rose-300 via-rose-400 to-rose-600", glow: "hover:border-rose-400/70 hover:shadow-rose-400/30", bgGrad: "from-rose-500/8", badgeBg: "bg-rose-400/20", badgeText: "text-rose-400", badgeBorder: "border-rose-400/30", accent: "#f43f5e" },
};

export function getPosStyle(pos) {
  return POS_STYLES[pos] || POS_STYLES.MED;
}
