import { socket } from "../../socket.js";

/**
 * adminApi — contratos socket do painel de administração (fonte única).
 *
 * Todos os eventos `admin*` passam por cá como promessas tipadas. As regras
 * de negócio multi-chamada (ex.: rename antes de password) também vivem aqui,
 * nunca nos componentes.
 */

/** Nome do coach de administração (espelho do env ADMIN_COACH_NAME do servidor, default "fabio"). */
export const ADMIN_COACH_NAME = "fabio";

/**
 * @typedef {Object} AdminUser
 * @property {string} name
 * @property {string} email
 * @property {number|null} birthYear
 * @property {string[]} rooms
 * @property {boolean} [online]
 */

/**
 * Verifica se o nome é o coach de administração (fonte única no frontend —
 * não duplicar esta comparação noutra parte).
 * @param {string|null|undefined} name
 * @returns {boolean} true se for o admin
 */
export function isAdminCoach(name) {
  return typeof name === "string" && name.toLowerCase() === ADMIN_COACH_NAME;
}

/**
 * Emite um evento socket e devolve a resposta como promise.
 * @param {string} event
 * @param {object|undefined} payload
 * @returns {Promise<object>}
 */
function emitAsync(event, payload) {
  return new Promise((resolve) => {
    if (payload === undefined) {
      // Sem payload: o callback é o primeiro argumento (os handlers admin recebem-no em `callback`).
      socket.emit(event, (response) => resolve(response));
    } else {
      socket.emit(event, payload, (response) => resolve(response));
    }
  });
}

/**
 * Lista todos os utilizadores registados com as suas salas e estado online.
 * @returns {Promise<{ok: boolean, users?: AdminUser[], error?: string}>}
 */
export function adminListUsers() {
  return emitAsync("adminListUsers");
}

/**
 * Renomeia um utilizador. O servidor força re-login da sessão ativa.
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export function adminRenameUser(oldName, newName) {
  return emitAsync("adminRenameUser", { oldName, newName });
}

/**
 * Altera a palavra-passe de um utilizador (sem pedir a atual).
 * @param {string} name
 * @param {string} newPassword
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export function adminChangePassword(name, newPassword) {
  return emitAsync("adminChangePassword", { name, newPassword });
}

/**
 * Apaga definitivamente um utilizador (conta + acessos a salas + sessões).
 * @param {string} name
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export function adminDeleteUser(name) {
  return emitAsync("adminDeleteUser", { name });
}

/**
 * Adiciona ou remove o acesso de um utilizador a uma sala.
 * Atenção: "remove" numa sala ativa = expulsão + ban permanente (intencional).
 * @param {string} name
 * @param {string} roomCode
 * @param {"add"|"remove"} action
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export function adminSetRoomAccess(name, roomCode, action) {
  return emitAsync("adminUpdateRoomAccess", { name, roomCode, action });
}

/**
 * Carrega os coaches humanos e as equipas atribuíveis de uma sala.
 * @param {string} roomCode
 * @returns {Promise<{ok: boolean, coaches?: Array<{name: string, teamId: number|null, teamName: string|null, division: number|null}>, teams?: Array<{id: number, name: string, division: number}>, error?: string}>}
 */
export function adminGetRoomCoaches(roomCode) {
  return emitAsync("adminGetRoomCoaches", { roomCode });
}

/**
 * Move um coach para uma equipa livre na sala (assume plantel + finanças).
 * @param {string} roomCode
 * @param {string} name
 * @param {number} teamId
 * @returns {Promise<{ok: boolean, error?: string, teamName?: string}>}
 */
export function adminSetCoachTeam(roomCode, name, teamId) {
  return emitAsync("adminSetCoachTeam", { roomCode, name, teamId });
}

/**
 * Guarda perfil de forma sequencial (regra de negócio): rename PRIMEIRO e
 * password DEPOIS — nunca em paralelo, porque a password é gravada com o nome
 * novo. Devolve a lista legível das alterações efetuadas.
 * @param {object} params - oldName (string); newName/newPassword opcionais.
 * @returns {Promise<{ok: boolean, changes?: string[], error?: string}>}
 */
export async function adminSaveProfile(params) {
  const trimmedName = typeof params.newName === "string" ? params.newName.trim() : "";
  const trimmedPassword = typeof params.newPassword === "string" ? params.newPassword.trim() : "";
  const doRename = trimmedName !== "" && trimmedName !== params.oldName;
  const doPassword = trimmedPassword !== "";

  if (!doRename && !doPassword) {
    return { ok: false, error: "Nenhuma alteração para guardar." };
  }

  const changes = [];
  let currentName = params.oldName;

  if (doRename) {
    const renameResult = await adminRenameUser(currentName, trimmedName);
    if (!renameResult?.ok) {
      return { ok: false, error: renameResult?.error || "Erro ao renomear." };
    }
    changes.push(`nome → "${trimmedName}"`);
    currentName = trimmedName;
  }

  if (doPassword) {
    const passwordResult = await adminChangePassword(currentName, trimmedPassword);
    if (!passwordResult?.ok) {
      return { ok: false, error: passwordResult?.error || "Erro ao alterar palavra-passe." };
    }
    changes.push("palavra-passe alterada");
  }

  return { ok: true, changes };
}

/**
 * Gera uma palavra-passe aleatória de 12 caracteres (sem carateres ambíguos).
 * @returns {string}
 */
export function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
