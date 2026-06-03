/**
 * auth.js — Central coach authentication module.
 *
 * Keeps a lightweight SQLite database (accounts.db) that is separate from
 * per-room game databases so that manager accounts persist across all rooms
 * and are not included in game saves shared with other players.
 *
 * Tables
 * ──────
 *  managers       – name / password_hash pairs (one row per coach account)
 *  room_managers  – tracks which coaches have ever joined which room so that
 *                   the /saves endpoint only shows their own rooms
 */

const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

// ── Cache de sessão em memória ──────────────────────────────────────────────────
// Evita re-executar bcrypt (72-141ms) em cada reconexão do socket.
// Guarda credenciais verificadas durante AUTH_CACHE_TTL (10 min).
// Seguro para um jogo: a memória do servidor não é acessível aos utilizadores.
const authCache = new Map(); // name_lower → { password, expiry }
const AUTH_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

function authCacheGet(name, password) {
	const key = name.toLowerCase();
	const cached = authCache.get(key);
	if (cached && cached.expiry > Date.now() && cached.password === password) {
		// Renovar TTL a cada uso
		cached.expiry = Date.now() + AUTH_CACHE_TTL;
		return true;
	}
	return false;
}

function authCacheSet(name, password) {
	authCache.set(name.toLowerCase(), {
		password,
		expiry: Date.now() + AUTH_CACHE_TTL,
	});
}

function authCacheInvalidate(name) {
	authCache.delete(name.toLowerCase());
}

function resolveAccountsDbPath() {
	const candidates = [
		path.join(__dirname, "db"),
		path.join(__dirname, "..", "db"),
		path.join(process.cwd(), "db"),
	];

	const existingFile = candidates
		.map((dir) => path.join(dir, "accounts.db"))
		.find((candidatePath) => fs.existsSync(candidatePath));

	if (existingFile) {
		return existingFile;
	}

	// Prefer the directory that contains base.db so that accounts.db lands in
	// the same volume-mounted folder as the game databases, not in dist/db/.
	const targetDir =
		candidates.find((dir) => fs.existsSync(path.join(dir, "base.db"))) ||
		candidates.find((dir) => fs.existsSync(dir)) ||
		candidates[0];
	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}
	return path.join(targetDir, "accounts.db");
}

const DB_PATH = resolveAccountsDbPath();

// Ensure the db directory exists (it always will in production but guards
// against a fresh checkout where only base.db is present).
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
	if (err) {
		console.error("[auth] Failed to open accounts.db:", err.message);
	} else {
		console.log("[auth] accounts.db ready.");
	}
});

// Create tables once on startup
db.serialize(() => {
	db.run(`
    CREATE TABLE IF NOT EXISTS managers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT    NOT NULL
    )
  `);
	db.run(`
    CREATE TABLE IF NOT EXISTS room_managers (
      room_code    TEXT NOT NULL COLLATE NOCASE,
      manager_name TEXT NOT NULL COLLATE NOCASE,
      PRIMARY KEY (room_code, manager_name)
    )
  `);
	// Migration: add avatar_seed column (safe to re-run)
	db.run(
		`ALTER TABLE managers ADD COLUMN avatar_seed TEXT DEFAULT ''`,
		(err) => {
			if (err) {
				// Column already exists — ignore
			}
		},
	);
	db.run(`ALTER TABLE managers ADD COLUMN email TEXT DEFAULT ''`, (err) => {
		if (err) {
			// Column already exists — ignore
		}
	});
	db.run(
		`ALTER TABLE managers ADD COLUMN birth_year INTEGER DEFAULT NULL`,
		(err) => {
			if (err) {
				// Column already exists — ignore
			}
		},
	);
});

