## Patrocinador atualiza camisola e gráfico sem refresh (2026-10-01)
- Bug (Ano 2 S1): após `chooseSponsor`, o logotipo da camisola e o gráfico de saldo só atualizavam com refresh.
- Causa: o handler `chooseSponsor` (`server/socketSessionHandlers.ts`) só emitia `sponsorState` ao próprio + `globalNewsUpdated` — sem `teamsData` (fonte do `sponsorBrand` do TeamKit e do budget) nem `financeData` (fonte do gráfico e de `sponsorRevenue`).
- Fix: no sucesso do `chooseSponsor`, broadcast de `teamsData` para a sala (via `getTeamsWithCoachNames`, já importado) + `clubNewsUpdated { teamId }`; no cliente (`client/src/hooks/socket/news.js`), `sponsorState` com `chosen` volta a pedir `requestFinanceData` (mesmo padrão do `stadiumBuilt`).
- Checks: server `typecheck` OK · `audit:socketio` 0 erros · client `eslint` + `check:types` OK · sem mudança de layout → sem `test:mobile`.

## Deploy v26.10.3 no rick (2026-10-01)
- Tag `v26.10.3` (bump de `APP_VERSION` em `client/src/constants/index.js`); rebuild com `backend Healthy`.
- Inclui: dica do adjunto sobre teto de treino (Forma/Resistência) + testes `trainingCapAdvice`.
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Adjunto avisa quando o treino bate no teto (Forma/Resistência) (2026-10-01)
- Pedido: o JJ deve avisar quando o treino já chegou ao limiar e os jogadores não avançam (Forma e Resistência).
- Factos do motor (`server/trainingHelpers.ts`, `gameConstants.ts`): Forma +6/semana até `FORM_MAX=50`, Resistência +4.9/semana até `RES_MAX=50` — bónus só para quem jogou; no teto o ganho é zero e o acumulador de resistência é zerado, ou seja, continuar nesse foco perde a semana.
- Decisão do utilizador: avisa com **≥70% do plantel no teto**, **1x por semana** até o foco mudar (usa a chave semanal normal — a dica extingue-se sozinha quando trocas de foco).
- Implementação: util puro novo `client/src/utils/trainingCapAdvice.js` (foco → campo/teto) + dica `trainingcap` no `useAssistantCoach.js`, logo a seguir à do «foco não definido» e antes da enfermaria. Foco ativo lido do `localStorage` (caminho rápido) com o fallback de BD que já existia; foco de skill ou desconhecido nunca avisa.
- Constantes novas em `client/src/constants/index.js` a espelhar o servidor (`FORM_MAX`/`RES_MAX`) + `TRAINING_CAP_TARGETS` e `TRAINING_CAP_SQUAD_RATIO` (limiar num só sítio).
- Checks: `npm run test:trainingcap` (novo, 5 grupos de asserções) PASS · `lint` limpo nos ficheiros tocados · `check:types` OK · sem mudança de layout → sem `test:mobile`.

