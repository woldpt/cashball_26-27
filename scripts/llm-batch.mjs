#!/usr/bin/env node
// Gera variantes de frases PT-PT com o llama-server local, para revisão manual.
// Uso: LLAMA_API_KEY=... node scripts/llm-batch.mjs <exemplos.txt> "<descrição do lance>" [n=30]
// Exemplos: uma frase por linha; o marcador {name} é o jogador. Saída: docs/llm-out/<ficheiro>.txt
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename } from "node:path";

const URL = process.env.LLAMA_URL ?? "http://127.0.0.1:8080/v1/chat/completions";
const MODEL = process.env.LLAMA_MODEL ?? "Swift-1.5-Qwen3.8-27B-GSQ-RCO-IQ3_S";
const [file, desc, n = "30"] = process.argv.slice(2);
if (!file || !desc || !process.env.LLAMA_API_KEY) {
  console.error('Uso: LLAMA_API_KEY=... node scripts/llm-batch.mjs <exemplos.txt> "<descrição>" [n]');
  process.exit(1);
}

const examples = readFileSync(file, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
// ponytail: lista curta de brasileirismos, ampliar quando aparecerem no output
const BR = /\b(você|voce|time|gol|goleiro|torcida|técnico|zagueiro|cara|legal)\b/i;
const ok = (s) => s.length <= 160 && s.includes("{name}") && !BR.test(s) && !examples.includes(s);

const prompt = `Escreve ${n} frases novas e diferentes de narração de futebol em português de Portugal (PT-PT, nunca brasileiro) para: ${desc}.
Usa {name} onde entra o nome do jogador. Uma frase por linha, sem numeração nem comentários, máx. 160 caracteres, tom de relato televisivo.
Exemplos do estilo:
${examples.map((e) => "- " + e).join("\n")}`;

const res = await fetch(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLAMA_API_KEY}` },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
    max_tokens: 4000,
    chat_template_kwargs: { enable_thinking: false },
  }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const text = (await res.json()).choices[0].message.content ?? "";

const lines = text.split("\n").map((s) => s.replace(/^[-*\d.\s]+/, "").trim());
const good = [...new Set(lines.filter(ok))];
mkdirSync("docs/llm-out", { recursive: true });
const out = `docs/llm-out/${basename(file, ".txt")}.txt`;
writeFileSync(out, good.join("\n") + "\n");
console.log(`${good.length}/${lines.filter(Boolean).length} frases válidas → ${out}`);
