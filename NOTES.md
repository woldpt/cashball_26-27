## Limite de plantel nos leilões dos NPC (2026-10-10)
- NPC com 24 ou mais jogadores deixa de licitar em leilões (`NPC_MAX_SQUAD`, o mesmo limite que já havia na lista de transferências).
- Porquê: os excedentes das divisões de cima acabavam nos leilões das de baixo, sem limite — plantéis de 33 na 5.ª e 30 na 4.ª.
- Medido (`sim:seasons`, 2 salas × 6 épocas): plantel máximo da 5.ª 33 → 24,5 e da 4.ª 30 → 24,5; leilões com venda 483 → 215 (os outros fecham desertos e o jogador fica no clube); nenhuma posição em falta; clubes no vermelho e dinheiro em jogo iguais.
- Por ver: a qualidade da 5.ª continua a cair (12 → 5,5 em 6 épocas) — não treinam (excluídos do treino automático) e sofrem o decaimento de fim de época. Quem sobe da 5.ª chega à 4.ª (qualidade 15) muito abaixo.
- Testado: typecheck, npc-bid-window, finance-guards, connect-smoke, npc-squad-planning. Sem teste próprio (é uma guarda de uma linha; a prova é a medição).

## Academia dos NPC removida: base de jogadores fixa (2026-10-10)
- `processNpcInvestment` já não cria jogadores: acima dos 10M€ o excedente vai para obra (se houver adeptos) ou infraestruturas (500 mil/semana, `NPC_INFRA_COST`). Os prospetos já criados nas salas existentes ficam.
- Porquê: regra do jogo — base de dados de jogadores fixa e eterna, ninguém entra e ninguém sai. A academia entrou a 2026-09-11 (`1c8f9770`) como forma de gastar dinheiro e era o único sítio que criava jogadores (75 em 6 épocas, a acelerar).
- Medido (`sim:seasons`, 2 salas × 6 épocas): jogadores 1097 em todas as épocas (antes 1189); nenhuma posição em falta; 1.ª divisão com teto ~10,5M. Dinheiro em jogo 213M (antes 169M): as divisões de baixo ficam mais ricas porque deixam de pagar à 1.ª pelos jovens.
- Por ver: a 5.ª divisão continua a inchar (26 de média, máx. 33) e a perder qualidade (12 → 7) mesmo sem academia — as de cima vendem excedentes para baixo e nos leilões os NPC licitam sem limite de plantel.
- Testado: typecheck, finance-guards (F7: nenhum jogador novo), connect-smoke, contractrenewal, npc-squad-planning.

## Dinheiro parado nos NPC ricos (2026-10-10)
- NPC acima dos 10M€ com o plantel cheio (26) e o estádio à medida dos adeptos passa a pôr 500 mil/semana em infraestruturas (sai do jogo). Antes ficava bloqueado: nem obra, nem academia, nem compras (plantel ≥ 24 não compra).
- Diagnóstico corrigido: o dinheiro não duplica sempre — sobe 19%, 12%, 7%, 4% e estabiliza perto dos 205M; o salto da época 2 é o patrocínio da 1.ª época pago no fim. O que crescia sem parar eram os grandes da 1.ª (até 19M).
- Medido (`sim:seasons`, 2 salas × 6 épocas): máximo da 1.ª 18,9 → 10,8M; média da 1.ª 12,0 → 9,2M; dinheiro em jogo estabiliza em ~170M (antes 203M e a subir); 2.ª–4.ª iguais.
- Rejeitado por medição: agentes a farejar riqueza nos NPC e teto da folha com 85% da bilheteira (ordenados sobem, nível de dinheiro igual); limiar de investimento por divisão (1.ª a 5M) — afunda a 2.ª–5.ª (14 clubes no vermelho na época 6): o excedente da 1.ª é o que financia as de baixo pelas compras. Não baixar esse limiar sem medir.
- Testado: typecheck, finance-guards (F7 novo), connect-smoke, contractrenewal, npc-squad-planning, staff.

