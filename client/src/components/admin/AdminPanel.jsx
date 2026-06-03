import { useState, useEffect, useCallback } from "react";
import { socket } from "../../socket.js";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../../contexts/GameContext.jsx";

/**
 * AdminPanel — User management for the admin coach (fabio).
 *
 * Three sections:
 *   1. User List — table of all users with rooms and actions
 *   2. Edit User — change name or password for selected user
 *   3. Room Assignment — add/remove rooms for selected user
 *
 * Only accessible by the admin coach (ADMIN_COACH_NAME env var, default "fabio").
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function AdminPanel({ open, onClose }) {
  const { me, adminUsers, setAdminUsers } = useGame();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Selected user state
  const [selectedUser, setSelectedUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Is the current user the admin?
  const isAdmin = me?.name?.toLowerCase() === "fabio";

  // ── Fetch users list ──────────────────────────────────────────────────────
  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError("");
    socket.emit("adminListUsers", (result) => {
      setLoading(false);
      if (result?.ok) {
        setAdminUsers(result.users || []);
      } else {
        setError(result?.error || "Erro ao carregar utilizadores.");
      }
    });
  }, [setAdminUsers]);

  useEffect(() => {
    if (!open) return;
    // Defer via microtask to avoid calling setState synchronously in effect
    const t = setTimeout(() => fetchUsers(), 0);
    socket.on("adminUsersUpdated", fetchUsers);
    return () => {
      clearTimeout(t);
      socket.off("adminUsersUpdated", fetchUsers);
    };
  }, [open, fetchUsers]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function selectUser(user) {
    setSelectedUser(user);
    setEditName(user.name);
    setEditPassword("");
    setNewRoomCode("");
    setError("");
    setSuccess("");
  }

  function clearSuccess() {
    setSuccess("");
    setError("");
  }

  // Bug 2 fix: run rename THEN password change sequentially, never in parallel.
  // Running both in parallel caused password change to fail because it used the
  // new name before the rename had completed on the server.
  async function handleSaveProfile() {
    if (!selectedUser) return;

    const doRename = editName.trim() !== "" && editName.trim() !== selectedUser.name;
    const doPassword = editPassword.trim() !== "";

    if (!doRename && !doPassword) {
      setError("Nenhuma alteração para guardar.");
      return;
    }

    setEditLoading(true);
    setError("");
    setSuccess("");

    const changes = [];
    let currentName = selectedUser.name;

    // Step 1: rename first (if needed)
    if (doRename) {
      const result = await new Promise((resolve) =>
        socket.emit("adminRenameUser", { oldName: currentName, newName: editName.trim() }, resolve),
      );
      if (!result?.ok) {
        setEditLoading(false);
        setError(result?.error || "Erro ao renomear.");
        return;
      }
      changes.push(`nome → "${editName.trim()}"`);
      currentName = editName.trim();
    }

    // Step 2: change password AFTER rename is confirmed complete
    if (doPassword) {
      const result = await new Promise((resolve) =>
        socket.emit("adminChangePassword", { name: currentName, newPassword: editPassword.trim() }, resolve),
      );
      if (!result?.ok) {
        setEditLoading(false);
        setError(result?.error || "Erro ao alterar palavra-passe.");
        return;
      }
      changes.push("palavra-passe alterada");
    }

    setEditLoading(false);
    setSuccess(changes.join("; ") + " com sucesso!");
    setEditPassword("");
    fetchUsers();
    if (doRename) setSelectedUser({ ...selectedUser, name: editName.trim() });
  }

  function handleDeleteUser() {
    if (!selectedUser) return;
    if (!window.confirm(`Tens a certeza que queres apagar a conta de "${selectedUser.name}"? Esta ação é irreversível.`)) return;

    setEditLoading(true);
    socket.emit("adminDeleteUser", { name: selectedUser.name }, (result) => {
      setEditLoading(false);
      if (result?.ok) {
        setSuccess(`Utilizador "${selectedUser.name}" apagado.`);
        setSelectedUser(null);
        fetchUsers();
      } else {
        setError(result?.error || "Erro ao apagar utilizador.");
      }
    });
  }

  function handleAddRoom() {
    if (!selectedUser || !newRoomCode.trim()) return;
    setEditLoading(true);
    socket.emit(
      "adminUpdateRoomAccess",
      { name: selectedUser.name, roomCode: newRoomCode.trim().toUpperCase(), action: "add" },
      (result) => {
        setEditLoading(false);
        if (result?.ok) {
          setSuccess(`Sala "${newRoomCode.trim().toUpperCase()}" adicionada.`);
          setNewRoomCode("");
          fetchUsers();
        } else {
          setError(result?.error || "Erro ao adicionar sala.");
        }
      },
    );
  }

  function handleRemoveRoom(roomCode) {
    if (!selectedUser) return;
    setEditLoading(true);
    socket.emit(
      "adminUpdateRoomAccess",
      { name: selectedUser.name, roomCode, action: "remove" },
      (result) => {
        setEditLoading(false);
        if (result?.ok) {
          setSuccess(`Sala "${roomCode}" removida.`);
          fetchUsers();
        } else {
          setError(result?.error || "Erro ao remover sala.");
        }
      },
    );
  }

  // ── Guard: only admin can see this ────────────────────────────────────────
  if (!isAdmin || !open) return null;

  // Bug 7 fix: second branch was dead code (selectedUser is always falsy there)
  const userRooms = selectedUser
    ? (adminUsers.find((u) => u.name === selectedUser.name)?.rooms || [])
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="admin-backdrop"
        className="fixed inset-0 z-[300] bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          className="w-full max-w-4xl max-h-[85vh] bg-zinc-900 border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          initial={{ scale: 0.9, y: 32 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 32 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-400 text-2xl">
                admin_panel_settings
              </span>
              <div>
                <h2 className="text-lg font-black text-white">Gestão de Utilizadores</h2>
                <p className="text-zinc-500 text-xs">
                  {adminUsers.length} utilizador{adminUsers.length !== 1 ? "es" : ""} registado{adminUsers.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* ── Feedback ── */}
          {(error || success) && (
            <div
              className={`px-6 py-2 text-sm font-bold shrink-0 ${
                error ? "bg-red-500/10 text-red-400 border-b border-red-500/20" : "bg-green-500/10 text-green-400 border-b border-green-500/20"
              }`}
            >
              {error || success}
              <button onClick={clearSuccess} className="ml-3 underline text-xs opacity-70 hover:opacity-100">
                Fechar
              </button>
            </div>
          )}

          {/* ── Body ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* LEFT: User List */}
            <div className="w-1/2 border-r border-zinc-700/50 flex flex-col min-h-0">
              <div className="px-4 py-2 border-b border-zinc-700/30 shrink-0">
                <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-black">
                  Utilizadores
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-zinc-500">
                    <span className="material-symbols-outlined animate-spin mr-2">sync</span>
                    A carregar...
                  </div>
                ) : adminUsers.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
                    Nenhum utilizador encontrado.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                      <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-500">
                        <th className="px-4 py-2 font-black">Nome</th>
                        <th className="px-4 py-2 font-black">Salas</th>
                        <th className="px-4 py-2 font-black text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((user) => (
                        <tr
                          key={user.name}
                          onClick={() => selectUser(user)}
                          className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                            selectedUser?.name === user.name
                              ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                              : "hover:bg-zinc-800/50 border-l-2 border-l-transparent"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <span className="text-white font-bold">{user.name}</span>
                            {user.name.toLowerCase() === "fabio" && (
                              <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-black uppercase">
                                Admin
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-400 text-xs">
                            {user.rooms?.length || 0} sala{(user.rooms?.length || 0) !== 1 ? "s" : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-[10px] text-zinc-600 uppercase font-black tracking-wider">
                              Editar →
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* RIGHT: Edit Panel */}
            <div className="w-1/2 flex flex-col min-h-0">
              {!selectedUser ? (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                  Seleciona um utilizador à esquerda para editar.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* ── Section: Edit Profile ── */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-black mb-3">
                      Editar Perfil
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
                          Nome
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
                          Nova Palavra-passe
                        </label>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Deixar em branco para não alterar"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveProfile}
                          disabled={editLoading || (!editName.trim() && !editPassword.trim())}
                          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold px-4 py-1.5 rounded-lg text-sm transition-colors"
                        >
                          {editLoading ? "A guardar..." : "Guardar"}
                        </button>

                        <button
                          onClick={handleDeleteUser}
                          disabled={editLoading}
                          className="bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 font-bold px-4 py-1.5 rounded-lg text-sm transition-colors"
                        >
                          Apagar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Divider ── */}
                  <div className="border-t border-zinc-800" />

                  {/* ── Section: Room Assignment ── */}
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-black mb-3">
                      Salas ({userRooms.length})
                    </h3>

                    {/* Current rooms */}
                    <div className="space-y-1 mb-3">
                      {userRooms.length === 0 ? (
                        <p className="text-zinc-600 text-xs py-1">Nenhuma sala atribuída.</p>
                      ) : (
                        userRooms.map((room) => (
                          <div
                            key={room}
                            className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2"
                          >
                            <span className="text-sm text-white font-mono font-bold tracking-wider">
                              {room}
                            </span>
                            <button
                              onClick={() => handleRemoveRoom(room)}
                              disabled={editLoading}
                              className="text-zinc-500 hover:text-red-400 disabled:opacity-30 transition-colors p-0.5"
                              title={`Remover sala ${room}`}
                            >
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add room */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRoomCode}
                        onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                        placeholder="Código da sala (ex: A1B2C3)"
                        maxLength={6}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors font-mono tracking-wider"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddRoom();
                        }}
                      />
                      <button
                        onClick={handleAddRoom}
                        disabled={editLoading || !newRoomCode.trim()}
                        className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-3 py-2 rounded-lg text-sm transition-colors shrink-0"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {/* ── Section: User Info ── */}
                  <div className="border-t border-zinc-800 pt-4">
                    <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-black mb-2">
                      Informação
                    </h3>
                    <div className="text-xs text-zinc-500 space-y-1">
                      {selectedUser.email && (
                        <p>Email: {selectedUser.email}</p>
                      )}
                      {selectedUser.birthYear && (
                        <p>Ano nascimento: {selectedUser.birthYear}</p>
                      )}
                      <p className="text-[11px] text-zinc-600 mt-1">
                        ID interno: {selectedUser.name?.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-3 border-t border-zinc-700/50 flex items-center justify-between text-[10px] text-zinc-600 shrink-0">
            <span>Admin Panel v1 — Apenas {me?.name} tem acesso</span>
            <button
              onClick={fetchUsers}
              className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Actualizar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
