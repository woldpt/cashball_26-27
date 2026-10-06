# Redesign da janela de simulação (tab `live`)

## Contexto
Avaliação (7/10): momentos de golo fortes, mas hierarquia fraca e pouco controlo
para o treinador — substituições escondidas no clique do marcador, sem dados para
decidir, comentário de uma só frase, outros jogos a ocupar muito ecrã, texto de
7–9px, efeitos a mais e o marcador perde-se ao fazer scroll.

## Mudanças
1. **Botão "Substituições"** explícito no hero (`LiveMatchHero.jsx`); fora de jogo
   vira "Detalhes do jogo". O clique no marcador continua a funcionar.
2. **Faixa de dados** sob o marcador: posse (`homePossession` já chega a cada
   minuto), remates (golos + `chance` + `near_miss` + penáltis falhados + VAR) e
   alerta de cansaço da minha equipa (`fatigueLoss >= 3` no lineup ao vivo).
3. **Feed de lances** (todos, mais recente em cima, ~6 visíveis com scroll) no
   lugar da frase única; as colunas por equipa ficam só com golos e vermelhos.
4. **Multiplex** (`LiveGoalTicker.jsx`): últimos golos dos outros jogos, ao lado
   da classificação virtual (e da Taça). Outras divisões em `<details>`
   recolhidos (abertos se houver treinador humano); a minha divisão aberta.
5. **Texto mínimo** na vista live: 11px para conteúdo, 10px para labels/badges.
6. **Menos efeitos:** saem as marcas de água dos emblemas, a vinheta e a luz de
   estádio do hero; fica o flash de golo, a aura de liderança e a meteo.
7. **Marcador fixo** no topo quando o hero sai do ecrã (IntersectionObserver;
   contentor `overflow-clip` para o `sticky` funcionar).
8. **Código:** secção live de `GameRoutes.jsx` → `components/live/LiveView.jsx`
   (consome `useGame()`); funções puras novas em `liveHelpers.js` com teste
   `liveHelpers.test.mjs`.
9. Extra: `MatchView` passava `homePct`/`hInfo` ao `PossessionBar`, que espera
   `homePossession`/`homeColor` — a posse nunca aparecia. Corrigir.

## Verificação
`npm run lint` · `npm run check:types` · `npm run test:livehelpers` ·
`npm run test:mobile` (livehero + harness novo da LiveView) · screenshots.
