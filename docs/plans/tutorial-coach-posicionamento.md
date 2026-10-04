# Plano — Correção do posicionamento do boneco e dos destaques no tutorial

> Estado: **implementado** (2026-10-11). As causas foram confirmadas em ecrã com o harness novo `client/tutorial-resp-test.jsx` (antes: 8 de 15 medições falhadas). Desvios ao plano: não existe skill `run` (a reprodução foi feita com o harness + capturas); harness próprio em vez de o pendurar no `assistant-resp-test` (um harness por componente); o `tactic-play` duplicado passou a `tactic-play`/`tactic-play-fab`; `player-skills` ficou em todas as linhas (o pick da 1.ª instância visível resolve); o balão não é espelhado porque o retrato fica sempre à esquerda dele.

## Ficheiros envolvidos

- `client/src/components/tutorial/CoachTutorial.jsx` — overlay, spotlight e balão
- `client/src/components/tutorial/coachTutorialSteps.js` — passos e seletores `data-tour`
- `client/src/components/shared/AssistantCoachView.jsx` — `AssistantMascot`
- `client/src/components/shared/AssistantCoach.jsx` — só reexporta (sem lógica)
- `client/src/GameLayout.jsx` — `handleTutorialNavigate` (tab + `setMobileSubMenu`)
- `client/src/views/TacticsView.jsx`, `ClubTab.jsx`, `components/shared/BadgeSkills.jsx`, `components/layout/{Sidebar,MobileNav}.jsx` — âncoras `data-tour`

## Diagnóstico

### Destaque (spotlight) — `CoachTutorial.jsx:47-103`

1. **Medição única, depois congelada.** `tryMeasure` pára o polling no primeiro alvo encontrado. Mas o alvo mede-se a meio de animações: transição de tab (`AnimatePresence`, ~0,22s), fly-up mobile aberto por `setMobileSubMenu`, `scrollIntoView({behavior:"smooth"})` medido no `requestAnimationFrame` seguinte, e o overlay a entrar com `y:120`. O anel fica desfasado do elemento real. Não há `ResizeObserver` nem re-medição depois de assentar.
2. **Alvos ambíguos.** `findTarget` devolve o primeiro elemento visível. `tactic-play` existe duas vezes (`TacticsView.jsx:1025` e `:1294`); `player-skills` é uma instância por linha de jogador.
3. **Spotlight em 4 faixas** sem clamp ao viewport: alvo parcialmente fora do ecrã dá larguras/alturas negativas e "buracos" no escurecimento.
4. **Sem `visualViewport`.** No telemóvel a barra do browser altera o viewport e `onResize` não cobre isso.

### Boneco e balão — `CoachTutorial.jsx:160-230`

5. **Balão fixo ao centro** (`items-center justify-center`), ignora onde está o destaque. Em `club-staff`, `player-skills`, `tactic-titulares` e `tactic-lineup` tapa o próprio alvo; nos alvos da nav mobile (em baixo) pode sobrepor-se ao fly-up.
6. **Dois bonecos montados** (`sm:hidden` + `hidden sm:block`): dois `setInterval` de 420ms e imagens carregadas duas vezes.
7. **Orientação inconsistente.** As dicas normais espelham o boneco em desktop (`flipOnDesktop` + `lg:flex-row-reverse`); o tutorial nunca espelha e o rabicho fica sempre à esquerda (`-left-[11px]`).
8. **Tamanho com salto.** Tutorial: `compact` até `sm`, normal depois. Dica normal: outro breakpoint (`lg`).

## Passos

0. **Reproduzir.** Com a skill `run`, capturas de cada passo em mobile (~400px, portrait e landscape), tablet e desktop. Confirma quais dos pontos acima são reais e dá o "antes".
1. **Medição robusta.** Extrair um hook `useTargetRect(step)`:
   - mede em `requestAnimationFrame` contínuo durante ~600ms após navegar (cobre as animações) e fica ligado a `ResizeObserver`, `scroll` e `visualViewport`;
   - `scrollIntoView({behavior:"instant"})` antes de medir;
   - só devolve o rect quando estabiliza em 2 frames seguidos.
2. **Alvos inequívocos.** `data-tour` únicos (ex.: `tactic-play-btn`) ou índice no passo; para `player-skills`, marcar só a primeira linha visível. Escolher a primeira instância dentro do viewport.
3. **Spotlight simplificado.** Um único anel com `box-shadow: 0 0 0 100vmax rgba(0,0,0,.7)`, clamp ao viewport e transição suave entre passos (substitui as 4 faixas).
4. **Balão que desvia do alvo.** Escolher o lado livre a partir do `rect`: alvo na metade de cima → balão em baixo, e vice-versa. Em mobile, balão no topo quando o alvo é o fly-up. Passo sem alvo continua centrado.
5. **Boneco único.** Uma só instância de `AssistantMascot`, tamanho responsivo por classes e os mesmos breakpoints da dica normal. Espelhar boneco e rabicho conforme o lado do balão, reutilizando a lógica do `flipOnDesktop`.
6. **Verificar.** Repetir as capturas, `npm run check:types` e lint; percorrer os 11 passos em Voltar/Seguinte e confirmar que o anel não "salta". Se existir o harness `client/assistant-resp-test.jsx`, acrescentar-lhe o tutorial.

## Ordem e commits

0 → 1 e 2 (corrigem o destaque, a maior parte) → 3 a 5 (layout) → 6. Um commit pequeno por bloco.

## Em aberto

- Capturas do utilizador (ecrã + passo) onde o desvio é mais visível, para priorizar a reprodução.
