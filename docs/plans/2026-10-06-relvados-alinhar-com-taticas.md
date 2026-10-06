# Relvados — levantamento e alinhamento com o pitch das Táticas

Referência ("bonito"): `Pitch()` em `client/src/views/TacticsView.jsx:665`.

## Receita da referência

| Item | Valor |
|---|---|
| Fundo | `radial-gradient(ellipse at 50% 25%, #1f5c1a 0%, #123a0d 50%, #09200a 100%)` — verde escuro, foco no terço de cima |
| Faixas de corte | **nenhuma** |
| Linhas | SVG `viewBox 0 0 9 12`, `stroke rgba(255,255,255,0.15)`, `strokeWidth 0.065` (discretas), pontos a 0.2 |
| Overlay | `bg-linear-to-b from-black/5 via-transparent to-black/25` |
| Caixa | `rounded-2xl overflow-hidden`, sem borda, `aspect 9/12` |
| Orientação | ATA em cima → GR em baixo |

## Levantamento

| # | Onde | Tipo | Estado vs referência |
|---|---|---|---|
| 1 | `TacticsView.jsx` `Pitch()` | campo c/ jogadores | **referência** |
| 2 | `components/match/shared/PitchFormation.jsx` (`TURF_BACKGROUND` + `PITCH_SVG`) | campo partilhado | ✗ verde vivo `#0a5a16→#0d6b1d`, faixas brancas 40/80px, foco branco no topo, linhas 0.28–0.4 (fortes), overlay `from-black/45`; GR em cima, ATA em baixo (invertido) |
| 3 | `MatchPitch.jsx` (jogo próprio, MatchView) | wrapper de #2 | ✗ `rounded-md`, `border-white/15`, sombra verde `rgba(5,67,14,.45)`, 9/16 |
| 4 | `MatchView.jsx:104` (legacy) e `:179` `SpectatePitchCard` | wrapper de #2 | ✗ gradiente de fallback `#05430e→#0b5e1a` (escondido por #2, mas código morto/divergente), `rounded-md`, borda/sombra próprias |
| 5 | `components/shared/PostMatchPitch.jsx` (JournalTab) | usa #2 | herda #2; wrapper `rounded-2xl` com `border-outline-variant/25` ✓ quase |
| 6 | `components/live/briefing/OpponentFormation.jsx` | usa #2 | herda #2; sem wrapper próprio |
| 7 | `components/live/LivePitchStrip.jsx` (mobile + hero desktop) | faixa decorativa em perspetiva | ✗ `TINT` com verdes claros `#1f6b2a…#36993c`, 7 faixas alternadas, linhas `0.55` |
| 8 | `components/shared/StadiumIllustration.jsx` | ilustração SVG do estádio | ✗ `#22c55e/#16a34a` (dia) `#1f7a3d/#186233` (noite), `#14532d` base — ilustração, escala própria |
| 9 | `components/transfers/TransferChrome.jsx` | header com riscas `repeating-linear-gradient` | decoração subtil, não é relvado — ignorar |
| 10 | `index.css` `.pitch-glow` | glow verde | não usado em lado nenhum → candidato a apagar |
| 11 | `WeatherOverlay.jsx` | overlay meteo sobre #3 | neutro (não mexer) |

Nota: `StadiumTab.jsx` (riscas amarelas/pretas) não é relvado.

## Plano

Ordem por impacto — o passo 1 sozinho cobre #2, #3, #5, #6 e metade de #4.

1. **Fonte única de estilo.** Em `PitchFormation.jsx` exportar `TURF_BACKGROUND` e `PITCH_LINES` (cor/espessura) com os valores da referência; trocar:
   - `TURF_BACKGROUND` → o radial escuro, sem `repeating-linear-gradient` nem foco branco.
   - `PITCH_SVG`: `stroke` para `rgba(255,255,255,0.15)` (ajustar `strokeWidth` ao viewBox 315×560 ≈ 0.065×35 ≈ 2.3 → testar 1.5–2), pontos a 0.2.
   - overlay `from-black/45 via-transparent to-white/[0.04]` → `from-black/5 via-transparent to-black/25`.
2. **Tactics usa a mesma fonte.** `Pitch()` importa `TURF_BACKGROUND` (e o overlay) em vez de os ter inline → o "bonito" fica definido num só sítio e não volta a divergir. O SVG de Táticas (9×12) mantém-se (proporção diferente).
3. **Wrappers.** `MatchPitch.jsx`, `MatchView.jsx:104/179`: `rounded-md` → `rounded-2xl`, apagar `bg-[linear-gradient(#05430e…)]`, `border-white/1x` e sombras verdes (`shadow-[0_0_36px_rgba(5,67,14,.45)]`); ficar só `border border-outline-variant/25` como o `PostMatchPitch`.
4. **LivePitchStrip.** Reescrever `TINT` com verdes escuros da família `#1f5c1a/#123a0d` (manter o desvio por meteo: neve/frio/nevoeiro como diferença relativa), tirar as faixas alternadas (ou reduzir a ~3% de contraste) e baixar `line` para `rgba(255,255,255,0.25)`.
5. **StadiumIllustration** — mudar só `GRASS_A/B/BASE` para a mesma família escura (dia ligeiramente mais claro que noite). Faixas de perspetiva ficam (dão profundidade), com menos contraste.
6. **Limpeza.** Apagar `.pitch-glow` de `index.css` (verificar com grep que está sem uso — está).
7. **Verificar** (`run`/browser) em: Tactics, MatchView próprio, spectate dual-pitch, Journal (rescaldo), briefing adversário, Live mobile + hero desktop, Stadium. Corre `npm run check:types` e o lint.

## Decisões em aberto

- **Orientação:** Táticas = ATA em cima / GR em baixo; `PitchFormation` = GR em cima / ATA em baixo (`ROW_POSITIONS`). Recomendo **não mexer** (no jogo, a equipa da casa ataca a mesma direção em toda a narração); só mudar se quiseres coerência total — afeta `ROW_POSITIONS` e a ordem dos rows no `PostMatchPitch`.
- **Aspect:** Táticas 9:12 vs jogo 9:16 — manter (o 9:16 é height-driven nas colunas do jogo).
- **StadiumIllustration** (passo 5) é opcional; é ilustração, não "campo de jogo".
