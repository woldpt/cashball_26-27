/* ── Live view shared helpers ─────────────────────────────────────────────
 *
 * Constantes e funções partilhadas entre o LiveMatchHero e o LiveFixtureRow
 * para manter a consistência visual da vista ao vivo.
 */

/** Cor do flash de golo (momentâneo) em todas as vistas ao vivo. */
export const FLASH_COLOR = "#ff4444";

/** Mapa único de ícones para eventos de partida (emoji, tamanho fixo). */
export function matchEventIcon(type) {
  switch (type) {
    case "goal":
    case "penalty_goal":
    case "var_goal_pending":
      return "⚽";
    case "own_goal":
      return "⚽🔙";
    case "var_disallowed":
      return "🚩";
    case "penalty_miss":
      return "❌";
    case "yellow":
      return "🟨";
    case "red":
      return "🟥";
    case "injury":
      return "🚑";
    case "substitution":
    case "halftime_sub":
      return "🔁";
    default:
      return "";
  }
}

/** True para tipos de evento que contam como golo no marcador.
 *
 * `own_goal` também incrementa o resultado (evento com `team` da equipa
 * beneficiada, igual ao engine) — contar aqui mantém o marcador, a projeção da
 * classificação e o empate-aos-90 sincronizados com finalHomeGoals/finalAwayGoals. */
export function isGoalType(type) {
  return (
    type === "goal" ||
    type === "penalty_goal" ||
    type === "own_goal" ||
    type === "var_goal_pending"
  );
}

/**
 * True se um jogo estava empatado aos 90' (logo, foi a prolongamento).
 * Conta golos REGULAMENTARES (minute <= 90) com o MESMO critério do marcador
 * (`isGoalType`), que inclui `penalty_goal` — penáltis também incrementam o
 * resultado real (finalHomeGoals/finalAwayGoals). Um filtro que contasse só
 * `type === "goal"` fazia jogos decididos na regulamentação por penáltis
 * (ex.: 1-0 de penálti) aparecerem na lista de jogos do prolongamento.
 */
export function isDrawnAt90(match) {
  const goals90Home = (match?.events || []).filter(
    (e) => e.minute <= 90 && isGoalType(e.type) && e.team === "home",
  ).length;
  const goals90Away = (match?.events || []).filter(
    (e) => e.minute <= 90 && isGoalType(e.type) && e.team === "away",
  ).length;
  return goals90Home === goals90Away;
}

