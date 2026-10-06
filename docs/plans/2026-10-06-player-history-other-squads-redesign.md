# 2026-10-06 — Redesenho: Histórico do Jogador + Perfil de Clube

**Objetivo:** `PlayerHistoryModal.jsx` e `OtherSquadsTab.jsx` com acabamento de
topo, dentro do `STYLE.md` (tokens, componentes partilhados, sem lógica nova).

## Ficha do jogador (`components/modals/PlayerHistoryModal.jsx`)

1. **Cabeçalho tipo "carta":** filete no topo nas cores do clube, brilho na cor
   da posição, avatar maior também no telemóvel, skill grande à direita (com
   seta ▲▼ se mudou esta semana), chip de posição, nome + insígnias, clube com
   `TeamCrest` (troca o brasão feito à mão). Botão fechar redondo com ícone.
2. **Faixa de números:** 4 mosaicos — Valor, Ordenado/sem, Jogos e Golos da época.
3. **Gestão contratual / Mercado:** cartões com aviso de contrato em faixa
   própria; botões com ícones Material em vez de emojis.
4. **Desempenho:** a tabela passa a 4 mosaicos (valor da época grande,
   carreira por baixo).
5. **Prémios:** medalhas douradas. **Transferências:** linha do tempo
   (ano · De → Para · valor) em vez de tabela — lê-se melhor no telemóvel.
6. Títulos de secção unificados (ícone + rótulo) num helper local.

## Perfil de clube (`views/OtherSquadsTab.jsx`)

1. **Cabeçalho:** sombra de profundidade sobre a cor, brasão com aro, linha de
   contexto em chips (`bg-black/25`, regra do header §14).
2. **Próximo jogo:** cartão "duelo" (brasão vs brasão, Casa/Fora, competição,
   "Hoje") em vez da linha simples.
3. **Últimos jogos:** resumo V/E/D no cabeçalho; marcador numa pastilha com a
   cor do resultado.
4. **Destaques:** ranking 1·2·3 com medalha.
5. **Clube:** mosaicos com ícones (cores, patrocinador com `SponsorLogo`,
   estádio, capacidade). Corrige a capacidade, que caía sempre em 10 000
   (a linha da classificação não traz `stadium_capacity`).
6. **Jogos:** separador "Resultados" / "Por jogar". **Plantel:** cabeçalhos de
   grupo com a cor da posição.

## Gráfico da evolução (`components/modals/SkillLineChart.jsx`) — pedido no OK

- Linha 2px + área esbatida, crosshair que encaixa no ponto mais próximo,
  tooltip, setas do teclado, tabela escondida para leitores de ecrã;
  leitura no topo (skill atual, tendência na janela, mín/máx).

## Estado

- ✅ Feito (2026-10-06).

## Verificação

- `teamsquad-resp-test.jsx` está partido (`useGame` sem provider) → envolver
  em `GameContext.Provider`.
- `npm run lint` · `npm run check:types` ·
  `npm run test:mobile -- playerhistory-resp-test teamsquad-resp-test`
  + capturas antes/depois a 390 e 1280 px.
