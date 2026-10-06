# WaitingCoachesModal — redesign (2026-10-06)

Problemas: cabeçalho pouco informativo ("N/M prontos"), nada diz *quem* falta; o congelamento por coach ausente (regra central do jogo) não é explicado; lista e chat com receitas à mão (`gray-*`, `text-[8–9px]`); chat duplicado do RoomHub (sem agrupamento, sem scroll inteligente, sem gap anti-spam).

Feito:
1. `ChatComposer` partilhado (input + respostas rápidas + gap 1 s) e `ChatMessages` com ref própria → o modal reutiliza o chat do RoomHub (remove `chatMessagesRef` do GameContext).
2. Hero: ícone `hourglass_top`/`check_circle`, título "À espera de X" / "À espera de N coaches" / "Todos prontos!", lista de quem falta, contador grande `n/total` e barra segmentada (1 segmento por coach).
3. Banner de pausa quando há coaches offline (o jogo congela até regressarem).
4. Linhas de coach: faixa na cor do clube, anel de estado no avatar (pulsa se a pensar), `Badge` partilhado (`success`/`warning`/`error`).
5. Rodapé com `Button` partilhado; "A observar o jogo" com ícone.
6. Mobile: lista limitada a 34 % da altura, chat a ocupar o resto; ≥560 px lado a lado (coaches 290 px).
