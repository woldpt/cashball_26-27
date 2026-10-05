# Estádio procedural — plano de melhoria

**Data:** 2026-10-05
**Alvo:** `client/src/components/shared/StadiumIllustration.jsx` (+ `client/src/index.css`, secção "StadiumIllustration")
**Consumidores:** `StadiumTab.jsx` (hero, `shot="close"`), `ClubTab.jsx` (card `h-24`/`short:h-16`), `OtherSquadsTab.jsx` (header)
**Nota atual:** 6/10. **Objetivo:** 8+/10, sem custo extra visível no mobile.

## Restrição dura — a animação por mood mantém-se

O contrato de mood atual não muda. Todas as fases têm de o respeitar:

| Banda (`FANS_MOOD_LOW`=23, `FANS_MOOD_HIGH`=38) | Comportamento que fica |
|---|---|
| `low` (<23) | `moodOcc = occ*0.12`, noite (`night`), lua, poças de luz, tumbleweeds (`.stadium-weed`, `.stadium-weed-1`) |
| `mid` | estático, custo zero |
| `high` (≥38) | `moodOcc` sobe, `.stadium-sway` no grupo das bancadas, tochas `.stadium-flicker` na claque, bandeiras `.stadium-flag-wave` |

Regras:
- **As bancadas novas entram no mesmo `<g className="stadium-sway">`.** Assim ondulam juntas e não há um segundo grupo a animar.
- **A multidão nova usa o mesmo `crowdDots`/`moodOcc`/claque.** A noite de faroeste esvazia tudo, não só a bancada do fundo.
- **Anima-se só `<g>`, nunca pontos individuais.** O comentário do CSS já explica porquê.
- **`prefers-reduced-motion` continua a parar tudo.** Os tumbleweeds ficam na posição de repouso visível.
- **As classes CSS e os keyframes não mudam de nome.**

## Diagnóstico (screenshot de ~10k, mood alto)

1. **Só há uma bancada, atrás da baliza.** Os flancos ficam com colinas e céu, e lê-se como campo de treino. É o maior problema.
2. **A escala não bate certo.** A baliza (`GOAL_HALF_*` × `span`) parece um brinquedo ao pé da bancada, e as bandeiras de canto parecem do mesmo tamanho que as da cobertura.
3. **A perspetiva é incoerente.** O relvado foge para um ponto (`pitchHalf`), mas a bancada, o muro e as bandeiras estão em ortogonal pura. A linha de meio-campo vai de `x=10` a `790` e ignora as bordas do relvado.
4. **A multidão parece ruído.** Os pontos aleatórios com 4 zonas de cor não formam filas. No card pequeno (`h-16`) vira textura.
5. **Há pouca identidade.** Duas equipas com a mesma lotação só diferem na cor. O "procedural" depende só de `capacity`.
6. **O céu é sempre igual.** O sol, as nuvens e as colinas têm posições fixas.

## Fases

Cada fase é um commit isolado, verificável e reversível.

### Fase 1 — Bancadas laterais em perspetiva (maior ganho)

- Adicionar 2 bancadas laterais como **trapézios que seguem `pitchHalf(y)`**. A borda interior encosta à linha lateral do relvado e a exterior abre para fora. Vão de `PITCH_TOP` até ~`PITCH_TOP + 0.45·PITCH_H`, e cortam-se aí para não taparem o centro do campo.
- A altura e o número de filas escalam com a lotação:
  - ≤5k: nenhuma (o pelado mantém o carácter)
  - 5–15k: 1 degrau baixo
  - 15–50k: completa
  - ≥50k: com cobertura lateral
- Multidão lateral: `crowdDots` generalizado para receber uma função `x(y)` de borda, ou seja, filas inclinadas. Mesmo `moodOcc` e mesmo seed por anel.
- Tudo dentro do grupo `stadium-sway`.
- **Orçamento de pontos:** o teto total fica nos ~1100 de hoje. Para isso, aumentar o passo nas laterais (7 em vez de 5) e baixar ligeiramente a densidade do fundo.
- As colinas passam a aparecer só por cima das bancadas laterais, ou só no pelado.

