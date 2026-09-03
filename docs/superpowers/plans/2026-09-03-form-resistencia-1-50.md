# Migração Forma/Resistência para 1–50 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar `form` (50–130) e `resistance` (1–5) para a escala 1–50 preservando o equilíbrio atual do jogo.

**Architecture:** Migração por camadas com constantes centrais novas em `gameConstants.ts`; primeiro as constantes e a matemática (verificadas por script), depois DB/seed/juniores, migração idempotente das salas, motor, treino, pós-jogo, economia, UI e por fim regressões/audits/docs.

**Tech Stack:** TypeScript (server, `npm run typecheck`), JSX (client, `npm run lint`), sqlite3 via `tsx` scripts, auditorias `audit:gamestate` / `audit:socketio`.

**Spec:** `docs/superpowers/specs/2026-09-03-form-resistencia-1-50-design.md`

## Global Constraints

- Todo o UI, mensagens e comentários em português europeu (nunca "placar", nunca "contra" como auto-golo).
- Não usar `clipPath` em `PlayerAvatar.jsx` (não é tocado neste plano).
- Em `ModalShell`, os `children` avaliam sempre: expressões novas no `PlayerHistoryModal.jsx` têm de ser nulas-seguras.
- Fonte da verdade do progresso é `game.calendarIndex`; este plano não toca em lógica de calendário.
- Não persistir `game.lockedCoaches` (não é tocado).
- Commits focados no "porquê", um por tarefa, só após checks a passar.

---

## File Structure

| Ficheiro | Responsabilidade nesta migração |
|---|---|
| `server/gameConstants.ts` | Novas constantes `FORM_*`/`RES_*`/`ECON_FORM_REF` + `signingWage` reescalado |
| `server/db/schema.sql` | `DEFAULT`s 100→32, 3→26 |
| `server/db/seed.js` | Geração 19–32 / conversão 1–5 (hash auto-invalida `base.db`, sem trabalho extra) |
| `server/game/playerUtils.ts` | Juniores 26/26 + `weightedPickScorer` /32 |
| `server/gameManager.ts` | Migração idempotente das salas (`scale_v2` em `game_state`) |
| `server/game/engine.ts` | `getPower`, fadiga ×2, lesão |
| `server/trainingHelpers.ts` | Ganhos/decay/acumulador + comentário de cabeçalho |
| `server/cupFlowHelpers.ts` | Limiares de potencial 38/7 |
| `server/matchSummaryHelpers.ts` | Deltas de moral + clamp 50/13 |
| `server/contractHelpers.ts` | `effectiveValue` reescalado |
| `server/auctionHelpers.ts` | Defaults `?? 32 / ?? 26` (2 sítios) |
| `client/src/views/TacticsView.jsx` | Fallback, emojis, cores RES |
| `client/src/components/shared/PlayerRow.jsx` | Fallback, emojis |
| `client/src/components/auctions/AuctionCard.jsx` | Tooltip, limiares, sem `%` |
| `client/src/components/ui/TransferHub.jsx` | Tooltip, limiares, sem `%` |
| `client/src/components/match/shared/OpponentGridCard.jsx` | Fallback, limiares |
| `client/src/components/match/shared/MatchPlayerCard.jsx` | Fallback, limiares, comentário 86–114 |
| `client/src/components/match/shared/CompactPlayerCard.jsx` | Fallback, limiares |
| `client/src/components/modals/PlayerHistoryModal.jsx` | Limiares + nota "escala antiga" |
| `client/src/hooks/useSocketListeners.js` | Fallback `?? 100 → ?? 32` (L1191) |
| `server/scripts/*Regression.mts` | Comentários/schemas/asserts atualizados |
| `COMO_SIMULA_JOGOS.md` | §1e/§5/§6/§7 |

Sem ficheiros novos no repo. Scripts de verificação vivem em `/tmp` (descartáveis).

---

### Task 1: Constantes centrais + verificação da matemática

**Files:**
- Modify: `server/gameConstants.ts` (inserir bloco após os imports)
- Test: `/tmp/check-scale.ts` (descartável, via `npx tsx`)

