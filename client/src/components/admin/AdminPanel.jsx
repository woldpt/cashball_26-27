import { useState } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { ModalShell } from "../shared/ModalShell.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";
import { Button } from "../shared/Button.jsx";
import { MODAL_Z } from "../../constants/index.js";
import { isAdminCoach } from "./adminApi.js";
import { useAdminUsers } from "./useAdminUsers.js";
import { UserList } from "./UserList.jsx";
import { UserProfileSection } from "./UserProfileSection.jsx";
import { UserRoomsSection } from "./UserRoomsSection.jsx";
import { UserTeamsSection } from "./UserTeamsSection.jsx";

/**
 * AdminPanel — Gestão de utilizadores para o coach de administração.
 *
 * Componente shell: só layout (2 painéis) + estado da seleção. Todo o resto
 * está em subcomponentes dedicadas:
 *   - adminApi.js          → contratos socket (fonte única)
 *   - useAdminUsers        → lista + subscrição `adminUsersUpdated`
 *   - UserList             → pesquisa/ordenação/online (esquerda)
 *   - UserProfileSection   → perfil + palavra-passe + apagar
 *   - UserRoomsSection     → salas + diálogo de remoção (BAN explícito)
 *   - UserTeamsSection     → roster da sala + mover treinador (useRoomRoster)
 *
 * Only accessible by the admin coach (ADMIN_COACH_NAME env var, default "fabio").
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function AdminPanel({ open, onClose }) {
  const { me, adminUsers } = useGame();
  const [selectedUser, setSelectedUser] = useState(null);

  const isAdmin = isAdminCoach(me?.name);
  const { loading, error: usersError, fetchUsers } = useAdminUsers({ open: open && isAdmin });

  if (!isAdmin) return null;

  // Salas sempre "frescas" vindas do contexto (renomeias/remoções refletem-se).
  const selectedRooms = adminUsers.find((u) => u.name === selectedUser?.name)?.rooms ?? [];

  /** @param {string} newName Nome novo do utilizador após rename. */
  function handleRenamed(newName) {
    setSelectedUser((u) => (u ? { ...u, name: newName } : u));
  }

  return (
    <ModalShell visible={open} onClose={onClose} z={MODAL_Z.admin} variant="xl" cardClassName="max-h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-outline-variant/15 flex items-center justify-between shrink-0 bg-surface-container-high/50">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-400 text-2xl">admin_panel_settings</span>
          <div>
            <h2 className="text-base font-black font-headline tracking-tight text-on-surface uppercase">Gestão de Utilizadores</h2>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{adminUsers.length} utilizadores registados</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} title="Fechar">
          <span className="material-symbols-outlined">close</span>
        </Button>
      </div>

      {/* Erro de carregamento da lista (não é feedback de ações — cada secção tem o seu próprio) */}
      {usersError && (
        <div className="px-6 py-2 border-b border-error/20 bg-error/10 text-error font-bold text-xs shrink-0">{usersError}</div>
      )}

      {/* Body 2-colunas */}
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-outline-variant/15 bg-surface-container-high/30 min-h-0 flex flex-col">
          <UserList
            users={adminUsers}
            loading={loading}
            selectedName={selectedUser?.name ?? null}
            onSelect={(u) => setSelectedUser(u)}
          />
        </div>

        <div className="w-1/2 min-h-0 overflow-y-auto p-5 space-y-6">
          {!selectedUser ? (
            <EmptyState
              emoji="👤"
              title="Seleciona um utilizador"
              description="Escolhe um utilizador na lista para editar perfil, salas e equipas."
            />
          ) : (
            <>
              {/* key=nome: remonta limpo ao trocar de utilizador / após rename */}
              <UserProfileSection
                key={`profile-${selectedUser.name}`}
                user={selectedUser}
                onRenamed={handleRenamed}
                onDeleted={() => setSelectedUser(null)}
              />
              <div className="border-t border-outline-variant/15" />
              <UserRoomsSection user={selectedUser} rooms={selectedRooms} onChanged={fetchUsers} />
              <div className="border-t border-outline-variant/15" />
              {/* key=join das salas: remonta limpo quando uma sala é adicionada/removida */}
              <UserTeamsSection key={`teams-${selectedRooms.join("|") || "none"}`} rooms={selectedRooms} />
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-outline-variant/15 flex items-center justify-between text-[10px] text-on-surface-variant shrink-0">
        <span>Apenas {me?.name} tem acesso a este painel.</span>
        <Button variant="ghost" size="sm" onClick={fetchUsers}>
          <span className="material-symbols-outlined text-sm">refresh</span>
          Actualizar
        </Button>
      </div>
    </ModalShell>
  );
}
