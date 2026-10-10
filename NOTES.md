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

## Briefing sem espaços vazios (2026-10-10)
- Duelo em largura total, "Prepara a estratégia" virou faixa fina (`PrepCtaCard`), 3 colunas à mesma altura (ameaças esticam, "último confronto/ambiente" colados à base do radar). `briefing-resp-test.jsx` tem cópia da grelha — mantê-la em sincronia.
- Testado: lint, check:types, test:mobile 195/195; screenshot 1360 visto.

## Capitães: liderança relativa, nos maus momentos (2026-10-10)
- Liderança 1–5 calculada (idade, jogos, estatuto, moral — `leadershipOf`); capitão = escolha do treinador (`tactic.captainId`, gravado no assento) ou o maior líder; a braçadeira passa sozinha quando ele sai. Só a DIFERENÇA entre capitães conta: quem sofre golo com melhor líder encurta e enfraquece o ímpeto do adversário (3–13', base 8'). Cliente: seletor na Tática, "C" no campo/intervalo, 4.º cartão no duelo; `utils/leadership.js` ESPELHA o servidor.
- Corrigido de passagem: o duelo da Tática nunca aparecia em produção (`probableFormation` é objeto, o harness usava string).
- Testado: engine-unit 44 (U34–U36), simulação 8000 jogos (5★ vs 1★ = ±1,4 pp; golos 2,48), typecheck, regressões do motor, connect-smoke, session-freeze, crash-recovery, audits; client lint/check:types, test:leadership, test:livehelpers, test:mobile 195/195.

## Familiaridade táctica: estrelas ao abrir Táticas (2026-10-10)
- Estrelas vazias: o cliente só pedia `requestAllTacticFamiliarity` no botão JOGAR; abrir Táticas pelo menu, sidebar ou reload nunca pedia. Agora `GameContext.jsx` pede ao abrir o separador (com `teamInfo` carregado). Pós-jogo sem gatilho próprio: o `matchResults` já muda para "Ao Vivo".
- Testado: client lint + check:types (0 erros). Não visto no ecrã — falta ver as estrelas num jogo real.

## Ímpeto visível, remates ao intervalo e leitura do jogo (2026-10-10)
- Live: chip "🔥 <equipa> por cima · mais N'" durante os 8' a seguir a um golo (espelha `momentumMinutes`; `liveMomentum` em `liveHelpers.js`, sem mexer no servidor). Pós-jogo: cartão "Leitura do jogo" (`matchVerdict`: expulsão cedo, golos esperados vs resultado, golo no embalo).
- Intervalo: linha "Remates · Golos esp." (`ShotLine`) no bloco da posse (desktop) e sob "Intervalo" (telemóvel); coluna da Tática com `[&>*]:shrink-0` para o bloco não ser cortado.
- Testado: test:livehelpers (casos novos), lint, check:types, test:mobile 195/195; screenshots livehero 360 e intervalo 1280.

## Tática e intervalo com cara de quadro tático (2026-10-10)
- Botões de mentalidade/pressão/conversa: barra segmentada acesa (telemóvel/Tática) ou cartões com ícone e efeito (intervalo desktop e Tática desktop); posse em destaque com emblemas e %; ordens como frase de pílulas que mudam ao toque (sem selects); duelo em 3 mini-cartões com selo (Ganhas/Em risco…). Tática mobile: Moral → Formação+duelo → Instruções → Ordens. `STYLE_OPTIONS` passou para `constants/index.js`.
- Testado: client lint + check:types, test:mobile 195/195 (concorrência 6), test:tacticpositions, test:briefing; screenshots 360/1280/1440 da Tática e do intervalo vistos.
- Tática desktop: Moral passou para cima da Formação (coluna 1); coluna do meio só "Instruções" com os cartões a encher a altura; grelha de formações `flex-1 auto-rows-fr` — sem vazios entre colunas.

## Deploy v26.10.42 no rick (2026-10-10)
- Tática desktop equilibrada (Moral sobre a Formação, sem vazios). Backend Healthy.

## Deploy v26.10.41 no rick (2026-10-10)
- Ímpeto visível no Live, remates/golos esperados no intervalo e "Leitura do jogo" no fim. Backend Healthy.

## Deploy v26.10.40 no rick (2026-10-10)
Push, tag e rebuild feitos; backend Healthy.
Inclui o commit de táticas do intervalo (3.ª coluna) e o registo do deploy anterior.

## Deploy v26.10.39 no rick (2026-10-10)
Push, tag e rebuild feitos; backend Healthy.
Inclui o commit de táticas do intervalo de outra sessão (em curso nesta árvore); o bump de `APP_VERSION` ficou incluído nesse commit, sem commit próprio.

