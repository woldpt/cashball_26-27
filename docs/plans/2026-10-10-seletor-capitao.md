# Seletor de capitão: pílula + cartão próprio

Origem: o menu nativo (`<select>`) do capitão na Tática não encaixa no visual do jogo. A lista que abre é desenhada pelo sistema, a seta do navegador fica visível e os nomes longos cortam-se.

## Estado

- **Pílula + cartão próprio** (estilo do `StatusPicker`) em `client/src/views/TacticsView.jsx`, no lugar do `<select>`. Fecha com clique fora ou Esc. A escolha grava-se como antes (`captainId`).
- **Fundo sólido:** `surface-container` tem 10% de transparência e deixava ver as linhas do plantel; o cartão tem uma camada `bg-bg` por baixo.
- **Coluna «Titulares»:** `overflow-hidden` → `overflow-visible` (opção A). Com 7 titulares a última opção estava cortada e não se clicava; agora clica-se.

## Verificado

- `npm run lint`, `npm run check:types`, `npm run test:mobile` (5 larguras, PASS).
- Capturas 390 e 1440: lista aberta e escolha gravada.
- Medido no navegador com 7 titulares: última opção clicável (antes, com `overflow-hidden`, não).

## Por fazer / a confirmar

- Pop-ups de estado (Titular/Suplente/Excluído) das últimas linhas: deve deixar de ser cortados pelo mesmo motivo; não testado.
- Opções B e C ficaram de fora.
