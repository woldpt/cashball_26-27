import { useState } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
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
  const isMobile = useIsMobile();

  const isAdmin = isAdminCoach(me?.name);
  const { loading, error: usersError, fetchUsers } = useAdminUsers({ open: open && isAdmin });

  if (!isAdmin) return null;

  // Salas sempre "frescas" vindas do contexto (renomeias/remoções refletem-se).
  const selectedRooms = adminUsers.find((u) => u.name === selectedUser?.name)?.rooms ?? [];

  // Conteúdo do painel de detalhe: reutilizado na layout de 2 colunas (desktop)
  // e na coluna única de mobile (ao ver um utilizador).
  const detailContent = !selectedUser ? (
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
  );

  // Lista de utilizadores — reutilizada na coluna desktop e no mobile (largura total).
  const listPane = (
    <UserList
      users={adminUsers}
      loading={loading}
      selectedName={selectedUser?.name ?? null}
      onSelect={(u) => setSelectedUser(u)}
    />
  );

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

      {/* Body — o `detailContent` é renderizado dentro da coluna de detalhe, abaixo.
          Desktop (>= md): 2 colunas lado-a-lado. Mobile (< md): coluna única — lista OU
          detalhe, nunca ambos (com row-flex e duas colunas `w-full`, o mobile vertical
          ficava partido a 50/50 com os dois painéis visíveis). */}
      <div className="flex flex-1 min-h-0">
        {isMobile ? (
          /* Detalhe — largura total em mobile, com «Voltar» para regressar à lista. */
          selectedUser ? (
            <div className="w-full min-h-0 flex flex-col">
              <div className="px-5 pt-4 pb-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                  <span className="material-symbols-outlined">arrow_back</span>
                  Voltar
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-5 pt-3 space-y-6">
                {detailContent}
              </div>
            </div>
          ) : (
            /* Lista — largura total em mobile */
            <div className="w-full min-h-0 flex flex-col">{listPane}</div>
          )
        ) : (
          <>
            {/* Lista */}
            <div className="w-1/2 min-h-0 flex flex-col border-r border-outline-variant/15 bg-surface-container-high/30">
              {listPane}
            </div>

            {/* Detalhe */}
            <div className="w-1/2 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
                {detailContent}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer — empilha em mobile, linha no desktop */}
      <div className="px-6 py-3 border-t border-outline-variant/15 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] text-on-surface-variant shrink-0 gap-2">
        <span>Apenas {me?.name} tem acesso a este painel.</span>
        <Button variant="ghost" size="sm" onClick={fetchUsers}>
          <span className="material-symbols-outlined text-sm">refresh</span>
          Actualizar
        </Button>
      </div>
    </ModalShell>
  );
}
