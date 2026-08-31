import { useSyncExternalStore } from "react";

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
  const query = `max-width: ${threshold - 1}px`;
  let mql = null;
  const getMql = () => (mql ??= window.matchMedia(query));

  return useSyncExternalStore(
    (onChange) => {
      const q = getMql();
      q.addEventListener("change", onChange);
      return () => q.removeEventListener("change", onChange);
    },
    () => getMql().matches,
    () => false
  );
}

/**
 * useMobileLandscape — devolve `true` quando o ecrã está em orientação
 * horizontal E abaixo do breakpoint `lg` (1024px) do Tailwind.
 * Cobre a banda "telemóvel landscape" — tablets/desktop em landscape
 * continuam a usar a sidebar desktop (`lg:flex`) sem efeito.
 *
 * @returns {boolean} `true` se orientation for landscape e width < 1024px.
 */
export function useMobileLandscape() {
  const query = "(orientation: landscape) and (max-width: 1023px)";
  let mql = null;
  const getMql = () => (mql ??= window.matchMedia(query));

  return useSyncExternalStore(
    (onChange) => {
      const q = getMql();
      q.addEventListener("change", onChange);
      return () => q.removeEventListener("change", onChange);
    },
    () => getMql().matches,
    () => false
  );
}
