# Notícias depois do apito final: semana seguinte

Origem: no Jornal, as notícias que chegam depois do apito final aparecem com a semana jogada, quando já começou a semana nova. Pedido: devem ter a data da semana nova.

## Decisões

- **Servidor decide a semana no momento da gravação**, não o ecrã por tipo de notícia. Motivo: o castigo de 3 amarelos sai durante o jogo, antes do apito, e um mapa por tipo puxava-o para a semana seguinte por engano.
- **Marca do apito** `game._whistleSlot`: fixada no FULL TIME, limpa no início do jogo seguinte, no prolongamento e ao voltar ao lobby. `newsSlotFor` (`server/coreHelpers.ts`) soma 1 quando a notícia é da semana marcada.
- **Rescaldo fica de fora:** guarda a jogada e o ecrã soma 1 (`formatRecapDate`), como já fazia. Assim as notícias antigas do rescaldo não mudam.
- **Só as novas:** o histórico já gravado não é alterado.
- **Lesões:** guardam a semana jogada (`played`) na descrição, para a contagem de semanas de baixa não mudar. Linhas antigas usam `slot`, como antes.
- **Época de 25 semanas** (`SEASON_WEEKS`, não 20): a viragem para a época seguinte passa a usar esse valor.

## Ficheiros

- `server/coreHelpers.ts`, `server/weeklyFlowHelpers.ts`, `server/cupFlowHelpers.ts`, `server/types.ts`
- `server/scripts/newsSlotRegression.mts` (caso N6)
- `client/src/utils/inboxItems.js`

## Verificação

- `npm run typecheck` (servidor), `npm run test:newsslot`, `npm run test:progress-news`, `npm run test:crash-recovery`, `npm run audit:gamestate B8N0ZH` (0 erros)
- Cliente: `npm run lint`, `npm run check:types`, e um script temporário fora do projeto para as datas (S6, S25, S1 da época seguinte) e para a contagem de semanas das lesões.
- Não testado num jogo real completo: falta ver uma finalização de época a acontecer.
