# Live View dos amigáveis na semana da Taça

## Contexto
Nas semanas da Taça, os eliminados podem marcar um amigável (ronda `-r` na BD, `round = FRIENDLY_ROUND (0)` em memória). Esses jogos correm no mesmo fluxo/payload da ronda da Taça, e o cliente só sabe que é "amigável" pelo nome da ronda (`cupMatchRoundName`) ou por `cupRoundResults.round === 0` — o que só é verdade no amigável de **pré-época**. Resultado:
- O hero/MatchPage mostra "Taça · Oitavos", badge 🏆, botões "INICIAR JOGO — TAÇA", lógica de prolongamento.
- `computeFinalWhistle` (`client/src/utils/finalWhistle.js`) trata o jogo como taça: vitória → frase "Três pontos que sabem a glória."; empate → `winnerId == null` → **nunca apita**.
- `GameContext.jsx:778` (humor pós-jogo) classifica como `cup` com o nome da ronda da Taça.

Causa raiz: **a flag "amigável" é por ronda no cliente, mas no servidor é por fixture.** O servidor já marca `isFriendly: true` nos resultados finais (`cupFlowHelpers.ts:2344`), mas não nos payloads live.

## Recomendação: não criar vista nova
Uma vista nova duplicaria hero, relógio, intervenção, eventos e resync. O amigável de pré-época já tem um "modo amigável" na vista existente (sem prefixo Taça, 🤝, subs ilimitadas). Basta alimentar esse modo com a flag certa **por fixture**. Uma vista própria só se justificar se quiseres conteúdo diferente (ex.: sem "outros jogos" da Taça) — fica fora.

## Passos

### 1. Servidor — marcar cada fixture
Acrescentar `isFriendly: f.round === FRIENDLY_ROUND` ao map de fixtures em:
- `server/weeklyFlowHelpers.ts` — `matchMinuteUpdate` (~l.965) e `cupHalfTimeResults` (~l.1030).
- `server/cupFlowHelpers.ts` — `matchReplay` (~l.2899 e ~l.2935), `cupETHalfTime`, e o `fallbackResults` (~l.2440). Os resultados finais já trazem a flag (l.2344).

### 2. Cliente — um único helper
Em `client/src/components/live/liveHelpers.js`: `isFriendlyMatch(fixture, cupRound)` → `fixture?.isFriendly || Number(cupRound) === 0`. Garantir que `isFriendly` sobrevive ao merge dos fixtures em `client/src/hooks/socket/match.js` / `cup.js`.

### 3. Cliente — usar o helper (substitui o regex `/amigável/` e o `round === 0`)
- `MatchPage.jsx:226` — `isFriendly` a partir do meu fixture. Isto já corrige badge, botões, ET gate e limite de subs (passa para `IntervencaoView`).
- `LiveMatchHero.jsx:99` — idem; label "Amigável" em vez de `Taça · <ronda>`.
- `MatchPage.jsx:420` — "Outros jogos": no amigável, título "Amigáveis" e listar só fixtures com `isFriendly`; os jogos da Taça ficam numa secção à parte (ou omitidos).
- `GameContext.jsx:778` — `isFriendly` pelo `myMatch.isFriendly`; key `friendly:${season}:cup${round}` para não colidir com a da pré-época; roundName "Amigável".
- `finalWhistle.js` — mesma deteção (`cup.isFriendly`); devolve `competition: "friendly"`.

### 4. Frases do apito
`FinalWhistleStamp.jsx`: pool `PHRASES_FRIENDLY` (sem pontos, ex.: "Apito final! Vitória no amigável — bom ensaio.") escolhida quando `whistle.competition === "friendly"`. Aproveitar para tirar "pontos" também da pool usada na Taça (eliminatória não tem pontos): passar a pool por competição `league | cup | friendly`.

### 5. Plano no repo
Copiar este plano para `docs/plans/2026-10-05-live-view-amigaveis-taca.md`; commit por passo.

## Verificação
- `npm run check:types` e testes existentes de `finalWhistle` (acrescentar 2 casos: amigável de semana de Taça com vitória → `competition: "friendly"`; com empate → apita).
- Manual: sala com 2 humanos eliminados, marcar amigável na véspera da ronda; confirmar label "Amigável", 🤝, sem prolongamento aos 90', apito com frase sem pontos, e humor pós-jogo "Amigável". Verificar também que um humano ainda na Taça continua a ver tudo como Taça na mesma semana.
