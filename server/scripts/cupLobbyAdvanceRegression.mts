import assert from "node:assert/strict";
import { createWeeklyFlowHelpers } from "../weeklyFlowHelpers";

// Regressão do arranque de semanas no lobby:
// - Sala de 1 treinador: rondas só-NPC da Taça avançam com um clique do
//   espectador (comportamento de sempre — o guard da Taça espera o clique).
// - Sala MULTIPLAYER (2+ assentos member com equipa): TODOS os membros têm de
//   estar online e clicar Pronto («todos os membros sempre», eliminados da
//   Taça incluídos) — antes a ronda avançava com um clique só.

function ioStub() {
  return { to: () => ({ emit: () => {} }) };
}

function scenario(
  options: {
    members?: Array<{
      name?: string;
      teamId?: number;
      ready?: boolean;
      online?: boolean;
    }>;
  } = {},
) {
  const dbReads: string[] = [];
  const seats: any = {};
  const playersByName: any = {};
  for (const m of options.members ?? [{}]) {
    const name = m.name ?? "coach";
    const teamId = m.teamId ?? 22;
    seats[name] = {
      name,
      status: "member",
      teamId,
      intent: { ready: !!m.ready },
    };
    if (m.online !== false) {
      playersByName[name] = { name, teamId, socketId: `s-${name}` };
    }
  }
  const game: any = {
    roomCode: "CUP-REGRESSION",
    gamePhase: "lobby",
    calendarIndex: 8,
    matchweek: 7,
    season: 1,
    currentEvent: { type: "cup", round: 2 },
    currentFixtures: [{ homeTeamId: 101, awayTeamId: 102 }],
    seatSeenAt: {},
    seats,
    playersByName,
    db: {
      get(sql: string) {
        dbReads.push(sql);
        // Do not start the actual simulation; reaching this query proves dispatch.
      },
    },
  };
  const helpers = createWeeklyFlowHelpers({ io: ioStub() } as any);
  return { game, helpers, dbReads };
}

// ── Sala de 1 treinador (comportamento de sempre) ───────────────────────────
const unattended = scenario();
await unattended.helpers.checkAllReady(unattended.game);
assert.equal(unattended.dbReads.length, 0, "Cup must wait while seated spectators remain");

const spectatorConfirmed = scenario({ members: [{ ready: true }] });
await spectatorConfirmed.helpers.checkAllReady(spectatorConfirmed.game);
assert.equal(spectatorConfirmed.dbReads.length, 1, "solo spectator confirmation must start the Cup");

const noCoaches = scenario({ members: [] });
await noCoaches.helpers.checkAllReady(noCoaches.game);
assert.equal(noCoaches.dbReads.length, 1, "empty rooms must retain automatic progression");

// ── Regra «todos os membros sempre» (lobby multiplayer) ──────────────────────
const oneOfTwoReady = scenario({
  members: [
    { name: "A", teamId: 22, ready: true },
    { name: "B", teamId: 23, ready: false },
  ],
});
await oneOfTwoReady.helpers.checkAllReady(oneOfTwoReady.game);
assert.equal(
  oneOfTwoReady.dbReads.length,
  0,
  "multiplayer lobby must wait for ALL member seats to ready",
);

const allReady = scenario({
  members: [
    { name: "A", teamId: 22, ready: true },
    { name: "B", teamId: 23, ready: true },
  ],
});
await allReady.helpers.checkAllReady(allReady.game);
assert.equal(allReady.dbReads.length, 1, "all members ready must start the Cup");

const oneOffline = scenario({
  members: [
    { name: "A", teamId: 22, ready: true },
    { name: "B", teamId: 23, ready: true, online: false },
  ],
});
await oneOffline.helpers.checkAllReady(oneOffline.game);
assert.equal(
  oneOffline.dbReads.length,
  0,
  "multiplayer lobby must freeze while a member is offline",
);

console.log("Cup lobby auto-advance regression: PASS");
