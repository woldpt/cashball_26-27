## Adjunto fala JJ meme total (2026-10-01)
- Pedido: Treinador-adjunto passa a falar na linguagem meme do Jorge Jesus, intensidade meme total, textos + CTAs + alcunha.
- 7 dicas reescritas em `useAssistantCoach.js` (6) + `trainingCapAdvice.js` (1, mantém interpolação do foco); etiqueta `Treinador-adjunto` → `O Mister` (cabeçalho + aria-labels) em `AssistantCoach.jsx`. Só strings, zero lógica/tabs/keys.
- Checks: `eslint` limpo nos 3 ficheiros · `check:types` OK · só texto → sem `test:mobile`; audits saltam (sem lógica de jogo/sockets).

## Tutorial passa para o treinador-adjunto (2026-10-01)
- Pedido: o tutorial passa a ser ensinado pelo adjunto.
- Spotlight, ordem, tabs/alvos, arranque (WelcomeModal conta nova) e «Rever tutorial» inalterados; só o balão ganha a cara do adjunto (medalhão `assistant.webp` + balão com rabicho, etiqueta «Treinador-adjunto · Passo N de 10») e os 10 textos passam à 1.ª pessoa («Mister, eu mostro-te…»).
- `AssistantMascot` exportado de `AssistantCoach.jsx` para reutilização sem duplicar; dicas normais calam-se enquanto `tutorial.active` (`GameLayout` não monta o `AssistantCoach`, sem tocar nos `seenKey` 1x/semana).
- Checks: `eslint` limpo nos ficheiros tocados (3 erros pré-existentes noutros ficheiros) · `check:types` OK · `test:mobile` PASS (175/175).

## Jornal sem S16 por cima de S18 (sorteio transitório) (2026-10-01)
- Bug (sala P9XFLJ, Leça): a linha «Sorteio: Meias-finais» datada de S16 aparecia no topo por cima de notícias S18.
- Causa: transitórios iam todos para o topo sem ordenar por data; o transitório do sorteio leva a data da semana do sorteio e, para equipa já eliminada (Leça caiu na ronda 1 — o espelho `cup_draw` só é gravado a `cupTeamIds`, equipas ainda em prova), nunca chega linha gravada que o esconda (`cupDrawCovered`), por isso envelhecia no topo. Ordem das linhas gravadas verificada correta na BD (slot desc, sem inversões).
- Fix: em `client/src/hooks/useInbox.js`, só `redFlag` fica fixo no topo; o resto (incluindo transitórios com data passada) desce para a posição cronológica via `inboxWeekKey` (`S<semana>/<ano>` → ano * 100 + semana, sort estável).
- Checks: `eslint` limpo no ficheiro · `check:types` OK · prova de semântica em node (redFlag primeiro, resto desc, estável em empate) · mesma lista/componentes, só ordem → sem `test:mobile`.

## Patrocinador atualiza camisola e gráfico sem refresh (2026-10-01)
- Bug (Ano 2 S1): após `chooseSponsor`, o logotipo da camisola e o gráfico de saldo só atualizavam com refresh.
- Causa: o handler `chooseSponsor` (`server/socketSessionHandlers.ts`) só emitia `sponsorState` ao próprio + `globalNewsUpdated` — sem `teamsData` (fonte do `sponsorBrand` do TeamKit e do budget) nem `financeData` (fonte do gráfico e de `sponsorRevenue`).
- Fix: no sucesso do `chooseSponsor`, broadcast de `teamsData` para a sala (via `getTeamsWithCoachNames`, já importado) + `clubNewsUpdated { teamId }`; no cliente (`client/src/hooks/socket/news.js`), `sponsorState` com `chosen` volta a pedir `requestFinanceData` (mesmo padrão do `stadiumBuilt`).
- Checks: server `typecheck` OK · `audit:socketio` 0 erros · client `eslint` + `check:types` OK · sem mudança de layout → sem `test:mobile`.

## Final da Taça em harmonia com os match heros (2026-10-01)
- Pedido: `CupFinalStage.jsx` destoava dos outros heros — sem camisolas nem logotipos de fundo; manter a taça, agora ao centro (SVG da Taça de Portugal).
- Frente-a-frente passa a usar o `ScoreKit` do `LiveMatchHero` (camisola `TeamKit` + badge do treinador, fallback para `TeamCrest`; fora veste alterna via `useKitClash`) em vez do `TeamCrest` rodado; nomes dos treinadores vivem no badge, como no hero.
- Fundo com marcas de água dos emblemas laterais iguais às do `LiveMatchHero`; troféu-emoji de canto removido, Taça em SVG (`client/public/trophies/taca-portugal.svg`, da Wikimedia Commons) centrada atrás do marcador com brilho dourado.
- `ScoreKit` exportado do `LiveMatchHero.jsx` (1 palavra) para reutilização sem duplicar.
- Checks: `lint` limpo nos ficheiros tocados (3 erros + 1 warning pré-existentes noutros ficheiros) · `check:types` OK · `test:mobile` PASS (175/175).

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


## Contratos em semanas, não jornadas (2026-10-01)
- Pedido: duração/fim do contrato aparecia em jornadas; passa a semanas.
- Fix: `contractWeekLabel(slot)` → `Semana N` (server `coreHelpers.ts` + client `utils/slotLabel.js`); `contractEndInfo()` devolve `slot` + `label: Semana N`; renomeado `CONTRACT_LENGTH_MATCHWEEKS` → `CONTRACT_LENGTH_WEEKS` (alias antigo mantido), `contractEndMatchweek` → `contractEndSlot` no fio (cliente aceita o antigo em fallback); mensagens de bloqueio de leilão usam `end.label`; fallback `Jornada ${n}` no `market.js` e variáveis no `PlayerHistoryModal.jsx`/`helpers.js` atualizados.
- Checks: server `typecheck` OK · client `eslint` limpo nos ficheiros tocados (3 erros pré-existentes noutros ficheiros) · `check:types` OK · sem mudança de layout → sem `test:mobile`.
