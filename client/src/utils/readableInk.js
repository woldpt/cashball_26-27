const lum = (hex) => {
  const m = /^#?([\da-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Cor de texto legível sobre `bg`: usa `preferred` se o contraste ≥ 4.5, senão branco/preto.
 * @param {string} bg Cor de fundo (#rrggbb).
 * @param {string} [preferred] Cor desejada (#rrggbb), ex.: secundária do clube.
 * @returns {string}
 */
export function readableInk(bg, preferred) {
  const lb = lum(bg);
  if (lb == null) return preferred || "#fff";
  const lp = lum(preferred);
  if (lp != null && ratio(lb, lp) >= 4.5) return preferred;
  return ratio(lb, 1) >= ratio(lb, 0) ? "#fff" : "#000";
}