/**
 * Verify an existing account or create a new one.
 *
 * @param {string} name      Coach name (case-insensitive unique key)
 * @param {string} password  Plain-text password provided by the user
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function verifyOrCreateManager(name, password) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedPassword = typeof password === "string" ? password : "";

	if (!normalizedName || !normalizedPassword) {
		return Promise.resolve({ ok: false, error: "Credenciais inválidas." });
	}

	// Verificar cache antes de correr bcrypt (~72-141ms poupados em reconexões)
	if (authCacheGet(normalizedName, normalizedPassword)) {
		return Promise.resolve({ ok: true });
	}

	return new Promise((resolve) => {
		db.get(
			"SELECT id, password_hash FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			async (err, row) => {
				if (err) {
					console.error("[auth] DB error:", err.message);
					return resolve({ ok: false, error: "Erro interno de autenticação." });
				}

				if (row) {
					// Existing account — verify password
					const match = await bcrypt.compare(
						normalizedPassword,
						row.password_hash,
					);
					if (!match) {
						authCacheInvalidate(normalizedName);
						return resolve({ ok: false, error: "Palavra-passe incorrecta." });
					}
					authCacheSet(normalizedName, normalizedPassword);
					return resolve({ ok: true });
				} else {
					// New account — create with hashed password
					const hash = await bcrypt.hash(normalizedPassword, 10);
					db.run(
						"INSERT INTO managers (name, password_hash) VALUES (?, ?)",
						[normalizedName, hash],
						(err2) => {
							if (err2) {
								console.error("[auth] Insert error:", err2.message);
								return resolve({ ok: false, error: "Erro ao criar conta." });
							}
							console.log(
								`[auth] New coach account created: "${normalizedName}"`,
							);
							authCacheSet(normalizedName, normalizedPassword);
							resolve({ ok: true });
						},
					);
				}
			},
		);
	});
}

/**
 * Verify an existing manager account without creating a new one.
 *
 * @param {string} name
 * @param {string} password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function verifyManager(name, password) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedPassword = typeof password === "string" ? password : "";

	if (!normalizedName || !normalizedPassword) {
		return Promise.resolve({ ok: false, error: "Credenciais inválidas." });
	}

	// Cache hit: evitar bcrypt em re-logins recentes
	if (authCacheGet(normalizedName, normalizedPassword)) {
		return Promise.resolve({ ok: true });
	}

	return new Promise((resolve) => {
		db.get(
			"SELECT id, password_hash FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			async (err, row) => {
				if (err) {
					console.error("[auth] DB error:", err.message);
					return resolve({ ok: false, error: "Erro interno de autenticação." });
				}

				if (!row) {
					return resolve({ ok: false, error: "Conta não encontrada." });
				}

				const match = await bcrypt.compare(
					normalizedPassword,
					row.password_hash,
				);
				if (!match) {
					authCacheInvalidate(normalizedName);
					return resolve({ ok: false, error: "Palavra-passe incorrecta." });
				}

				authCacheSet(normalizedName, normalizedPassword);
				return resolve({ ok: true });
			},
		);
	});
}

/**
 * Create a new manager account.
 *
 * @param {string} name
 * @param {string} password
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function createManager(name, password) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedPassword = typeof password === "string" ? password : "";

	if (!normalizedName || !normalizedPassword) {
		return Promise.resolve({ ok: false, error: "Credenciais inválidas." });
	}

	return new Promise((resolve) => {
		db.get(
			"SELECT id FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			async (err, row) => {
				if (err) {
					console.error("[auth] DB error:", err.message);
					return resolve({ ok: false, error: "Erro interno de autenticação." });
				}

				if (row) {
					return resolve({
						ok: false,
						error: "Já existe uma conta com esse nome.",
					});
				}

				const hash = await bcrypt.hash(normalizedPassword, 10);
				db.run(
					"INSERT INTO managers (name, password_hash) VALUES (?, ?)",
					[normalizedName, hash],
					(err2) => {
						if (err2) {
							console.error("[auth] Insert error:", err2.message);
							return resolve({ ok: false, error: "Erro ao criar conta." });
						}
						console.log(
							`[auth] New coach account created: "${normalizedName}"`,
						);
						resolve({ ok: true });
					},
				);
			},
		);
	});
}

/**
 * Record that a coach has joined (or created) a game room.
 * Idempotent — safe to call on every join.
 *
 * @param {string} managerName
 * @param {string} roomCode
 */
function recordRoomAccess(managerName, roomCode) {
	db.run(
		"INSERT OR IGNORE INTO room_managers (room_code, manager_name) VALUES (?, ?)",
		[roomCode.toUpperCase(), managerName],
	);
}