/** Extrai [home, draw, away] das odds de um texto de evento de apostas. */
export function parseOdds(text) {
  if (!text) return null;
  const nums =
    text
      .replace(/^\[(?:\d+'|HT)\]\s*\S*\s*/, "")
      .match(/\d+\.\d{2}/g) || [];
  return nums.length >= 3 ? [nums[0], nums[1], nums[2]] : null;
}

/** Flash boolean de uma equipa com base no goalFlashRef e no timestamp. */
export function isFlashing(flashRef, homeId, awayId, side, now = Date.now()) {
  const { ts } = readGoalFlashEntry(flashRef?.[`${homeId}_${awayId}_${side}`]);
  return !!ts && now - ts < 1500;
}

/**
 * Lê uma entrada do goalFlashRef nos dois formatos: número legado (só
 * timestamp) ou objeto `{ ts, n }` (timestamp + contador de golos).
 *
 * @param {number|{ts:number,n:number}|null|undefined} raw
 * @returns {{ts:number,n:number}}
 */
export function readGoalFlashEntry(raw) {
  if (typeof raw === "number") return { ts: raw, n: 1 };
  return { ts: raw?.ts ?? 0, n: raw?.n ?? 0 };
}

/**
 * Golos ainda não consumidos pelo GoalFlashOverlay, um por golo (não um por
 * lado): dois golos no mesmo minuto — mesmo do mesmo lado — geram dois
 * momentos. `consumed` é o mapa mutável `{ home: {ts,n}, away: {ts,n} }`
 * do overlay; é atualizado aqui para a mesma batch nunca se repetir.
 *
 * @param {Object} flashRef - mapa goalFlashRef
 * @param {number|string} homeId
 * @param {number|string} awayId
 * @param {{home:{ts:number,n:number},away:{ts:number,n:number}}} consumed
 * @param {number} [now] - Date.now()
 * @param {number} [maxAgeMs] - validade do flash (2200ms)
 * @returns {Array<{side:string,ts:number}>} momentos novos, ordenados por ts
 */
export function freshGoalFlashes(flashRef, homeId, awayId, consumed, now = Date.now(), maxAgeMs = 2200) {
  const fresh = [];
  for (const side of ["home", "away"]) {
    const { ts, n } = readGoalFlashEntry(flashRef?.[`${homeId}_${awayId}_${side}`]);
    const last = consumed[side] || { ts: 0, n: 0 };
    if (!ts || ts < now - maxAgeMs) continue;
    if (ts < last.ts || (ts === last.ts && n <= last.n)) continue;
    const count = ts > last.ts ? Math.max(1, n - last.n) : n - last.n;
    consumed[side] = { ts, n };
    for (let i = 0; i < count; i++) fresh.push({ side, ts });
  }
  fresh.sort((a, b) => a.ts - b.ts);
  return fresh;
}

/**
 * Projeção da classificação ao vivo: tabela persistida (teams) + resultados
 * da jornada em curso (marcadores derivados dos eventos, até liveMinute).
 *
 * Quando `applyLiveResults` é false, os dados persistidos já incluem a jornada
 * (servidor reenviou teamsData/teamForms) — devolve a tabela tal como está,
 * evitando contar a jornada duas vezes. A `form` combina o histórico anterior
 * (teamForms) com o resultado da jornada em curso quando projetado.
 *
 * @param {Object} props
 * @param {Array} props.teams
 * @param {Object|null} props.matchResults
 * @param {number} props.liveMinute
 * @param {Object} props.teamForms
 * @param {boolean} props.applyLiveResults
 */
export function computeVirtualStandings({
  teams,
  matchResults,
  liveMinute = 90,
  teamForms = {},
  applyLiveResults = false,
}) {
  // Comparador idêntico ao servidor (pontos → DG → golos → nome).
  const cmp = (a, b) =>
    b.points - a.points ||
    b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor ||
    String(a.name || "").localeCompare(String(b.name || ""));

  const rows = teams.map((t) => ({
    team: t,
    name: t.name || "",
    played: (t.wins || 0) + (t.draws || 0) + (t.losses || 0),
    wins: t.wins || 0,
    draws: t.draws || 0,
    losses: t.losses || 0,
    goalsFor: t.goals_for || 0,
    goalsAgainst: t.goals_against || 0,
    points: t.points || 0,
    form: teamForms[t.id] || "",
  }));

  // Posição anterior = ranking da tabela persistida (antes desta jornada).
  [...rows]
    .sort(cmp)
    .forEach((r, i) => {
      r.prevPos = i + 1;
    });

  if (applyLiveResults) {
    (matchResults?.results || []).forEach((r) => {
      const home = rows.find((row) => String(row.team.id) === String(r.homeTeamId));
      const away = rows.find((row) => String(row.team.id) === String(r.awayTeamId));
      if (!home || !away) return;
      const events = r.events || [];
      const homeGoals = events.filter(
        (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "home",
      ).length;
      const awayGoals = events.filter(
        (e) => e.minute <= liveMinute && isGoalType(e.type) && e.team === "away",
      ).length;
      applyResult(home, homeGoals, awayGoals);
      applyResult(away, awayGoals, homeGoals);
      home.form += homeGoals > awayGoals ? "V" : homeGoals === awayGoals ? "E" : "D";
      away.form += awayGoals > homeGoals ? "V" : awayGoals === homeGoals ? "E" : "D";
    });
  }

  const ranked = [...rows].sort(cmp);
  ranked.forEach((r, i) => {
    r.curPos = i + 1;
    r.movement = r.prevPos - r.curPos;
  });

  return ranked;
}

function applyResult(row, goalsFor, goalsAgainst) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

/**
 * Resolve a coluna de equipa onde um evento deve ser apresentado em listas
 * por equipa (ex.: colunas de eventos do LiveMatchHero).
 *
 * Por omissão, o lado vem da equipa real do JOGADOR (via lineups) — defesa
 * contra flags `team` divergentes chegadas do servidor. Os auto-golos são o
 * caso especial: o `playerId` é o AUTOR (um defensor da equipa que SOFREU),
 * enquanto `e.team` é a equipa BENEFICIADA — o mesmo lado que o marcador
 * conta em todo o lado (`isGoalType` + `e.team`). Logo, auto-golos seguem
 * SEMPRE `e.team`, nunca o lado do autor.
 *
 * @param {Object} event - Evento de partida (fixture.events).
 * @param {Map|Object|null} lineupSideById - Mapa playerId → "home"|"away"
 *   construído a partir das lineups (podem faltar suplentes/autores fora do
 *   snapshot).
 * @returns {string} "home" | "away"
 */
export function resolveEventSide(event, lineupSideById) {
  if (event?.type === "own_goal") return event.team;
  if (event?.playerId != null && lineupSideById?.has?.(event.playerId)) {
    return lineupSideById.get(event.playerId);
  }
  return event?.team;
}

/**
 * Detecta cores pretas/muito escuras (luminância percebida < ~40/255) para
 * decidir quando a cor primária de uma equipa não é legível como texto.
 * @param {string|null|undefined} hex
 * @returns {boolean}
 */
export function isDarkColor(hex) {
  if (typeof hex !== "string") return false;
  const m = hex.trim().replace(/^#/, "");
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 40;
}

/**
 * Cor de texto com identidade de equipa: a primária, se legível; a
 * secundária, se a primária for muito escura.
 * @param {{ color_primary?: string, color_secondary?: string }|null|undefined} team
 * @returns {string}
 */
export function teamTextColor(team) {
  const primary = team?.color_primary;
  if (primary && !isDarkColor(primary)) return primary;
  return team?.color_secondary || "#fff";
}

/**
 * Fila de penáltis com suspense: N eventos → N shows escalonados (cada um
 * ocupa `displayMs`) + 1 revelação atómica no fim. O consumidor agenda cada
 * step com `setTimeout(fn, step.atMs)` — timers canceláveis por tick novo.
 * Lista vazia → [] (nada agendado); entradas nulas são ignoradas.
 *
 * @param {Array<Object|null|undefined>} events eventos com `penaltySuspense`
 * @param {number} displayMs janela de cada penálti
 * @returns {Array<{atMs: number, action: "show"|"reveal", event?: Object>}
 */
export function computePenaltySteps(events, displayMs) {
  const list = (events || []).filter(Boolean);
  if (!list.length) return [];
  return [
    ...list.map((event, i) => ({
      atMs: i * displayMs,
      action: "show",
      event,
    })),
    { atMs: list.length * displayMs, action: "reveal" },
  ];
}

/**
 * Amigável? O de pré-época viaja como ronda 0; o da semana da Taça
 * (eliminados) partilha a ronda da Taça, por isso a flag vem no fixture.
 *
 * @param {{ isFriendly?: boolean } | null | undefined} fixture
 * @param {number|string|null|undefined} cupRound
 * @returns {boolean}
 */
export function isFriendlyMatch(fixture, cupRound) {
  return !!fixture?.isFriendly || (cupRound != null && Number(cupRound) === 0);
}

/**
 * Resultado até ao minuto, com o mesmo critério do marcador (`isGoalType`).
 *
 * @param {Array<{minute:number,type:string,team:string}>|null|undefined} events
 * @param {number} liveMinute
 * @returns {{home:number, away:number}}
 */
export function liveScore(events, liveMinute) {
  let home = 0;
  let away = 0;
  for (const e of events || []) {
    if ((e.minute ?? -1) > liveMinute || !isGoalType(e.type)) continue;
    if (e.team === "home") home += 1;
    else if (e.team === "away") away += 1;
  }
  return { home, away };
}

/* Lances que contam como remate (o `team` é sempre o lado que ataca). O
 * auto-golo não conta: o `team` dele é o beneficiado, não quem rematou. */
const SHOT_TYPES = new Set([
  "goal", "penalty_goal", "chance", "near_miss", "penalty_miss",
  "var_disallowed", "var_goal_pending",
]);

/**
 * Remates por equipa até ao minuto.
 *
 * @param {Array<{minute:number,type:string,team:string}>|null|undefined} events
 * @param {number} liveMinute
 * @returns {{home:number, away:number}}
 */
export function liveShots(events, liveMinute) {
  let home = 0;
  let away = 0;
  for (const e of events || []) {
    if ((e.minute ?? -1) > liveMinute || !SHOT_TYPES.has(e.type)) continue;
    if (e.team === "home") home += 1;
    else if (e.team === "away") away += 1;
  }
  return { home, away };
}

/**
 * Jogadores em campo mais cansados (perda de skill em jogo ≥ `minLoss`),
 * do mais para o menos cansado. O lineup ao vivo mantém `fatigueLoss` em dia
 * a cada minuto e as trocas em campo reaproveitam a posição (`is_starter`).
 *
 * @param {Array<{id:number,name:string,is_starter?:boolean,fatigueLoss?:number}>|null|undefined} lineup
 * @param {Array<{minute:number,type:string,playerId?:number}>|null|undefined} events
 * @param {number} liveMinute
 * @param {number} [minLoss]
 * @param {number} [limit]
 * @returns {Array<{id:number,name:string,fatigueLoss:number}>}
 */
export function tiredPlayers(lineup, events, liveMinute, minLoss = 3, limit = 2) {
  const sentOff = new Set(
    (events || [])
      .filter((e) => e.type === "red" && e.minute <= liveMinute)
      .map((e) => e.playerId),
  );
  return (lineup || [])
    .filter(
      (p) =>
        p.is_starter !== false &&
        !sentOff.has(p.id) &&
        Number(p.fatigueLoss ?? 0) >= minLoss,
    )
    .sort((a, b) => b.fatigueLoss - a.fatigueLoss)
    .slice(0, limit);
}

/* "[23'] ⚽ Frase" → ícone + frase. O ícone só é separado quando o 1.º
 * token não começa por letra/número (as mudanças táticas não trazem emoji). */
const COMMENTARY_RE = /^\[(?:\d+'|HT)\]\s*(?:([^\p{L}\p{N}\s"“«'(]\S*)\s+)?(.*)$/su;

/**
 * Feed de lances do jogo até ao minuto, do mais recente para o mais antigo
 * (empates de minuto pela ordem de chegada). As odds ficam de fora.
 *
 * @param {Array<Object>|null|undefined} events
 * @param {number} liveMinute
 * @returns {Array<{key:string, icon:string, phrase:string, event:Object}>}
 */
export function liveFeed(events, liveMinute) {
  return (events || [])
    .map((e, i) => ({ e, i }))
    .filter(
      ({ e }) =>
        e.minute <= liveMinute &&
        e.type !== "betting" &&
        (e.text || matchEventIcon(e.type)),
    )
    .sort((a, b) => b.e.minute - a.e.minute || b.i - a.i)
    .map(({ e, i }) => {
      const m = e.text ? COMMENTARY_RE.exec(e.text) : null;
      const phrase = (m ? m[2] : e.text || e.playerName || "").trim();
      return {
        key: `${e.minute}-${e.type}-${e.playerId ?? ""}-${i}`,
        icon: m?.[1] || e.emoji || matchEventIcon(e.type),
        phrase,
        event: e,
      };
    })
    .filter((row) => row.phrase);
}

/**
 * Multiplex: golos dos outros jogos até ao minuto, do mais recente para o
 * mais antigo, com o resultado logo a seguir a cada golo.
 *
 * @param {Array<{homeTeamId:number,awayTeamId:number,events?:Array<Object>}>|null|undefined} fixtures
 * @param {number} liveMinute
 * @param {(fixture: Object) => boolean} skip - jogos a excluir (o meu)
 * @param {number} [limit]
 * @returns {Array<{key:string, minute:number, fixture:Object, side:string, home:number, away:number, playerName?:string, type:string}>}
 */
export function otherGoals(fixtures, liveMinute, skip, limit = 6) {
  const out = [];
  for (const f of fixtures || []) {
    if (skip(f)) continue;
    let home = 0;
    let away = 0;
    (f.events || [])
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.minute - b.e.minute || a.i - b.i)
      .forEach(({ e, i }) => {
        if (e.minute > liveMinute || !isGoalType(e.type)) return;
        if (e.team === "home") home += 1;
        else if (e.team === "away") away += 1;
        else return;
        out.push({
          key: `${f.homeTeamId}_${f.awayTeamId}_${i}`,
          minute: e.minute,
          fixture: f,
          side: e.team,
          home,
          away,
          playerName: e.playerName,
          type: e.type,
        });
      });
  }
  return out.sort((a, b) => b.minute - a.minute).slice(0, limit);
}