## Motor: golos por jogo de volta aos 2,5 (2026-10-10)
- `chancesTotal` 30,7 → 22,6 (oportunidades por jogo; a conversão não mexe).
- Porquê: o simulador de épocas mostrou 3,3 golos por jogo nas ligas a sério (3,0 antes da nova escolha de onze dos NPC). A calibração sintética dava 2,5 porque só joga 4-4-2 iguais em equilibrado; formações de ataque, mudanças de estilo, auto-golos (0,26/jogo) e penáltis (0,12) somam por cima.
- Medido (`sim:seasons`, 3 salas × 3 épocas): 3,31 → 2,47 (1.ª 2,46 · 2.ª 2,41 · 3.ª 2,67 · 4.ª 2,34). Ligas ~2 pontos mais niveladas (1.ª: campeão 38,7 → 36,4, último 9,1 → 11,8). A calibração sintética passa a dar ~1,9 — a referência dos 2,5 mede-se agora no simulador.
- Testado: typecheck, test:engine-unit (47/47), own-goal, penalty-ordering, substitutions, segment-barrier, ratings, attendance; sem salas presas nem erros do servidor.

## Simulador de épocas (2026-10-10)
- `cd server && npm run sim:seasons -- --seasons 3 --runs 3` corre o jogo real só com NPC, ~15 s por época: servidor no mesmo processo (`simBridge` no `index.ts`) + relógio virtual (`scripts/lib/virtualClock.ts`) que dispara os temporizadores quando a BD está parada. Relatório por divisão, salas presas, erros do servidor e `audit:gamestate`; `--json` para comparar antes/depois.
- No jogo: `simLobbyHoldMs` em `checkAllReady` (nunca definido em produção) — sem humanos a sala salta de jornada em jornada e os leilões nunca saíam da pausa.
- Limites: sem humanos (bilhete, empréstimos, táticas humanas por exercitar); a semente fixa o ponto de partida mas o desenrolar varia ~5% (comparar médias de 3+ salas).
- 1.ª leitura (3 salas × 3 épocas, jogo de manhã vs agora): clubes no vermelho 3,3 → 0; clubes com posição em falta 9 → 0; lotação média da 1.ª na época 3 49 700 → 32 300; equipas em 4-2-4 19 → 11. Por ver: golos por jogo 3,0 → 3,4 na 1.ª (calibração do motor aponta 2,5); o dinheiro em jogo duplica em 3 épocas (75 → 160 M) com ou sem as correções; homónimos no mesmo plantel via mercado.
- Testado: typecheck, todos os `test:*` do servidor, crash-recovery (B8N0ZH), finalize E2E no servidor real.

## Correções à economia (2026-10-10)
- NPC não compram acima de 1,4× o valor; bilhete: 3% de adeptos por euro acima dos 15 € (piso 50%); melhor marcador por divisão (500/250/125/60 mil); NPC só constrói com massa adepta > lotação; teto da folha NPC soma metade da bilheteira semanal (`npcFolhaCeiling`). Plano: `docs/plans/2026-10-10-economia-correcoes.md`.
- Porquê: auditoria deu 4/10 — um humano vendia a NPC a 5× o valor (8 NPC compravam um jogador de 156 mil a 780 mil), 30 € rendia +58% sem custo, e todos os clubes lucravam sempre.
- Medido: acima de 1,4× zero NPC compram; a 30 € vão 55% dos adeptos (receita +10%); teto da 1.ª 152 → ~215 mil/semana. Efeito em várias épocas só projetado (sem simulador nem sala de produção).
- Testado: typecheck, todos os `test:*` do servidor (npc-squad-planning 15, attendance, topscorer, finance-guards com F6 ajustado ao custo com ordenados), audit:socketio e audit:gamestate B8N0ZH (0 erros).
- Fechado depois: teto de 1,4× também nos lances de leilão (`npcAuctionMaxBid`; antes 2,5× na entrada e sem teto no contra-lance); `test:segment-barrier` B5 contava a troca de capitão como mudança de tática (teste ajustado, jogo certo); `test:crash-recovery` (B8N0ZH) passa.
- Por fechar: medir a economia em várias épocas (não há simulador; o relógio mais rápido dá ~40 min reais por época).

