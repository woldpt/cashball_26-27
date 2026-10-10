# Faixa "A fechar a jornada…" (2026-10-10)

- **Objetivo:** mostrar uma faixa discreta enquanto o servidor fecha a jornada (resultados, finanças, treinos, moral, notícias).
- **Servidor** (`weeklyFlowHelpers.ts`): emite `roundFinalizing {active}` ao entrar em `match_finalizing` e no `finally` do fecho.
- **Cliente:** estado `finalizing` (GameContext) ligado em `hooks/socket/match.js`; faixa em `GameOverlays.jsx` só depois de 1 s; limpa também ao (re)ligar.
- **Verificação:** typecheck, lint, check:types, audit:socketio, test:connect-smoke, test:mobile.
