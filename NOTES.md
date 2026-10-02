## Estabilização da Taça F1+F3 — dreno único e fim de relógio único (2026-10-02)
- F1 (`GameContext.jsx`): o dreno do `pendingCupRoundResults` passa a regra explícita — drena se (parado E relógio no fim) OU (parado E nunca viu o jogo); tabela de verdade idêntica, mas o `return` silencioso virou log `cupRoundResults a aguardar dreno` com o motivo (idle/halftime/ação/minuto).
- F3 (`GameContext.jsx`): os 4 ramos de fim de jogo (live/replay × 90'/120') colapsam num `finishClock` único; tempos intactos (2 s aos 120', 3 s aos 90'), ordem de setters intacta, acks continuam no-ops intencionais.
- Checks: `eslint` só o erro pré-existente `react-refresh` · `check:types` OK · sem lógica de jogo/layout → sem audits/mobile.

## Estabilização da Taça F0 — instrumentação das transições (2026-10-02)
- Plano aprovado: estabilizar sorteio→jogo→ET→penáltis→resultados→Jornal. F0 primeiro (só logs, zero lógica), fixes (F1–F5) só após ensaio com evidência.
- Cliente (`utils/cupFlowLog.js` novo, `[CUPFLOW +ms]`): `cupDrawStart` recebido/pendente/aberto, `cupExtraTimeStart` (espectador ou não), `cupRoundResults` recebido + drenado, relógio parado nos 90'/120' (live vs replay), landing → Jornal.
- Servidor (`cupFlowHelpers.ts`): gate de animação do ET regista resolução por acks (ms + nº treinadores) vs timeout integral; `cupRoundResults` regista ronda/ET/nº resultados.
- Checks: server `typecheck` OK · `audit:socketio` 0 erros (101 warnings, sem emits/handlers novos — pré-existentes) · client `eslint` só o erro pré-existente `react-refresh` no `GameContext.jsx` (prova: HEAD já exporta 3 símbolos; diff só adiciona linhas) · `check:types` OK · sem lógica/layout → sem `test:mobile`, sem `audit:gamestate` (sem sala viva; fica para o ensaio).
- Incidente git: `git stash push -- <path> -m ...` comeu as flags como pathspec e o `pop` a seguir aplicou um stash antigo sobre a árvore (conflitos em .db binários). Resolvido a favor da árvore (saves locais de dev; produção no rick intacta). Lição: nunca `stash` para prova de pré-existência — usar `git show HEAD:<path>` + `git diff` em vez disso. Stack de stashes antigas deixada intacta.
- Próximo passo: ensaio com sala viva (pedir roomCode + ronda + nº humanos) e cruzar `[CUPFLOW]` do browser com logs do servidor antes de fixar (F1–F5).

## Espectador vê o prolongamento alheio em ritmo de gala (2026-10-02)
- Pedido: após o jogo da Taça decidido aos 90', o observador ficava a olhar para o minuto 90 durante ~48 s+ (ET escondido de outro jogo + gate de animação em timeout integral) — queria-se ver o ET sem humanos com o relógio acelerado, como no B016.
- Servidor (`server/game/engine.ts`, `simulateExtraTime`): ET só-NPC com humanos ligados passa de 100 ms/min para o ritmo de gala (`CUP_FINAL_SPECTATOR_MS_PER_MINUTE`, 500 ms → ~15 s de ET); 100 ms só quando ninguém está a ver. Tempo real com humano em campo, inalterado.
- Cliente (`client/src/hooks/socket/cup.js`, `cupExtraTimeStart`): quem não está em `drawnTeamIds` segue como espectador (`isCupExtraTime` + badge, relógio 90→120, `isPlayingMatch`, limpa `waitingForResults` da corrida dos 3 s) em vez de `return`. Sidebar «Outros jogos» atualiza em direto; hero do jogo decidido já se escondia sozinho; aos 120' o `cupExtraTimeDone` resolve o gate sem timeout. Sem popup de penáltis para espectadores (só resultado).
- Checks: server `typecheck` OK · `audit:socketio` 0 erros · client `eslint` limpo no ficheiro (3 erros + 1 warning pré-existentes noutros) · `check:types` OK · só fluxo de estado/badge existente → sem `test:mobile`.

## Adjunto fala JJ meme total (2026-10-01)
- Pedido: Treinador-adjunto passa a falar na linguagem meme do Jorge Jesus, intensidade meme total, textos + CTAs + alcunha.
- 7 dicas reescritas em `useAssistantCoach.js` (6) + `trainingCapAdvice.js` (1, mantém interpolação do foco); etiqueta `Treinador-adjunto` → `O Mister` (cabeçalho + aria-labels) em `AssistantCoach.jsx`. Só strings, zero lógica/tabs/keys.
- Checks: `eslint` limpo nos 3 ficheiros · `check:types` OK · só texto → sem `test:mobile`; audits saltam (sem lógica de jogo/sockets).

## Deploy v26.10.5 no rick (2026-10-01)
- Tag `v26.10.5` (bump de `APP_VERSION` em `client/src/constants/index.js`); rebuild com `backend Healthy`.
- Inclui: adjunto JJ de braços cruzados (`mister.webp` servido, bundle novo a referenciá-lo).
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Adjunto passa a JJ de braços cruzados (2026-10-01)
- O retrato vetorizado confundia-se com o antigo; o adjunto passa a ser o JJ de braços cruzados (imagem do utilizador).
- Recorte `rembg` (estádio + assinatura `.acho` fora), enquadramento cabeça+ombros, `mister.webp` 512px/52 KB com alfa; SVG seria MBs, ficou raster. `assistant.svg` (206 KB) apagado.
- Checks: `eslint` + `check:types` OK · confirmação visual do medalhão · sem mudança de layout → sem `test:mobile`.

## Deploy v26.10.4 no rick (2026-10-01)
- Tag `v26.10.4` (bump de `APP_VERSION` em `client/src/constants/index.js`); rebuild com `backend Healthy`.
- Inclui: tutorial ensinado pelo adjunto + retrato do adjunto em SVG sem fundo.
- Salas de produção intactas; seed só recria `base.db` se o esquema/fixtures mudarem.

## Retrato do adjunto vetorizado sem fundo (2026-10-01)
- Pedido: retirar a relva do `assistant.webp` e passar a SVG; escolhido o SVG fiel de 16 cores (206 KB).
- Recorte por matiz verde (`PIL/numpy`, cantinho branco do topo incluído) sobre o disco; `vtracer` segfaulta neste ambiente, venci com `imagetracerjs` (12→44 KB preterido, 16 cores vence). SVG só com paths preenchidos, sem `clipPath`/máscaras.
- `AssistantCoach.jsx` (e o tutorial via `AssistantMascot`) passam a `/coaches/assistant.svg`; `.webp` apagado. Fundo do SVG é o verde-escuro do disco — funde-se com o medalhão.
- Checks: `eslint` + `check:types` OK · confirmação visual do medalhão · sem mudança de layout → sem `test:mobile`.

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