/**
 * Return the list of room codes the given coach has ever joined.
 *
 * @param {string} managerName
 * @returns {Promise<string[]>}
 */
function getManagerRooms(managerName) {
	return new Promise((resolve) => {
		db.all(
			"SELECT room_code FROM room_managers WHERE manager_name = ? COLLATE NOCASE ORDER BY room_code",
			[managerName],
			(err, rows) => {
				if (err) return resolve([]);
				resolve(rows.map((r) => r.room_code));
			},
		);
	});
}

/**
 * Remove all room_managers entries for a given room (called when a room is deleted).
 *
 * @param {string} roomCode
 * @returns {Promise<void>}
 */
function deleteRoomAccess(roomCode) {
	return new Promise((resolve) => {
		db.run(
			"DELETE FROM room_managers WHERE room_code = ? COLLATE NOCASE",
			[roomCode.toUpperCase()],
			() => resolve(),
		);
	});
}

/**
 * Change a manager's password (requires current password verification).
 *
 * @param {string} name
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function changePassword(name, currentPassword, newPassword) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedCurrent =
		typeof currentPassword === "string" ? currentPassword : "";
	const normalizedNew = typeof newPassword === "string" ? newPassword : "";

	if (!normalizedName || !normalizedCurrent || !normalizedNew) {
		return Promise.resolve({ ok: false, error: "Credenciais inválidas." });
	}
	if (normalizedNew.length < 3) {
		return Promise.resolve({
			ok: false,
			error: "A nova palavra-passe deve ter pelo menos 3 caracteres.",
		});
	}

	return new Promise((resolve) => {
		db.get(
			"SELECT id, password_hash FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			async (err, row) => {
				if (err) {
					console.error("[auth] DB error:", err.message);
					return resolve({ ok: false, error: "Erro interno." });
				}
				if (!row) {
					return resolve({ ok: false, error: "Conta não encontrada." });
				}
				const match = await bcrypt.compare(
					normalizedCurrent,
					row.password_hash,
				);
				if (!match) {
					return resolve({
						ok: false,
						error: "Palavra-passe actual incorrecta.",
					});
				}
				const hash = await bcrypt.hash(normalizedNew, 10);
				db.run(
					"UPDATE managers SET password_hash = ? WHERE id = ?",
					[hash, row.id],
					(err2) => {
						if (err2) {
							console.error("[auth] Update error:", err2.message);
							return resolve({
								ok: false,
								error: "Erro ao alterar palavra-passe.",
							});
						}
						resolve({ ok: true });
					},
				);
			},
		);
	});
}

/**
 * Return public info about a manager (name, list of room codes).
 *
 * @param {string} name
 * @returns {Promise<{ok: boolean, error?: string, info?: {name: string, rooms: string[]}}>}
 */
/**
 * Return the names of all human coaches linked to a room.
 *
 * @param {string} roomCode
 * @param {string} [excludeName] - Optional name to exclude from the list
 * @returns {Promise<string[]>}
 */
function getRoomCoaches(roomCode, excludeName) {
	return new Promise((resolve) => {
		db.all(
			"SELECT manager_name FROM room_managers WHERE room_code = ? COLLATE NOCASE ORDER BY manager_name",
			[roomCode.toUpperCase()],
			(err, rows) => {
				if (err) return resolve([]);
				const names = rows.map((r) => r.manager_name);
				if (excludeName) {
					const excl = excludeName.toLowerCase();
					resolve(names.filter((n) => n.toLowerCase() !== excl));
				} else {
					resolve(names);
				}
			},
		);
	});
}

function getManagerInfo(name) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	if (!normalizedName) {
		return Promise.resolve({ ok: false, error: "Nome inválido." });
	}

	return new Promise((resolve) => {
		db.get(
			"SELECT id, name, email, birth_year FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			async (err, row) => {
				if (err) {
					console.error("[auth] DB error:", err.message);
					return resolve({ ok: false, error: "Erro interno." });
				}
				if (!row) {
					return resolve({ ok: false, error: "Conta não encontrada." });
				}

				const rooms = await getManagerRooms(normalizedName);

				resolve({
					ok: true,
					info: {
						name: row.name,
						email: row.email || "",
						birthYear: row.birth_year || null,
						rooms,
					},
				});
			},
		);
	});
}