## NPC a gerir como diretor desportivo (2026-10-10)
- Compras pela posição em falta e com o ordenado na conta; vendas só de quem sobra (titulares protegidos, sobrepreço a quem tem mercado, venda de oportunidade 5%/semana); renovação segura quem faz falta; onze por qualidade × forma e formação pelos melhores 11. `npcSquadPlanning.ts` (puro) + `pickAiLineup` em `matchCalculations.ts`. Plano: `docs/plans/2026-10-10-npc-gestao-desportiva.md`.
- Porquê: auditoria deu 3/10 a compras e vendas e 5/10 ao onze (16 de 50 equipas em 4-2-4).
- Medido (onze novo vs antigo, 180 mil jogos simplificados): 1,386 vs 1,362 pts/jogo; 4-2-4 desce de 16 para 11 equipas; NPC contra NPC sobe ~6% em golos. Mercado sem medição de épocas (não há simulador).
- Testado: typecheck, test:npc-squad-planning (12 novos), npc-bid-window, engine-unit (47/47), contractrenewal, contractyear, substitutions, connect-smoke, engineCalibration (2,52), audit:socketio e audit:gamestate B8N0ZH (0 erros).

## 4.ª divisão com estádios iguais (2026-10-10)
- Lotação de O Elvas, Oliv. Hospital, Malveira, Sintrense e Alcochetense → 5000 (`all_teams.json`); a massa adepta acompanha. Só salas novas. Plano: `docs/plans/2026-10-10-quarta-divisao-estadios-iguais.md`.
- Porquê: a bilheteira é proporcional à lotação útil e essas equipas (2500–3500) recebiam 50–70% das outras, com o mesmo plantel — sorte no sorteio de equipa dos humanos.
- Testado: seed, audit:gamestate base (`balanced_draw` exige agora lotação e massa adepta iguais; falha com os dados antigos, 0 erros com os novos), typecheck, connect-smoke, test:attendance.

## 4.ª divisão com baralho igual (2026-10-10)
- Seed: na 4.ª (`BALANCED_DRAW_DIVISIONS`), cada equipa recebe os mesmos valores de skill por posição, espalhados no intervalo; o sorteio só decide que jogador fica com qual (`dealBalancedSkills`). 5.ª igual a antes. Só salas novas. Plano: `docs/plans/2026-10-10-quarta-divisao-sorteio-justo.md`.
- Porquê: os humanos começam na 4.ª com equipa sorteada e o sorteio livre 5–15 dava onzes até 24% mais fortes.
- Medido: soma do melhor onze 135–136 em todas (5.ª, sorteio livre: 112–150); pontos médios por equipa 28–31 (antes 15–39). Efeito lateral: os valores vão de 6 a 14 (já não sai 5 nem 15).
- Testado: seed, audit:gamestate base (verificação nova `balanced_draw`, 0 erros), typecheck, connect-smoke, own-goal, penalty-ordering, segment-barrier.

## Plantéis iniciais por escalões (2026-10-10)
- `skillRange` próprio nas 36 equipas das 1.ª–3.ª divisões (`all_teams.json`), 4 escalões de 3 pela ordem do ficheiro; 4.ª e 5.ª iguais (os humanos começam na 4.ª com equipa sorteada). Só salas novas. Plano: `docs/plans/2026-10-10-ligas-menos-niveladas.md`.
- Porquê: todas as equipas de uma divisão sorteavam do mesmo intervalo e o título calhava a qualquer um.
- Medido (30 épocas, 22 jogos, campeão/último): 1.ª 41/20 → 44/16, 2.ª 41/19 → 43/16, 3.ª 40/20 → 45/17. Na 1.ª o escalão 1 bate no teto de 50, por isso os escalões 3 e 4 desceram (36–43 e 32–39; com 38–45 e 35–42 dava só 42/18).
- Por vigiar: folha salarial do escalão 1 da 1.ª cabe 15 vezes no orçamento (escalão 4: 23) — não testado ao longo de uma época. O escalão 4 da 1.ª (32–39) sobrepõe-se ao escalão 1 da 2.ª (31–37).
- Testado: seed, audit:gamestate base (0 erros), typecheck, connect-smoke, own-goal, penalty-ordering, segment-barrier.

