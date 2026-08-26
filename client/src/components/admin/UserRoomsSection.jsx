import { useState } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { Button } from "../shared/Button.jsx";
import { GameDialog } from "../shared/GameDialog.jsx";
import { MODAL_Z } from "../../constants/index.js";
import { adminSetRoomAccess } from "./adminApi.js";

/**
 * Secção "Salas" — adicionar/remover o acesso do utilizador a salas.
 *
 * O diálogo de remoção é explícito sobre as consequências: em sala ativa,
 * remover = expulsão + BAN PERMANENTE (comportamento intencional do backend).
 *
 * @param {{ user: any, rooms: string[], onChanged?: () => void }} props
 */
export function UserRoomsSection({ user, rooms, onChanged }) {
  const { addToast } = useGame();
  const [newRoomCode, setNewRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState(null);

  if (!user) return null;

  function handleAdd() {
    const code = newRoomCode.trim().toUpperCase();
    if (!code || busy) return;
    setBusy(true);
    setError("");
    adminSetRoomAccess(user.name, code, "add").then((result) => {
      setBusy(false);
      if (result?.ok) {
        addToast(`Sala "${code}" adicionada a ${user.name}.`);
        setNewRoomCode("");
        onChanged?.();
      } else {
        setError(result?.error ?? "Erro ao adicionar sala.");
      }
    });
  }

  function handleRemove() {
    const code = pendingRemoval;
    adminSetRoomAccess(user.name, code, "remove").then((result) => {
      setPendingRemoval(null);
      if (result?.ok) {
        addToast(`Sala "${code}" removida de ${user.name}.`);
        onChanged?.();
      } else {
        setError(result?.error ?? "Erro ao remover sala.");
      }
    });
  }

  const removalDialog = pendingRemoval
    ? {
        mode: "confirm",
        title: `Remover sala ${pendingRemoval}`,
        description: `${user.name} perde o acesso a esta sala. Se a sala estiver ativa, ele será EXPULSO e BANIDO PERMANENTEMENTE (não poderá reentrar) e a sua equipa ficará sem treinador.`,
        danger: true,
        confirmLabel: "Remover + banir",
        onConfirm: handleRemove,
      }
    : null;

  return (
    <section>
      <h3 className="text-xs uppercase tracking-widest text-on-surface-variant font-black mb-1">
        Salas ({rooms.length})
      </h3>
      {error && <p className="text-xs text-error font-bold mb-2">{error}</p>}

      {rooms.length === 0 ? (
        <p className="text-on-surface-variant/60 text-xs py-1">Nenhuma sala atribuída.</p>
      ) : (
        <div className="space-y-1.5">
          {rooms.map((room) => (
            <div key={room} className="flex items-center justify-between bg-surface-container-high/50 rounded-md px-3 py-2">
              <span className="text-sm text-on-surface font-mono font-bold tracking-wider">{room}</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPendingRemoval(room)}>
                Remover
              </Button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          type="text"
          value={newRoomCode}
          onChange={(e) => setNewRoomCode(e.target.value)}
          placeholder="CÓDIGO DA SALA"
          aria-label="Adicionar sala por código"
          className="flex-1 rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface uppercase tracking-wider font-bold placeholder:text-xs placeholder:font-medium focus:outline-none focus:border-primary transition-colors"
        />
        <Button variant="accent" disabled={busy || !newRoomCode.trim()}>
          <span className="material-symbols-outlined">add</span>
          Adicionar
        </Button>
      </form>

      <GameDialog dialog={removalDialog} z={MODAL_Z.adminDialog} onClose={() => setPendingRemoval(null)} />
    </section>
  );
}
