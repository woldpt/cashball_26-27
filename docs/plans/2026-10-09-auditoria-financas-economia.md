# Plano — Auditoria financeira: economia do jogo (prompt p/ Claude Opus)

> Origem: sessão de 2026-10-09. Este ficheiro guarda o **prompt de auditoria**
> (não um plano de execução) para correr com o Claude Opus dentro do
> repositório. O Opus devolve só um relatório — não altera código.
>
> **Objetivo:** caçar corrupção silenciosa de estado no ciclo financeiro —
> pagamentos duplos, salários que vazam, orçamentos dessincronizados.
>
> **Depois do relatório:** escrever o plano de execução no estilo dos outros
> de `docs/plans/` (fases, bugs com ficheiro:linha, verificação), e só então
> aplicar as guards, uma a uma, com verificação entre cada.

---

# Auditoria financeira: economia do jogo

Vais auditar o **ciclo financeiro** do CashBall — todo o dinheiro que entra,
sai ou pode ser duplicado/perdido — sem alterar código. O foco é a
corrupção silenciosa de estado: pagamentos duplos, salários que vazam,
orçamentos dessincronizados.

## O mapa do dinheiro (para verificares, não para dares como certo)

- **Renda semanal** (`server/weeklyFlowHelpers.ts`, secção "Weekly
  finance"): base por divisão + pagamento de patrocínio − salários de
  jogadores − salários de staff − juros e amortização de empréstimo.
  Protegida por marcador `applied_weeks (kind='weekly_finance')` e
  transação BEGIN/COMMIT.
- **Contratos/transferências** (`server/contractHelpers.ts`): contratação,
  venda, custos, salários semanais do jogador (`players.salary_weekly`).
- **Leilões** (`server/auctionHelpers.ts` + handlers de leilão): lances,
  lance vencedor, pagamento — guardas conhecidas: `bids[npcTeam.id] != null`
  (lances NPC duplicados) e filtros `p.transfer_status`.
- **Transferências NPC** (`server/npcTransferHelpers.ts`).
- **Patrocínios** (`server/game/sponsors.ts`): ofertas, `sponsor_weekly`,
  flag `sponsor_paid_second`, escolha NPC.
- **Empréstimos**: juros + prestação semanal.
- **Despedida de treinador** (`server/coachDismissalHelpers.ts`): o que
  acontece com o orçamento e os salários quando um treinador sai?
- **Frontend** (apenas para ver o que é mostrado):
  `client/src/views/FinancesTab.jsx`, `client/src/components/ui/TransferHub.jsx`,
  `client/src/views/AuctionsTab.jsx`.

## Cenários a caçar (um por um, com veredicto)

1. **Renda semanal em dobro** — o marcador `applied_weeks` é à prova de
   crash no meio da transação? E de dois avanços de semana simultâneos?
2. **Salário de jogador vendido** — jogador vendido a meio da semana: a
   dedução cai na equipa certa? Jogador sem equipa continua a pagar
   salário a alguém?
3. **Custo de transferência** — a venda debita a uma equipa e credita à
   outra atomicamente? Se crashar no meio, o dinheiro fica "no ar"?
4. **Leilão** — o pagamento do lance vencedor é idempotente? Sala congelada
   a meio do leilão: o dinheiro é cobrado uma vez?
5. **Patrocínio** — `sponsor_weekly` pago duas vezes? Flag
   `sponsor_paid_second` consistente? Patrocínio trocado: o pagamento
   antigo continua?
6. **Empréstimo quitado** — juros/amortização param exatamente quando o
   empréstimo acaba? Sem dedução fantasma na semana seguinte?
7. **Orçamento negativo** — em que ponto o orçamento pode ficar negativo e
   o que o jogo faz depois?
8. **Operações não transacionais** — além da renda semanal, quais
   operações financeiras escrevem em várias tabelas sem transação?
9. **Despedida** — treinador despedido: salários do staff, obrigações e
   orçamento ficam consistentes?
10. **Cliente vs. servidor** — `FinancesTab` mostra o orçamento do servidor
    em tempo real ou pode mostrar valor stale após operação?

## O que queres no relatório

Para cada cenário: **veredicto** (seguro / vulnerável / parcial),
**onde** (ficheiro:linha), **sequência concreta** que o dispara (se
vulnerável), **consequência** (quanto dinheiro se perde/duplica),
**severidade** (alta = dinheiro duplicado ou perdido; média = valor
errado visível; baixa = cosmético), **sugestão de fix** concreta e mínima.

Termina com: (a) os 5 problemas mais graves em ordem, (b) o que já está bem
guardado (marcadores, transações, guards) e não deve ser tocado, (c) o que
falta cobrir com `audit:gamestate` e testes.

Escreve em pt-PT. Não alteres ficheiros.
