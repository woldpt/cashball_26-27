# Plano — sombra subtil nos logotipos dos crests

> Executar tal como está; algo fora do plano → parar e perguntar. pt-PT sempre; frontend só JS.

## Problema

Hoje o `<img>` do crest leva `bg-[color_primary]` + `shadow-md` **no próprio elemento**: a sombra desenha-se à volta do quadrado/círculo, não do logótipo. `filter: drop-shadow` no mesmo `<img>` também sombrearia o fundo inteiro (acompanha o alfa do elemento, fundo incluído). Para sombrear só o logótipo, o fundo colorido tem de sair do `<img>` para um wrapper.

## Abordagem

1. **Utilitário único** em `client/src/index.css` (Tailwind 4, `@utility`):
   ```css
   @utility crest-shadow {
     filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.45)) drop-shadow(0 2px 4px rgb(0 0 0 / 0.25));
   }
   ```
   Duas camadas curtas = sombra suave sem "mancha". Valores afináveis num só sítio. (Confirmar nome/ficheiro do CSS global antes de editar.)
2. **Estrutura por crest**: `<span style={{bg}} class="círculo/rounded border">` → `<img class="crest-shadow object-contain p-1 w-full h-full">`. O `shadow-md` do tile mantém-se (sombra do cartão) ou sai se ficar redundante — decidir no ecrã.
3. **Fallback (inicial/3 letras)**: sem alteração — não é logótipo.

## Fase 1 — componentes partilhados (cobre a maioria dos ecrãs)

- `components/shared/TeamCrest.jsx` — wrapper com `circle` + bg; `<img>` filho com `crest-shadow`. Mantém `onError`/`failedCrest`.
- `components/live/TeamCrest.jsx` — idem; o `rotate/scale` (`mediaStyle`) passa para o wrapper. **Nota:** hoje há dois atributos `style` no `<img>` (o 2.º vence e o `mediaStyle` é ignorado) — bug latente; ao mover o bg para o wrapper fica resolvido, mas verificar que o resultado visual do `rotate` no Live é o pretendido.

## Fase 2 — sítios com `<img>` direto (mesmo padrão, um a um)

`PlayerHistoryModal.jsx:220` · `WelcomeModal.jsx:39` · `TransferHub.jsx:54` · `CupFinalStage.jsx:120,135` · `LiveMatchHero.jsx:205,220` · `AuctionResultRow.jsx:22` · `DuelHero.jsx:112,135` · `ClubTab.jsx:396` · `CalendarioTab.jsx:228`.

Preferir **trocar por `shared/TeamCrest`** onde o layout o permitir (menos duplicação); onde não, aplicar o mesmo wrapper + `crest-shadow` localmente. Não criar abstração nova.

## Verificação

- `npm run check:types` + build do cliente.
- Olhar (browser) em: Clube, Calendário, Live/Briefing, Leilões, Taça — modo claro/escuro e crest com logótipo **escuro sobre cor escura** (a sombra não deve sujar; se sim, baixar opacidade).
- Crest que falha a carregar → continua a cair para a inicial.
- Performance: `drop-shadow` é filtro de GPU; em listas longas (classificações, transferências) testar scroll em mobile. Se pesar, usar só 1 camada nessas listas.

## Fora de âmbito

Sombra no fallback de letras, mudança de cores/bordas, `STYLE.md` (acrescentar 1 linha ao token só se o utilitário ficar).