/**
 * Get the avatar seed for a manager.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
function getAvatarSeed(name) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	if (!normalizedName) return Promise.resolve("");

	return new Promise((resolve) => {
		db.get(
			"SELECT avatar_seed FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			(err, row) => {
				if (err || !row) return resolve("");
				resolve(row.avatar_seed || "");
			},
		);
	});
}

/**
 * Set the avatar seed for a manager.
 *
 * @param {string} name
 * @param {string} seed
 * @returns {Promise<{ok: boolean}>}
 */
function setAvatarSeed(name, seed) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	if (!normalizedName) return Promise.resolve({ ok: false });

	return new Promise((resolve) => {
		db.run(
			"UPDATE managers SET avatar_seed = ? WHERE name = ? COLLATE NOCASE",
			[seed, normalizedName],
			(err) => {
				if (err) {
					console.error("[auth] setAvatarSeed error:", err.message);
					return resolve({ ok: false });
				}
				resolve({ ok: true });
			},
		);
	});
}

/**
 * Update a manager's profile (email, birth year).
 * Only fields that are provided (non-undefined) are updated.
 *
 * @param {string} name
 * @param {string|undefined} email
 * @param {number|undefined} birthYear
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function updateManagerProfile(name, email, birthYear) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	if (!normalizedName) {
		return Promise.resolve({ ok: false, error: "Nome inválido." });
	}

	const updates = [];
	const params = [];

	if (email !== undefined) {
		const safeEmail =
			typeof email === "string" && email.trim() !== "" ? email.trim() : null;
		updates.push("email = ?");
		params.push(safeEmail);
	}
	if (birthYear !== undefined) {
		const safeBirthYear =
			birthYear != null && !Number.isNaN(birthYear)
				? parseInt(birthYear, 10)
				: null;
		updates.push("birth_year = ?");
		params.push(safeBirthYear);
	}

	// Nothing to update
	if (updates.length === 0) {
		return Promise.resolve({ ok: true });
	}

	params.push(normalizedName);

	return new Promise((resolve) => {
		db.run(
			`UPDATE managers SET ${updates.join(", ")} WHERE name = ? COLLATE NOCASE`,
			params,
			(err) => {
				if (err) {
					console.error("[auth] updateManagerProfile error:", err.message);
					return resolve({ ok: false, error: "Erro ao actualizar perfil." });
				}
				resolve({ ok: true });
			},
		);
	});
}

/**
 * Delete a manager account and all associated room access records.
 *
 * @param {string} name
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function deleteManager(name) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	if (!normalizedName) {
		return Promise.resolve({ ok: false, error: "Nome inválido." });
	}

	return new Promise((resolve) => {
		db.serialize(() => {
			db.run(
				"DELETE FROM room_managers WHERE manager_name = ? COLLATE NOCASE",
				[normalizedName],
			);
			db.run(
				"DELETE FROM managers WHERE name = ? COLLATE NOCASE",
				[normalizedName],
				(err) => {
					if (err) {
						console.error("[auth] deleteManager error:", err.message);
						return resolve({ ok: false, error: "Erro ao apagar conta." });
					}
					resolve({ ok: true });
				},
			);
		});
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin-only functions (for the user management panel)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List all manager accounts with their room assignments.
 * Admin-only — no password check.
 *
 * @returns {Promise<{ok: boolean, users?: Array<{name: string, email: string, birthYear: number|null, rooms: string[]}>, error?: string}>}
 */
function adminListUsers() {
	return new Promise((resolve) => {
		db.all(
			"SELECT id, name, email, birth_year FROM managers ORDER BY name COLLATE NOCASE",
			[],
			async (err, rows) => {
				if (err) {
					console.error("[auth] adminListUsers error:", err.message);
					return resolve({ ok: false, error: "Erro ao listar utilizadores." });
				}

				const users = [];
				for (const row of rows) {
					const rooms = await getManagerRooms(row.name);
					users.push({
						name: row.name,
						email: row.email || "",
						birthYear: row.birth_year || null,
						rooms,
					});
				}
				resolve({ ok: true, users });
			},
		);
	});
}

