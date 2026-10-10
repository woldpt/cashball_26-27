# Treinadores humanos: aviso por má série, escolha de clube e motivo do convite

Data: 2026-10-10 · Estado: aprovado e implementado

## Objetivo

Três melhorias às regras de despedimento e convites de treinadores humanos
(nota 7/10 na avaliação):

1. **Aviso antes do despedimento por resultados.** Com 3 derrotas nos últimos
   5 jogos, aviso da direção; com 4, último aviso. Um aviso por nível; volta a
   sair só se a série recuperar (menos de 3 derrotas) e voltar a cair.
2. **Treinador despedido escolhe o clube** (opção A). Recebe 3 clubes e fica
   sem clube até escolher. Enquanto escolhe, o lugar na sala já está libertado,
   por isso a sala não fica parada.
3. **Convite com o motivo.** O convite diz quantas vitórias o treinador teve
   nos últimos 5 jogos, no Jornal e na caixa de entrada.

## Decisões tomadas por mim

- O aviso por má série chega como mensagem ao treinador (se estiver online) e
  como notícia no Jornal (fica para quem reentrar). Não abre modal, para não
  criar mais um estado de ecrã.
- Os 3 clubes são os mesmos que a atribuição automática daria antes (os últimos
  4 classificados, primeiro os da divisão de origem).
- Se a escolha for recusada (clube ocupado entretanto ou a meio do jogo), a lista
  é atualizada sem fechar o modal.
- O modal não fecha sem escolha. Só fecha quando o clube é atribuído.

## Ficheiros tocados

Servidor: `coachDismissalHelpers.ts`, `types.ts`, `gameManager.ts` (persistência
de `formWarned` e `dismissalOptions`), `socketGameplayHandlers.ts` (sai
`confirmDismissalClub`), `socketSessionHandlers.ts` e `index.ts` (reenvio da
escolha ao reentrar).

Cliente: `components/modals/DismissalModal.jsx` (passa a mostrar só a escolha),
`hooks/socket/coach.js` (evento `dismissalChoice`), `hooks/socket/session.js`,
`GameOverlays.jsx`, `utils/inboxItems.js` (texto do convite e artigo do aviso),
`hooks/useInbox.js`.

Testes: `scripts/coachDismissalLeagueRegression.mts` (cenários A, B, D, E e os
novos F e G) e `scripts/relegationCoachRegression.mts`, atualizados para a regra
nova. Harness novo: `dismissal-resp-test.html` / `.jsx`.

## Verificação

- Servidor: typecheck, `test:connect-smoke`, `test:session-freeze` (17/17),
  `audit:socketio` (0 erros), `test:coach-dismissal-league`,
  `test:relegation-coach`.
- Cliente: lint, `check:types`, `test:postmatchflow`, `test:inboxreads`,
  `test:joinerrors`, `test:mobile` (195/195 + harness do modal, 5 larguras).
- `test:journaldb` tem 2 falhas que já existiam antes desta alteração (renovação
  → club; duas equipas na media). Não foram tocadas.

## Ficou de fora

- Treinador despedido cujos 3 clubes são ocupados antes de escolher fica sem
  opções e parado. Não existe reabastecimento automático (ponto 2 da lista de
  melhorias, não pedido).
