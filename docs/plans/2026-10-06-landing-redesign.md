# Redesenho da landing page

**Data:** 2026-10-06
**Estado:** concluído (fases 1–5). Extra: `--color-bg` não existia no `@theme` (`bg-bg`/`from-bg` eram no-op) — definido como `#131313`.
**Âmbito:** `client/src/components/auth/` (LandingPage e filhos). `RoomSelectScreen`, `ReconnectScreen` e os formulários de auth ficam fora, salvo retoques visuais no `AuthCard`.

## Diagnóstico

A landing é correta, mas fica plana:

- **Hero sem imagem.** Só há texto, um cartão de jogo e um fundo quase preto com uma linha de giz a 7 %. Nada mostra o estádio nem o ambiente de jogo, que são a parte mais vistosa da app.
- **O direto não conta uma história.** O minuto avança, mas o resultado (2–1) e os 3 eventos ficam fixos desde o 63'. O golo do 64' já aparece antes de o relógio lá chegar.
- **A montra é uma pilha de painéis.** Widgets, plantel, tabela e jornal aparecem sem títulos nem texto: quem chega não percebe o que está a ver nem porque importa.
- **Falta o "como funciona".** O fluxo conta-a, cria sala, sorteio do clube, joga com amigos só aparece numa frase do hero.
- **Não há fecho.** Depois da montra vem logo o rodapé. Não há nenhum CTA para voltar ao formulário.
- **O cartão de auth não se destaca do fundo.** Tem a mesma superfície dos painéis, sem profundidade nem brilho.

## Princípios

- Só reutilizar: `StadiumIllustration`, `Panel`, `SummaryWidget`, `PlayerRow`, `Button`, os `public/backgrounds/*.webp` e o `framer-motion`, que já está instalado. **Sem dependências novas.**
- Só tokens (STYLE.md §1). Em escalas responsivas, usar apenas `base → sm → xl` (armadilha do §7).
- `short:` (mobile landscape) continua a mostrar só o hero e a auth, sem a montra.
- `prefers-reduced-motion`: sem animação de entrada nem relógio, só o estado final.

## Fases (um commit por fase)

### Fase 1: Hero com estádio

- `LandingBackground`: tirar o círculo de giz. Pôr por trás do hero uma `StadiumIllustration` (`capacity≈60000`, `mood≈45` para a festa, `weather` noturno/limpo e cores primary/tertiary), a ocupar a largura toda até ~70vh. Por baixo, um gradiente `to-bg` para fundir com a página. Opacidade de ~35–45 % para o texto continuar legível.
- A ilustração é `memo` e as animações de festa são CSS. Confirmar que não pesa no mobile (Performance do DevTools com CPU 4×). Se pesar, usar `mood` neutro (é estático e não custa nada).
- `HeroSection`: título maior em `xl` e uma linha de 3 "chips" de valor por baixo do parágrafo (ícone Material + texto curto: *Multijogador em tempo real · Leilões e mercado · Taças e campeonato*).

### Fase 2: Direto com narrativa

- Começar no 61' com 1–1, mostrar só os eventos com `minute <= minuto atual` e calcular o resultado a partir dos eventos. Assim o golo do 64' "acontece" à frente do utilizador: o evento entra animado e o placar pisca a `primary`.
- Pôr uma barra fina de progresso do jogo (minuto/90) no rodapé do cartão.
- Ao chegar aos 90', recomeçar do 61' após uma pausa curta, para que quem fica na página continue a ver movimento.
- `landingShowcase.js`: os eventos passam a levar `side: "home" | "away"` para se poder derivar o resultado. Remover `homeGoals`/`awayGoals`.

### Fase 3: Cartão de auth com profundidade

- `AuthCard`: sombra `shadow-2xl shadow-black/50`, anel `ring-1 ring-primary/15` e um brilho radial `primary-container` atrás do cartão (pseudo-camada absoluta). O fundo passa a `bg-surface-container/90 backdrop-blur` para deixar ver o estádio.
- Não mexer nos formulários.

### Fase 4: Montra com secções explicadas

- Substituir a pilha por **3 blocos alternados** (texto ↔ visual), cada um com kicker, título e 1–2 frases:
  1. **Gere o plantel:** `PlayerRow` ×4 e os widgets.
  2. **Compete na liga:** a mini-classificação.
  3. **Vive a jornada:** o jornal, com `backgrounds/jornal.webp` como textura atenuada.
- Entrada com `motion` `whileInView` (fade + 16px, `once: true`), desligada com reduced motion.
- Layout: `grid sm:grid-cols-2`, alternando a ordem com `sm:order-*` (sem `md`/`lg`).

### Fase 5: "Como funciona" e CTA final

- 3 passos numerados, numa linha (ícone + título + frase): *Cria conta → Sorteio do clube → Joga com amigos*.
- Banda final com o título "O balneário espera por ti" e um `Button primary` que faz scroll até ao topo e põe o foco em `#login-name`.
- `LandingFooter` fica igual.

## Fora do âmbito (adiado)

- Screenshots/vídeo reais do jogo: dependem de assets novos. Avaliar depois da fase 4.
- Tema claro da landing: a app é dark-only.
- Testemunhos ou contagem de jogadores online: não há dados reais.

## Verificação (por fase)

- `npm run check:types` e o lint do cliente.
- Ver no browser a 390×844, 844×390 (`short:`), 768 e 1440: sem scroll horizontal, header/marca visíveis em `short:`, contraste do título sobre o estádio (AA).
- Ativar reduced motion no DevTools: relógio parado, sem animações de entrada.
- Fluxo login → `mode` (RoomSelectScreen): a transição de saída da landing continua a funcionar.
