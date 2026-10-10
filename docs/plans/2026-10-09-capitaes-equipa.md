# Capitães de Equipa (2026-10-09, revisto 2026-10-10) — ✅ feito 2026-10-10

## Objetivo
Todas as equipas têm capitão, por isso um bónus igual para todos não dá
vantagem a ninguém. O que conta é a **diferença entre os dois capitães**, e
sente-se **nos maus momentos**: depois de sofrer um golo, o melhor líder
segura a equipa e o "por cima" do adversário dura menos. Com capitães
equivalentes não muda nada.

## Decisões do utilizador
- Efeito relativo (capitão contra capitão), só nos maus momentos (depois de sofrer golo).
- O treinador escolhe; sem escolha é automático; NPCs sempre automático.
- Troca livre: mudar de capitão não custa moral.
- Sem efeito fora do jogo (a braçadeira muda de mãos durante o jogo; não faz sentido creditar a semana).
- O capitão não bate penáltis por defeito; batedor fica para depois.
- (2026-10-09) Efeito diferenciado pela qualidade do capitão.

## Regras
- **Liderança 1–5 (braçadeiras)**, calculada sem coluna nova (`leadershipOf`):
  - idade: ≤20 → 0 · 21–23 → 0,5 · 24–26 → 1 · 27–28 → 1,5 · 29–33 → 2 · 34+ → 1,5;
  - experiência: `1,5 × min(career_games / 60, 1)`;
  - estatuto: qualidade ≥ média do onze + 4 → 1 · ≥ média → 0,5 · abaixo → 0;
  - moral do próprio: < 15 → −1 · > 35 → +0,5;
  - total arredondado e limitado a 1–5. (A 1.ª versão dava 4–5 a quase todos os
    capitães; com esta, numa sala real na 2.ª época: 1★×2, 2★×8, 3★×26, 4★×14.)
- **Efeito:** ao sofrer golo, a duração do ímpeto do adversário (base 8')
  passa a `8 − 2 × (braçadeiras de quem sofreu − braçadeiras de quem marcou)`,
  limitada a 3–13', e a força acompanha a duração (`1 + 0,15 × minutos/8`).
  Capitães iguais → tudo como antes. A duração vai no evento do golo
  (`momentumMinutes`), para o chip 🔥 do Live mostrar o tempo certo.
- **Narração:** só com 2+ braçadeiras de diferença: se encurta o ímpeto, "O capitão X reúne a equipa".
  Se o alonga, "Falta uma voz de comando ao Y".
- **Braçadeira passa** quando o capitão sai (troca, lesão, expulsão): vai para o
  titular com mais liderança em campo; a narração anuncia. Não há sorteio, por
  isso o replay pós-crash dá o mesmo resultado.
- **Automático:** titular com maior liderança; empate → maior `career_games` → id.
- **Calibração (8000 jogos, equipas iguais):** 5★ contra 1★ = +1,4 pp de vitórias e −1,4 pp de
  derrotas; 4★ contra 3★ = +0,4 pp; golos/jogo 2,48 (sem mexer). Só com a duração
  dava 0,6 pp — por isso a força acompanha.

## Onde se vê
- **Tática:** seletor "Capitão" no cartão dos Titulares (com a liderança de cada um);
  "C" no titular e no campo.
- **Duelo:** 4.º mini-cartão "Capitão 4×2" (Ganhas / Igual / Perdes) contra o
  capitão provável do adversário (`nextMatchSummary.opponent`).
- **Live/intervalo:** "C" junto ao capitão; o chip 🔥 com a duração real;
  narração quando a braçadeira passa ou o capitão segura a equipa.

## Ficheiros
- `server/game/matchCalculations.ts` — `leadershipOf(player, xiAvgSkill)` e `pickCaptain(squad, chosenId)`.
- `server/gameConstants.ts` — `MATCH_TUNING`: minutos por braçadeira, limites 3–13.
- `server/game/engine.ts` — capitães no arranque; passagem em `removeFromPitch`/`swapOnPitch`;
  duração do ímpeto em `startMomentum`; `momentumMinutes` no evento do golo.
- `server/game/commentary.ts` — frases (braçadeira passa, capitão reúne, falta de voz).
- `server/types.ts`, `socketGameplayHandlers.ts`, `roomStateHelpers.ts` — `tactic.captainId`
  validado e gravado no assento (como a pressão e as ordens).
- `server/matchSummaryHelpers.ts` — capitão provável do adversário no `nextMatchSummary`.
- `client`: `TacticsView.jsx` (C, menu, duelo), `liveHelpers.js` (`liveMomentum` lê a duração do evento),
  campo do Live/intervalo (C).

## Verificação
- `test:engine-unit`: casos novos (liderança, escolha automática, passagem da
  braçadeira, duração do ímpeto), a falhar no código antigo.
- Simulação de 8000 jogos: golos/jogo (~2,5) e diferença de vitórias entre capitão forte e fraco.
- server `typecheck`, `test:connect-smoke`, `audit:socketio`, `audit:gamestate <sala>`, `test:crash-recovery`.
- client `lint`, `check:types`, `test:livehelpers`, `test:mobile` (Tática, intervalo, Live).