/**
 * Change a manager's password without requiring the current one.
 * Admin-only override.
 *
 * @param {string} name
 * @param {string} newPassword
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function adminChangePassword(name, newPassword) {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedNew = typeof newPassword === "string" ? newPassword : "";

	if (!normalizedName || !normalizedNew) {
		return Promise.resolve({ ok: false, error: "Credenciais inválidas." });
	}
	if (normalizedNew.length < 3) {
		return Promise.resolve({
			ok: false,
			error: "A palavra-passe deve ter pelo menos 3 caracteres.",
		});
	}

	return new Promise((resolve) => {
		db.get(
			"SELECT id FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			async (err, row) => {
				if (err) {
					console.error("[auth] adminChangePassword error:", err.message);
					return resolve({ ok: false, error: "Erro interno." });
				}
				if (!row) {
					return resolve({ ok: false, error: "Utilizador não encontrado." });
				}

				const hash = await bcrypt.hash(normalizedNew, 10);
				db.run(
					"UPDATE managers SET password_hash = ? WHERE id = ?",
					[hash, row.id],
					(err2) => {
						if (err2) {
							console.error("[auth] adminChangePassword update error:", err2.message);
							return resolve({ ok: false, error: "Erro ao alterar palavra-passe." });
						}
						authCacheInvalidate(normalizedName);
						console.log(`[auth] Admin changed password for "${normalizedName}"`);
						resolve({ ok: true });
					},
				);
			},
		);
	});
}

/**
 * Rename a manager account across ALL databases:
 *   - accounts.db.managers
 *   - accounts.db.room_managers
 *   - Every per-room game_XXXX.db.managers
 *
 * Returns partial-success info so the admin knows if some per-room DBs
 * could not be updated (e.g. because the room is actively in memory).
 *
 * @param {string} oldName
 * @param {string} newName
 * @param {object} [activeGames] - Optional in-memory game state map for live sync
 * @returns {Promise<{ok: boolean, error?: string, warnings?: string[]}>}
 */
