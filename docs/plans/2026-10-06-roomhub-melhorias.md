# RoomHub — plano de melhoria (2026-10-06)

Ficheiro: `client/src/components/chat/RoomHub.jsx` (728 linhas, 1 componente). Regra do plano: cada fase é um commit independente; nada de features novas sem dor real.

## Diagnóstico

### Bugs / comportamento errado
1. **Mensagem perdida:** `sendChat` limpa o input mesmo quando `emitChat` descarta por `SEND_GAP_MS` (ex.: quick-message e Enter em <300 ms).
2. **Rate limit mudo:** o servidor limita a 1 msg/s (`socketChatHandlers.ts`, `RATE_LIMIT_MS`) e responde com `systemMessage` **string** — o `onSystemMessage` ignora strings (`typeof data === "string"` → return). O utilizador não vê nada e o gap de 300 ms no cliente não condiz com o 1 s do servidor.
3. **Convite preso:** `sent` e `error` nunca expiram (só `accepted`/`declined` têm timer) → "Convite enviado" fica para sempre se o convidado ignorar; o erro nunca desaparece.
4. **Mensagens de sistema fora de ordem:** renderizadas todas antes das mensagens do chat, em vez de intercaladas por timestamp; key `Date.now()+Math.random()`.
5. **Overflow:** bolha sem `break-words` — uma palavra comprida (500 chars) rebenta o layout.
6. **Enter com IME:** `onKeyDown` não verifica `e.nativeEvent.isComposing`.
7. **Contador errado:** cabeçalho mostra `players.length` (presentes) sem total; com roster devia ser `online/total`.
8. **Kick sem confirmação** (ação destrutiva a 1 clique, botão minúsculo ao lado do nome).

### Performance
- O componente está sempre montado e subscreve **todo** o `GameContext` → re-render a cada mudança de contexto mesmo fechado; `coaches`/`teamById`/`memberNames` recalculam fechado.
- `getChatHistory` é pedido a cada abertura e a cada troca de tab, mesmo com histórico já carregado.
- `formatChatTime` recriado por render (usar `Intl.DateTimeFormat` ao nível do módulo).

### Acessibilidade / UI
- `role="dialog"` sem foco inicial, sem devolver foco ao fechar, sem `aria-modal`; tabs Sala/Global sem `role="tab"`/`aria-selected`.
- Estado do coach só por cor do ponto (daltonismo) — o texto existe mas a 8 px; várias fontes 7–9 px.
- Cores cruas (`zinc-*`, `rose-*`, `sky-*`, `emerald-*`, `amber-*`) em vez dos tokens do `STYLE.md`.
- `style={{maxHeight:72}}`/`width` inline → classes Tailwind.
- Sem indicador "novas mensagens" quando o scroll não está no fundo (o auto-scroll em `GameContext.jsx:~980` salta sempre para o fim ao chegar mensagem, mesmo se estiver a ler histórico).
- Quick-message "🖕" — rever (tom/moderação); sugerir "GG", "Já volto".

### Manutenção
- 728 linhas: lista de coaches, convites, mensagens e input misturados; lógica de convites (estado + timers + 2 sockets) isolável.

## Fases (por ordem de valor/risco)

**Fase 1 — Bugs (1 commit, só RoomHub.jsx)**
- `emitChat` devolve `boolean`; `sendChat` só limpa se enviou. `SEND_GAP_MS` → 1000 (alinhar ao servidor).
- `onSystemMessage` mostra também strings (toast/linha de sistema só do próprio, não broadcast) — confirmar que não duplica o que `useSocketListeners` já faz com strings.
- Timer de expiração para `sent` (ex.: 30 s) e `error` (5 s); centralizar num `setInviteStatus(key, status, ttl)`.
- `break-words` na bolha; `isComposing` no Enter; kick com `window.confirm`/confirmação inline de 2 cliques.
- Contador `online/total` a partir de `coaches`.

**Fase 2 — Mensagens (1 commit)**
- Fundir `systemMessages` + `activeMessages` por `timestamp` num único `useMemo`; ids por contador.
- Agrupar mensagens consecutivas do mesmo coach (<2 min): nome/avatar/hora só na primeira/última.
- Scroll inteligente: só auto-scroll se estava a ≤80 px do fundo; senão pill "↓ Novas mensagens". (Toca em `GameContext.jsx:980` — mover a lógica para o RoomHub e remover o effect de lá.)
- Não repetir `getChatHistory` se o canal já tem mensagens.

**Fase 3 — Split + performance (1 commit)**
- `RoomHub` fica casca (`roomHubOpen` → `null` antes de qualquer `useMemo` caro, painel num filho `RoomHubPanel` só montado aberto).
- Extrair para `components/chat/`: `CoachRow.jsx` (`React.memo`), `ChatMessages.jsx`, `useRoomInvites.js` (estado + timers + listeners). Sem mais abstrações.
- Escolher seletores do contexto estreitos não é possível sem refactor do `GameContext` — fora de âmbito; o filho montado só aberto já resolve o grosso.

**Fase 4 — A11y e tokens (1 commit)**
- Foco no input ao abrir, devolver foco ao botão de origem ao fechar; `aria-modal="false"` (é um painel não-bloqueante) + `role="tablist"/"tab"`.
- Mínimo 10 px no estado do coach; ícone/forma além da cor no ponto de estado.
- Trocar cores cruas por tokens do `STYLE.md`; remover estilos inline.

## Fora de âmbito (YAGNI)
Reações a mensagens, @menções, markdown, paginação do histórico, mensagens privadas.

## Verificação
`npm run check:types` + `npm run build` no client; teste manual: 2 sessões (enviar rápido, convite ignorado, mensagem de 500 chars sem espaços, kick no lobby, mobile 375 px).
