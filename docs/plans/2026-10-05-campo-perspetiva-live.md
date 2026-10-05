# Campo em perspetiva no fundo da live view (mobile)

## Contexto
Decorativo: uma faixa fina com um relvado em perspetiva no fundo da live view, só em mobile, tingida pela meteorologia do jogo. Altura máx. ~64px para não roubar espaço.

## Abordagem
Reutilizar o que já existe:
- `WeatherOverlay` (`components/match/shared/WeatherOverlay.jsx`) em modo não-fullscreen → partículas (chuva/neve/vento/nevoeiro) dentro da faixa, com `prefers-reduced-motion` já tratado em `index.css`.
- Meteo: `myMatch.events.find(e => e.type === "weather")?.emoji` (mesmo padrão de `LiveMatchHero.jsx:109`).

### Novo `client/src/components/live/LivePitchStrip.jsx` (~50 linhas)
- Wrapper `md:hidden relative h-16 overflow-hidden rounded-md` com `perspective: 300px`.
- Dentro, um `<svg viewBox="0 0 680 1050">` (só o meio-campo próximo visível) com `transform: rotateX(60deg)` e `transform-origin: bottom` → linhas do campo convergem para o horizonte: faixas de relva alternadas, linha de meio-campo, círculo central, áreas.
- Céu em gradiente no topo da faixa + `boxShadow` inset para desvanecer no fundo.
- Tinta por condição (mapa pequeno `TINT`: sol = relva mais clara + brilho quente; chuva/chuva_forte = céu escuro, relva saturada; neve = relva esbranquiçada; nevoeiro = véu cinzento; frio = azulado). Reutiliza `EMOJI_TO_CONDITION` → exportar de `WeatherOverlay.jsx` (1 palavra `export`).
- `<WeatherOverlay emoji={emoji} />` por cima.
- `aria-hidden`, `pointer-events-none`. JSDoc nas props.

### Montagem
`GameRoutes.jsx`: no fim do bloco da tab live (depois da lista de `LiveFixtureRow`, ~linha 418), `{myMatch && <LivePitchStrip emoji={...} />}`; exportar em `components/live/index.js`.

## Verificação
- `npm run check:types` no client.
- `npm run dev`, abrir jogo ao vivo em viewport mobile (DevTools 390px): faixa visível no fundo, ≤64px, escondida em `md+`; testar com saves que tenham chuva/neve.
- Commit no fim (`feat(live): campo em perspetiva com meteo no fundo da live view mobile`) + copiar plano para `docs/plans/2026-10-05-campo-perspetiva-live.md`.
