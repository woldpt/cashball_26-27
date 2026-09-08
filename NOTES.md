# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Em curso

- (nada)

## Tutorial de Coach (novo)

- Tour guiado em 8 balões spotlight (Clube → Plantel → Treino → Finanças → Mercado → 11 → Confirmar → Simulação); arranca ao fechar o WelcomeModal de conta nova, 1x por treinador+sala (localStorage), com Saltar e "Rever tutorial" no Clube.
- Ficheiros novos: `client/src/components/tutorial/{CoachTutorial.jsx,coachTutorialSteps.js}`, `client/src/hooks/useCoachTutorial.js`; âncoras `data-tour` em GameLayout/TacticsView.
- Checks: lint + check:types OK; landscape PASS 168/168; portrait só falha pré-existente `transfer-resp-test` 320 (falha igual sem estas alterações). `client/transform-fixed-test.html` é órfão (sem .jsx) e ficou fora do commit.

## Último estado

- **CupUpsetModal sequenciado com PostMatchMoodModal:** sem auto-fecho (só botão "Continuar"); a revelação agora aguarda `postMatchMood === null` (gate nas deps do effect, timer de 250 ms rearmado) — modais já não sobrepõem. Se o jogo do utilizador não foi dessa ronda (sem mood modal), a surpresa revela diretamente.
- **Mentalidade alterável a meio do jogo:** o engine já adotava `setTactic` ao vivo (`applyLiveTacticAdoption` em `engine.ts`, efeito no minuto seguinte + evento `tactic_change` na cronologia) — a restrição era só UI. `IntervencaoView.jsx`: `MentalidadeColumn` (desktop) já sem gate de `isHalftime`; mobile vertical mostra o bloco recolhível também em modo `action`; landscape phone ganhou o chip "Mentalidade" na barra minimalista do topo (abre a linha de botões de estilo). Mobile-resp-check: portrait + landscape PASS (harness `intervencao-test`).
- **Penalti falhado na vista ao vivo:** o engine já emite `penalty_miss` (e a timeline/narração já o tratavam), mas a lista de eventos das colunas por equipa no `LiveMatchHero` filtrava-o fora. Adicionado `"penalty_miss"` aos filtros `homeEvents`/`awayEvents` + cor âmbar em `TeamEvents` + ícone `❌` em `matchEventIcon` (`liveHelpers.js`).
- **Compra de NPCs no Mercado (lote semanal):** `processNpcTransferActivity` (`server/npcTransferHelpers.ts`) só comprava com probabilidades baixas (40% por equipa / 55% por jogador) e tecto de 55% do orçamento — parecia que os NPCs só compravam em leilões (que são reativos). Ajustado para 65% / 75% e tecto de 70%.
- Nota: o Mercado só tem oferta via listagens "fixed" (humanos) ou excedentes listados pelos próprios NPCs; nas salas ativas o mercado estava vazio (`transfer_status='none'` em todos).

## Próximos passos

- Push de `d0c24d2` (crest nos icones + nomes legíveis no popup do sorteio da Taça) — só com pedido explícito do utilizador.