### Fase 2 — Escala e perspetiva coerentes

- Baliza: fator mínimo próprio (`max(span, 0.8)`), porque não encolhe com o estádio. Tem de ter ~1/5 da largura do relvado na linha de fundo.
- A linha de meio-campo é limitada a `±pitchHalf(212)` e passa a haver linhas laterais visíveis (bordas do trapézio). O círculo central fica com o raio proporcional a `pitchHalf(212)`.
- Muro, LED e bandeirolas do fundo ficam iguais (o fundo é frontal por definição). Só as laterais têm fuga.
- As bandeiras de canto encolhem ~30% (estão no plano do fundo).

### Fase 3 — Multidão legível

- **Filas primeiro, cor depois:** cada fila é um traço base com a cor do setor (opacidade 0.5) e os pontos ficam por cima. Assim, mesmo em `h-16`, lê-se "bancada cheia de gente", e o esvaziamento por `moodOcc` passa a notar-se como buracos nas filas.
- **Blocos por setor:** as zonas de cor seguem os vomitórios (`aisleCount`) e não `floor(x/34)`. A claque central (cor da casa) e um setor visitante num canto (cor `away`) ficam coerentes.
- Ao longe, os anéis superiores têm pontos menores e mais escuros. Dá profundidade sem custo.

### Fase 4 — Identidade por clube (seed)

- Nova prop opcional `seed` (o `team.id`), passada pelos 3 consumidores. Sem `seed`, o desenho é o atual. `hash01(seed + k)` decide variações **discretas e estáveis**:
  - estilo de cobertura: arco (atual), plana com treliça, ou em "dente de serra" (só ≥15k)
  - torres de iluminação: 4 de canto ou rampas no telhado (≥15k), postes (<15k)
  - assentos com padrão ou com as iniciais do clube nos anéis (só ≥30k, com cor `away` sobre `home`)
  - lado do placard/telão e posição do sol
- **A lotação continua a mandar na volumetria.** A seed só decide estilo, nunca tamanho, para cada obra de +5k continuar a notar-se.

### Fase 5 — Céu e ambiente

- Posição das nuvens e do sol a partir da seed. Opcionalmente (YAGNI até haver pedido), meteo da jornada via `RefWeatherBar`, que já tem os dados.
- A noite de faroeste fica exatamente igual (paleta `night` intacta). Só se acrescentam focos a bater nas laterais novas.

## Fora de âmbito

- Câmara/ângulo novos, 3D ou canvas: o SVG paramétrico chega.
- Animar pontos individuais (ola, etc.): rebenta o orçamento no mobile. Se for pedido, será uma `<g>` de máscara a varrer.
- Mexer no servidor: `fans_mood`, `stadium_capacity` e `team.id` já chegam ao cliente.

## Verificação (por fase)

1. Self-check `client/src/components/shared/stadiumGeometry.check.js` (node puro, com `assert`):
   - para `cap ∈ {0, 3k, 5k, 10k, 15k, 30k, 50k, 80k, 120k, NaN}`, nenhum NaN no viewBox ou na geometria;
   - largura monotónica com a lotação;
   - contagem de pontos ≤ 1200 em `mood=50, occ=1`.

   Exige extrair a geometria pura para um módulo (`stadiumGeometry.js`) só se a Fase 1 a tornar necessária. Caso contrário, o check renderiza com `react-dom/server` e conta `<circle`.
2. `npm run check:types`.
3. Visual: os 3 consumidores × {pelado 4k, 10k, 30k, 60k, 110k} × mood {10, 30, 45}, nos tamanhos `h-16`, `h-28` e hero `close`. Confirmar o sway, as tochas, as bandeiras e os tumbleweeds, e confirmar que com `reduced-motion` fica tudo parado.
4. Performance: no Chrome DevTools (mobile 4× CPU throttle), sem frames longos no ClubTab com mood alto.

## Ordem recomendada

Fase 1 → 2 → 3 dão o salto de 6 para ~8. A Fase 4 é a que faz cada estádio parecer "do clube". A Fase 5 é polimento.