function adminRenameManager(oldName, newName, activeGames) {
	const normalizedOld = typeof oldName === "string" ? oldName.trim() : "";
	const normalizedNew = typeof newName === "string" ? newName.trim() : "";

	if (!normalizedOld || !normalizedNew) {
		return Promise.resolve({ ok: false, error: "Nomes inválidos." });
	}
	if (normalizedOld.toLowerCase() === normalizedNew.toLowerCase()) {
		return Promise.resolve({ ok: false, error: "O novo nome é igual ao actual." });
	}
	if (normalizedNew.length < 2) {
		return Promise.resolve({
			ok: false,
			error: "O nome deve ter pelo menos 2 caracteres.",
		});
	}

	return new Promise((resolve) => {
		// Check new name doesn't already exist
		db.get(
			"SELECT id FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedNew],
			async (err, existing) => {
				if (err) {
					console.error("[auth] adminRenameManager check error:", err.message);
					return resolve({ ok: false, error: "Erro interno." });
				}
				if (existing) {
					return resolve({
						ok: false,
						error: `Já existe uma conta com o nome "${normalizedNew}".`,
					});
				}

				const warnings = [];

				// 1. Rename in accounts.db.managers
				db.run(
					"UPDATE managers SET name = ? WHERE name = ? COLLATE NOCASE",
					[normalizedNew, normalizedOld],
					(updateErr) => {
						if (updateErr) {
							console.error("[auth] adminRenameManager update managers error:", updateErr.message);
							return resolve({ ok: false, error: "Erro ao renomear conta." });
						}

						// Invalidate cache for both old and new names
						authCacheInvalidate(normalizedOld);
						authCacheInvalidate(normalizedNew);

						// 2. Rename in accounts.db.room_managers
						db.run(
							"UPDATE room_managers SET manager_name = ? WHERE manager_name = ? COLLATE NOCASE",
							[normalizedNew, normalizedOld],
							(rmErr) => {
								if (rmErr) {
									console.error("[auth] adminRenameManager update room_managers error:", rmErr.message);
									warnings.push("Falha ao actualizar room_managers.");
								}

								// 3. Rename in each per-room game DB
								db.all(
									"SELECT room_code FROM room_managers WHERE manager_name = ? COLLATE NOCASE",
									[normalizedNew],
									(roomErr, roomRows) => {
										if (roomErr) {
											console.error("[auth] adminRenameManager fetch rooms error:", roomErr.message);
											return resolve({ ok: true, warnings: [...warnings, "Não foi possível verificar salas para renomeação."] });
										}

										const roomCodes = (roomRows || []).map((r) => r.room_code);
										let pending = roomCodes.length;

										if (pending === 0) {
											// No rooms to update — done
											console.log(`[auth] Admin renamed "${normalizedOld}" → "${normalizedNew}" (no rooms)`);
											return resolve({ ok: true, warnings: warnings.length > 0 ? warnings : undefined });
										}

										const done = () => {
											pending--;
											if (pending <= 0) {
												console.log(`[auth] Admin renamed "${normalizedOld}" → "${normalizedNew}" (${roomCodes.length} rooms)`);
												resolve({ ok: true, warnings: warnings.length > 0 ? warnings : undefined });
											}
										};

										for (const roomCode of roomCodes) {
											const gameDbPath = path.join(
												path.dirname(DB_PATH),
												`game_${roomCode}.db`,
											);

											// If the game is active in memory, update playersByName there too
											if (activeGames && activeGames[roomCode]) {
												const game = activeGames[roomCode];
												if (game.playersByName && game.playersByName[normalizedOld]) {
													game.playersByName[normalizedNew] = game.playersByName[normalizedOld];
													game.playersByName[normalizedNew].name = normalizedNew;
													delete game.playersByName[normalizedOld];

													// Update socketToName
													const sockId = game.playersByName[normalizedNew]?.socketId;
													if (sockId && game.socketToName) {
														game.socketToName[sockId] = normalizedNew;
													}

													// Update lockedCoaches
													if (game.lockedCoaches && game.lockedCoaches.has(normalizedOld)) {
														game.lockedCoaches.delete(normalizedOld);
														game.lockedCoaches.add(normalizedNew);
													}

													// Update roomCreator
													if (game.roomCreator === normalizedOld) {
														game.roomCreator = normalizedNew;
													}

													// Update phaseAcks
													if (game.phaseAcks && game.phaseAcks.has(normalizedOld)) {
														game.phaseAcks.delete(normalizedOld);
														game.phaseAcks.add(normalizedNew);
													}

													// Update dismissedCoachSince
													if (game.dismissedCoachSince && game.dismissedCoachSince[normalizedOld]) {
														game.dismissedCoachSince[normalizedNew] = game.dismissedCoachSince[normalizedOld];
														delete game.dismissedCoachSince[normalizedOld];
													}

													// Update dismissalsThisSeason
													if (game.dismissalsThisSeason && game.dismissalsThisSeason.has(normalizedOld)) {
														game.dismissalsThisSeason.delete(normalizedOld);
														game.dismissalsThisSeason.add(normalizedNew);
													}

													// Update pendingJobOffers
													if (game.pendingJobOffers && game.pendingJobOffers[normalizedOld]) {
														game.pendingJobOffers[normalizedNew] = game.pendingJobOffers[normalizedOld];
														delete game.pendingJobOffers[normalizedOld];
													}

													// Emit a name-changed event to the affected coach so they can refresh
													if (sockId) {
														try {
															// Emit via the game's socket reference if available
															// (actual emit happens in socket handler since io isn't available here)
														} catch (_) {}
													}
												}
											}

											// Open per-room DB and update managers table
											if (fs.existsSync(gameDbPath)) {
												try {
													const gameDb = new sqlite3.Database(gameDbPath);
													gameDb.run(
														"UPDATE managers SET name = ? WHERE name = ? COLLATE NOCASE",
														[normalizedNew, normalizedOld],
														(gdbErr) => {
															if (gdbErr) {
																console.error(
																	`[auth] adminRenameManager error on ${roomCode}:`,
																	gdbErr.message,
																);
																warnings.push(`Falha ao actualizar sala ${roomCode}.`);
															}
															gameDb.close();
															done();
														},
													);
												} catch (perr) {
													console.error(
														`[auth] adminRenameManager open error on ${roomCode}:`,
														perr.message,
													);
													warnings.push(`Falha ao abrir sala ${roomCode}.`);
													done();
												}
											} else {
												// Game DB doesn't exist — skip (room might have been deleted)
												warnings.push(`Sala ${roomCode} não encontrada no disco.`);
												done();
											}
										}
									},
								);
							},
						);
					},
				);
			},
		);
	});
}

