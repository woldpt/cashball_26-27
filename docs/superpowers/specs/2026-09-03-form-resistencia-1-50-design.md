# Migração Forma e Resistência para 1–50 — Design (Opção A)

- **Data:** 2026-09-03
- **Estado:** aprovada pelo utilizador em chat (opção A + juniores no neutro + economia a preservar a média)
- **Objetivo:** pôr `form` e `resistance` na mesma janela da skill principal (`skill` 1–50, teto `potential` 50), preservando o equilíbrio atual do jogo (migração, não rebalanceamento).

## 1. Decisões fechadas

| # | Decisão | Valor | Porquê |
|---|---------|-------|--------|
| D1 | Mapeamento | Linear afim com `Math.round` (Opção A) | Preserva distribuição e probabilidades; sem retune |
| D2 | Neutro da forma | **32** (imagem de 100) | `1 + 50×49/80 = 31,625 → 32`. Corrige o "31" aproximado do estudo inicial |
| D3 | Neutro da resistência | **26** (imagem de 3) | `1 + 2×49/4 = 25,5 → 26`. Preserva fadiga/lesão médias |
| D4 | Juniores | `form: 26`, `resistance: 26` | Buff consciente: entram usáveis (≈ forma antiga 91), não no piso |
| D5 | Economia | Fator relativo ao neutro, preserva média 1,11 | Sem ele os salários médios desciam ~10% |
| D6 | Histórico de treino antigo | Congelar como legado + nota na UI | Não reescrever logs; valores antigos ficam marcados "escala antiga" |
| D7 | Piso moral pós-jogo | Manter diferença relativa: `MAX(13, …)` | 70→13 pela mesma fórmula; preserva intenção original |
| D8 | `aggressiveness` | Fora de âmbito | Fica como única escala 1–5; inconsistência assumida |

## 2. Funções de conversão (fonte da verdade)

```
FORM_RATIO = 49/80 = 0,6125        (gama nova 1–50 sobre gama antiga 50–130)
RES_RATIO  = 49/4  = 12,25         (gama nova 1–50 sobre gama antiga 1–5)

novaForma = Math.round(1 + (antigaForma - 50) * 49/80)
novaRes   = Math.round(1 + (antigaRes - 1) * 49/4)
```

Tabela de referência (forma): 50→1, 60→7, **70→13**, 80→19, 90→**26**, 100→**32**, 110→38, 115→41, 120→44, 130→50.
Tabela de referência (resistência): 1→1, 2→13, 3→26, 4→38, 5→50.

Constantes novas em `server/gameConstants.ts` (único sítio com números mágicos):

```
FORM_NEUTRAL = 32, FORM_MIN = 1, FORM_MAX = 50
RES_NEUTRAL = 26,  RES_MIN = 1,  RES_MAX = 50
ECON_FORM_REF = 100/90   // preserves mean wage factor (ver §6)
```

## 3. Base de dados e migração

1. `server/db/schema.sql`: `form INTEGER DEFAULT 32`, `resistance INTEGER DEFAULT 26`.
2. Novo bloco de migração em `server/index.ts` (+ apoio em `server/gameManager.ts`) para `game_*.db` existentes — **obrigatória**, sem ela as salas antigas ficam com forma 80–130 acima do teto 50:
   `UPDATE players SET form = ROUND(1 + (form-50)*49.0/80), resistance = ROUND(1 + (resistance-1)*49.0/4)`,
   `training_resistance_progress = training_resistance_progress * 12.25`, tudo com clamp 1–50.
3. `ensureSeeded`/`fixtures_hash`: a mudança invalida `base.db` e força reseed do template (só template; salas existentes intactas). Comportamento desejado.
4. `server/db/seed.js`: forma gerar equivalente a 80–100 → **19–32**; resistência gerar 1–5 e converter (→ {1,13,26,38,50}), para manter a curva.
5. Juniores (`server/game/playerUtils.ts`, dois sítios): `form: 50 → 26`, `resistance: 3 → 26` (D4).
6. `training_player_history`: não migrar (D6); UI marca valores pré-migração como escala antiga.

## 4. Motor (`server/game/engine.ts`, `server/game/playerUtils.ts`)

- `getPower` (atual L1334–1335): `avgForm = average(squad.map(p => p.form ?? FORM_NEUTRAL))`, `formFactor = clamp(avgForm / FORM_NEUTRAL, 0.85, 1.15)`.
- `weightedPickScorer` (`playerUtils.ts` L250–253): `formMultiplier = clamp((p.form ?? FORM_NEUTRAL) / FORM_NEUTRAL, 0.7, 1.3)`.
- Fadiga (`engine.ts` L790–791, L821–822): `skipChance = (resistance - 1) * 0.00816` (= 0.1/12.25; neutro 26 → 0,20 como hoje; máx 0,40). Fallback `|| 3 → ?? RES_NEUTRAL`.
- Lesão (L1937): `resistanceSkip = (resistance - 1) * 0.00653` (= 0.08/12.25; máx 0,32 como hoje).
- `FATIGUE_INTERVAL_MINUTES` e regras de clima: intocados.

