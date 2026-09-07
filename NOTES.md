# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Em curso

- (nada)

## Último estado

- **Compra de NPCs no Mercado (lote semanal):** `processNpcTransferActivity` (`server/npcTransferHelpers.ts`) só comprava com probabilidades baixas (40% por equipa / 55% por jogador) e tecto de 55% do orçamento — parecia que os NPCs só compravam em leilões (que são reativos). Ajustado para 65% / 75% e tecto de 70%.
- Nota: o Mercado só tem oferta via listagens "fixed" (humanos) ou excedentes listados pelos próprios NPCs; nas salas ativas o mercado estava vazio (`transfer_status='none'` em todos).

## Próximos passos

- Push de `d0c24d2` (crest nos icones + nomes legíveis no popup do sorteio da Taça) — só com pedido explícito do utilizador.
