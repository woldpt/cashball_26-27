---
name: diagnosing-bugs
description: "Diagnóstico de bugs difíceis: crashes, sala presa, regressões de desempenho e falhas intermitentes. Usa quando o utilizador diz que algo não funciona, dá erro, rebenta, trava, ficou lento, ou que os números/estado do jogo estão errados."
---

# Diagnóstico de Bugs

Disciplina para bugs difíceis. As fases correm **por ordem** — saltar uma exige
dizer porquê por escrito. Vale para servidor, cliente e base de dados; para
crash/restart e replay lê também `docs/CRASH.md`.

## Fase 1 — Loop vermelho

**É isto a skill toda.** Um comando que falha *neste* bug e fica verde com o
fix. Enquanto não existir, ler código à procura de uma teoria está proibido —
é assim que se corrige o sintoma em vez da causa (`min-w-0` "porque costuma
resolver").

Procura primeiro no que o CashBall já tem (loop novo é último recurso):

| Sinal | Onde |
|---|---|
| Budgets vs salários, squad mínimo, duplicados, fases | `cd server && npm run audit:gamestate <ROOM_CODE>` |
| Presença, assentos, ready, congelamento da sala | `npm run audit:session <ROOM_CODE>` · `npm run test:session-freeze` |
| Socket: handlers registados, duplicados, órfãos | `npm run audit:socketio` · `npm run test:connect-smoke` |
| Não avança, "preso", replay pós-restart | `npm run test:crash-recovery` (clona p/ `game_CRASHT.db`) · `test:finalize` · `test:segment-barrier` |
| Motor, minuto a minuto, números do jogo | `npm run test:engine-unit` · resto dos `npm run test:*` (um reprodutor por feature, ver `server/package.json`) |
| UI, JSX, layout | `cd client && npm run test:mobile -- <harness>` (mapa de harnesses na skill `mobile-resp-check`) |
| Utilitários do cliente | `cd client && npm run test:*` (ver `client/package.json`) |

Cru também serve: `curl`/socket contra `npm run dev`, ou replay de um payload
real capturado para ficheiro.

**Concluída quando** nomeias **um** comando, já o correste pelo menos uma vez
(mostra invocação + saída) e ele é:

- [ ] **vermelho-able** — chega ao código do bug e verifica o teu sintoma exato
- [ ] **determinístico** — mesmo veredicto em cada corrida (flake: taxa alta e fixa)
- [ ] **rápido** — segundos, não minutos
- [ ] **sem humano** — corre sozinho (humano só no passo HITL da Fase 4)

Sem loop: para e dize-o. Pede (a) acesso ao que reproduz — `ROOM_CODE`, save,
ambiente, (b) um artefacto capturado, ou (c) autorização para instrumentar
temporariamente. Apertar um loop que já existe (mais rápido, mais afiado,
mais determinístico) vale tanto como encontrá-lo.

## Fase 2 — Reproduzir e minimizar

- [ ] A falha é a que o **utilizador** descreveu, não outra que calha por perto
- [ ] Reproduz em várias corridas; sintoma exato capturado (mensagem, valor, tempo)

Depois **minimiza**: tira entradas, chamadores, config e passos **um a um**,
re-correndo o loop depois de cada corte. O que fica tem de ser todo ele
necessário — tirar qualquer peça torna o loop verde.

## Fase 3 — Hipóteses

3–5 hipóteses **falsificáveis**, ordenadas, *antes* de testar a primeira — e
mostra-as ao utilizador (ele tem contexto que reordena: "isso mexemos ontem").

> "Se <X> é a causa, então <mudar Y> faz o bug desaparecer / <mudar Z> piora-o."

Hipótese sem previsão é palpite: descarta ou afia. Não bloqueies à espera do OK.

## Fase 4 — Instrumentar

Cada probe serve uma previsão. **Uma variável de cada vez.** Preferência:
inspeção/REPL ou breakpoint > logs nas fronteiras que distinguem hipóteses >
"logar tudo e grepar". Marca cada log com prefixo único — `[DEBUG-a4f2]` — para
a limpeza ser um `grep`.

Desempenho: logs são a ferramenta errada. Mede uma linha de base (harness,
`performance.now`, profiler, `EXPLAIN QUERY PLAN`) e só depois bisecta.

HITL é último recurso: se um humano tem de clicar (dois browsers, sala real),
guia-o passo a passo e usa a saída dele como prova, nunca a memória dele.

## Fase 5 — Fix + regressão

Escreve a regressão **antes** do fix, mas só se houver **seam correto** — um
sítio onde o teste exercita o padrão real do bug. Se só existir um seam raso
(unit de um chamador quando o bug precisa de vários), a regressão dá falsa
confiança: **a ausência de seam é ela própria o achado**; regista-a.

1. Repro minimizado vira teste que falha no seam · 2. vê-o falhar · 3. fix ·
4. vê-o passar · 5. corre o loop da Fase 1 outra vez no cenário original.

Checks aplicáveis por `verify-before-done`. Atenção: `server/index.ts` tem
`// @ts-nocheck` — o `typecheck` não vê lá dentro, exige `test:connect-smoke`.

## Fase 6 — Limpeza e entrega

- [ ] Loop da Fase 1 já não reproduz
- [ ] Regressão passa (ou a ausência de seam está registada)
- [ ] `grep [DEBUG-` sem resultados
- [ ] Protótipos de debug apagados (ou em sítio marcado como tal)
- [ ] A hipótese vencedora vai na mensagem do commit
- [ ] `NOTES.md` atualizado (o quê, porquê, como foi testado) + commit pela `auto-commit`

## Regras

1. **Jamais fixar por hipótese.** Reproduzir → isolar causa → só então fixar.
2. **Segredos fora do que mostras** — escreve `<REDACTED>` (chaves, env, IPs).
   Capturas trazem cabeçalhos de auth: cita só as linhas com sinal.
3. **Determinismo do motor:** o motor anda no `tick.rng` (seeded) — o replay
   pós-crash só é idêntico se o fix não criar nova fonte de aleatoriedade nem
   escrever em BD fora do sítio habitual.
