# Amigáveis na semana da taça (eliminados)

## Regras
- Só treinadores **eliminados** da taça podem marcar. Semana da **final**: ninguém (a final encerra a época).
- **Opcional.** Marca-se no calendário **na véspera** (jornada anterior à ronda da taça). Prazo: fecho dos jogos da véspera. **Não se desmarca.**
- O adjunto lembra na véspera (dica, como as de Forma/Resistência), só a eliminados que ainda não marcaram.
- **Emparelhamento (bolsa):** no fecho da véspera, os inscritos humanos são emparelhados entre si; quem sobra joga contra uma equipa **IA eliminada** (ao acaso). IA nunca joga IA.
- **Casa:** quem marcou primeiro (ordem de inscrição); contra IA, o humano é sempre a casa.
- **Regras de jogo:** iguais ao amigável de pré-época (bilheteira, efeitos, todos os suplentes).
- **Presença:** humano ausente congela a jornada (regra central, sem exceção).

## Implementação (reaproveitar o amigável de pré-época)
1. **Inscrição:** tabela `friendly_signups (season, cup_round, team_id, created_at)`; evento socket `signupCupWeekFriendly` (valida: eliminado, véspera, não é final, não inscrito).
2. **Fecho da véspera** (`weeklyFlowHelpers` no fim da jornada): emparelhar por `created_at` e inserir em `cup_matches` com marca de amigável (ex.: `round = 0` não serve — usar coluna `is_friendly` ou ronda própria; decidir ao ler `prepareFriendlyFixtures`).
3. **Semana da taça:** os fixtures dos amigáveis correm junto com a ronda da taça; `finalizeFriendly` aplica as regras de pré-época.
4. **Cliente:** botão no calendário (`CalendarTab`) na véspera + estado "marcado"; dica do adjunto.
5. **Resumo/notícias:** `matchSummaryHelpers` já trata `type === "friendly"` — confirmar que mostra os dois tipos na mesma semana.

## Em aberto
- Forma de distinguir amigável de semana da taça vs pré-época em `cup_matches` (ver passo 2).
