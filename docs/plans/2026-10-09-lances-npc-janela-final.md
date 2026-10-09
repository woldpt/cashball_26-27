# Plano — Lances dos NPCs espaçados e concentrados no fim do leilão

> Estado: **proposto** (aguarda OK). Nenhum ficheiro de código foi alterado.
> Substitui a ideia do registo de lances rejeitados (`2026-10-09-registo-lances-rejeitados.md`), que ficou parada.

## Objetivo

Os lances dos NPCs deixam de chegar em rajada logo a seguir ao arranque. Passam a acontecer só nos últimos 30 segundos do leilão, com pelo menos 6 a 10 segundos entre lances de NPCs. Dá mais urgência e parece mais realista.

## Decisões tomadas

- **Janela:** NPCs só licitam entre os 90 s e os 120 s (últimos 30 s).
- **Espaçamento:** entre dois lances de NPCs no mesmo leilão, espera de 6 a 10 segundos (sorteada).
- **Contra-lances:** seguem a mesma janela e o mesmo espaçamento.
- **Preço ao chegar a vez:** o NPC recalcula o lance com o preço atual (líder + 10 000 €), desde que caiba no seu limite (60% do orçamento e 2,5 vezes o valor). Se não couber, desiste sem registo.
- **Lances humanos:** sem alterações.

## Ficheiros envolvidos

- `server/npcTransferHelpers.ts`
  - `scheduleNpcAuctionBids` (~linhas 242–390): deixa de disparar com `setTimeout` de 2 a 16 s. Em vez disso, o NPC entra numa fila do leilão.
  - `scheduleNpcCounterBid` (~linhas 399–460): o contra-lance também entra na fila, com o mesmo espaçamento.
  - Nova função interna para libertar a fila: uma única “vez” de cada vez por leilão, ao intervalo sorteado de 6 a 10 s, e só dentro da janela.
- `server/auctionHelpers.ts`: só se for preciso limpar a fila quando o leilão pausa ou fecha (o `status` já é verificado ao disparar). Sem outras alterações.
- `server/gameConstants.ts`: constantes novas para a janela (30 s), o espaçamento mínimo (6 s) e o máximo (10 s). Assim os valores ficam juntos e fáceis de ajustar.

Não se toca em `socketTransferHandlers.ts`, no cliente, nem em eventos de socket.

## Abordagem

1. **Janela:** o leilão dura 120 s (`endsAt`). A janela começa em `endsAt − 30 s`. Um NPC que decida licitar antes da janela espera até ela abrir.
2. **Espaçamento:** a fila liberta um lance de cada vez. Entre um lance e o seguinte, espera um intervalo sorteado entre 6 e 10 s. Só liberta enquanto houver tempo antes do fecho (margem de 2 s para não licitar já com o leilão fechado).
3. **Cada vez que chega, recalcula:** o lance vale `preço atual + 10 000 €`. Se ultrapassar o limite do NPC, o NPC não licita (não é registado como rejeição).
4. **Pausa e retoma:** ao pausar, a fila é ignorada (o `status` já é verificado). Ao retomar, o sorteio de entrada é refeito, como hoje.
5. **Limite de lances na janela:** com 30 s e espaçamento de 6 a 10 s, cabem no máximo 4 a 5 lances de NPCs. Fica como limite natural, sem contador extra.

## Efeitos esperados

- Quase desaparecem as rejeições de NPCs, porque o lance é recalculado no momento. Os números da simulação mudam: a taxa de rejeição desce, e o preço final tende a subir (é o que a tua pergunta sobre “recalcular” implicava).
- Rajadas de NPCs deixam de existir fora dos últimos 30 s.
- Mais tempo para os humanos reagirem antes da janela.

## Verificação (AGENTS.md)

- `cd server && npm run typecheck`
- `cd server && npm run test:connect-smoke`
- `cd server && npm run audit:socketio` (sem handlers novos, mas confirmar)
- `cd server && npm run audit:gamestate <ROOM>` numa sala de teste com leilões (lei do jogo mudou: orçamentos, plantel, fases)
- **Teste de regressão novo** (ex.: `server/scripts/npcBidWindowRegression.mts`): com o relógio controlado, confirma que (a) nenhum lance de NPC cai antes dos 90 s; (b) a distância entre dois lances de NPCs fica entre 6 e 10 s; (c) o lance é recalculado para o preço atual; (d) nenhum lance chega depois do fecho.
- Depois da implementação, correr a simulação de `sim_real.js` de novo, para ver o efeito real nos preços e nas rejeições (fora do repositório).
- Atualizar `NOTES.md` e fazer commit (regra do projeto).

## Riscos

- **Mais difícil de ver a interação humana:** NPCs só agem no fim; se um humano não estiver atento, o leilão fecha com um NPC a decidir pouco antes. Mitigação: a janela é de 30 s, não menos.
- **Preço mais alto:** o recálculo faz os NPCs licitarem sempre o preço atual, o que pode subir o valor final. Se for demais, a constante do incremento (10 000 €) ou o teto de 60% do orçamento são os botões a ajustar.
- **Pausas durante o jogo:** a fila tem de ser ignorada sem deixar temporizadores órfãos; o teste cobre isto.

## Perguntas em aberto

Nenhuma. As decisões foram tomadas por ti.

Se estiveres de acordo, sigo com a implementação, os testes e o commit.