**Interfaces:**
- Consumes: nada.
- Produces: `FORM_NEUTRAL=32, FORM_MIN=1, FORM_MAX=50, RES_NEUTRAL=26, RES_MIN=1, RES_MAX=50, ECON_FORM_REF=100/90` para as Tasks 2–8.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// /tmp/check-scale.ts
import { FORM_NEUTRAL, FORM_MIN, FORM_MAX, RES_NEUTRAL, RES_MIN, RES_MAX, ECON_FORM_REF, signingWage } from "/home/woldpt/git/cashball/server/gameConstants.ts";
import assert from "node:assert";
assert.equal(FORM_NEUTRAL, 32); assert.equal(FORM_MIN, 1); assert.equal(FORM_MAX, 50);
assert.equal(RES_NEUTRAL, 26); assert.equal(RES_MIN, 1); assert.equal(RES_MAX, 50);
assert.equal(ECON_FORM_REF, 100/90);
// Mapeamento linear: extremos e neutros
const f = (o: number) => Math.round(1 + (o - 50) * 49/80);
const r = (o: number) => Math.round(1 + (o - 1) * 49/4);
assert.deepEqual([f(50),f(70),f(80),f(90),f(100),f(110),f(115),f(130)], [1,13,19,26,32,38,41,50]);
assert.deepEqual([r(1),r(2),r(3),r(4),r(5)], [1,13,26,38,50]);
// Preservação salarial: mesmo salário antes/depois no ponto neutro
const before = signingWage({ skill: 30, resistance: 3, form: 100 });
assert.ok(typeof before === "number");
console.log("OK escala, neutro salarial antigo =", before);
```

Run: `cd server && npx tsx /tmp/check-scale.ts`
Expected: FAIL com `FORM_NEUTRAL is not defined` / `does not export`.

- [ ] **Step 2: Implementação mínima** — inserir em `server/gameConstants.ts` após os imports:

```ts
/**
 * Escala unificada 1–50 para forma e resistência (migração v2).
 * Neutros são a imagem linear dos antigos: forma 100→32, resistência 3→26.
 */
export const FORM_NEUTRAL = 32;
export const FORM_MIN = 1;
export const FORM_MAX = 50;
export const RES_NEUTRAL = 26;
export const RES_MIN = 1;
export const RES_MAX = 50;
/** Referência económica: preserva o fator médio antigo form/90 (100→1,11). */
export const ECON_FORM_REF = 100 / 90;
```

- [ ] **Step 3: Correr o teste**

Run: `cd server && npx tsx /tmp/check-scale.ts`
Expected: PASS, imprime `OK escala`.

- [ ] **Step 4: Typecheck + commit**

```bash
cd server && npm run typecheck
git add server/gameConstants.ts
git commit -m "feat: add FORM_/RES_ scale constants for 1-50 migration

Centraliza neutros e limites para a migração forma/resistência não
espalhar números mágicos pelo motor, treino e economia."
```

---

### Task 2: Schema, seed e juniores

**Files:**
- Modify: `server/db/schema.sql:35-36`, `server/db/seed.js:200-201`, `server/game/playerUtils.ts:68-73,147-152`

**Interfaces:**
- Consumes: Task 1 (usa os valores 32/26, sem importar — SQL/JS puros).
- Produces: novas salas nascem na escala 1–50; `fixtures_hash` invalida `base.db` sozinho (cobre seed.js+schema).

- [ ] **Step 1: Schema** — substituir:

```sql
  form INTEGER DEFAULT 100,
  resistance INTEGER DEFAULT 3,
```

por:

```sql
  form INTEGER DEFAULT 32,
  resistance INTEGER DEFAULT 26,
```

- [ ] **Step 2: Seed** — em `server/db/seed.js:200-201`, substituir:

```js
        const form = p.form || Math.floor(Math.random() * 20) + 80;
        const res = Math.floor(Math.random() * 5) + 1;
```

por:

```js
        const form = p.form || Math.floor(Math.random() * 14) + 19;
        const res = [1, 13, 26, 38, 50][Math.floor(Math.random() * 5)];
```

(19–32 equivale a 80–100; resistência sorteia 1–5 e converte, mantendo a curva.)

- [ ] **Step 3: Juniores** — nos dois blocos de `server/game/playerUtils.ts` (`form: 50` → `form: 26`, `resistance: 3` → `resistance: 26`). Manter `aggressiveness: 3`, `age: 17`.

- [ ] **Step 4: Verificar**

```bash
cd server && npm run typecheck
node -e "const s=require('./db/schema.sql'); " 2>/dev/null; grep -n "DEFAULT 32\|DEFAULT 26" db/schema.sql
```

Expected: typecheck PASS; grep mostra L35 `DEFAULT 32`, L36 `DEFAULT 26`.

- [ ] **Step 5: Commit**

```bash
git add server/db/schema.sql server/db/seed.js server/game/playerUtils.ts
git commit -m "feat: seed new rooms with form/resistance on 1-50 scale

