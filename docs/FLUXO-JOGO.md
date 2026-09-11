# FLUXO-JOGO — ciclo liga · jornal · taça

> Mapa do ciclo de jogo ponta a ponta, atualizado para a época de 20 semanas
> (amigável de pré-época + relógio único em slots).
> Fontes: `server/gameConstants.ts` (`SEASON_CALENDAR`), `server/weeklyFlowHelpers.ts`
> (`checkAllReady`/`startWeekOnce`/`runMatchSegment`/`finalizeLeagueEvent`),
> `server/cupFlowHelpers.ts` (`startCupRound`/`finalizeCupRound`/`continueFromEtGate`/`applySeasonEnd`),
> `server/socketGameplayHandlers.ts` (`setReady`), `client/src/GameOverlays.jsx` (landing),
> `client/src/utils/postMatchFlow.js` (fila pós-jogo), `client/src/views/JournalTab.jsx`.
> Regra permanente: progresso da época = `game.calendarIndex`, nunca `matchweek`.

## 1. Calendário da época (20 semanas)

Amigável, liga e taça **nunca** correm em simultâneo — cada entrada é um evento jogável:

| Idx | Evento | Idx | Evento | Idx | Evento |
|-----|--------|-----|--------|-----|--------|
| 0 | **AMIGÁVEL pré-época** | 7 | L6 | 14 | L11 |
| 1 | L1 | 8 | **C2 oitavos** | 15 | **C4 meias** |
| 2 | L2 | 9 | L7 | 16 | L12 |
| 3 | L3 | 10 | L8 | 17 | L13 |
| 4 | **C1 16avos** | 11 | L9 | 18 | L14 |
| 5 | L4 | 12 | **C3 quartos** | 19 | **C5 final** |
| 6 | L5 | 13 | L10 | | |

`calendarIndex` 0–19 avança +1 por evento concluído; `matchweek` 1–14 só conta jornadas de liga. Fim (`calendarIndex >= 20`) → `applySeasonEnd` → nova época (`season++/year++`, `calendarIndex=0`, `matchweek=1`, sorteio invisível do amigável feito logo).

**Relógio único:** contratos (duração 20), castigos, lesões, cooldowns e `joined` vivem em **slots 1–20** (`(calendarIndex)+1`), não em jornadas da liga. Só rótulos ficam em `matchweek`: tabela `matches`, `last_auctioned_matchweek` (anti-releilão na mesma jornada) e histórico de táticas.

## 2. Máquina de fases

```
lobby
  │  (todos Pronto — checkAllReady)
  ▼
match_first_half  (min 1–45)
  │
  ▼
match_halftime  (espera Pronto, sem timer)
  │
  ▼
match_second_half  (min 46–90)
  │
  ├─ liga ──────────────────────────────► match_finalizing ─► lobby
  ├─ amigável ──────────────────────────► match_finalizing ─► lobby (sem ET)
  │
  └─ taça, empate aos 90' COM humano ──► match_et_gate (pausa p/ mexer)
  │                                          │
  │                                          ▼
  │                                     match_extra_time (90+30)
  │                                          │  (ainda empate → penáltis)
  │                                          ▼
  └─ taça, resto ──────────────────────► match_finalizing ─► lobby
```

Fases transitórias fazem reset para `lobby` no restart (anti-deadlock).

## 3. Lobby → apito inicial

1. Treinador afina tática (`TacticsView`, briefing usa as fixtures **já preparadas** — as mesmas que vão ser jogadas) e carrega **Pronto** (`setReady`).
2. `checkAllReady`: no lobby exige todos os coaches bloqueados online + ready; a meio do jogo basta os conectados.
3. `startWeekOnce`: pausa leilões → `phase=match_first_half` → finanças semanais idempotentes (`applied_weeks`) → fixtures (liga: reutiliza as do lobby; taça: sorteio `startCupRound`, com animação `cupDrawStart` exceto na final; amigável: sorteio invisível divs 1–5 feito no fim de época, sem animação).
4. Direto: `matchSegmentStart` + `matchMinuteUpdate` por minuto (1000 ms/min com humanos, 100 ms só-NPC, 500 ms final sem humanos).

## 4. Intervalo → 2.ª parte → fim