## Motor: equilíbrio das formações (2026-10-10)
- `duelPossePerMed` 0.025 → 0.012: cada médio a mais vale metade da posse.
- Porquê: com equipas iguais a classificação das formações era a contagem de médios (3-5-2 ganhava a tudo, 4-2-4 perdia com tudo). Plano: `docs/plans/2026-10-10-equilibrio-formacoes.md`.
- Medido (todos contra todos, pts/jogo por formação): de 1,46–1,22 para 1,40–1,31; melhor tática 1,44, pior 1,26; golos/jogo 2,52.
- Testado: typecheck, test:engine-unit (47/47), engineCalibration, audit:gamestate B8N0ZH (0 erros).

## Motor: posse em percentagem (2026-10-10)
- `computePossession` conta a diferença entre médios em % da média dos dois (`posseRelative: 0.42`, substitui `possePerPoint`); o meio da escala (skill 30) fica igual.
- Porquê: em pontos, o mesmo desnível valia 1,4pp de posse a 10 de skill e 6,2pp a 44, e a Pressão Alta saía mais barata nas divisões de baixo. Plano: `docs/plans/2026-10-10-posse-em-percentagem.md`.
- Medido: Pressão Alta vs Média −0,03 pts/jogo em todas as divisões (antes +0,10 a −0,13); ligas iniciais iguais, só a 4.ª menos nivelada (campeão 41→43, último 20→17); golos/jogo 2,52.
- Testado: typecheck, test:engine-unit (47/47, U42 novo), engineCalibration, audit:socketio (0 erros), audit:gamestate B8N0ZH (0 erros).

## Motor: contra-ataque e cansaço proporcional (2026-10-10)
- Defensivo finaliza melhor contra Ofensivo (+25%) e contra Pressão Alta (+10%) — `counterAttackConvMult`; metade desses golos tem narração de contra-ataque. Cansaço: cada golpe tira 4% da skill base (antes −1 fixo), ×1,3 com Pressão Alta; por dentro tem decimais, arredonda-se só ao enviar ao cliente. Lesões e trocas NPC ao intervalo usam `fatiguePoints(p)`.
- Porquê: Ofensivo + Pressão Alta ganhava a tudo e defender nunca compensava. Plano: `docs/plans/2026-10-10-contra-ataque-cansaco-proporcional.md`.
- Medido (todos contra todos, pts/jogo): estilos 1,29/1,36/1,43 → 1,37/1,35/1,36; Defensivo vs Ofensivo −0,25 → +0,09 a +0,15; Pressão Alta vs Média +0,15 → −0,13 (skill 44), mas ainda +0,10 em skill 10 (a posse conta médios em pontos, não em % — por fazer). Golos/jogo 2,53 na calibração.
- Testado: typecheck, test:engine-unit (46/46, U40/U41 novos), substitutions, emergency-gk, own-goal, penalty-ordering, engineCalibration, audit:socketio (0 erros), audit:gamestate B8N0ZH (0 erros).

## Deploy v26.10.47 no rick (2026-10-10)
- Bump `31869844`, tag `v26.10.47`: treinadores — aviso por má série, escolha de clube após despedimento (3 opções) e convite com vitórias recentes.
- Push `c27c6180..31869844`; tag publicada.
- Rick: `git pull` + rebuild; backend Healthy.

## Deploy v26.10.49 no rick (2026-10-10)
- Bump `ea37199a`, tag `v26.10.49`: NPC com critério — compram pela posição em falta, vendem quem sobra e escolhem o onze pela forma.
- Push `93ce106f..ea37199a` (6 commits); tag publicada.
- Rick: `git pull` + rebuild; backend Healthy.

## Deploy v26.10.48 no rick (2026-10-10)
- Bump `93ce106f`, tag `v26.10.48`: equilíbrio de jogo — contra-ataque defensivo, posse pela diferença de médios, ligas menos niveladas e 4.ª divisão com estádios e sorteio justos.
- Push `31869844..93ce106f` (14 commits); tag publicada.
- Rick: `git pull` + rebuild; backend Healthy.

## Escolha de clube: poda das opções ocupadas (2026-10-10)
Quando um humano fica com um clube, sai das opções dos outros despedidos (que recebem a lista nova); lista vazia ⇒ novo sorteio de 3 (antes ficavam sem clube e sem opções). `pruneDismissalOptions` em `assignCoachToTeam`.
Testado: typecheck, test:coach-dismissal-league (cenário H novo), test:session-freeze, audit:socketio.