Novas salas e juniores nascem na escala unificada; o fixtures_hash
existente invalida o base.db sozinho. Juniores entram no neutro (26),
usáveis no 11 inicial — buff consciente aprovado na spec (D4)."
```

---

### Task 3: Migração idempotente das salas existentes

**Files:**
- Modify: `server/gameManager.ts` (novo passo de backfill junto ao backfill de `potential`, que usa o mesmo padrão `db.run(UPDATE …)`)
- Test: `/tmp/verify-scale-migration.mjs` (sqlite em memória com o pacote `sqlite3` do server)

**Interfaces:**
- Consumes: Task 1 (fórmulas).
- Produces: salas `game_*.db` antigas convertidas uma única vez (marcador `scale_v2`).

- [ ] **Step 1: Escrever o teste que falha** — `/tmp/verify-scale-migration.mjs`:

```js
import sqlite3 from "sqlite3";
import assert from "node:assert";
const db = new sqlite3.Database(":memory:");
const run = (sql, p=[]) => new Promise((res, rej) => db.run(sql, p, function(e){ e ? rej(e) : res(this); }));
const get = (sql, p=[]) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
await run("CREATE TABLE players (id INTEGER PRIMARY KEY, form INTEGER, resistance INTEGER, training_resistance_progress REAL DEFAULT 0)");
await run("CREATE TABLE game_state (key TEXT PRIMARY KEY, value TEXT)");
await run("INSERT INTO players (form, resistance, training_resistance_progress) VALUES (100, 3, 0.4), (130, 5, 0.9), (50, 1, 0)");
// --- cópia exata dos UPDATEs da migração (ver Step 2) ---
await run(`UPDATE players SET form = CAST(ROUND(1 + (form - 50) * 49.0 / 80) AS INTEGER), resistance = CAST(ROUND(1 + (resistance - 1) * 49.0 / 4) AS INTEGER)`);
await run(`UPDATE players SET form = MIN(50, MAX(1, form)), resistance = MIN(50, MAX(1, resistance))`);
await run(`UPDATE players SET training_resistance_progress = COALESCE(training_resistance_progress, 0) * 12.25`);
const rows = await new Promise((res, rej) => db.all("SELECT form, resistance, training_resistance_progress AS p FROM players ORDER BY id", (e, r) => e ? rej(e) : res(r)));
assert.deepEqual(rows.map(r => [r.form, r.resistance]), [[32,26],[50,50],[1,1]]);
assert.ok(Math.abs(rows[0].p - 4.9) < 1e-9 && Math.abs(rows[1].p - 11.025) < 1e-9);
console.log("OK migração:", JSON.stringify(rows));
```

Run: `cd server && node /tmp/verify-scale-migration.mjs`
Expected: PASS (valida a matemática SQL isolada; o FAIL real vem no Step 3 se a migração não estiver no gameManager).

- [ ] **Step 2: Implementação** — em `server/gameManager.ts`, junto ao `backfillSteps` do `potential`, adicionar passo com o mesmo estilo (`db.run` + warn em erro):

```ts
// Migração v2: forma 50–130 → 1–50, resistência 1–5 → 1–50. Idempotente
// via marcador scale_v2 em game_state (salas novas já nascem convertidas).
backfillSteps.push((next) => {
  db.get(`SELECT value FROM game_state WHERE key = 'scale_v2'`, (mErr, row) => {
    if (mErr || row) return next();
    db.run(
      `UPDATE players SET form = CAST(ROUND(1 + (form - 50) * 49.0 / 80) AS INTEGER), resistance = CAST(ROUND(1 + (resistance - 1) * 49.0 / 4) AS INTEGER)`,
      (uErr) => {
        if (uErr) { console.warn("[gameManager] scale v2 values failed:", uErr.message); return next(); }
        db.run(`UPDATE players SET form = MIN(50, MAX(1, form)), resistance = MIN(50, MAX(1, resistance))`, () => {
          db.run(`UPDATE players SET training_resistance_progress = COALESCE(training_resistance_progress, 0) * 12.25`, () => {
            db.run(`INSERT OR IGNORE INTO game_state (key, value) VALUES ('scale_v2', '1')`, (iErr) => {
              if (iErr) console.warn("[gameManager] scale v2 marker failed:", iErr.message);
              else console.log("[gameManager] form/resistance rescaled to 1–50");
              next();
            });
          });
        });
      },
    );
  });
});
```

Ajustar nomes (`db`, `next`) aos identificadores reais do bloco `backfillSteps` envolvente.

- [ ] **Step 3: Verificar**

```bash
cd server && node /tmp/verify-scale-migration.mjs && npm run typecheck
```

Expected: ambos PASS.

- [ ] **Step 4: Commit**

```bash
git add server/gameManager.ts
git commit -m "feat: one-time rescale of form/resistance for existing rooms

