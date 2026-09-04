# Plano de Auditoria — `server/game/engine.ts`

> Gerado na auditoria do engine. Correções aplicadas sequencialmente, um commit por bug.
> Estado: `[ ]` pendente · `[x]` concluído e com commit.

## P0 — Correção / risco real

- [x] **#1 Shootout sem viés da casa** — `simulatePenaltyShootout` faz `homeGoals++` no failsafe de empate.
      Fix: coin-flip no failsafe.
- [x] **#2 Flush transacional pós-jogo** — `db.run` fire-and-forget de golos/cartões/lesões dentro do
      loop minuto-a-minuto. Fix: acumular deltas em memória, um flush transacional no fim.
- [ ] **#3 Separar `matchSkill` de `skill`** — a fadiga muta `player.skill` em memória (atributo
      persistente). Fix: campo separado de skill efetiva em jogo.
- [ ] **#4 Unificar semente do clima** — bloco `ws ^= ...` copiado em `generateIntroEvents`,
      `simulateMatchSegment` e `matchSummaryHelpers`. Fix: `getWeatherForFixture()` única.
- [ ] **#5 Cachear cálculo de força** — `getPower()` 90–120× por jogo. Fix: cache + invalidação por evento.
- [ ] **#6 ET sem overhead 30×** — `simulateExtraTime` chama `simulateMatchSegment` 30 vezes,
      reconstruindo plantéis/morale a cada minuto. Fix: segmento único 91–120.

## P1 — Manutenibilidade / testabilidade

- [ ] **#7 Helpers lineup/tática** — bloco splice + `lineupRef` + `tacticRef.positions` +
      `coachState.tactic` copiado ~6×. Fix: `removeFromPitch()` / `swapOnPitch()`.
- [ ] **#8 Centralizar tuning** — literais (`0.03`, `0.08`, `0.05`, `0.002`, `0.015`, `0.003`,
      `0.00816`, `0.00653`, fatores de morale) dispersos. Fix: `MATCH_TUNING` com taxas-alvo.
- [ ] **#9 RNG injetável** — `Math.random()` em ~30 sítios. Fix: `context.rng ?? Math.random`
      (seeded por `roomCode+calendarIndex` nos testes).
- [ ] **#10 Tipos em vez de `any`** — `Db`, `PlayerRow`, `MatchFixture`, `tactic: any`; `choice`
      objeto-vs-id inconsistente. Fix: tipar e uniformizar.
- [ ] **#11 Exports ESM puros** — `module.exports` + `import` misturados. Fix: só `export`.
- [ ] **#12 Evolução async/await** — `applyPostMatchQualityEvolution` com callbacks aninhados +
      contador `remaining`; `UPDATE teams SET morale` global sem await. Fix: async/await + batch.

## P2 — Balanceamento / UX / perf (após P0–P1)

- Janelas de 60s por evento (fila única / timeouts decrescentes).
- `getTeamSquad` auto-pick só por `skill` (unificar com critério posicional do `generateAITactic`).
- Comentário desatualizado em `generateFixturesForDivision` ("embaralha" vs `ORDER BY id`);
  teste de propriedade do padrão casa/fora.
- Telemetria de balanceamento por jogo.
- Batch de queries DB por jornada.
