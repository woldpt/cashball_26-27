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
 * Componente shell: só layout + estado da seleção. Todo o resto está em
 * subcomponentes dedicadas:
 *   - adminApi.js          → contratos socket (fonte única)
 *   - useAdminUsers        → lista + subscrição `adminUsersUpdated`
 *   - UserList             → pesquisa/ordenação/online (lista; cartões em mobile)
 *   - UserProfileSection   → perfil + palavra-passe + apagar
 *   - UserRoomsSection     → salas + diálogo de remoção (BAN explícito)
 *   - UserTeamsSection     → roster da sala + mover treinador (useRoomRoster)
 *
 * Layouts:
 *  - Desktop (>= 768px): card `xl` com 2 colunas lado-a-lado (lista | detalhe).
 *  - Mobile (< 768px):   "ecrã inteiro" — o card ocupa ~100dvh, fluxo vertical
 *    lista ↔ detalhe e barra superior que dá contexto (título ou «Voltar»).
 *    Tudo com `min-w-0` + truncate/break para NUNCA haver scroll horizontal.
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

  /** @param {string} newName Nome novo do utilizador após rename. */
  function handleRenamed(newName) {
    setSelectedUser((u) => (u ? { ...u, name: newName } : u));
  }

  // ── Mobile (< 768px): ecrã inteiro ────────────────────────────────────────
  // O card "xl" é convertido num sheet vertical quase cheio (h = 100dvh menos o
  // padding do backdrop). A barra superior dá contexto: título na lista,
  // «Voltar» + nome do utilizador no detalhe. Corpo com scroll vertical próprio;
  // larguras nunca forçadas → sem scroll horizontal por construção.
  if (isMobile) {
    return (
      <ModalShell
        visible={open}
        onClose={onClose}
        z={MODAL_Z.admin}
        variant="xl"
        cardClassName="h-[calc(100dvh-24px)] flex flex-col"
      >
        {/* Barra superior — contexto do estado atual */}
        <header className="shrink-0 px-4 py-3 border-b border-outline-variant/15 bg-surface-container-high/50 flex items-center gap-2 min-w-0">
          {selectedUser ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUser(null)}
                title="Voltar à lista"
                className="shrink-0 -ml-1"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </Button>
              <div className="min-w-0 flex-1">
                <h2
                  className="text-sm font-black font-headline tracking-tight text-on-surface uppercase truncate"
                  title={selectedUser.name}
                >
                  {selectedUser.name}
                </h2>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Gestão de utilizador</p>
              </div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-amber-400 text-2xl shrink-0">admin_panel_settings</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black font-headline tracking-tight text-on-surface uppercase truncate">
                  Gestão de Utilizadores
                </h2>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                  {adminUsers.length} utilizadores registados
                </p>
              </div>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} title="Fechar" className="shrink-0">
            <span className="material-symbols-outlined">close</span>
          </Button>
        </header>

        {/* Erro de carregamento da lista */}
        {usersError && (
          <div className="px-4 py-2 border-b border-error/20 bg-error/10 text-error font-bold text-xs break-words shrink-0">
            {usersError}
          </div>
        )}

        {/* Corpo — lista OU detalhe, com scroll vertical próprio */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedUser ? (
            <div className="p-4 space-y-6">{detailContent}</div>
          ) : (
            <UserList
              isMobile
              users={adminUsers}
              loading={loading}
              selectedName={selectedUser?.name ?? null}
              onSelect={(u) => setSelectedUser(u)}
            />
          )}
        </div>

        {/* Footer — nota de acesso + refresh */}
        <footer className="shrink-0 px-4 py-2.5 border-t border-outline-variant/15 flex items-center justify-between gap-3 min-w-0">
          <span className="text-[10px] text-on-surface-variant truncate">Apenas {me?.name} tem acesso a este painel.</span>
          <Button variant="ghost" size="sm" onClick={fetchUsers} className="shrink-0">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Actualizar
          </Button>
        </footer>
      </ModalShell>
    );
  }

  // ── Desktop (>= 768px): 2 colunas lado-a-lado ─────────────────────────────
  return (
    <ModalShell visible={open} onClose={onClose} z={MODAL_Z.admin} variant="xl" cardClassName="max-h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-outline-variant/15 flex items-center justify-between shrink-0 bg-surface-container-high/50">
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-outlined text-amber-400 text-2xl shrink-0">admin_panel_settings</span>
          <div className="min-w-0">
            <h2 className="text-base font-black font-headline tracking-tight text-on-surface uppercase truncate">Gestão de Utilizadores</h2>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{adminUsers.length} utilizadores registados</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} title="Fechar" className="shrink-0">
          <span className="material-symbols-outlined">close</span>
        </Button>
      </div>

      {/* Erro de carregamento da lista (não é feedback de ações — cada secção tem o seu próprio) */}
      {usersError && (
        <div className="px-6 py-2 border-b border-error/20 bg-error/10 text-error font-bold text-xs break-words shrink-0">{usersError}</div>
      )}

      {/* Body — Desktop: 2 colunas lado-a-lado. */}
      <div className="flex flex-1 min-h-0">
        {/* Lista */}
        <div className="w-1/2 min-h-0 min-w-0 flex flex-col border-r border-outline-variant/15 bg-surface-container-high/30">
          <UserList
            users={adminUsers}
            loading={loading}
            selectedName={selectedUser?.name ?? null}
            onSelect={(u) => setSelectedUser(u)}
          />
        </div>

        {/* Detalhe */}
        <div className="w-1/2 min-h-0 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">{detailContent}</div>
        </div>
      </div>

      {/* Footer */}
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