/**
 * Add room access for a manager (so the room appears in their saves list).
 * Validates that the game DB file exists before inserting.
 *
 * @param {string} managerName
 * @param {string} roomCode
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function adminAddRoomAccess(managerName, roomCode) {
	const normalizedName = typeof managerName === "string" ? managerName.trim() : "";
	const normalizedRoom = typeof roomCode === "string" ? roomCode.trim().toUpperCase() : "";

	if (!normalizedName || !normalizedRoom) {
		return Promise.resolve({ ok: false, error: "Nome ou código de sala inválidos." });
	}

	// Validate room exists on disk
	const gameDbPath = path.join(path.dirname(DB_PATH), `game_${normalizedRoom}.db`);
	if (!fs.existsSync(gameDbPath)) {
		return Promise.resolve({
			ok: false,
			error: `A sala "${normalizedRoom}" não existe.`,
		});
	}

	return new Promise((resolve) => {
		// Check manager exists first
		db.get(
			"SELECT id FROM managers WHERE name = ? COLLATE NOCASE",
			[normalizedName],
			(err, row) => {
				if (err) {
					console.error("[auth] adminAddRoomAccess error:", err.message);
					return resolve({ ok: false, error: "Erro interno." });
				}
				if (!row) {
					return resolve({ ok: false, error: "Utilizador não encontrado." });
				}

				db.run(
					"INSERT OR IGNORE INTO room_managers (room_code, manager_name) VALUES (?, ?)",
					[normalizedRoom, normalizedName],
					(insErr) => {
						if (insErr) {
							console.error("[auth] adminAddRoomAccess insert error:", insErr.message);
							return resolve({ ok: false, error: "Erro ao adicionar sala." });
						}
						console.log(`[auth] Admin added room ${normalizedRoom} to "${normalizedName}"`);
						resolve({ ok: true });
					},
				);
			},
		);
	});
}

/**
 * Remove room access for a manager.
 *
 * @param {string} managerName
 * @param {string} roomCode
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
function adminRemoveRoomAccess(managerName, roomCode) {
	const normalizedName = typeof managerName === "string" ? managerName.trim() : "";
	const normalizedRoom = typeof roomCode === "string" ? roomCode.trim().toUpperCase() : "";

	if (!normalizedName || !normalizedRoom) {
		return Promise.resolve({ ok: false, error: "Nome ou código de sala inválidos." });
	}

	return new Promise((resolve) => {
		db.run(
			"DELETE FROM room_managers WHERE room_code = ? COLLATE NOCASE AND manager_name = ? COLLATE NOCASE",
			[normalizedRoom, normalizedName],
			(err) => {
				if (err) {
					console.error("[auth] adminRemoveRoomAccess error:", err.message);
					return resolve({ ok: false, error: "Erro ao remover sala." });
				}
				console.log(`[auth] Admin removed room ${normalizedRoom} from "${normalizedName}"`);
				resolve({ ok: true });
			},
		);
	});
}

module.exports = {
	verifyOrCreateManager,
	verifyManager,
	createManager,
	recordRoomAccess,
	deleteRoomAccess,
	getManagerRooms,
	getRoomCoaches,
	changePassword,
	getManagerInfo,
	getAvatarSeed,
	setAvatarSeed,
	updateManagerProfile,
	deleteManager,
	// Admin functions
	adminListUsers,
	adminChangePassword,
	adminRenameManager,
	adminAddRoomAccess,
	adminRemoveRoomAccess,
};
