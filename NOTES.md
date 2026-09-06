# NOTES.md — Estado corrente do projeto

> **Regra (1 ficheiro, nunca um por sessão):**
> - Atualizar no fim de cada tarefa/funcionalidade — e antes de fechar a sessão.
> - Bullets curtos em pt-PT. Blocos antigos (> ~2 semanas) já refletidos em commits: apagar.
> - Regra permanente descoberta → mover para `AGENTS.md`/`CLAUDE.md`/`STYLE.md` e remover daqui.
> - Ao iniciar uma sessão nova: ler este ficheiro + `git log --oneline -10`.

## Em curso

- (nada)

## Último estado

- `StadiumIllustration` passa de cena noturna a diurna (dia limpo): céu azul claro, sol + nuvens em vez de estrelas, cobertura cinzento metálico, projetores apagados (torres mantêm-se, sem brilho). Chega a `StadiumTab` e `ClubTab` sem mexer nas vistas. Verificação: lint + check:types ok.

- Fetch Segunda Liga via TUI (commit `c3bced7`, sem push): 12/12 D2 OK 0 erros — Marítimo 22 fotos novas, resto merge plantel/cores/emblema + skip; 12 fotos treinador em `client/public/coaches/`. TUI ganhou resumo permanente por equipa + `extractCoachPhoto` (<img /img/treinadores/>, og:image é placeholder). Pipeline `manager.photo`: schema + seed + migração `gameManager` + `coach_photo` em `getTeamsWithCoachNames`. Verificação: typecheck + seed 60 + audit base 0/0. Nota: fotos Segunda que já estavam untracked antes deste job continuam por commitar (fora do âmbito).

- Fix build Docker (`UNRESOLVED_IMPORT` ×4): `ff695d7` apagou os JPGs de `client/src/assets/` mas `ClubTab.jsx` ainda os importava — banner do estádio migrado para `StadiumIllustration` (SVG, cores da equipa), igual ao `StadiumTab`; bloco `stadiumImg` removido. Verificação: lint + check:types ok, zero imports de `assets/` em `src/`. Build local por verificar (`client/node_modules` de root, `EACCES` no npm install) — falta `docker compose up --build` do lado do utilizador.

- Audit + fix `fetchZerozeroTUI.ts` (commit `63f4c2d`, sem push): plantel faz merge (posição/idade/flag/zerozeroId + top-up a mínimos GR3/DEF6/MED6/ATA5) em vez de `slice(0,22)` todo-MED; `downloadImage` filtra placeholder por URL e valida `content-type`; multiselect com `initialValues: []`; opção `estádio` removida (era no-op); emblema/treinador reutilizam `crest`/`photo` existentes; `zerozeroUrl` persiste nas fixtures; `fotoJogadores` usa ID primeiro + salta ficheiros existentes; cache nas páginas de equipa; flags CLI `--equipas/--info/--dry-run/--refresh/--help`; retoma = `tui_state.json` + gravação progressiva. Corrigidos no caminho: `initialValues` (não `defaultValues` no @clack 1.7), genérico `multiselect<InfoKey>`, `--info` case-insensitive. Verificação: typecheck ok; dry-run Marítimo `22/32 actualizados → 3/7/6/6` sem gravar.

- Audit pt-PT de `server/game/commentary.ts`: 24 correções (calm down→"calma, rapaz", Red card→"Cartão vermelho", zíper→fecho, vestiário→balneário, juiz→árbitro, técnico→treinador 3×, atacante→avançado, bancais→bancadas, assistência→bancada, trave→barra 7×, despeje→corte, "Toque de mais"/"produziu o cartão da camisa", meia-lua→meia bota, "Bola ao ar/cotas/bookmakers/pranchetas"→pt-PT, Spoiler→Alerta) + 4 remates de humor (táticas início/2.ª parte, prolongamento, final). "Contra" verificado: só sentido de adversário, sem violação; "Rua!" mantido (gíria pt-PT). Verificação: 0 erros no ficheiro no `typecheck` (2 erros pré-existentes em `scripts/fetchZerozeroTUI.ts`, fora do âmbito).