Sem isto as salas antigas ficavam com forma 80-130 acima do teto 50.
Marcador scale_v2 em game_state garante aplicação única."
```

---

### Task 4: Motor — getPower, scorer, fadiga, lesão

**Files:**
- Modify: `server/game/engine.ts:790-791,821-822,1334-1335,1937`, `server/game/playerUtils.ts:250-253`
- Test: `/tmp/check-engine-scale.ts` (asserts de fatores no ponto neutro) + typecheck

**Interfaces:**
- Consumes: Task 1 (`FORM_NEUTRAL`, `RES_NEUTRAL`). Verificar o import existente de `gameConstants.ts` no topo de cada ficheiro; se não existir, adicionar à lista de imports (não criar import novo separado).
- Produces: fatores 1,0 no neutro; `skipChance` 0,20/0,40 como antes.

- [ ] **Step 1: Teste que falha** — `/tmp/check-engine-scale.ts`:

```ts
import fs from "node:fs";
import assert from "node:assert";
const eng = fs.readFileSync("/home/woldpt/git/cashball/server/game/engine.ts", "utf8");
const pu = fs.readFileSync("/home/woldpt/git/cashball/server/game/playerUtils.ts", "utf8");
assert.ok(eng.includes("avgForm / FORM_NEUTRAL"), "getPower usa FORM_NEUTRAL");
assert.ok(pu.includes("/ FORM_NEUTRAL"), "scorer usa FORM_NEUTRAL");
assert.ok(eng.includes("(resistance - 1) * 0.00816"), "fadiga reescalada");
assert.ok(eng.includes("(resistance - 1) * 0.00653"), "lesão reescalada");
assert.ok(!eng.includes("p.form || 100") && !pu.includes("p.form || 100"), "sem fallbacks antigos de forma");
console.log("OK motor");
// Matemática: neutro 26 → fadiga 0,204 ≈ 0,20; máx 49*0,00816 ≈ 0,40
assert.ok(Math.abs(25 * 0.00816 - 0.2) < 0.005 && Math.abs(49 * 0.00816 - 0.4) < 0.005);
assert.ok(Math.abs(49 * 0.00653 - 0.32) < 0.005);
```

Run: `cd server && npx tsx /tmp/check-engine-scale.ts` — Expected: FAIL (strings novas ainda não existem).

- [ ] **Step 2: Implementação** — 5 substituições exatas:

1. `engine.ts:790-791` e `821-822` (dois sítios idênticos):
```ts
    const resistance = p.resistance || 3;
    const skipChance = (resistance - 1) * 0.1;
```
→
```ts
    const resistance = p.resistance ?? RES_NEUTRAL;
    const skipChance = (resistance - 1) * 0.00816;
```
2. `engine.ts:1334-1335`:
```ts
    const avgForm = average(squad.map((p) => p.form || 100));
    const formFactor = Math.max(0.85, Math.min(1.15, avgForm / 100));
```
→
```ts
    const avgForm = average(squad.map((p) => p.form ?? FORM_NEUTRAL));
    const formFactor = Math.max(0.85, Math.min(1.15, avgForm / FORM_NEUTRAL));
```
3. `engine.ts:1937`:
```ts
        const resistanceSkip = ((injuredPlayer?.resistance || 3) - 1) * 0.08;
```
→
```ts
        const resistanceSkip = ((injuredPlayer?.resistance ?? RES_NEUTRAL) - 1) * 0.00653;
```
4. `playerUtils.ts:250-253`:
```ts
     const formMultiplier = Math.max(
       0.7,
       Math.min(1.3, (p.form || 100) / 100),
     );
```
→
```ts
     const formMultiplier = Math.max(
       0.7,
       Math.min(1.3, (p.form ?? FORM_NEUTRAL) / FORM_NEUTRAL),
     );
