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
  const query = `(max-width: ${threshold - 1}px)`;
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

/**
 * useCompactViewport — devolve `true` quando o viewport NÃO tem espaço para o
 * layout desktop do jogo: exige largura ≥ breakpoint `md` (768px) E altura ≥
 * 520px.
 *
 * Cobre a banda "telemóvel em horizontal": tem largura de desktop mas só
 * ~375–400px de altura, onde a grid de 3 colunas ficaria cortada — esses
 * ecrãs devem usar o layout compacto (stack mobile) em vez da grid.
 *
 * @returns {boolean} `true` quando deve ser usado o layout compacto.
 */
export function useCompactViewport() {
  const query = "(min-width: 768px) and (min-height: 520px)";
  let mql = null;
  const getMql = () => (mql ??= window.matchMedia(query));

  return !useSyncExternalStore(
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
 * useLandscapePhone — devolve `true` quando o ecrã está em landscape e a
 * altura é curta (<520px). Cobre todos os telemóveis em horizontal,
 * incluindo os estreitos (ex.: 667×375 do iPhone SE) e tablets — o vertical
 * mantém o layout normal. Em desktop largo e baixo a banda também dispara;
 * aí as duas colunas lado-a-lado são preferíveis ao stack vertical.
 *
 * @returns {boolean} `true` se orientation for landscape e height < 520px.
 */
export function useLandscapePhone() {
  const query = "(orientation: landscape) and (max-height: 519px)";
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
