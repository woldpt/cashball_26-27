# TrainingTab — avaliação e melhorias

## Contexto
Pedido: avaliar `client/src/views/TrainingTab.jsx` (código e UI/UX, de 1 a 10) e propor melhorias.

**Notas: código 6.5/10 · UI/UX 6.5/10**

## Melhorias (por prioridade)

### Bugs
1. **PlayerLink partido** — `PlayerReportRow` usa `player.id`, mas `groupByPlayer` cria `player_id`. Fica `playerId={player.player_id}`.
2. **Estado duplicado** — `selectedTraining` e `savedTraining` acabam sempre com o mesmo valor (as duas leem o localStorage e são escritas em conjunto). Apagar `selectedTraining`, usar só `savedTraining` (também no efeito que escreve no localStorage).
3. **Reenvio inútil** — clicar no foco que já está ativo volta a emitir `setTrainingFocus`. Fazer early return se `trainingKey === savedTraining`.

### Código
4. Passar `FOCUS_ATTRIBUTE` para dentro de `TRAINING_META` (campo `attr`): uma única fonte por opção.
5. Agrupar `historyByPosition` com `Object.groupBy` (ou um reduce) — menos linhas.
6. O erro nunca desaparece sozinho: limpá-lo no próximo sucesso (já acontece) chega; em alternativa, timeout de 4s.

### UI/UX
0. **(Pedido) Nível atual ao lado da evolução** — em cada coluna do relatório mostrar o valor atual + o delta, p.ex. `15 ▲1` (antes: só `▲1`, com `old → new` escondido no tooltip). Não é preciso mexer no servidor: `getTrainingHistory` (`server/socketTrainingHandlers.ts:110`) já envia `old_value`/`new_value`. Em `DeltaCell`: `<span className="font-black tabular-nums">{record.new_value}</span>` + `Badge` com o delta. Atributos sem mudança continuam `—`. A coluna do foco fica destacada como já está (`highlightAttr`).
   - Limite: `new_value` é o nível logo após aquele treino; se a skill mudar depois (p.ex. idade), aqui não se vê. Se for preciso o valor ao vivo, juntar `p.skill/p.form/p.resistance` ao SELECT.
7. **Feedback ao clicar**: durante o `loading`, mostrar um spinner/“A guardar…” só no cartão clicado, em vez de apagar todos a 50%.
8. **Cabeçalhos das colunas**: os `Skill/Forma/Resist.` a 8px repetem-se em cada linha → passar para um único cabeçalho por grupo (mais legível, menos ruído).
9. **Cor dos deltas**: subida usa `variant="info"`; deve ser `success` (verde), descida `error`.
10. **Meta “evento #N”** é críptico → mostrar “Jornada N” (ou retirar).
11. **Widget “Jornada”** repete o meta do painel → trocar por algo útil, p.ex. “Melhorias / Quedas” (soma dos deltas positivos e negativos).
12. Texto: “league ou taça” → “liga ou taça”; emojis do `EmptyState` → ícones Material, para ficar coerente com o resto.
13. O cartão selecionado mantém as classes de hover (`glow`): aplicar o brilho fixo quando está ativo.

## Ficheiros
- `client/src/views/TrainingTab.jsx` (único). Reutilizar `Badge`, `EmptyState`, `POSITION_*` já importados.

## Verificação
- `npm run check:types` e `npm run lint` no client.
- Abrir o separador Treino: mudar de foco (pulso + “Guardado!”), voltar a clicar no ativo (sem emit), clicar no nome de um jogador no relatório (abre o histórico), confirmar as cores dos deltas.
- Commit no fim.