```
Garantir `FORM_NEUTRAL`/`RES_NEUTRAL` importados de `./gameConstants.ts` (engine) e `./gameConstants.ts` relativo correto (playerUtils está em `game/`, confirmar caminho do import existente).

- [ ] **Step 3: Verificar** — `cd server && npx tsx /tmp/check-engine-scale.ts && npm run typecheck` — Expected: PASS + PASS.

- [ ] **Step 4: Commit**

```bash
git add server/game/engine.ts server/game/playerUtils.ts
git commit -m "feat: engine uses 1-50 form/resistance factors

formFactor e scorer dividem pelo neutro 32; fadiga e lesão dividem por
12.25 para preservar as probabilidades 0,20/0,40 e 0,32."
```

---

### Task 5: Treino

**Files:**
- Modify: `server/trainingHelpers.ts` (cabeçalho L12-25, L127-128, L140-155, L178-181, L214-228, L247-253)

**Interfaces:**
- Consumes: Task 1. Confirmar import de constantes no topo do ficheiro.
- Produces: ritmo de treino/decay idêntico em termos relativos.

- [ ] **Step 1: Cabeçalho** — atualizar o comentário L12-25 para a nova escala (forma `+6` treino / `+2` descanso / decay `(form-1)×0.08` piso 1; resistência `+4,9` treino, `-1,84` jogou / `-0,61` descansou, 1,0 = 1 ponto, teto 50 piso 1). Manter o aviso sobre acumuladores REAL vs INTEGER.

- [ ] **Step 2: Blocos de código** — substituições exatas:

```ts
                    const oldForm = player.form ?? 100;
                    const newForm = Math.min(130, oldForm + 10);
```
→
```ts
                    const oldForm = player.form ?? FORM_NEUTRAL;
                    const newForm = Math.min(FORM_MAX, oldForm + 6);
```
```ts
                    const oldRes = player.resistance ?? 3;
                    const oldProg = player.resistance_progress ?? 0;
                    let newProg = oldProg + 0.4;
                    let newRes = oldRes;
                    while (newProg >= 1.0 && newRes < 5) {
                      newRes += 1;
                      newProg -= 1.0;
                    }
                    if (newRes >= 5) newProg = 0; // cap progress at the ceiling
```
→ mesmos nomes com `?? RES_NEUTRAL`, `+ 4.9`, `newRes < RES_MAX`, `if (newRes >= RES_MAX) newProg = 0;`. E `delta: 0.4` (L155) → `delta: 4.9`.
```ts
                        Math.max(0.5, 0.5 + (player.form ?? 100) / 200),
```
→
```ts
                        Math.max(0.5, 0.5 + 0.5 * ((player.form ?? FORM_NEUTRAL) / FORM_NEUTRAL)),
```
```ts
                    const oldForm = player.form ?? 100;
```
(decay, L214) → `?? FORM_NEUTRAL`; `Math.min(130, oldForm + 4)` → `Math.min(FORM_MAX, oldForm + 2)`; `Math.max(1, Math.round((oldForm - 50) * 0.08))` → `Math.max(1, Math.round((oldForm - FORM_MIN) * 0.08))`; `Math.max(50, oldForm - decay)` → `Math.max(FORM_MIN, oldForm - decay)`; atualizar o comentário "efeito piso nos 50" → "efeito piso no 1".
```ts
                    const oldRes = player.resistance ?? 3;
```
(L248) → `?? RES_NEUTRAL`; `const resLoss = played ? -0.15 : -0.05;` → `played ? -1.84 : -0.61`; `while (newProg < 0 && newRes > 1)` → `newRes > RES_MIN`; `if (newRes <= 1 && newProg < 0)` → `if (newRes <= RES_MIN && newProg < 0)`.

- [ ] **Step 3: Verificar**

```bash
cd server && npm run typecheck && grep -n "130\|?? 100\|?? 3\|+ 0.4\|-0.15\|< 5\|> 1\|MAX(50\|MIN(130" trainingHelpers.ts; echo "---"; grep -cn "FORM_NEUTRAL\|RES_NEUTRAL\|FORM_MAX\|FORM_MIN\|RES_MAX\|RES_MIN" trainingHelpers.ts
```

Expected: typecheck PASS; primeiro grep sem resultados (exceto o aviso INTEGER do cabeçalho, se mantido); segundo grep ≥ 10.

- [ ] **Step 4: Commit**

```bash
git add server/trainingHelpers.ts
git commit -m "feat: training gains/decay on 1-50 form/resistance

