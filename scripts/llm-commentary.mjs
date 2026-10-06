#!/usr/bin/env node
// Gera variantes PT-PT de cada pool de server/game/commentary.ts com o llama-server local.
// Uso: LLAMA_API_KEY=... node scripts/llm-commentary.mjs [n=25] [filtro]
// Saída: docs/llm-out/commentary.md (para rever e colar à mão; nunca altera o commentary.ts).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const URL = process.env.LLAMA_URL ?? "http://127.0.0.1:8080/v1/chat/completions";
const MODEL = process.env.LLAMA_MODEL ?? "Swift-1.5-Qwen3.8-27B-GSQ-RCO-IQ3_S";
const N = process.argv[2] ?? "25";
const FILTER = process.argv[3];
if (!process.env.LLAMA_API_KEY) throw new Error("Falta LLAMA_API_KEY");

// ── 1. extrair pools ───────────────────────────────────────────────────────
const lines = readFileSync("server/game/commentary.ts", "utf8").split("\n");
const pools = [];
let fn = "", fnComment = "", ctx = "", cur = null;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const f = l.match(/^(?:export )?function (\w+)/);
  if (f) {
    fn = f[1];
    let j = i - 1, c = [];
    while (j >= 0 && lines[j].startsWith("//")) c.unshift(lines[j--].slice(2).trim());
    fnComment = c.join(" ");
    ctx = "";
  }
  if (cur) {
    const m = l.match(/^\s*`(.*)`,?\s*$/);
    if (m) cur.examples.push(m[1]);
    else if (/^\s*\]/.test(l)) { pools.push(cur); cur = null; }
  } else if (/pickPhrase\(\[|return \[|^\s*\w+: \[\s*$/.test(l)) {
    const key = l.match(/^\s*(\w+): \[\s*$/)?.[1];
    const prev = lines[i - 1].trim();
    cur = { fn, hint: [fnComment, key && `variante "${key}"`, /^if |^\} else/.test(prev) ? `condição: ${prev}` : ""].filter(Boolean).join(" · "), examples: [] };
  }
}
const todo = pools.filter((p) => p.examples.length >= 3 && (!FILTER || p.fn.includes(FILTER)));
console.log(`${todo.length} pools`);

// ── 2. gerar + validar ─────────────────────────────────────────────────────
const ph = (s) => s.match(/\$\{[^}]+\}/g) ?? [];
// ponytail: lista curta de brasileirismos, ampliar quando aparecerem no output
const BR = /\b(você|voce|time|gol|goleiro|torcida|técnico|zagueiro|cara|legal)\b/i;

async function ask(prompt) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLAMA_API_KEY}` },
    body: JSON.stringify({
      model: MODEL, temperature: 0.9, max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()).choices[0].message.content ?? "";
}

mkdirSync("docs/llm-out", { recursive: true });
let md = `# Variantes geradas para commentary.ts\n\nModelo: ${MODEL} · rever antes de colar.\n`;
for (const [k, p] of todo.entries()) {
  const allowed = new Set(p.examples.flatMap(ph));
  const required = [...allowed].filter((x) => p.examples.every((e) => e.includes(x)));
  const prompt = `Escreve ${N} frases novas e diferentes de narração de futebol em português de Portugal (PT-PT, nunca brasileiro) para: ${p.hint || p.fn} (função ${p.fn}).
Mantém EXATAMENTE os marcadores \${...} dos exemplos, copiados letra a letra; obrigatórios em todas as frases: ${required.join(" ") || "nenhum"}.
Uma frase por linha, sem numeração nem comentários, tom de relato televisivo, no mesmo registo e contexto dos exemplos (não inventes contexto que os exemplos não têm, como resultado ou minuto).
Exemplos:
${p.examples.slice(0, 15).map((e) => "- " + e).join("\n")}`;
  let good = [];
  try {
    const raw = (await ask(prompt)).split("\n").map((s) => s.replace(/^[-*\d.\s]+/, "").replace(/^`|`,?$/g, "").trim());
    good = [...new Set(raw.filter((s) => s && s.length <= 220 && !BR.test(s) && !p.examples.includes(s) && ph(s).every((x) => allowed.has(x)) && required.every((x) => s.includes(x))))];
  } catch (e) { console.error(p.fn, e.message); }
  console.log(`[${k + 1}/${todo.length}] ${p.fn}: ${good.length}`);
  md += `\n## ${p.fn}${p.hint ? ` — ${p.hint}` : ""}\n\n\`\`\`ts\n${good.map((s) => `    \`${s}\`,`).join("\n")}\n\`\`\`\n`;
  writeFileSync("docs/llm-out/commentary.md", md);
}
