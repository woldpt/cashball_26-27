# Roadmap tático — o jogo do treinador de bancada (2026-10-09)

> Visão de "Pep": um jogo leve, em que **cada decisão do treinador se nota no relvado**.
> Hoje o motor é sólido e bem calibrado (~2,5 golos/jogo), mas várias decisões
> táticas pesam pouco ou nada, e algumas situações reais (jogar com 10, estar a
> perder) não mudam o jogo. Este roadmap junta **irrealismos** encontrados no código
> e **features novas**, em fases pequenas. Nada foi alterado no código.

## Como o motor funciona hoje (resumo)

1. No apito inicial calcula-se a **posse** (só pela média dos médios + estilo) → reparte ~31 oportunidades pelo jogo. **Fica fixa até ao fim.**
2. Cada oportunidade vira golo conforme **média dos avançados** vs **média de defesas + GR**, multiplicada por formação, estilo, forma, moral, familiaridade, público, clima.
3. Por minuto há ainda penáltis, cartões, lesões e cansaço (−1 de qualidade a cada 15', travado pela resistência).

Ficheiros: `server/game/engine.ts`, `server/game/matchCalculations.ts`, `server/gameConstants.ts` (`MATCH_TUNING`).

---

## Parte A — Irrealismos (o que hoje não bate certo)

| # | Problema | Onde | Porque importa ao treinador | Gravidade |
|---|---|---|---|---|
| A1 | **Jogar com 10 quase não custa nada.** Ataque e defesa usam *médias*, por isso tirar um jogador mal mexe na força; e a posse já está fixada. | `computeSidePower` (médias), `engine.ts:2010` (posse fixa) | Uma expulsão devia ser um drama tático (recuar, sacrificar um avançado). Hoje é quase irrelevante. | 🔴 Alta |
| A2 | **Posse e nº de oportunidades fixas desde o 1.º minuto.** Mudar de estilo ao intervalo, meter um médio melhor ou ficar com 10 não muda quem tem a bola. | `engine.ts:2010-2021` (só calcula se `_homeChances == null`) | Mata metade das decisões em jogo: a substituição de um médio não tem efeito na posse. | 🔴 Alta |
| A3 | **A formação escolhida não tem de bater certo com o onze.** O cliente deixa trocar um defesa por um avançado (só bloqueia GR↔campo), mas o motor usa o *fator da formação declarada*. Ex.: declarar 5-4-1 (defesa ×1,41) e jogar com 3 defesas e 5 avançados. | `TacticsContext.jsx:222-227`, `computeSidePower` usa `tactic.formation` | Atalho/exploit: o melhor de dois mundos sem custo. (Confirmar com um teste antes de corrigir.) | 🔴 Alta |
| A4 | **O número de jogadores por linha não conta.** 5 médios valem o mesmo que 2 se a média for igual; 4 avançados valem o mesmo que 1 (só o fator fixo da formação muda). | `computeSidePower`, `computePossession` | Não existe "superioridade no meio-campo" — a ideia mais básica de tática. | 🟠 Média |
| A5 | **O resultado não muda comportamentos.** Quem perde por 1 aos 80' não arrisca; os NPCs escolhem a tática antes do jogo e **nunca** a ajustam (nem ao intervalo, nem com o resultado), e só substituem por lesão/expulsão. | `generateAITactic` (só pré-jogo) | Jogos sem "final de jogo em cerco"; os NPCs parecem passivos. | 🟠 Média |
| A6 | **Penáltis sorteados 50/50 entre as equipas**, independentemente de quem ataca mais; o GR adversário não conta no penálti em jogo; o batedor automático é o "melhor jogador" — pode ser o próprio GR. | `resolvePenaltyKick`, `applyPenaltyEvent`, `selectPenaltyTaker` | Quem é encostado à área devia sofrer mais penáltis; um bom GR devia valer alguma coisa. | 🟡 Baixa |
| A7 | **Cartões: o culpado é sorteado igual entre os 11** (incluindo o GR); a agressividade individual só pesa na *quantidade* de cartões da equipa, não em *quem* os leva. Estilo/pressão não influencia. | `resolveCards` → `emitCard` | O "Triturador" devia ser o primeiro a ver amarelo; tirar um jogador amarelado devia ser decisão real. | 🟡 Baixa |
| A8 | **Lesões não ligadas ao cansaço** — o lesionado é sorteado ao acaso entre os 11. | `resolveInjuries` | Gerir minutos e substituir quem está "rebentado" devia reduzir o risco. | 🟡 Baixa |
| A9 | **"Nunca há golo no minuto a seguir a um golo".** No futebol real o golo de resposta logo a seguir acontece. | `resolveOpenPlayGoal` (`_lastGoalMinute`) | Pequeno, mas tira emoção. Basta reduzir (ex. ×0,5) em vez de proibir. | ⚪ Cosmético |
| A10 | **Chuva forte = +15% de golos.** Discutível: chuva costuma dar mais erros mas também jogo mais partido. Ok como regra de jogo, mas não é "realista". | `getWeatherGoalMultiplier` | Opcional — rever só se incomodar. | ⚪ Cosmético |

---

## Parte B — Features novas (camada do treinador de bancada)

Pensadas para serem **leves**: poucas decisões, efeito claro, explicadas no Briefing/Live.

| # | Feature | O que o treinador faz | Efeito no motor | Esforço |
|---|---|---|---|---|
| B1 | **Estatísticas do jogo: oportunidades + "golos esperados"** | Vê no fim (e ao intervalo) remates, defesas do GR e "golos esperados" de cada equipa. | O motor **já calcula** a probabilidade de cada oportunidade — é só somar e mostrar. | P |
| B2 | **Pressão (alta / média / baixa)** | Um interruptor ao lado do estilo. | Alta: + posse e + oportunidades, mas + cartões e + cansaço; baixa: o contrário. Cria a escolha "pressiono 60' e depois troco". | M |
| B3 | **Ordens condicionais** ("se aos 70' estiver a perder → Ofensivo e entra X") | 1–2 regras simples no Briefing. | Aplicadas pelo servidor sozinho. Ótimo para multijogador assíncrono e para quem está no telemóvel. | M |
| B4 | **Conversa ao intervalo** (Acalmar / Exigir / Elogiar) | Uma escolha no intervalo. | Mexe na moral da 2.ª parte conforme o resultado (exigir a ganhar = arrogância; elogiar a perder = relaxamento). | P |
| B5 | **Duelo de formações** (pedra-papel-tesoura leve) | Escolher a formação *contra* o adversário (o Briefing já mostra o dele). | Ex.: 3 defesas contra 3 avançados = defesa sofre; 5 médios contra 3 = mais posse. Resolve A4 de forma legível. | M |
| B6 | **NPCs que reagem** | — (adversários mais vivos) | Ao intervalo e aos ~70' o NPC ajusta estilo pelo resultado e faz 1–3 substituições (cansados/amarelados). Resolve A5. | M |
| B7 | **Batedores definidos** (penáltis) + **Capitão** | Escolher batedor na tática. Capitão: plano já existe (`2026-10-09-capitaes-equipa.md`). | Batedor fixo evita o GR a bater; capitão já desenhado. | P |
| B8 | **Polivalência** (2.ª posição por jogador) | Pode jogar um médio a lateral sem drama. | Fora de posição = −20% de qualidade; na 2.ª posição = −5%. Resolve A3 de forma justa. | G (precisa de dados novos) |
| B9 | **Ímpeto ("momentum")** | Vê no Live quem está "por cima". | Depois de um golo / grande defesa, a equipa ganha 5–10' de pequena vantagem. Dá narrativa e sentido às substituições. | P |

P = pequeno · M = médio · G = grande.

---

## Parte C — Roadmap por fases

### Fase 1 — Coerência (correções baratas, alto retorno) — ✅ feita 2026-10-09
> Feito: formação contada no onze em campo (`effectiveFormation`; familiaridade só para a formação jogada); com N a menos: oportunidades ×0,82ᴺ / adversário ×1,2ᴺ / defesa ×0,9ᴺ; penálti pelo domínio + GR adversário conta + batedor automático nunca o GR; cartões pela agressividade (GR ×0,3); lesões pelo cansaço — e corrigido o erro em que o teste de resistência era de um jogador e a lesão ia para outro; minuto após golo a ×0,5 (`chancesTotal` 31,2→30,7 para manter os golos); `xg` em cada lance → "Remates" e "Golos esperados" na barra de posse do jogo ao vivo.
> Medido (8000 jogos, motor real): 2,465 golos/jogo antes e depois; com 10: marca −19%, sofre +44%; penáltis para quem domina 52%→60%; cartões ao GR 8,9%→3,2%.
> Por fazer: a % de posse mostrada não muda com a expulsão (é a A2, Fase 2); estatísticas também no intervalo/resumo.

- **A3** — formação passa a ser *derivada do onze real* no servidor (já existe `deriveFormationFromLineup` em `matchSummaryHelpers.ts`), ou o cliente impede troca entre linhas. Recomendo a 1.ª (servidor = verdade).
- **A1** — expulsão custa: cada jogador a menos tira ~8–10% à força da linha onde jogava e à posse.
- **A6/A7/A8** — sorteios ponderados: penálti pelo domínio, culpado do cartão pela agressividade, lesão pelo cansaço; batedor automático nunca o GR.
- **A9** — reduzir em vez de proibir o golo seguido.
- **B1** — mostrar oportunidades/"golos esperados".

### Fase 2 — O jogo reage
- **A2** — recalcular posse/oportunidades restantes quando muda a tática, há substituição de médio ou expulsão (apenas para os minutos que faltam).
- **B6** — NPCs ajustam ao intervalo e aos 70'.
- **B9** — ímpeto.

### Fase 3 — Camada tática
- **B5** — duelo de formações (resolve A4).
- **B2** — pressão.
- **B4** — conversa ao intervalo.
- **B3** — ordens condicionais.

### Fase 4 — Profundidade leve
- **B7** — capitão (plano existente) + batedores.
- **B8** — polivalência.

---

## Regras para qualquer mexida no motor

- Cada fase **recalibra** com `server/scripts/engineCalibration.mts` para manter ~2,5 golos/jogo e a percentagem de vitórias da casa.
- Regressão: `npm run test:engine-unit` + um caso novo por irrealismo corrigido (falha no código antigo).
- Alterou jogo/comunicações → `audit:gamestate <SALA>` e `audit:socketio`.
- Tudo o que se ganha no motor tem de aparecer **explicado** ao treinador (Briefing/Live), senão não existe para ele.
