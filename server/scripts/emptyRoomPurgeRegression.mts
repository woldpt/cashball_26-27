import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createRoomCleanupHelpers } from "../roomCleanupHelpers";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cashball-empty-room-"));
  const roomCode = "ABC123";
  const dbFile = path.join(dir, `game_${roomCode}.db`);
  const activeGames: Record<string, any> = {};
  let roomCoaches: string[] = [];
  let failLookup = false;
  let accessDeleted = false;
  let gamePurged = false;

  const cleanup = createRoomCleanupHelpers({
    activeGames,
    async getRoomCoachesStrict() {
      if (failLookup) throw new Error("auth db unavailable");
      return roomCoaches;
    },
    async deleteRoomAccess() {
      accessDeleted = true;
    },
    roomDbPath: () => dbFile,
    purgeGame: () => {
      gamePurged = true;
      return true;
    },
  });

  const addDbAndSidecars = () => {
    for (const suffix of ["", "-wal", "-shm", "-journal"])
      fs.writeFileSync(dbFile + suffix, "test");
  };

  try {
    addDbAndSidecars();
    roomCoaches = ["Offline coach"];
    assert.equal(await cleanup.purgeEmptyRoom(roomCode), "has_members");
    assert.equal(fs.existsSync(dbFile), true, "offline authorized coach keeps the save");
    assert.equal(gamePurged, false);

    roomCoaches = [];
    activeGames[roomCode] = {
      kickedCoaches: new Set(),
      socketToName: { socket1: "Leaving coach" },
      playersByName: { "Leaving coach": { socketId: "socket1" } },
    };
    assert.equal(await cleanup.purgeEmptyRoom(roomCode), "waiting_for_disconnect");
    assert.equal(fs.existsSync(dbFile), true, "connected socket defers deletion");

    delete activeGames[roomCode];
    failLookup = true;
    assert.equal(await cleanup.purgeEmptyRoom(roomCode), "failed");
    assert.equal(fs.existsSync(dbFile), true, "lookup failure must fail closed");
    assert.equal(accessDeleted, false);

    failLookup = false;
    roomCoaches = ["Kicked coach"];
    activeGames[roomCode] = {
      kickedCoaches: new Set(["kicked coach"]),
      socketToName: {},
      playersByName: {},
    };
    assert.equal(await cleanup.purgeEmptyRoom(roomCode), "deleted");
    assert.equal(fs.existsSync(dbFile), false);
    assert.equal(fs.existsSync(`${dbFile}-wal`), false);
    assert.equal(fs.existsSync(`${dbFile}-shm`), false);
    assert.equal(fs.existsSync(`${dbFile}-journal`), false);
    assert.equal(gamePurged, true);
    assert.equal(accessDeleted, true);

    console.log("Empty-room purge regression: PASS");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
