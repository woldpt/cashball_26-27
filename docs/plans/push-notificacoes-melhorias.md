# Plano — Melhoria das notificações push

Estado atual: 8/10. Código em `server/push.ts`, `server/auth.js` (tabela `push_subscriptions`), rotas `/api/push/*` em `server/index.ts`, gatilho em `weeklyFlowHelpers.ts` (`checkAllReady`), cliente em `client/public/sw.v7.js` e `client/src/components/shared/PushSettings.jsx`.

Hoje só existe **um** aviso («Todos prontos. Falta a tua tática!»), com throttle em memória e sem testes.

## Princípios

- Manter a regra de ouro: push **nunca** bloqueia nem rebenta o jogo (fire-and-forget + try/catch).
- Manter a flag `ENABLE_PUSH`: com ela desligada nada toca na rede.
- Não enviar push a quem está ligado e a ver a app (socket presente) — ruído inútil.
- Cada fase é entregável e reversível sozinha.

## Fase 0 — Correções baratas (bugs e dívida) · ~1h

| # | Problema | Correção | Ficheiro |
|---|---|---|---|
| 0.1 | `getPushSubscriptions` chamado 2× (`doMaybeNotify` + `notifyUser`) | `notifyUser` aceitar subs já carregadas (param opcional) ou `doMaybeNotify` deixar de pré-verificar | `push.ts` |
| 0.2 | Cooldown marcado **antes** de enviar; falha = 5 min sem aviso | Marcar só após ≥1 envio com sucesso (`notifyUser` devolve `number` de entregas) | `push.ts` |
| 0.3 | Sem `tag` por tipo; SW usa `cashball-ready` fixo | Payload com `tag`; SW usa `data.tag \|\| 'cashball'` | `push.ts`, `sw.v7.js` |
| 0.4 | `lastPushAt` cresce sem limite | Limpar entradas expiradas ao escrever (ou `Map` com purga periódica) | `push.ts` |
| 0.5 | `notificationclick` foca a 1.ª janela e ignora `url` | Se a janela existir: `focus()` + `navigate(url)` quando difere | `sw.v7.js` |

Nota: ao mexer no `sw.v7.js` há que subir a versão do SW (convenção `sw.vN.js`), senão o handler novo nunca entra (comentário na linha ~70).

## Fase 1 — Contexto na mensagem · ~1h

- Payload passa a `{ type, title, body, url, tag, roomCode }`.
- Texto inclui equipa/sala: «Sala ABCD · Falta a tua tática!». Resolve o caso de um treinador em várias salas.
- `url` com deep link para a sala/aba certa em vez de `/`.
- `tag` = `<tipo>:<roomCode>` para que avisos da mesma sala se **substituam** em vez de empilhar.
- Tipo `PushPayload` ganha `type: PushType` (união literal) e `tag`.

## Fase 2 — Throttle durável e partilhado · ~2h

- Mover o cooldown para a BD: coluna `last_push_at` (ou tabela `push_log(coach_name, type, room_code, sent_at)`), em `auth.js`.
- Chave do throttle = `(coach, type, roomCode)` — hoje é só por treinador, logo um aviso de uma sala bloqueia o de outra.
- Sobrevive a restart e a múltiplos processos.
- Purga de linhas > 24h no arranque.
- Opcional: `lastPushAt` em memória como cache de 1.º nível para evitar ir à BD em cada `checkAllReady`.

## Fase 3 — Novos tipos de aviso · ~3–4h

Cada tipo é uma função `maybeNotifyXxx(game)` como a atual, com tipo, cooldown e texto próprios. Candidatos, por valor:

1. **Jogo prestes a começar / retomado** — a sala voltou a andar depois de um congelamento por ausência (`waitForPresence` libertou). É o aviso que mais tempo poupa a quem os outros esperam.
2. **Janela de decisão aberta** — `waitForMatchAction` / intervalo à espera do treinador.
3. **Leilão** — leilão a terminar / ser ultrapassado (`pendingAuctionQueueTimers`).
4. **Fim de jornada** — resultado final + posição, só para ausentes.
5. **Convite de sala** — hoje só `__presence__` via socket; push para quem está offline.

