# Plano — melhorias à `LandingPage.jsx`

Ficheiros: `client/src/components/auth/LandingPage.jsx`, `RoomSelectScreen.jsx`, `LoginForm.jsx`, `RegisterForm.jsx`, `client/src/App.jsx` (`landingProps`, linha ~130).
Nota atual: 8/10. Sem bugs; problemas de manutenção.

## Princípios

- Sem contexto novo, sem libs: só agrupar props e limpar. (YAGNI)
- Um commit por fase (regra do projeto), só os ficheiros tocados.
- Comportamento visual e fluxo de auth inalterados.

## Fase 1 — Fase de auth explícita (risco baixo)

- Problema: `authPhase === "login" ? <LoginForm/> : <RegisterForm/>` — qualquer valor desconhecido cai no registo.
- Fazer: `authPhase === "register" ? <RegisterForm/> : <LoginForm/>`? **Não** — manter fallback seguro = login (o ecrã menos destrutivo). Alternativa igualmente barata: dois ramos explícitos e `null` no resto.
- Decisão: fallback para `LoginForm`, com `"register"` explícito.
- Verificar: `useAuth.js` — confirmar todos os valores que `authPhase` pode tomar (`login` | `register` | `mode`).

## Fase 2 — Handlers e JSDoc (risco nulo)

- Remover `@typedef LandingPageProps` e passar ao padrão do `CLAUDE.md`: `@param {Object} props` + um `@param` por prop + `@returns {JSX.Element}`; tipos reais em vez de `function` (`@param {(v: string) => void} props.setName`).
- `clearAuthError` / `createAccount`: manter (são triviais); não usar `useCallback` (os filhos não são memoizados — sem ganho).
- Verificar: `npm run check:types`.

## Fase 3 — Agrupar props (o ganho principal)

Hoje: 27 props planas; `availableSaves`, `setAvailableSaves`, `token`, `backendUrl`, `isNewAccount`, `joinMode`, `selectJoinMode`, `handleLogout`, `handleJoin`, `joining`, `joinError`, `roomCode`, `setRoomCode` só servem o `RoomSelectScreen`.

1. `App.jsx` `landingProps` passa a ter 3 grupos:
   - `form` → `name, setName, password, setPassword, confirmPassword, setConfirmPassword, authSubmitting, authError, setAuthError`
   - `room` → tudo o que é só do `RoomSelectScreen`
   - topo → `authPhase, setAuthPhase, disconnected, resetAuthFlow, handleAuthenticate, me`
2. `LandingPage` desestrutura 6 props em vez de 27 e faz `<RoomSelectScreen {...room} name={form.name} .../>`.
3. `LoginForm`/`RegisterForm`: receber `form` (+ `onSubmit`, `onBack`…) em vez de 6–9 props soltas. Ajustar JSDoc.
4. `RoomSelectScreen`: manter a API de props atual (recebe o spread de `room`) — sem alterar o corpo.
- Ceiling: se `RoomSelectScreen` crescer, só então um contexto próprio.

## Fase 4 — Verificação

- `npm run check:types` e lint.
- Manual (via skill `run`): login, registo, voltar do registo, erro de auth a limpar ao escrever, entrada em sala, reconexão (`me && !me.teamId`), viewport `short:` e mobile.
- Grep por outros consumidores de `LandingPage`/`landingProps` (hoje só `App.jsx`) antes de fechar.

## Fora de âmbito (decidido não fazer)

- Contexto/Provider para a landing — excessivo para um único consumidor.
- Memoização dos handlers — sem benefício medido.
- Mover estado de saves para dentro do `RoomSelectScreen` — mexe no `useAuth` (fetch/limpeza no logout); só se a Fase 3 não bastar.

## Ordem e commits

1 → 2 → 3 → 4. Mensagens: `refactor: LandingPage com fase de auth explícita`, `docs: JSDoc da LandingPage no padrão do projeto`, `refactor: LandingPage agrupa props em form/room`.