Ritmo relativo preservado: forma +6/+2, decay (form-1)x0.08; resistência
+4.9/-1.84/-0.61 com 1.0 = 1 ponto. Skill usa 0.5+0.5x(form/32)."
```

---

### Task 6: Pós-jogo — potencial e moral

**Files:**
- Modify: `server/cupFlowHelpers.ts:144,149`, `server/matchSummaryHelpers.ts:1063-1072`

- [ ] **Step 1: Potencial** — `if (form >= 110 …)` → `if (form >= 38 …)`; `else if (form <= 60 …)` → `else if (form <= 7 …)`. Manter `Math.random() < 0.20`, `played >= 12`, tetos `MIN(50…)`/`MAX(5…)`.

- [ ] **Step 2: Moral** — substituir o bloco L1063–1072:

```ts
                     ? Math.floor(Math.random() * 5) - 2 // -2 a +2
                     : won
                       ? 5 + Math.floor(Math.random() * 6) // +5 a +10
                       : -(5 + Math.floor(Math.random() * 6)); // -5 a -10
```
→ deltas ×0,6125:
```ts
                     ? Math.floor(Math.random() * 3) - 1 // -1 a +1
                     : won
                       ? 3 + Math.floor(Math.random() * 4) // +3 a +6
                       : -(3 + Math.floor(Math.random() * 4)); // -3 a -6
```
e
```ts
                    `UPDATE players SET form = MIN(130, MAX(70, form + ?)) WHERE id IN (${ph})`,
```
→
```ts
                    `UPDATE players SET form = MIN(50, MAX(13, form + ?)) WHERE id IN (${ph})`,
```

- [ ] **Step 3: Verificar** — `cd server && npm run typecheck` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/cupFlowHelpers.ts server/matchSummaryHelpers.ts
git commit -m "feat: post-match potential and morale on 1-50 form

Limiares 110/60 viram 38/7; deltas de moral reescalados x0.6125 com clamp
50/13 a manter a diferença relativa original."
```

---

### Task 7: Economia + leilões

**Files:**
- Modify: `server/gameConstants.ts:56-57`, `server/contractHelpers.ts:61-62`, `server/auctionHelpers.ts:35-36,482-483`
- Test: extensão de `/tmp/check-scale.ts` — preservação salarial

**Interfaces:**
- Consumes: Task 1 (`RES_*`, `FORM_NEUTRAL`, `ECON_FORM_REF`).
- Produces: salários inalterados no ponto neutro.

- [ ] **Step 1: Teste que falha** — acrescentar a `/tmp/check-scale.ts`:

```ts
const after = signingWage({ skill: 30, resistance: 26, form: 32 });
assert.equal(after, before);
console.log("OK salários preservados:", after);
```

Run: `cd server && npx tsx /tmp/check-scale.ts` — Expected: FAIL (fatores antigos dão valor diferente).

- [ ] **Step 2: Implementação**:

```ts
  const resFactor = 0.9 + ((player.resistance || 3) / 5) * 0.2;
  const formFactor = (player.form || 90) / 90;
```
→ (nos dois ficheiros, `signingWage` e `effectiveValue`)
```ts
  const resFactor = 0.9 + ((player.resistance ?? RES_NEUTRAL) / RES_MAX) * 0.2;
  const formFactor = ((player.form ?? FORM_NEUTRAL) / FORM_NEUTRAL) * ECON_FORM_REF;
```
Garantir imports das constantes em `contractHelpers.ts` (verificar o import existente de `gameConstants.ts`). `fairWeeklyWage`/`recalcPlayerValue`: não tocar.
`auctionHelpers.ts` (2 sítios): `form: row.form ?? 100` → `?? FORM_NEUTRAL`, `resistance: row.resistance ?? 3` → `?? RES_NEUTRAL` (mesmo para `player.form`/`player.resistance`); `aggressiveness ?? 3`: não tocar.

- [ ] **Step 3: Verificar** — `cd server && npx tsx /tmp/check-scale.ts && npm run typecheck` — Expected: PASS + PASS, imprime `OK salários preservados`.

- [ ] **Step 4: Commit**

```bash
git add server/gameConstants.ts server/contractHelpers.ts server/auctionHelpers.ts
git commit -m "feat: wages and auction defaults on 1-50 scale

Fator de forma relativo ao neutro x100/90: nenhum salário muda só pela
migração. Defaults de leilão passam a 32/26."
```

