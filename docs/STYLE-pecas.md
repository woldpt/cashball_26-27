# STYLE-pecas.md — CashBall · Peças com especificação própria

> Complemento do `STYLE.md`: páginas e assets com regras próprias (Jornal, marcas de patrocinador, camisolas). Ler antes de mexer nestas peças.

## Jornal — caixa de entrada (JournalTab)

A tab Jornal é a **caixa de entrada do treinador** (hub estilo CM2001):
tópicos à esquerda e detalhe à direita no desktop, uma só linha de filtros
(Todas, O Meu Clube, Competições, Plantel, Mercado). O detalhe segue registo
de imprensa clássica: manchete em tinta forte, entrada com capitular
(só a partir de 140 caracteres) e filetes a separar corpo e ações.
As cores por categoria vivem em `FILTER_TONES` no `JournalTab.jsx`.

**Pendências (redFlag):** a urgência vive só no booleano `redFlag` —
nunca emojis nos títulos. Linha da lista com faixa lateral `error`, `Badge`
`error` «Ação necessária» e linha secundária com dado útil por tipo
(`flagSummary`: salário exigido / clube + classificação / patrocínio /
orçamento). Detalhe com faixa `error`, selo «Ação necessária» +
«Bloqueia o Pronto» e painel de ação rico antes do corpo
(`FlagActionPanel` + `InboxActions` partilhado, botões `md`).

## Marcas de patrocinador

Símbolo transparente, `viewBox="0 0 100 100"`, em `client/public/sponsors/<id>.svg`
(o id vem de `sponsors.ts`) — **nunca editado à mão em bruto**: o gerador é que
normaliza e cose a silhueta branca. `npm run sponsor:marks` reescreve os 60
(idempotente; `-- --check` deteta deriva). O nome da marca **não** vive no SVG:
é texto no `SponsorLogo` e no patch da camisola, com o nome curto do catálogo.

O tamanho-alvo é o remendo no peito da camisola (**22 unidades**, `TeamKit.jsx`);
o mesmo desenho é visto a 44–48px nas listas.

| Regra | Limite |
|---|---|
| Caixa / normalização | lado maior 74 em 100, centrado, `data-art` + `data-halo` (gerador) |
| Formas | ≤ 5 por marca |
| Espessura mínima | ≥ 6 unidades no espaço final — abaixo disto desaparece a 22px |
| Cor | 2 cores de marca + 1 acento, tiradas do `bg`/`fg` de `sponsors.ts` |
| Contraste | nenhuma marca só com cores claras (≥ 1 forma com luminância ≤ 0,8): a silhueta branca não salva um corpo branco em camisola clara |
| Semântica | a silhueta diz o setor sem o nome (teste a 22px) |
| Proibido | `clipPath` (regra do projeto), `<text>` desenhado, `<image>` embutida |

**Aceite:** `npm run sponsor:sheet` → folha com as 60 a 22px (tamanho do remendo)
e 44px (listas) sobre claro/creme/navy/escuro. A leitura a 22px decide; o craft
vê-se a 96px.

## Camisolas

Molde único (`clipPath id="k"`), `viewBox="0 0 100 100"`, em
`client/public/kits/<slug>.svg` a partir de `server/db/fixtures/kits.json`
(cores classificadas das fotos do zerozero) — **nunca editado à mão**: o
gerador reescreve as 120 (casa + fora). `cd server && npm run generate:kits`
(`-- --check` deteta deriva); `npm run test:kit` exige as 120 válidas e fora ≠ casa.

A de fora (`<slug>_away.svg`, cores trocadas, mesmo padrão) só se usa quando
as duas de casa empatam: o `useKitClash` compara os SVGs e a equipa de fora
veste a de fora (placar do `LiveMatchHero`, `DuelHero`). Em 404 da camisola,
o `TeamKit` cai para o `TeamCrest` em vez de deixar vazio.