- `StadiumTab` com SVG paramétrico (`StadiumIllustration.jsx`, vista lateral em corte): 1/2/3 anéis + cobertura/camarotes/telão por escalão de lotação, bancadas e faixa nas cores da equipa, escala subtil até 120k; 4 JPGs (~800KB) removidos. Verificação: lint + check:types ok.

- Scroll interno das tabs full-bleed (`squad`/`leiloes`): o wrapper `overflow-hidden` esperava que `TeamSquadView`/`AuctionsPage` preenchessem a altura, mas a cadeia intermédia `grid.grid-cols-1 → div → motion.div` (sem classes) era auto-altura — a árvore ficava à altura do conteúdo e o wrapper cortava sem scrollbar. Fix: variável `isFullBleedTab` em `GameLayout.jsx` aplica só às full-bleed `flex-1 min-h-0` na cadeia + `grid-rows-[minmax(0,1fr)]`. Verificação: lint + check:types ok; mobile-resp portrait 125/125 + landscape 150/150 PASS; screenshots 390×844 e 667×375 ok.

- Cards de sala em `RoomSelectScreen.jsx` compactados em todas as vistas: `p-5 gap-3`→`p-4 gap-2`, nome `text-lg`→`text-base`, grid `gap-4`→`gap-3` (`short:gap-2.5`). `roomselect-resp-test` PASS em portrait (125/125) e landscape 414–1023×375; screenshots 390×844 e 844×390 ok.

- Landing hero (landscape only, `short:`): título/frases rotacionais aumentados para `clamp(1.4rem,4.5vw,2.2rem)` e cartão "Painel do Treinador" diminuído — `max-w-xs` (320px), `p-2.5`/`space-y-1`, h2 `text-base`, inputs `py-1`, CTAs `py-1.5`/`py-1`. Chips de stats do hero (Divisões/Treinadores/Simulação) removidos — redundantes com os cards de features em baixo. Verificação: portrait 125/125 + landing landscape 6/6, screenshots 667×375/844×390 ok, portrait inalterado.

- 3 defeitos de landscape corrigidos (detectados pela nova landscape pass — código do app nunca testado em landscape antes): (1) `RoomHub.jsx` — lista de players `max-h-40` (160px fixos) + coluna mobile `flex-col` deixava o input fora do ecrã em h=375; agora `max-h-[16dvh]` (proporcional, `sm:max-h-none` mantém desktop). (2) `UserList.jsx` (tabela desktop) — nome sem espaços forçava `min-content` 460px > coluna `w-1/2` (clip em 844/926); agora `table-fixed` + `truncate` na coluna Nome, Salas `w-24`, chevron `w-12`. (3) `welcome-resp-test.jsx` — bug de medição do harness: comparava `scrollHeight` com o disponível; o card em `short:` é deliberadamente capado+scrollable (`max-h-[calc(100dvh-2rem)]`), passou a medir `offsetHeight` (renderizado) — um card clipado continua a dar FAIL. Verificação: portrait 125/125 + landscape 150/150 PASS, screenshots ok.

## Decisões recentes

- Skill `mobile-resp-check`: gatilho reduzido a **mudanças estruturais** de layout (nova view/tab/modal, `GameLayout.jsx`, `index.css`, novo componente partilhado, grid/flex/larguras) — tweaks pequenos (padding/cores/texto) não disparam. Adicionada **landscape pass obrigatória**: `cd client && npm run test:mobile:landscape` (widths 568–1023, height 375); a verificação só está completa com portrait + landscape em PASS.

## Armadilhas / "não fazer"

- Frontmatter YAML de skills (`description`): scalar plain não pode conter `:` seguido de espaço (ex. "passes: portrait") — o parser `yaml` do pi falha com `BLOCK_AS_IMPLICIT_KEY`. Sempre entre aspas duplas quando há colones internos.

## Próximos passos

- (nada)
