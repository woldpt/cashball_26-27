## Adjunto: canto inferior direito, clique dispensa, dica do 11 semanal→por sala (2026-10-01)
- Queixas: (1) em desktop o adjunto «parecia a voar» (centrado em baixo); (2) só o ✕ dispensava; (3) «sempre com as mesmas questões do 11 não estar definido».
- Fix 1 (`components/shared/AssistantCoach.jsx`): `lg:justify-end lg:pr-6` + `lg:flex-row-reverse` → medalhão no canto inferior direito com o balão à esquerda; rabicho espelhado por variantes `lg:` (`left-auto`/`-right-[9px]`/`border-r`). Mobile intacto (canto esquerdo + balão à direita).
- Fix 2: `onClick={onDismiss}` no balão + `cursor-pointer` (o CTA continua a navegar e o ✕ mantém o caminho de teclado).
- Fix 3 (`hooks/useAssistantCoach.js`): `ONCE_PER_ROOM_TIPS = {lineup}` + `seenKeyFor()` — a dica do 11 passa a 1x por SALA em vez de por jornada. Verificado que a regra não é falsa: o cliente espelha `checkLineupReady` do servidor (11 + banco 7 com 1 GR). Efeito colateral positivo: era a dica do 11 que ficava sempre à frente e tapava as restantes (treino/finanças).
- Checks: `lint` limpo nos 2 ficheiros · `check:types` OK · `test:mobile assistant-resp-test` PASS 5/5. Desktop não tem harness: verificado com screenshot próprio da harness a 1280/1536 px (medalhão no canto, rabicho a apontar para o retrato) + 390 px para confirmar que o mobile não mudou.

