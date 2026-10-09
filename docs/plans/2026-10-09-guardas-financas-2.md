# Guardas financeiras 2 — pontas da 2.ª auditoria (2026-10-09)

Origem: relatório da re-auditoria (`2026-10-09-auditoria-financas-economia.md`) depois
das correções de `2026-10-09-guardas-financas.md`. Sem buracos de gravidade alta; sobram
valores errados e riscos pequenos. Uma correção por commit, verificar entre cada.

## Fase 1 — dinheiro/valor errado
1. **Patrocínio perfil B a dobrar nas Finanças** — `socketSessionHandlers.ts:1818`: a notícia
   grava `offer.total` quando não entrou dinheiro; `requestFinanceData` soma-a às semanais.
   Fix: `amount = offer.upfront` (idem `cupFlowHelpers.ts` NPC).
2. **`sponsor_pending` órfão** — equipa sem treinador humano nunca recebe patrocínio.
   Fix: na renda semanal (dentro da transação), escolha automática (NPC) para esses clubes.

## Fase 2 — fila e erros de escrita
3. Empréstimos (`takeLoan`/`payLoan`/`payAllLoan`), investimento NPC (obra/academia) e
   crédito NPC em `openSponsorMarket` passam por `runRoomTask`; academia numa transação.
4. Prémios/bilheteira da Taça e prémios de campeão/patrocínio: não engolir erros
   (`dbRunOn` em vez de `db.run(..., resolve)`) — um erro faz ROLLBACK em vez de marcar como pago.

## Fase 3 — pontas
5. Fecho de leilão: guarda `team_id = vendedor` e `budget >= ?` no débito; leilão restaurado
   cumpre a venda garantida (`guaranteed`).
6. Renda semanal: reler o marcador dentro da transação.
7. Amigáveis: Finanças mostram a divisão 50/50 real e chamam-lhes «Amigável».
8. `fireStaff` sem saldo devolve `no_budget`.

Fica de fora (decisão do utilizador pendente): lances ao sair da sala (`leaveRoom`/kick),
cláusula sobre jogador sem clube; marca duplicada em cliques simultâneos (só cosmético).

## Verificação
server `typecheck` · `test:finance-guards` (novos F7–F10) · `test:sponsor` · `test:staff` ·
`test:crash-recovery` · `test:topscorer` · `test:connect-smoke` · `audit:socketio` ·
`audit:gamestate` (novas verificações). Sem UI estrutural → sem `test:mobile`.
