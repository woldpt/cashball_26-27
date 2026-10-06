import { useEffect, useRef, useState } from "react";
import { useGame } from "../contexts/GameContext.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { EmptyState } from "../components/shared/EmptyState.jsx";
import { Button } from "../components/shared/Button.jsx";
import { TransferHeader } from "../components/transfers/TransferChrome.jsx";
import { isAdminCoach } from "../components/admin/adminApi.js";
import { useAdminUsers } from "../components/admin/useAdminUsers.js";
import { UserList } from "../components/admin/UserList.jsx";
import { UserProfileSection } from "../components/admin/UserProfileSection.jsx";
import { UserRoomsSection } from "../components/admin/UserRoomsSection.jsx";
import { UserTeamsSection } from "../components/admin/UserTeamsSection.jsx";

/**
 * AdminPage — gestão de utilizadores para o coach de administração (tab `admin`).
 *
 * Só layout + estado da seleção; o resto vive em `components/admin/`:
 * `adminApi.js` (contratos socket), `useAdminUsers` (lista + subscrição),
 * `UserList`, `UserProfileSection`, `UserRoomsSection`, `UserTeamsSection`.
 *
 * Desktop (lg+): lista | detalhe lado a lado, cada um com scroll próprio.
 * Mobile: scroll único da página, lista por cima e detalhe por baixo
 * (auto-scroll ao selecionar; «Voltar» limpa a seleção).
 *
 * Só acessível ao coach admin (ADMIN_COACH_NAME, por defeito "fabio").
 *
 * @param {Object} props
 * @param {() => void} props.onBack - volta à tab anterior.
 * @returns {JSX.Element|null}
 */
export function AdminPage({ onBack }) {
  const { me, adminUsers } = useGame();
  const [selectedName, setSelectedName] = useState(null);
  const isMobile = useIsMobile();
  const detailRef = useRef(null);

  const isAdmin = isAdminCoach(me?.name);
  const { loading, error: usersError, fetchUsers } = useAdminUsers({ open: isAdmin });

  // Seleção por nome + lookup no contexto: o utilizador está sempre fresco
  // (renames e salas vindos do servidor refletem-se, sem snapshot obsoleto).
  const selectedUser = selectedName ? adminUsers.find((u) => u.name === selectedName) ?? null : null;
  const selectedRooms = selectedUser?.rooms ?? [];

  /** @param {string} newName Nome novo do utilizador após rename. */
  function handleRenamed(newName) {
    setSelectedName(newName);
    // A lista ainda tem o nome antigo até ao refetch.
    fetchUsers();
  }

  // Mobile: ao selecionar, leva o detalhe (por baixo da lista) à vista.
  useEffect(() => {
    if (!isMobile || !selectedName || !detailRef.current) return undefined;
    const id = requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedName, isMobile]);

  if (!isAdmin) return null;

  const detailContent = !selectedUser ? (
    <EmptyState
      icon="person"
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
        onDeleted={() => setSelectedName(null)}
      />
      <div className="border-t border-outline-variant/15" />
      <UserRoomsSection user={selectedUser} rooms={selectedRooms} onChanged={fetchUsers} />
      <div className="border-t border-outline-variant/15" />
      {/* key=join das salas: remonta limpo quando uma sala é adicionada/removida */}
      <UserTeamsSection key={`teams-${selectedRooms.join("|") || "none"}`} rooms={selectedRooms} />
    </>
  );

  const onlineCount = adminUsers.filter((u) => u.online).length;
  const roomCount = adminUsers.reduce((n, u) => n + (u.rooms?.length || 0), 0);

  return (
    <div className="space-y-4 short:space-y-2 min-w-0">
      <TransferHeader
        icon="admin_panel_settings"
        kicker="Administração"
        title="Utilizadores"
        valueLabel="Registados"
        valueClass="text-amber-400"
        budget={adminUsers.length}
        format={(n) => String(Math.round(n))}
        chips={[
          { label: "online", value: onlineCount, tone: onlineCount ? "good" : "neutral", icon: "wifi" },
          { label: "inscrições em salas", value: roomCount, tone: "neutral", icon: "meeting_room" },
        ]}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">arrow_back</span> Voltar
          </button>
          <Button variant="ghost" size="sm" onClick={fetchUsers}>
            <span className="material-symbols-outlined text-sm">refresh</span>
            Actualizar
          </Button>
        </div>
      </TransferHeader>

      {usersError && (
        <div aria-live="polite" className="rounded-md px-4 py-2 border border-error/20 bg-error/10 text-error font-bold text-xs break-words">
          {usersError}
        </div>
      )}

      <div className="grid gap-4 short:gap-2 lg:grid-cols-2 lg:items-start min-w-0">
        <section
          aria-label="Lista de utilizadores"
          className="min-w-0 rounded-md border border-outline-variant/20 bg-surface-container-low overflow-hidden lg:h-[70vh] flex flex-col"
        >
          <UserList
            isMobile={isMobile}
            disableInternalScroll={isMobile}
            users={adminUsers}
            loading={loading}
            selectedName={selectedName}
            onSelect={(u) => setSelectedName(u?.name ?? null)}
          />
        </section>

        <section
          ref={detailRef}
          aria-label="Detalhe do utilizador"
          className="min-w-0 rounded-md border border-outline-variant/20 bg-surface-container-low p-4 short:p-2.5 space-y-6 short:space-y-3 scroll-mt-3 lg:h-[70vh] lg:overflow-y-auto"
        >
          {detailContent}
        </section>
      </div>
    </div>
  );
}
