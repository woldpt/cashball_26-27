/**
 * Regression — aviso da direção: um aviso novo não pode herdar o «lido».
 *
 * O id antigo (`board-<nível>-<semanas>`) repetia-se sempre que o orçamento
 * voltava ao vermelho com a mesma combinação: o aviso novo chegava já lido.
 * O contrato que este teste codifica: o id inclui época + semana.
 *
 * Run: cd client && npm run test:boardnewsid
 */

const { boardNewsId } = await import("../src/utils/inboxItems.js");

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log(`  ok   — ${msg}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${msg}`);
  }
}

console.log("R1 mesmo nível/sequência noutra semana dá outro id");
{
  const before = boardNewsId(2026, 4, 1, 1);
  const after = boardNewsId(2026, 9, 1, 1);
  check(before !== after, `${before} ≠ ${after}`);
}

console.log("R2 mesma semana dá o mesmo id (estável, sem duplicar)");
{
  const a = boardNewsId(2026, 9, 3, 3);
  const b = boardNewsId(2026, 9, 3, 3);
  check(a === b, `id estável na semana (${a})`);
}

console.log("R3 noutra época dá outro id");
{
  const a = boardNewsId(2026, 9, 1, 2);
  const b = boardNewsId(2027, 9, 1, 2);
  check(a !== b, `${a} ≠ ${b}`);
}

if (failures > 0) {
  console.error(`\n❌ board-news-id: ${failures} falha(s)`);
  process.exit(1);
}
console.log("\n✅ board-news-id: aviso novo nunca herda o lido");
