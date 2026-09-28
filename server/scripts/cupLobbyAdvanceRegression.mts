import assert from "node:assert/strict";
import { createWeeklyFlowHelpers } from "../weeklyFlowHelpers";

function scenario(options: { memberReady?: boolean; hasMember?: boolean } = {}) {
  const dbReads: string[] = [];
  const member = options.hasMember === false
    ? {}
    : {
        coach: {
          status: "member",
          teamId: 22,
          intent: { ready: !!options.memberReady },
        },
      };
  const game: any = {
    roomCode: "CUP-REGRESSION",
    gamePhase: "lobby",
    calendarIndex: 8,
    matchweek: 7,
    season: 1,
    currentEvent: { type: "cup", round: 2 },
    currentFixtures: [{ homeTeamId: 101, awayTeamId: 102 }],
    seats: member,
    playersByName: {},
    db: {
      get(sql: string) {
        dbReads.push(sql);
        // Do not start the actual simulation; reaching this query proves dispatch.
      },
    },
  };
  const helpers = createWeeklyFlowHelpers({} as any);
  return { game, helpers, dbReads };
}

const unattended = scenario();
await unattended.helpers.checkAllReady(unattended.game);
assert.equal(unattended.dbReads.length, 0, "Cup must wait while seated spectators remain");

const spectatorConfirmed = scenario({ memberReady: true });
await spectatorConfirmed.helpers.checkAllReady(spectatorConfirmed.game);
assert.equal(spectatorConfirmed.dbReads.length, 1, "spectator confirmation must start the Cup");

const noCoaches = scenario({ hasMember: false });
await noCoaches.helpers.checkAllReady(noCoaches.game);
assert.equal(noCoaches.dbReads.length, 1, "empty rooms must retain automatic progression");

console.log("Cup lobby auto-advance regression: PASS");