Regra comum: só notifica quem está **ausente** (`computeAbsentees` / presença fora da grace) — reutilizar `roomStateHelpers.ts` em vez de reinventar presença.

## Fase 4 — Preferências do utilizador · ~2–3h

- Tabela/colunas de preferências por treinador: `push_prefs(coach_name, type, enabled)`; default = todos ligados exceto os mais ruidosos.
- `PushSettings.jsx` ganha interruptores por tipo (hoje é tudo-ou-nada por browser).
- Servidor consulta as prefs antes de enviar (um `SELECT` junto com as subs).
- Horas de silêncio (opcional): sem push entre HH:MM e HH:MM, no fuso do cliente.
- Seguir `STYLE.md` e o padrão de `MySquadTab.jsx` para a UI.

## Fase 5 — Robustez de envio · ~2h

- **Retry** com backoff curto (1 tentativa extra, ~1–2 s) só para erros de rede e 5xx/429; nunca para 4xx.
- Respeitar `Retry-After` em 429.
- **Limite de subscrições** por treinador (ex. 10): ao guardar a 11.ª, apagar a mais antiga. Evita crescimento por reinstalações.
- Purga periódica de subscrições com `created_at` muito antigo e nunca renovadas.
- **Re-subscrição automática** no cliente: no arranque, se `Notification.permission === 'granted'` e a subscrição mudou/expirou (`pushsubscriptionchange` no SW), voltar a registar.
- Contadores simples em memória (`sent`, `failed`, `removed`) expostos no log de arranque/admin, para saber se o push está saudável.

## Fase 6 — Testes e documentação · ~2h

Seguir o padrão do repo (`server/scripts/*Regression.mts`, `tsx --test`, script `test:push` em `server/package.json`):

- `pushRegression.mts` com `webpush` e `auth` **mockados**:
  - flag desligada → não chama `sendNotification`;
  - 410 e 403-VAPID apagam a subscrição; 403 genérico e 500 **não** apagam;
  - cooldown respeitado e **não** marcado quando o envio falha (0.2);
  - `maybeNotifyLastMissing`: dispara com exatamente 1 em falta; não dispara com 0 ou ≥2; ignora espectadores/eliminados;
  - throttle por `(coach, type, room)` independente entre salas (Fase 2);
  - preferências desligadas → sem envio (Fase 4).
- Atualizar `AGENTS.md` (comando `test:push`) e a nota de arquitetura em `CLAUDE.md` («Sistemas transversais») com uma linha sobre push.
- Documentar variáveis `ENABLE_PUSH`, `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT` e como gerar chaves.

## Ordem recomendada

`0 → 6 (testes do que já existe) → 1 → 2 → 3 → 4 → 5`

Escrever os testes logo a seguir à Fase 0 protege as fases seguintes; as Fases 4 e 5 só compensam depois de existirem ≥2 tipos de aviso.

## Riscos

- **Ruído:** mais tipos = mais risco de o utilizador desligar tudo. Mitigação: só ausentes, `tag` a substituir, prefs por tipo.
- **iOS:** só funciona com a PWA instalada (já tratado em `PushSettings.jsx` via `isIOS`/`isStandalone`); testar em dispositivo real.
- **Cache do SW:** esquecer de subir `sw.vN.js` deixa clientes com o handler antigo.
- **Migração da BD:** novas tabelas em `auth.js` com `CREATE TABLE IF NOT EXISTS`, como a atual — sem migração destrutiva.
- **Privacidade:** o payload passa pelo FCM/Apple; não incluir dados sensíveis (finanças, valores) no texto.

## Fora de âmbito (por agora)

Canais alternativos (email, Telegram), push para espectadores, e agrupamento/digest de avisos.
