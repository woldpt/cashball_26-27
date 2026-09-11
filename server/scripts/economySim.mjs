// Calibragem anti-bola-de-neve — matemática pura com os números da sala FGPQH6.
// Corre com: node scripts/economySim.mjs (sem dependências, sem BD).
const SEASON_WEEKS = 20;

// ── 1. Manutenção do estádio ─────────────────────────────────────────────
// Chaves real: 120k lugares, ~32.4M€ bilheteira / 53 jogos ≈ 611k€/jogo,
// ~8 jogos em casa/época → ~4.9M€/época de bilheteira.
for (const rate of [1.0, 1.5, 2.0]) {
  const chaves = 120000 * rate * SEASON_WEEKS;
  const leiria = 80000 * rate * SEASON_WEEKS;
  const small = 10000 * rate * SEASON_WEEKS;
  console.log(
    `upkeep ${rate}€/lugar/sem: Chaves-120k ${(chaves / 1e6).toFixed(1)}M | ` +
    `Leiria-80k ${(leiria / 1e6).toFixed(1)}M | pequeno-10k ${(small / 1e3).toFixed(0)}k/época`,
  );
}

// ── 2. Massa adepta: 5000 → 50000 em quantas épocas? ─────────────────────
for (const growth of [1.15, 1.2, 1.25]) {
  let fb = 5000, seasons = 0;
  while (fb < 50000 && seasons < 30) { fb *= growth; seasons++; }
  let fb3 = 5000 * Math.pow(growth, 3);
  console.log(
    `crescimento +${Math.round((growth - 1) * 100)}%/época: 5k→50k em ${seasons} épocas ` +
    `(ao fim de 3 anos: ${(fb3 / 1000).toFixed(1)}k — nunca 50k)`,
  );
}

// ── 3. Agentes farejam riqueza: multiplicador por saldo ───────────────────
// Proposta: mult = 1 + min(CAP, max(0, (budget - FLOOR)) / SCALE)
const FLOOR = 5_000_000, SCALE = 20_000_000, CAP = 0.5;
for (const budget of [2_000_000, 5_163_805, 8_000_000, 14_018_210, 30_000_000, 60_474_017]) {
  const mult = 1 + Math.min(CAP, Math.max(0, budget - FLOOR) / SCALE);
  console.log(`banco ${(budget / 1e6).toFixed(1)}M → pedidos ×${mult.toFixed(2)}`);
}

// ── 4. NPC investidor: drenar Porto 60M€, 1 ação/semana ───────────────────
// Ação = obra 300k (se capacidade < máx) senão academia 500k.
for (const weekly of [300_000, 400_000]) {
  let budget = 60_474_017, seasons = 0;
  while (budget > 10_000_000 && seasons < 20) { budget -= weekly * SEASON_WEEKS; seasons++; }
  console.log(
    `dreno ${(weekly / 1e3).toFixed(0)}k/sem: 60M→10M em ~${seasons} épocas`,
  );
}
