# CashBall 26/27

Jogo de gestão de futebol no browser, inspirado no **Elifoot 98**. Começas na base, montas o onze, defines a tática e lutas pela subida — sozinho ou com até **8 treinadores humanos** na mesma sala, cada um ao seu ritmo.

Sem horários fixos: submetes a tática quando podes e carregas em **Pronto**. Quando todos confirmam, a simulação corre em direto, minuto a minuto.

## Como se joga

1. **Cria conta e entra numa sala** (ou cria a tua e partilha o código).
2. **Prepara a equipa:** escolhe o onze, o banco (com suplente para a baliza), a formação e a mentalidade.
3. **Carrega em Pronto** e vê o jogo em direto — primeira parte, intervalo (com substituições), segunda parte e, na Taça, prolongamento e penáltis.
4. **Gere entre jornadas:** treina, compra e vende, ajusta preços de bilhetes e o estádio, renova contratos.

## O que há para gerir

- **Plantel:** cada jogador tem qualidade (`skill`), salário e agressividade. Só médios e avançados podem ser **craques** — cada craque no onze aumenta a hipótese de um golo decisivo.
- **Liga (4 divisões):** todos contra todos, a duas voltas, 14 jornadas por época. Os de cima sobem, os de baixo descem. Começas no Campeonato de Portugal.
- **Taça de Portugal:** eliminação direta, 5 rondas até à final. O atalho para a glória — e para os prémios.
- **Mercado:** preços negociados e **leilões rápidos** de 2 minutos. Se o plantel estiver curto, o clube desenrasca juniores para nunca faltares ao jogo.
- **Dinheiro:** salários, bilheteira (o preço do bilhete e o humor dos adeptos contam), patrocínios e obras no estádio. Cofre vazio e maus resultados levam ao **despedimento**.
- **Carreira:** o prestígio abre portas a convites de clubes maiores. Ganha, sobe e segura o lugar.

## Entrar num jogo

Basta um browser moderno, no computador ou no telemóvel. Registas-te, escolhes «Continuar jogo» ou «Novo jogo», e jogas a partir do separador **Jornal** — manchete da jornada, classificação, artilheiros e mercado.

## Para programadores

Stack: React 19 + Vite + Tailwind 4 no `client/`; Node + Express 5 + Socket.io 4 no `server/` (TypeScript); SQLite; `docker compose` para a stack completa.

```bash
docker compose up --build        # stack completa
cd server && npm run dev         # backend
cd client && npm run dev         # frontend
cd server && npm run seed        # repor dados base
```

Documentação do repo: `AGENTS.md` (operações e regras), `CLAUDE.md` (arquitetura), `STYLE.md` (design system), `docs/`.
