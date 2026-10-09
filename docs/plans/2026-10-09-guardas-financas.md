# Guardas financeiras — corrigir pagamentos duplos (2026-10-09)

## Objetivo
Fechar os buracos encontrados na auditoria (`2026-10-09-auditoria-financas-economia.md`)
onde o dinheiro pode ser pago duas vezes, perder-se ou deixar saldos negativos sem querer.
Cada correção é pequena e isolada: aplicar uma, verificar, commitar, passar à seguinte.

## Regra comum
O padrão já usado em `makeTransferProposal`/`hireStaff`: a **guarda vai no próprio SQL**
(`WHERE … AND <condição>`), lê-se `changes` e, se for 0, `ROLLBACK` e sair. Nada de
verificar fora da transação e confiar nisso. Transações sempre dentro de `runRoomTask`.

## Fase 1 — Pagamentos a dobrar (alta)

### 1.1 Leilão volta a fechar após reinício
- **Onde:** `server/auctionHelpers.ts:427-451` (`runFinalizeAuction`) e
  `server/gameManager.ts:788-797` (fecho inline de leilões restaurados).
- **Bug:** fechar o leilão não grava o estado; um reinício antes do próximo
  `saveGameState` restaura-o e paga outra vez (o `UPDATE players` não tem guarda).
- **Fix:**
  1. Nos 2 sítios, mudar o jogador **primeiro**:
     `… WHERE id = ? AND transfer_status = 'auction'`; `changes === 0` → `ROLLBACK` + fechar sem venda.
  2. `saveGameState(game)` no fim de `runFinalizeAuction` (venda e `closeUnsold`)
     e no fim do fecho inline do `gameManager`.
- **Extra (baixa, mesmo sítio):** `gameManager.ts:1069-1079` não grava
  `guaranteed` → acrescentar `guaranteed: !!a.guaranteed`.

### 1.2 `chooseSponsor` com duplo clique
- **Onde:** `server/socketSessionHandlers.ts:1778` (verificação) e `:1802` (UPDATE).
- **Fix:** UPDATE com `AND sponsor_pending = 1`, via `runExec`; `changes === 0` →
  `ROLLBACK` e devolver o `sponsorState` atual (sem crédito nem notícia).

### 1.3 `buyPlayer` aceita jogador em leilão
- **Onde:** `server/socketTransferHandlers.ts:115` e guarda do UPDATE em `:158`.
- **Fix:** exigir `transfer_status === 'fixed'` na verificação e
  `AND transfer_status = 'fixed'` no UPDATE (em vez de `!= 'none'`).

### 1.4 `fireStaff` com duplo clique
- **Onde:** `server/staffHelpers.ts:311-349`.
- **Fix:** `DELETE` primeiro; `changes === 0` → `ROLLBACK` + `{ ok:false, error:"not_found" }`;
  só depois cobrar a indemnização.

## Fase 2 — Saldos e atomicidade (média)

### 2.1 `buyPlayer` sem guarda de saldo no débito
- **Onde:** `server/socketTransferHandlers.ts:143-147`.
- **Fix:** `… WHERE id = ? AND budget >= ?`; `changes === 0` → erro `insufficient_budget`
  com mensagem "Não tens fundo de maneio suficiente!".

### 2.2 Transferências NPC sem transação nem fila
- **Onde:** `server/npcTransferHelpers.ts:186-245`.
- **Fix:** cada compra dentro de `runRoomTask` + `BEGIN/COMMIT`; ordem: mudar jogador
  (guarda já existente) → se 0, `ROLLBACK` e `continue`; senão débito comprador
  (`AND budget >= ?`) + crédito vendedor; apagar a compensação manual (`:226-245`).
  Notícias/`recordTransfer` ficam fora da transação (como hoje).

### 2.3 Prémios de fim de época não atómicos
- **Onde:** `server/cupFlowHelpers.ts` — `payChampionPrizes` (`:316`),
  `paySponsorRevenue` (`:408`), `payTopScorerPrize` (`:530`); marcador só no fim (`:1027`).
- **Fix:** cada passo dentro de `runRoomTask` + `BEGIN … recordSeasonStep … COMMIT`
  (mesmo padrão de `applyPromotionsAndRelegations`, `:639-678`). O `seasonStepOnce`
  continua a saltar passos já feitos. Remover o comentário `ponytail:` da janela.

## Fase 3 — Pontas soltas (baixa)

- **3.1 Renda semanal sem marcador em erro de leitura** —
  `weeklyFlowHelpers.ts:1725-1731`: em erro, `return false` (a semana volta ao lobby e tenta de novo) em vez de cobrar sem proteção.
- **3.2 Limite de empréstimo** — `socketFinanceHandlers.ts:150`:
  `loan_amount + 500000 <= 2500000` em vez de `loan_amount < 2500000`.
- **3.3 Lances de treinador despedido** — em `dismissHumanCoach`
  (`coachDismissalHelpers.ts:245`), retirar os lances do clube antigo dos leilões abertos
  (`delete auction.bids[oldTeamId]`) e emitir o mercado atualizado.

Fica de fora (registado, sem ação agora): `openSponsorMarket` sem `seasonStepOnce`
(`cupFlowHelpers.ts:864`), escritas soltas fora da fila (empréstimos, notícias) e
erros ignorados nos `game.db.run` da Taça — não duplicam dinheiro; voltar se aparecerem no audit.

## Testes novos
Um script `server/scripts/financeGuardsRegression.mts` (`npm run test:finance-guards`,
estilo `roomTxRegression`, BD em memória), um teste por correção:
- fechar o mesmo leilão 2× → só 1 movimento de saldo (1.1);
- `chooseSponsor` 2× em paralelo → 1 adiantamento, 1 notícia (1.2);
- `buyPlayer` de jogador em leilão → recusado (1.3);
- `fireStaff` 2× em paralelo → 1 indemnização (1.4);
- 2 `buyPlayer` em paralelo acima do saldo → saldo nunca < 0 (2.1);
- compra NPC com jogador já vendido → saldos intactos (2.2).

Alargar `test:crash-recovery` com: leilão fecha após o jogo → reinício antes da semana seguinte → saldos iguais.

## Audit
`server/scripts/gameStateAudit.ts` — novas verificações:
- jogadores `transfer_status='auction'` sem leilão em `activeAuctions`;
- `loan_amount > 2500000`;
- `sponsor_pending = 1` em equipa sem treinador humano;
- notícias `sponsor` duplicadas (mesma equipa/época).

## Verificação (entre cada correção)
- server `npm run typecheck` + `npm run test:finance-guards` + `test:room-tx`.
- 1.1 → `test:crash-recovery`; 1.2 → `test:sponsor`; 1.4 → `test:staff`;
  2.3 → `test:topscorer`; 1.2/`index.ts` mexido → `test:connect-smoke`.
- No fim: `audit:socketio` e `audit:gamestate <sala>` numa sala real (cópia).
- Sem mudanças de UI → sem `test:mobile`.
- Commit por correção, mensagem com o porquê (ex. `fix: prevent auction double payout after restart`).