## Treinadores: aviso por má série, escolha de clube e motivo do convite (2026-10-10)
- Despedimento por resultados avisa antes (3 derrotas e 4, no Jornal e por mensagem). O treinador despedido escolhe entre 3 clubes e fica sem clube até escolher. O convite diz as vitórias dos últimos 5 jogos. Plano: `docs/plans/2026-10-10-treinadores-avisos-escolha-convite.md`.
- Porquê: pedido do utilizador (melhorias 1, 4 e 5 da avaliação das regras de treinadores).
- Testado: server typecheck, connect-smoke, session-freeze (17/17), audit:socketio (0 erros), test:coach-dismissal-league (F/G novos), test:relegation-coach; client lint, check:types, test:postmatchflow, test:inboxreads, test:mobile (195/195 + harness `dismissal-resp-test`).
- Já falhava antes, não tocado: `test:journaldb` (renovação → club; duas equipas na media).

## Deploy v26.10.46 no rick (2026-10-10)
- Commit `b68d9659` + bump `c27c6180`, tag `v26.10.46`: botão Continuar da barra mobile sem corte (etiqueta 8px, sem tracking extra).
- Push `6b81e737..c27c6180`; tag publicada.
- Rick: `git pull` + rebuild; backend Healthy.

## Botão Continuar cortado na barra mobile (2026-10-10)
- "CONTINUAR" (9px + `tracking-wider`) era mais largo que o círculo de 56px do `PlayButton` e o `overflow-hidden` cortava o R.
- Fix: etiqueta a 8px `tracking-normal` (`MobileNav.jsx`).
- Testado: lint + check:types.

## Deploy v26.10.45 no rick (2026-10-10)
- Commits `2640763a`, `60c5c5ce`, `07033e63` + bump `6b81e737`, tag `v26.10.45`: seletor de capitão com dropdown próprio, leilões de venda forçada com clube e estatísticas completas, rescaldo do jornal na semana a seguir ao jogo.
- Push `119f9c04..6b81e737`; tag publicada.
- Rick: `git pull` + rebuild; backend Healthy.

## Tática: seletor de capitão sem menu nativo (2026-10-10)
- Capitão deixou de ser o `<select>` nativo (lista desenhada pelo sistema, seta do navegador, nomes cortados): pílula + cartão próprio no estilo do `StatusPicker`, fecha com clique fora/Esc. Fundo `bg-bg` por baixo (`surface-container` tem 10% de transparência e deixava ver as linhas do plantel).
- Coluna «Titulares» de `overflow-hidden` para `overflow-visible`: com menos de 11 titulares a lista era cortada e as últimas opções não se clicavam (medido com 7 titulares). Deve deixar de cortar também os pop-ups de estado das últimas linhas (não testado).
- Testado: lint, check:types, `test:mobile` (5 larguras PASS); capturas 390/1440 com a lista aberta e a escolha; clique na última opção com 7 titulares (antes não, agora sim).

## Leilões de cortes forçados: «Sem clube» e venda que falhava (2026-10-10)
- `forceNpcWageCut` (`contractHelpers.ts`) lia o jogador sem `team_id` nem nome do clube: o leilão mostrava «Sem clube» e, se alguém ganhasse, a venda falhava (`auctionHelpers.ts`, `team_id IS ?`) e o jogador ficava no clube. Agora lê `p.*` + `t.name`, como `processContractExpiries`; o preço inicial passa a usar o valor real (antes caía no proxy `skill*20000`).
- Porquê: pedido do utilizador — cartões de leilão com «Sem clube» nos cortes de custos de clubes NPC.
- Testado: typecheck, `test:contractrenewal`, `test:contractyear`, `audit:gamestate` numa sala local (0 erros); SQL antigo vs novo numa sala local (22 jogadores; antes sem `team_id`/`team_name`/`value`). Não visto num leilão real — falta confirmar.

