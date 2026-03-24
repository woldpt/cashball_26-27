const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const activeGames = {}; // { roomCode: { db, players: {}, matchweek: 1, globalMarket: [], initialized: false } }

function getGame(roomCode) {
  if (activeGames[roomCode]) return activeGames[roomCode];

  const dbPath = path.join(__dirname, 'db', `game_${roomCode}.db`);
  const basePath = path.join(__dirname, 'db', 'base.db');

  if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(basePath)) {
      throw new Error("Base DB not found!");
    }
    fs.copyFileSync(basePath, dbPath);
  }

  const db = new sqlite3.Database(dbPath);
  
  const game = {
    roomCode,
    db,
    players: {}, 
    matchweek: 1,
    globalMarket: [],
    initialized: false
  };

  db.all('SELECT * FROM players ORDER BY RANDOM() LIMIT 20', (err, rows) => {
    if (!err) game.globalMarket = rows;
    game.initialized = true;
  });

  activeGames[roomCode] = game;
  return game;
}

function getGameBySocket(socketId) {
  for (const roomCode in activeGames) {
    if (activeGames[roomCode].players[socketId]) {
      return activeGames[roomCode];
    }
  }
  return null;
}

module.exports = { getGame, getGameBySocket, activeGames };
