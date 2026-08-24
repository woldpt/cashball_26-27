/**
 * Regression test — "o calendário das outras equipas não está a aparecer
 * correctamente" (TeamSquadView Calendário tab).
 *
 * Root cause (confirmed): `calendarData` on the client is only refreshed when
 * the user visits the main Calendário tab (`GameContext.jsx` tab-driven
 * fetch) or after cup results. Opening a team squad (`handleOpenTeamSquad`)
 * never triggers `requestCalendar`, so the squad view's Calendário tab
 * computes statuses from a STALE `calendarIndex`.
 *
 * Consequence: after playing a league week without visiting the Calendário
 * tab, the just-played week is shown as "Próximo Jogo / Hoje" (its result
 * hidden) and the real current week as "Agendado". The user's own calendar
 * looks fine because it is normally seen via the main tab (self-refreshing);
 * other teams' calendars are seen via TeamSquadView → stale → broken.
 *
 * This test encodes the contract:
 *   1. With FRESH calendarData (what `requestCalendar` returns), the squad
 *      calendar must show MW1-6 done-with-results, MW7 current, MW8+ future —
 *      for ANY team (own or NPC).
 *   2. With STALE calendarData (the pre-fix client state), the calendar is
 *      demonstrably wrong — MW6 would show as "current" (the bug).
 *   3. Opening a team squad must refresh calendarData (`requestCalendar`),
 *      so the stale state never reaches the view.
 *
 * Run: cd client && npm run test:calendarsquad
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SEASON_CALENDAR } from "../src/constants/index.js";
import { generateLeagueFixtures } from "../src/utils/fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok  - ${msg}`);
}

// ── Fixture data: 8-team division, server-shuffled seeds ──────────────────
const TEAMS = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({
  id,
  name: `Team ${id}`,
  division: 1,
}));
const SEEDS = { 1: [5, 1, 3, 7, 2, 6, 4, 8] };

// Played results for MW1..6 — generated with the SAME round-robin algorithm
// the server uses, so done-week results are consistent with future fixtures.
const leagueMatches = [];
for (let mw = 1; mw <= 6; mw++) {
  for (const f of generateLeagueFixtures(SEEDS[1], mw)) {
    leagueMatches.push({
      matchweek: mw,
      home_team_id: f.homeTeamId,
      away_team_id: f.awayTeamId,
      home_score: (mw + f.homeTeamId) % 4,
      away_score: (mw + f.awayTeamId) % 3,
    });
  }
}

// Server truth at the time of viewing: calendarIndex 8 = MW7 in progress.
const SERVER_CALENDAR_INDEX = 8;

/**
 * TeamSquadView `teamFixtures` logic, copied verbatim from the view.
 * Returns Map<matchweek, { status, hasResult }> for the selected team.
 */
function squadCalendar(selectedTeamId, clientCalendarIndex) {
  const calendarData = {
    calendarIndex: clientCalendarIndex,
    fixtureSeeds: SEEDS,
    leagueMatches,
  };
  const selectedTeam = TEAMS.find((t) => t.id === selectedTeamId);
  const divTeams = TEAMS.filter(
    (t) => t.division === selectedTeam.division,
  ).sort((a, b) => a.id - b.id);

  const out = new Map();
  for (const entry of SEASON_CALENDAR.filter((e) => e.type === "league")) {
    const status =
      entry.calendarIndex < clientCalendarIndex
        ? "done"
        : entry.calendarIndex === clientCalendarIndex
          ? "current"
          : "future";
    const divFixtures =
      status === "done"
        ? leagueMatches
            .filter(
              (m) =>
                m.matchweek === entry.matchweek &&
                divTeams.some((t) => t.id === m.home_team_id) &&
                divTeams.some((t) => t.id === m.away_team_id),
            )
            .map((m) => ({
              homeTeamId: m.home_team_id,
              awayTeamId: m.away_team_id,
              result: m,
            }))
        : generateLeagueFixtures(
            calendarData.fixtureSeeds?.[selectedTeam.division] ??
              divTeams.map((t) => t.id),
            entry.matchweek,
          ).map((f) => ({ ...f, result: null }));
    const myFixture = divFixtures.find(
      (f) =>
        f.homeTeamId === selectedTeam.id ||
        f.awayTeamId === selectedTeam.id,
    );
    if (!myFixture) continue;
    out.set(entry.matchweek, { status, hasResult: !!myFixture.result });
  }
  return out;
}

function statusOf(cal, mw) {
  const e = cal.get(mw);
  return e ? `${e.status}${e.hasResult ? "(resultado)" : ""}` : "missing";
}

// ── 1. FRESH data (post-fix state) → correct for EVERY team ───────────────
for (const teamId of [1, 5, 6]) {
  // own team (1), NPC teams (5, 6)
  const cal = squadCalendar(teamId, SERVER_CALENDAR_INDEX);
  assert(cal.size === 14, `equipa ${teamId}: 14 jornadas presentes`);
  for (let mw = 1; mw <= 6; mw++) {
    assert(
      statusOf(cal, mw) === "done(resultado)",
      `equipa ${teamId}: MW${mw} = done com resultado (fresh)`,
    );
  }
  assert(
    statusOf(cal, 7) === "current",
    `equipa ${teamId}: MW7 = current (fresh)`,
  );
  for (let mw = 8; mw <= 14; mw++) {
    assert(
      statusOf(cal, mw) === "future",
      `equipa ${teamId}: MW${mw} = future (fresh)`,
    );
  }
}

// ── 2. STALE data (pre-fix client state) → the bug is visible ──────────────
// After playing MW6 the server advances to index 8, but the client keeps the
// previous snapshot (index 6) because opening a squad never refreshes it.
const staleCal = squadCalendar(1, SERVER_CALENDAR_INDEX - 2);
assert(
  statusOf(staleCal, 6) === "current",
  "STALE: MW6 (já jogada) aparece como current sem resultado — estado que o refresh elimina",
);
assert(
  statusOf(staleCal, 7) === "future",
  "STALE: MW7 (atual no servidor) aparece como future — estado que o refresh elimina",
);

// ── 3. Guard: opening a team squad must refresh calendarData ───────────────
const gameContextSrc = readFileSync(
  path.join(__dirname, "../src/contexts/GameContext.jsx"),
  "utf8",
);
const handlerBlock = gameContextSrc.slice(
  gameContextSrc.indexOf("const handleOpenTeamSquad"),
  gameContextSrc.indexOf("const handleCloseTeamSquad"),
);
assert(
  handlerBlock.includes('socket.emit("requestCalendar")'),
  "handleOpenTeamSquad emite requestCalendar (calendarData fresco ao abrir plantel)",
);

console.log("\n✅ teamSquadCalendarRegression: all checks passed");