## Intervalo (desktop): 3.ª coluna passa a Tática (2026-10-10)
- Saiu o relvado da 3.ª coluna: agora tem posse de bola, Mentalidade/Pressão/Conversa e "Ordens para o jogo" (editáveis). A 2.ª coluna ficou só com a lista de suplentes. `OrdersCard` passou a componente partilhado (`components/shared/OrdersCard.jsx`) usado pela Tática e pelo intervalo. Botão "Equilibrado" passou a "Neutro" (igual à Tática; cortava a 1280px).
- Testado: client lint + check:types, test:mobile 195/195 (concorrência 6 — com 20 a máquina carregada dava timeouts), screenshots 1280/1440 vistos, test:substitutions, test:emergency-gk.

## Deploy v26.10.38 no rick (2026-10-10)
Push, tag e rebuild feitos; backend Healthy.
Inclui as Fases 1–3 do roadmap tático do motor (formação real, jogar com 10, xG, posse viva, ímpeto, NPCs que gerem o jogo, duelo, pressão, conversa ao intervalo, ordens).

## Motor: Fase 3 do roadmap tático (2026-10-10)
- Duelo de formações (linhas reais: médios a mais → posse; avançados vs sobra de defesas → finalização), pressão alta/média/baixa, conversa ao intervalo e até 2 ordens programadas (aplicadas pelo servidor só a humanos; evento `order` alinha a tática do cliente). UI: Tática (duelo, pressão, "Ordens para o jogo") e Intervenção (pressão + conversa só no intervalo).
- Testado: engine-unit 41/41 (U30–U33 falham no código da Fase 2), simulação 8000 jogos (2,52 golos/jogo), own-goal, penalty-ordering, emergency-gk, substitutions, segment-barrier, finalize, ratings, connect-smoke, session-freeze, crash-recovery (GRMTZM), audits 0 erros, typecheck; client lint + check:types + test:mobile 195/195 + screenshots 320/360/390/1440 vistos. Validação do setTactic sem teste automático.

## Motor: Fase 2 do roadmap tático (2026-10-10)
- Posse recalculada a cada minuto (estilo, médios, cansaço, jogadores a menos, ímpeto de quem marcou — 8' a ×1,15); NPCs mudam de estilo pelo resultado (46'/70') e fazem trocas (60'/75', guardam 1 para lesões); humanos nunca tocados.
- Testado: engine-unit 37/37 (U27–U29 falham no código da Fase 1), simulação 8000 jogos (2,50 golos/jogo), own-goal, penalty-ordering, emergency-gk, substitutions, segment-barrier, finalize, ratings, connect-smoke, audits 0 erros, typecheck.
- ✅ Resolvido (2026-10-10): o `test:crash-recovery` S1 "finanças exatas" falhava com B8N0ZH/HP9S2L porque a conta esperada do teste não incluía os salários dos funcionários (534 000 €/semana nessas salas) nem a prestação do patrocínio; o jogo estava certo. Teste corrigido (e escolha sorteada de patrocinador neutralizada no setup); passa com B8N0ZH, HP9S2L, GRMTZM e uma cópia com patrocínio semanal.

## Motor: Fase 1 do roadmap tático (2026-10-09)
- Formação contada no onze real; jogar com 10 custa (oportunidades/defesa); penáltis pelo domínio + GR conta; cartões pela agressividade; lesões pelo cansaço (+ erro: resistência testada num jogador e lesão noutro); golo possível no minuto após golo; `xg` por lance → "Remates"/"Golos esperados" no jogo ao vivo. Plano: `docs/plans/2026-10-09-roadmap-tatica-treinador-bancada.md`.
- Testado: engine-unit 34/34 (U21–U26 novos, falham no código antigo), simulação 8000 jogos (golos/jogo iguais 2,465), own-goal, penalty-ordering, emergency-gk, substitutions, crash-recovery, segment-barrier, finalize, ratings, connect-smoke, audit:socketio, audit:gamestate B8N0ZH (0 erros), typecheck; client lint + check:types + test:mobile (2 falhas intermitentes no cabeçalho/jornal, passam ao repetir). Visual das estatísticas por ver num jogo real.

## Deploy v26.10.37 no rick (2026-10-09)
Push, tag e rebuild feitos; backend Healthy.
Inclui os últimos commits do master (odds, PAUSA, jornal, amigáveis).

## Transição do PAUSA no marcador (2026-10-09)
- `LiveMatchHero.jsx`: ao passar o rato, o resultado esbate/encolhe e o "PAUSA" sobe com brilho (300ms; só esbater com movimento reduzido), em vez de trocar de repente.
- Testado: lint, check:types.

## Jornal: castigo duplicado e leitor com altura fixa (2026-10-09)
- Amarelo + vermelho do mesmo jogador na mesma semana davam 2 notícias (sala TVV6WB): `logMedicalNews` atualiza a linha existente para o castigo mais longo e o cliente (`newsRowsToItems`) mostra só o mais longo (limpa também as já duplicadas). Leitor do Jornal: sem rodapé Recente/Antiga/Ler próxima, cartão com altura da área livre e scroll interno (só desktop).
- Testado: server typecheck, client lint + check:types, test:mobile (195/195).