---

### Task 8: Frontend — limiares, tooltips, fallbacks

**Files:** os 9 listados na File Structure (client). Sem testes novos; verificação por `lint` + `test:mobile` na Task 10 e revisão visual.

Regra mecânica por ficheiro (aplicar a **todas** as ocorrências de cada padrão):

| Padrão antigo | Padrão novo |
|---|---|
| `?? 100` / `\|\| 100` em forma | `?? 32` / `\|\| 32` |
| `>= 115` (forma) | `>= 41` |
| `<= 85` (forma) | `<= 22` |
| `%` após valor de forma (`{…form…}%`) | remover `%`, mostrar número 1–50 |
| `Forma 70–130 (100 = normal; ≥115 em grande; ≤85 em baixo)` | `Forma 1–50 (32 = normal; ≥41 em grande; ≤22 em baixo)` |
| RES `>= 4` verde / `>= 3` amarelo | `>= 38` verde / `>= 26` amarelo |

- [ ] **Step 1: `TacticsView.jsx`** — L127 `player.form ?? 100` → `?? 32`; L128 limiares 115/85 → 41/22; L186/188 `?? 0) >= 4` → `>= 38`, `>= 3` → `>= 26`.
- [ ] **Step 2: `PlayerRow.jsx`** — L60 `player.form \|\| 100` → `\|\| 32`; L61–65 limiares → 41/22.
- [ ] **Step 3: `AuctionCard.jsx`** — L393 tooltip; L396–397 limiares + remover `%`.
- [ ] **Step 4: `TransferHub.jsx`** — L240 tooltip; L242 limiares + remover `%`. (N.º cru de RES por perto se existir: exibe bem em 1–50, não tocar.)
- [ ] **Step 5: `OpponentGridCard.jsx`** — L15 fallback; L16–18 limiares.
- [ ] **Step 6: `MatchPlayerCard.jsx`** — L40 fallback; L51–53 limiares; comentário L49–50 `(86–114)` → `(23–40)`.
- [ ] **Step 7: `CompactPlayerCard.jsx`** — L53 fallback; L58–60 limiares.
- [ ] **Step 8: `PlayerHistoryModal.jsx`** — L277–286 fallbacks `|| 100` → `|| 32` e limiares → 41/22 (manter nulo-seguro: são expressões sobre `player`, que já é guardado no modal); acrescentar nota "valores anteriores à época X usam a escala antiga" junto ao bloco de forma (D6). `MatchBriefing.jsx` L639 (`Forma ${t.form}`) e ordenação "melhor forma": não tocar (ordinal).
- [ ] **Step 9: `useSocketListeners.js`** — L1191 `player.form ?? squadPlayer?.form ?? 100` → `?? 32`. Procurar outros `?? 100`/`?? 3` de forma/resistência no ficheiro e converter com a mesma regra.
- [ ] **Step 10: Verificar**

```bash
cd client && npm run lint
grep -rn ">= 115\|<= 85\|70–130\|form ?? 100\|form || 100\|form ?? squadPlayer?.form ?? 100" src/ | grep -vi "morale\|skill\|minute\|possession\|capacity\|wage\|stadium" ; echo "restantes acima (esperado: vazio)"
```

Expected: lint PASS; grep vazio.

- [ ] **Step 11: Commit**

```bash
git add client/src
git commit -m "feat: UI shows form/resistance on 1-50 scale

Limiares 115/85 viram 41/22, cores RES 38/26, tooltips 1-50 com neutro
32, sem sufixo %. Histórico antigo marcado como escala antiga."
```

---

### Task 9: Regressões e fixtures de testes

**Files:**
- Modify: `server/scripts/trainingReportRegression.mts:8`, `server/scripts/contractRenewalRegression.mts:54-55`, `trainingMultiSeasonRegression.mts`, `attendanceRegression.mts` (verificar asserts), fixtures `client/src/**/*resp-test.jsx` com valores fora da escala.

- [ ] **Step 1: Comentários/schemas** — `trainingReportRegression.mts:8`: `form → 50/130, resistance → 1/5` → `form → 1/50, resistance → 1/50`. `contractRenewalRegression.mts:54-55`: `resistance INTEGER DEFAULT 3` → `26`, `form INTEGER DEFAULT 90` → `32`.
- [ ] **Step 2: Asserts** — correr cada regressão e corrigir asserts ancorados à escala antiga (valores esperados de forma/resistência e contagens de teto/piso):

