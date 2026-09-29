import { useEffect, useState } from "react";

/** URL da camisola a partir do brasão (`/logos/<slug>.ext` → `/kits/<slug>.svg`). */
export function kitUrl(crest) {
  return crest?.includes("/logos/")
    ? crest.replace("/logos/", "/kits/").replace(/\.\w+(\?.*)?$/, ".svg")
    : null;
}

/**
 * useKitClash — desempate de camisolas idênticas em casa.
 *
 * Compara os dois SVGs de casa com o `aria-label` removido (a única
 * diferença por clube); se são a mesma camisola, devolve `true` — a equipa
 * **fora** passa a vestir a sua de fora (`_away.svg`, cores trocadas).
 * Os ficheiros ficam em cache no browser: um fetch por par de equipas.
 *
 * @param {string|null} homeCrest
 * @param {string|null} awayCrest
 * @returns {boolean}
 */
export function useKitClash(homeCrest, awayCrest) {
  const a = kitUrl(homeCrest);
  const b = kitUrl(awayCrest);
  const [clash, setClash] = useState(false);
  useEffect(() => {
    if (!a || !b) return;
    let on = true;
    const norm = (t) => t.replace(/aria-label="[^"]*"/g, "");
    Promise.all([
      fetch(a).then((r) => (r.ok ? r.text() : "")),
      fetch(b).then((r) => (r.ok ? r.text() : "")),
    ])
      .then(([ta, tb]) => {
        if (on) setClash(!!ta && !!tb && norm(ta) === norm(tb));
      })
      .catch(() => {
        if (on) setClash(false);
      });
    return () => {
      on = false;
    };
  }, [a, b]);
  // Sem os dois URLs o empate é indefinido: nunca forçar a de fora.
  return Boolean(a && b && clash);
}