- `phase=match_halftime` + `halfTimeResults` (liga) / `cupHalfTimeResults` (taça); readies a zero; **sem temporizador** — o jogo espera pelo Pronto (taça sem humanos avança sozinha).
- `advanceFromHalftime` → `match_second_half`, min 46–90.
- Apito final → `phase=match_finalizing`:
  - **Liga**: transação atómica (classificações + bilheteira + marker `finalized`) → `matchResults` (+MOM) → `calendarIndex++/matchweek++` → lobby + `seasonState`. Se o próximo evento é taça, o **sorteio é feito já** para se ver o adversário no lobby.
  - **Amigável** (`finalizeFriendly`): empates ficam (sem ET), sem apurados; transação (golos + bilheteira **50/50** + `cup_matches` ronda 0 + marker) → `cupRoundResults` (ronda 0, "Amigável de pré-época") → lobby. No motor, o amigável não gera cartões nem lesões; treino e evolução como na taça (mas sem memória tática).
  - **Taça**: empate com humano → `match_et_gate` + `cupETHalfTime`; `continueFromEtGate` corre o ET (`cupExtraTimeStart`) e penáltis se preciso (`cupPenaltyShootout`); transação (`cup_matches` + bilheteira + MOM + notícia `cup_upset` nos tomba-gigantes) → `cupRoundResults` → lobby.

## 5. Pós-jogo no cliente (fila + landing)

Ordem rígida (`postMatchFlow.js`) — um modal de cada vez, o resto espera com dados guardados:

```
penáltis → mood → avisos/despedimento/propostas → fim de época (SEMPRE último)
```

`WaitingCoaches` só aparece com a fila drenada. Upset da taça **não** é modal — é notícia persistente com tira própria no Jornal.

Landing (`GameOverlays.jsx`): jogo terminado (`!isPlaying`, sem intervalo/ação, `liveMinute >= 90`) + jogo decorrido antes + **zero** modais pendentes (fila central + dialogs de agente, mercado de treinadores, celebrações, sorteio, suspense, histórico) + `activeTab === "live"` → `navigateTab("jornal")`, **uma vez** por partida (`league:época:jornada` ou `cup:época:ronda`). O `jornal` é também o tab por defeito (landing pós-login).

## 6. Jornal → lobby seguinte

O `JournalTab` mostra a jornada anterior: manchete do teu jogo (liga, ou taça se for o mais recente), resto da série, outros treinadores humanos, mini-classificação, artilheiros, mercado, bancadas (dados via `getGlobalNews`, onde o amigável vem como competição `Friendly`; refrescado por `globalNewsUpdated` após cada liga/taça/amigável/fim de época e transferências). Tira própria **Pré-época** (só antes da L1). Daqui voltas à tática para preparar o evento seguinte e carregar Pronto — o ciclo recomeça (§3).

## 7. Fim de época

`applySeasonEnd`: prémios (campeões, melhor marcador), patrocínios, `palmares`, subidas/descidas (despromovidos da div 4 caem para o pool invisível da div 5 — humanos são realocados), reset de stats, novos `fixtureSeeds`, `seasonEnd` (modal terminal, reload ao fechar).

## 8. Eventos socket por transição (legenda)

| Transição | Emits do servidor |
|-----------|-------------------|
| Entrada em semana de taça (lobby) | `cupDrawStart` |
| Início de parte | `matchSegmentStart`, depois `matchMinuteUpdate`/min |
| Intervalo | `halfTimeResults` / `cupHalfTimeResults` |
| Porta de ET | `cupETHalfTime` → `cupExtraTimeStart` → `extraTimeEnded` → `cupPenaltyShootout` (se preciso) |
| Fim (liga) | `matchResults`, `seasonState`, `teamsData`, `teamForms`, `topScorers`, `standingsUpdated`, `globalNewsUpdated`, `mySquad`, (`coachMarketReport` se houver) |
| Fim (amigável) | `cupRoundResults` (ronda 0), `seasonState`, `globalNewsUpdated` | 
| Fim (taça) | `cupRoundResults`, `seasonState`, `teamsData`, `globalNewsUpdated`, (`systemMessage` na final) |
| Fim de época | `seasonEnd`, `teamsData`, `topScorers`, `teamForms`, `seasonState`, `globalNewsUpdated` |

## 9. Pontos quentes (onde nascem incoerências)

1. Fixtures do briefing vs jogadas (stale após crash) — fonte única: `game.currentFixtures` preparadas no lobby.
2. Gate do lobby com coaches desligados (só lobby é estrito; intervalo/ET usam conectados).
3. ET gate só conta coaches dos empatados — resto assiste.
4. Landing antecipado — guards `hadMatchInProgress` + `liveMinute >= 90` + modais brutos.
5. `matchResults`/`cupRoundResults` stale a recriar o modal da prova anterior — chaves anti-repetição separadas por competição.
6. Replay pós-crash — markers `applied_weeks` (`weekly_finance`, `finalized`); `recoverFinalizedSlot` avança sem rejogar.
7. Migração v2 (salas de 19 semanas): `game_state.calendarVersion`; backup `.pre20`; `calendarIndex+1`, `applied_weeks` e `team_training` pendente deslocados na época atual; ronda de taça vista nunca é redesenhada (reconstrói da tabela); contratos da época em curso na escala velha (`contractCutoverSeason`) até ao fim da época.