```bash
cd server && npm run test:crash-recovery
```

e os runners das regressões de treino/contratos (ver `package.json`; se um script não existir, correr o `.mts` com `npx tsx`). Expected: tudo verde; se um assert prender a escala antiga, converter o valor esperado pela fórmula da Task 1 e repetir.
- [ ] **Step 3: Fixtures resp** — nos `*-resp-test.jsx` (`transfer`, `match-spectate`, `intervencao`, `playerhistory`, `scout`, `mobile`), substituir valores de `form`/`resistance` fora de 1–50 pelos equivalentes (ex.: `resistance: 60–88` → mapear para 1–50; `form: 100/115` → 32/41). Verificar com:

```bash
cd client && grep -rn "resistance: [5-9][0-9]\|form: [5-9][0-9]\|form: 1[0-3][0-9]" src/ ; echo "restantes acima (esperado: vazio)"
```

- [ ] **Step 4: Commit**

```bash
git add server/scripts client/src
git commit -m "test: regressions and resp fixtures on 1-50 scale

Schemas inline, asserts e fixtures convertidos pela mesma fórmula linear
da migração."
```

---

### Task 10: Docs, simulação salarial, auditorias finais

**Files:**
- Modify: `COMO_SIMULA_JOGOS.md` (§1e, §5, §6, §7)

- [ ] **Step 1: Docs** — reescrever referências a `forma 100 = 1,0`, `70–130`, `resistência +8% por ponto` para neutro 32, gama 1–50 e `+0,65% por ponto de resistência` (0,2/12,25 ≈ 0,0065 por ponto em `resFactor`; fadiga `0,00816`/ponto; lesão `0,00653`/ponto).
- [ ] **Step 2: Simulação salarial** — correr (script descartável) a folha média por divisão antes/depois no ponto neutro e com a distribuição da seed; aceitar desvio < 1% (a matemática da Task 7 garante igualdade no neutro; a simulação apanha efeitos de distribuição):

```bash
cd server && npx tsx /tmp/sim-wages.ts
```

(`/tmp/sim-wages.ts`: importa `signingWage`, amostra skills 5–50 × formas 19–32 × resistências {1,13,26,38,50}, compara contra a fórmula antiga inline no script; asserts desvio médio < 1%. Escrever o script no momento da execução com estes requisitos.)

- [ ] **Step 3: Auditorias e checks finais**

```bash
cd server && npm run audit:gamestate -- <ROOM_CODE> && npm run audit:socketio && npm run typecheck
cd client && npm run lint && npm run check:types && npm run test:mobile
```

Expected: tudo verde (usar uma sala real para `audit:gamestate`; sem salas, correr contra `base`).

- [ ] **Step 4: Commit**

```bash
git add COMO_SIMULA_JOGOS.md
git commit -m "docs: game simulation guide on 1-50 form/resistance

Neutro 32, gamas e taxas por ponto atualizados; salários validados por
simulação (<1% de desvio)."
```

---

## Self-Review

**1. Cobertura da spec:** D1 (mapeamento) → Tasks 1–3, verificado em 1/3/4. D2/D3 (neutros) → Task 1 + usos em 4–8. D4 (juniores 26) → Task 2. D5 (economia preserva média) → Task 7 + simulação Task 10. D6 (histórico legado) → Tasks 3 (não migrar) e 8 (nota UI). D7 (moral MAX 13) → Task 6. D8 (aggressiveness fora) → excluído em todas as tasks, com nota explícita na Task 7.

**2. Placeholders:** nenhum "TBD/TODO"; todos os valores, linhas e comandos estão inline. O único ponto dependente do contexto de execução é `/tmp/sim-wages.ts` (requisitos de asserts escritos) e os nomes de runners das regressões (`package.json` manda).

**3. Consistência de tipos/nomes:** `FORM_NEUTRAL/FORM_MIN/FORM_MAX/RES_NEUTRAL/RES_MIN/RES_MAX/ECON_FORM_REF` definidos uma vez (Task 1) e referenciados pelo mesmo nome em 4–8; `scale_v2` como marcador único; fallbacks sempre `??` com as constantes.

## Execution Handoff

Após gravar o plano, oferecer: **1. Subagent-Driven (recomendado)** — subagente fresco por task com revisão entre tasks; **2. Inline Execution** — executar nesta sessão via executing-plans, em lote com checkpoints.