## Jornal: notícias depois do apito saem na semana seguinte (2026-10-10)
- Após o apito final, toda a notícia grava a semana seguinte: `newsSlotFor` (`coreHelpers.ts`) usa `game._whistleSlot`, fixado no FULL TIME e limpo no jogo seguinte, no prolongamento e ao voltar ao lobby. Rescaldo continua a guardar a jogada e o ecrã soma 1. Plano em `docs/plans/2026-10-10-noticias-depois-do-apito.md`.
- Época tem 25 semanas (não 20): a correção de ontem no rescaldo tinha o corte errado; agora `formatSeasonWeek` usa `SEASON_WEEKS`. Lesões guardam `played` na descrição para a contagem não mudar; histórico já gravado fica como está.
- Testado: `test:newsslot` (N6 novo), `test:crash-recovery`, `test:progress-news`, `audit:gamestate` numa sala local (0 erros), typecheck, lint, check:types, datas e contagem de semanas via script. Falta ver numa finalização de época real.

## Deploy v26.10.44 no rick (2026-10-10)
- Commit `119f9c04` com a tag `v26.10.44`: piso de compra NPC pela divisão e renovação de contratos NPC (menos leilões em massa). Backend Healthy.

## NPC: piso de compra pela divisão e menos leilões (2026-10-10)
- Compras NPC (leilão e lista): piso = máx(nível próprio, nível da divisão) − 10 (`getDivisionLevels`, `npcTransferHelpers.ts`). Contratos NPC que acabam: renova quem for bom e couber no orçamento, sem exigir posição curta (`contractHelpers.ts`) — antes quase todos iam a leilão em massa.
- Porquê: sala PYG2GT — Vit. Setúbal comprou 16 jogadores de média 20 (divisão 32); 58 leilões numa jornada.
- Testado: typecheck, test:contractrenewal, test:contractyear, test:npc-bid-window; SQL do nível validado numa cópia da sala (div. 2 = 34,8). Não visto numa época completa — falta confirmar.

## Ecrã de terceiros fecha no intervalo e no fim (2026-10-10)
- O ecrã de um jogo que não é o nosso (`showMatchDetail`) ficava aberto no fim do jogo e reaparecia na 2.ª parte. Agora fecha em `halfTimeResults`, `matchResults`, `cupHalfTimeResults`, `cupETHalfTime` e `cupRoundResults`; `LiveView` não abre jogos durante o intervalo.
- Porquê: pedido do utilizador — o relógio pode continuar, mas o ecrã não deve ficar ativo depois de o jogo parar. Os dois setters faltavam em `useSocketListeners` (`GameContext.jsx`).
- Testado: client lint e check:types (saída 0). Não visto numa partida real — falta confirmar.

## Táctica: sem o duelo no cartão da Formação (2026-10-10)
- Tirados o «Duelo com o … provável» e os quadradinhos Meio/Ataque/Defesa/Capitão do cartão Formação (`TacticsView.jsx`, `DuelStrip`). O `probableFormation` do servidor fica como está.
- Porquê: pedido do utilizador — informação repetida que não queria no cartão.
- Testado: lint e check:types; test:mobile `tactics-resp-test` 5/5 (320–430 px); captura 390 vista.

## Deploy v26.10.43 no rick (2026-10-10)
- Commit `10dde42c` com a tag `v26.10.43`: barra CM só no Jornal em ciclo, painéis do Jornal livres da barra, adjunto com 10 s pós-jogo. Backend Healthy.

## Notícias CM só no Jornal, em ciclo; adjunto com 10 s pós-jogo (2026-10-10)
- Faixa CM só é renderizada no separador Jornal (`GameLayout`), só aparece com notícias, repete todas em ciclo contínuo e deixou de navegar ao clicar. Movimento reduzido: uma notícia de cada vez. Painéis do Jornal descontam a altura da faixa (`.journal-panel` + `.game-shell:has(.cm-ticker)` em `index.css`). Silêncio do adjunto pós-jogo 45 s → 10 s (`POST_MATCH_QUIET_MS`).
- Porquê: a faixa só faz sentido no Jornal; antes o leitor do Jornal descia por trás dela (reproduzido no harness a 1280 px).
- Testado: lint, check:types, test:mobile 195/195 (concorrência 6; com 20 em paralelo os checks de tempo do `journal-resp-test` falham por carga), `journal-resp-test` com a faixa e o check `barClearance` (1024/1280/1440 PASS; FAIL antes do fix). Capturas 390 e 1280 vistas.
