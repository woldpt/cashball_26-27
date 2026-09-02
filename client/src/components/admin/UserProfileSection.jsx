import { useState } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { Button } from "../shared/Button.jsx";
import { GameDialog } from "../shared/GameDialog.jsx";
import { MODAL_Z } from "../../constants/index.js";
import { adminDeleteUser, adminSaveProfile, generatePassword } from "./adminApi.js";

/**
 * Secção "Perfil" — renomear / palavra-passe / apagar o utilizador.
 *
 * Dirty-state real: o botão de guardar só fica ativo com alterações efetivas.
 * A password só é enviada quando preenchida (o servidor não pede a atual).
 *
 * @param {{
 *   user: any,
 *   onRenamed?: (newName: string) => void,
 *   onDeleted?: () => void,
 * }} props
 */
export function UserProfileSection({ user, onRenamed, onDeleted }) {
  const { addToast } = useGame();
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editPassword, setEditPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Nota: sem effect de re-sincronização — o painel passa `key={selectedUser.name}`
  // e o React remonta esta secção limpa a cada troca/rename (padrão oficial).

  if (!user) return null;

  const trimmedName = editName.trim();
  const nameChanged = trimmedName !== "" && trimmedName !== user.name;
  const dirty = nameChanged || editPassword.trim() !== "";

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError("");
    const result = await adminSaveProfile({ oldName: user.name, newName: editName, newPassword: editPassword });
    setSaving(false);
    if (!result?.ok) {
      setError(result?.error ?? "Erro ao guardar.");
      return;
    }
    addToast(`Perfil guardado: ${(result.changes || []).join("; ")}.`);
    setEditPassword("");
    setShowPassword(false);
    onRenamed?.(nameChanged ? trimmedName : user.name);
  }

  function handleDelete() {
    adminDeleteUser(user.name).then((result) => {
      setConfirmDelete(false);
      if (result?.ok) {
        addToast(`Utilizador "${user.name}" apagado.`);
        onDeleted?.();
      } else {
        setError(result?.error ?? "Erro ao apagar utilizador.");
      }
    });
  }

  const deleteDialog = confirmDelete
    ? {
        mode: "confirm",
        title: `Apagar conta de "${user.name}"`,
        description: "A conta, os acessos a todas as salas e as sessões ativas serão eliminados. A ação é irreversível.",
        danger: true,
        confirmLabel: "Apagar conta",
        onConfirm: handleDelete,
      }
    : null;

  return (
    <section>
      <h3 className="text-xs uppercase tracking-widest text-on-surface-variant font-black mb-1">Perfil</h3>
      {error && <p className="text-xs text-error font-bold mb-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1" htmlFor="admin-edit-name">
            Nome
          </label>
          <input
            id="admin-edit-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
          />
          {nameChanged && (
            <p className="text-[10px] text-on-surface-variant/60 mt-1">Renomear força re-login na próxima sessão ativa.</p>
          )}
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1" htmlFor="admin-edit-password">
            Nova palavra-passe <span className="normal-case font-medium">(deixar vazio para não alterar)</span>
          </label>
          <div className="relative">
            <input
              id="admin-edit-password"
              type={showPassword ? "text" : "password"}
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 pr-16 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Ocultar" : "Mostrar"}
                className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">{showPassword ? "visibility_off" : "visibility"}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditPassword(generatePassword())}
                title="Gerar palavra-passe"
                className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">casino</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="accent" type="submit" disabled={!dirty || saving}>
            {saving ? (
              <span className="material-symbols-outlined animate-spin">sync</span>
            ) : (
              <span className="material-symbols-outlined">save</span>
            )}
            {saving ? "A guardar..." : "Guardar"}
          </Button>

          <div className="flex-1" />

          <Button variant="dangerSoft" size="sm" onClick={() => setConfirmDelete(true)}>
            Apagar utilizador
          </Button>
        </div>
      </form>

      {(user.email || user.birthYear) && (
        <div className="mt-4 pt-3 border-t border-outline-variant/15 text-xs text-on-surface-variant space-y-0.5 break-words">
          {user.email && <p>Email: {user.email}</p>}
          {user.birthYear && <p>Ano de nascimento: {user.birthYear}</p>}
        </div>
      )}

      <GameDialog dialog={deleteDialog} z={MODAL_Z.adminDialog} onClose={() => setConfirmDelete(false)} />
    </section>
  );
}