## 5. Treino (`server/trainingHelpers.ts`)

- Foco Forma (L127–128): `oldForm = player.form ?? 32`, `newForm = MIN(50, oldForm + 6)` (10×0,6125).
- Descanso sem foco Forma (L214–216): `+4 → +2`, teto 50.
- Decay sem foco Forma (jogou): `max(1, round((form - FORM_MIN) * 0.08))`, piso 1. (Declive 0,08 se mantém: as gamas encolhem na mesma proporção do mapeamento.)
- Foco Resistência (L140–142): acumulador mantém 1,0 = 1 ponto novo; fluxos ×12,25 → treino `+4,9`; desgaste (L247–250) jogou `-1,84`, descansou `-0,61`; teto/piso 50/1.
- Skill com foco posição (L178–181): `formFactor = clamp(0.5 + 0.5 * ((player.form ?? 32) / FORM_NEUTRAL), 0.5, 1.15)` — neutro dá 1,0 exato como hoje.
- Textos/tooltips em `TrainingPage.jsx`: sair de `%` para 1–50.

## 6. Pós-jogo e potencial

- `server/cupFlowHelpers.ts` L144/149: `form >= 110 → >= 38`; `form <= 60 → <= 7`.
- `server/matchSummaryHelpers.ts` L1064–1070: deltas reescalados ×0,6125 → empate `-1..+1`, vitória `+3..+6`, derrota `-3..-6`; clamp `MIN(130, MAX(70,…)) → MIN(50, MAX(13,…))` (D7).

## 7. Economia

- `server/gameConstants.ts` (`signingWage`) e `server/contractHelpers.ts` (`effectiveValue`):
  `resFactor = 0.9 + (resistance / 50) * 0.2`;
  `formFactor = (form / FORM_NEUTRAL) * ECON_FORM_REF` — neutro dá 1,11 exato, **nenhum salário muda só por causa da migração** (D5).
- `fairWeeklyWage`/`recalcPlayerValue`: intocados (só skill).
- `server/auctionHelpers.ts` (L35–36, L482–483): defaults `?? 100 / ?? 3 → ?? 32 / ?? 26`.

## 8. Frontend

- Emojis de forma: `>=41 💪 / <=22 😩` (115→41, 85→22 pela fórmula) em `PlayerRow.jsx` (desktop+mobile), `TacticsView.jsx`, `MatchPlayerCard.jsx`, `CompactPlayerCard.jsx`, `OpponentGridCard.jsx`, `TransferHub.jsx`, `AuctionCard.jsx`, `PlayerHistoryModal.jsx`; `%` → número 1–50; tooltip `Forma 70–130 (100 = normal)` → `Forma 1–50 (32 = normal)`.
- Cores RES em `TacticsView.jsx`: `>=4/>=3 → >=38/>=26`.
- `MatchBriefing.jsx` ("melhor forma"): ordinal, funciona sem alterações.
- Fixtures dos testes resp (`transfer`, `match-spectate`, `intervencao`, `playerhistory`, `scout`, `mobile`): corrigir valores fora da nova escala.
- `PlayerHistoryModal.jsx`: nota "escala antiga" para registos pré-migração (D6).

## 9. Testes, auditorias e docs

- Regressões: `trainingReportRegression.mts` (comentário 50/130, 1/5 → 1/50, 1/50 + asserts), `trainingMultiSeasonRegression.mts`, `contractRenewalRegression.mts` (schema inline `DEFAULT 3/90 → 26/32`), `attendanceRegression.mts`.
- Correr: `npm run audit:gamestate`, `audit:socketio`, `typecheck`, `lint`, `test:mobile`.
- Docs: `COMO_SIMULA_JOGOS.md` §1e/§5/§6/§7; simulação do impacto na folha salarial por divisão antes de fechar.

## 10. Riscos

- Salas sem migração partem silenciosamente (clamps escondem, treino/decay degradam) — migração é obrigatória, não opcional.
- Juniores a 26 entram melhores que hoje (buff consciente, D4) — monitorizar minutos de juniores nas primeiras épocas.
- Extremo inferior do `formFactor` de treino de skill fica mais penalizador (0,52 vs 0,75) — aceitável, só afeta forma 1–10.
