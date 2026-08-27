import { useEffect, useState } from "react";

/**
 * useIsMobile — devolve `true` quando a largura da janela está abaixo do
 * breakpoint `md` do Tailwind (768px).
 *
 * Lê o matchMedia dentro de um effect para evitar mismatch de hidratação e
 * subscreve as alterações de largura em tempo real.
 *
 * @param {number} [threshold=768] Largura (px) a partir da qual conta como desktop.
 * @returns {boolean} `true` se estiver abaixo do threshold (layout mobile).
 */
export function useIsMobile(threshold = 768) {
  const isMobile = () => window.matchMedia(`(max-width: ${threshold - 1}px)`).matches;

  const [mobile, setMobile] = useState(isMobile);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${threshold - 1}px)`);
    const onChange = () => setMobile(mql.matches);
    mql.addEventListener("change", onChange);
    setMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [threshold]);

  return mobile;
}
