/**
 * Classes de tamanho partilhadas pelos avatares circulares (procedural e
 * imagem carregada), para manter dimensões idênticas entre os dois tipos.
 */
export const AVATAR_SIZE_MAP = {
  sm: "w-10 h-10",
  // "md" responsivo para linhas compactas: 48px em mobile, 64px ≥sm
  mdR: "w-12 h-12 sm:w-16 sm:h-16",
  md: "w-16 h-16",
  lg: "w-24 h-24",
  xl: "w-32 h-32",
};
