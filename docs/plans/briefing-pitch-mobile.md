# Plano — relvado do adversário invisível no Briefing pré-jogo (mobile)

> Executar tal como está; algo fora do plano → parar e perguntar. pt-PT sempre; frontend só JS.

## Sintoma

No Briefing pré-jogo em vista mobile (< `lg`), o cartão "Confronto tático em campo" aparece só com o cabeçalho (`4-4-2 adversário`); o relvado com os 11 não se vê. Em desktop (`lg`+) funciona.

## Causa raiz

`client/src/components/live/briefing/OpponentFormation.jsx`, wrapper do relvado:

```jsx
<div className="relative w-full flex-1 min-h-80 short:min-h-56 lg:min-h-[360px] ...">
  <PitchFormation ... />   // raiz: "relative w-full h-full overflow-hidden"
```

- `PitchFormation` (`client/src/components/match/shared/PitchFormation.jsx`) usa `h-full` e **todo** o seu conteúdo (SVG e `PlayerRow`) é `absolute` → não contribui para a altura.
- Em mobile o pai do wrapper (o cartão) **não** é flex (`lg:flex lg:flex-col` só a partir de `lg`), logo `flex-1` não tem efeito.
- O wrapper só tem `min-height` (320px), sem `height`/`flex` definidos. Em CSS, `height: 100%` de um filho contra um pai com altura `auto` (mesmo com `min-height`) resolve para `auto` → o relvado colapsa a 0px, com jogadores e linhas absolutos a ficarem sem área.
- Em `lg` o cartão é flex column e o wrapper é um flex item esticado (`flex-1`), por isso a altura é definida e o `h-full` funciona. É por isso que só falha em mobile.

## Correção

1. Em `OpponentFormation.jsx`, dar ao wrapper uma altura **definida** em todos os breakpoints, em vez de depender de `min-h` + `h-full`:
   - Substituir `min-h-80 short:min-h-56 lg:min-h-[360px] short:lg:min-h-[240px]` por uma altura fixa em mobile com `aspect-ratio` do relvado (o SVG usa viewBox 315×560 → ~`aspect-[315/400]` é suficiente para mostrar 4 linhas), ex.:
     `relative w-full h-80 short:h-56 lg:h-auto lg:flex-1 lg:min-h-[360px] short:lg:min-h-[240px]`
   - Ou seja: `h-80`/`short:h-56` em mobile (altura definida → `h-full` do filho resolve) e `lg:h-auto lg:flex-1` mantém o comportamento atual em desktop.
2. Não alterar `PitchFormation` (partilhado com jogo próprio/spectate/intervenção).
3. Não alterar a grelha de `MatchBriefing.jsx`.

## Verificação

- `cd client && npm run check:types && npm run lint` (se existir) e `npm run build`.
- Browser (DevTools, 390×844 e 360×640): abrir Briefing pré-jogo com adversário → relvado visível com 11 jogadores nas 4 linhas (GR/DEF/MED/ATA), sem cortar nomes; repetir em landscape curto (`short:`, altura ≤ 560px).
- Desktop ≥ 1024px: sem regressão (relvado continua a preencher a coluna, mín. 360px).
- Confirmar que a mensagem "11 provável indisponível" continua a aparecer quando `placed === 0`.

## Commit

`fix: relvado do adversário no briefing visível em mobile (altura definida no wrapper)` — só `OpponentFormation.jsx` e este plano.
