# Session Context Compact — Cashball Room Joining Fix (v2)

## Resumo da Sessão

Sessão focada em resolver o bug "Não entra no Lobby apos seleccionar a sala". O utilizador conseguia autenticar-se e selecionar uma sala, mas a app nunca transitava da LandingPage para o lobby do jogo.

## Problema Raiz: Chicken-and-Egg com `teamAssigned`

**FLUXO ROTO (antes da correção):**

1. User clica Join → `setMe({ name, password, roomCode: "" })` → **sem `teamId`**
2. Servidor emite `joinGameSuccess` → App.jsx atualiza `me.roomCode` mas **ainda sem `teamId`**
3. `if (!me || !me.teamId)` → **TRUE** → mostra LandingPage
4. Servidor emite `teamAssigned` (com `teamId` pretendido)
5. **Ninguém ouve!** O listener `teamAssigned` está apenas em `useSocketListeners.js` que corre dentro de `GameProvider`
6. `GameProvider` só monta quando `me.teamId` é truthy → **NUNCA monta** → loop infinito na LandingPage

**CAUSA SECUNDÁRIA:** O handler de `teamAssigned` em `useSocketListeners` tinha um guard `if (!currentMe?.name || !currentMe?.roomCode) return;` — quando `teamAssigned` chega, o React ainda não processou a atualização do `me.roomCode` (porque `joinGameSuccess` e `teamAssigned` chegam no mesmo event loop). Isto fazia o handler abortar mesmo que o `GameProvider` estivesse montado.

## Solução Aplicada

### 1. `client/src/App.jsx` — Montagem Antecipada do `GameProvider`

- **Antes:** `if (!me || !me.teamId) { return <LandingPage />; }`
- **Agora:** `if (!me) { return <LandingPage />; }` → `GameProvider` monta logo que `me` existe
- Enquanto `!me.teamId`, mostra ecrã de carregamento "A entrar na sala..."
- Quando `teamAssigned` chega → `me.teamId` fica definido → `GameLayout` aparece
- Isto garante que `useSocketListeners` está registado **antes** de qualquer evento do servidor chegar

### 2. `client/src/hooks/useSocketListeners.js` — Guard do `teamAssigned` Corrigido

- **Antes:** `if (!currentMe?.name || !currentMe?.roomCode) return;`
- **Agora:** `if (!currentMe?.name) return;`
- O `roomCode` pode não estar atualizado no ref porque React ainda não processou o `joinGameSuccess`

## Estrutura Final do Render

```
if (!me)        → LandingPage (autenticação/criação de sala)
GameProvider     ← monta sempre que me existe
  ├─ !me.teamId → LoadingScreen "A entrar na sala..."
  └─ me.teamId  → TacticsProvider → GameLayout (lobby do jogo)
```

## Commits Realizados

| Hash      | Mensagem                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| `d758fc0` | fix: remove startTransition from session loading to fix auto-join race condition, add socket.connected check |
| `7e7cf82` | docs: add session context compact for room joining fix                                                       |
| `4a5a522` | fix: mount GameProvider as soon as me is set so teamAssigned listener is registered before server emits it   |

## Próximos Passos

1. Testar com hard refresh (Ctrl+Shift+R) para garantir cache limpa
2. Verificar se o lobby carrega com todos os dados (teams, squad, gameState)
3. Se necessário, adicionar logging no servidor para `joinGame` / `teamAssigned`
