import { useState } from "react";
import { useGame } from "../../contexts/GameContext.jsx";
import { Button } from "../shared/Button.jsx";
import { GameDialog } from "../shared/GameDialog.jsx";
import { MODAL_Z } from "../../constants/index.js";
import { isAdminCoach, adminSetCoachTeam } from "./adminApi.js";
import { useRoomRoster } from "./useRoomRoster.js";

/**
 * Secção "Mover treinador" — carrega o roster (coaches + equipas livres) de
 * cada sala do utilizador e permite mover QUALQUER coach da sala, não só o
 * selecionado à esquerda (o âmbito fica explícito no subtítulo).
 *
 * @param {{ rooms: string[] }} props
 */
export function UserTeamsSection({ rooms }) {
  const { addToast } = useGame();
  const [selectedRoom, setSelectedRoom] = useState("");
  const [targetCoach, setTargetCoach] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmMove, setConfirmMove] = useState(false);

  const { data, loading, error: rosterError, load } = useRoomRoster();

  // Nota: se a sala selecionada for removida noutra secção, o painel muda a `key`
  // desta secção (join das salas) e o React remonta tudo limpo — sem effect.

  if (!rooms || rooms.length === 0) {
    return <p className="text-on-surface-variant/60 text-xs py-1">Este utilizador não tem salas.</p>;
  }

  const coachesList = data?.coaches || [];
  const freeTeams = data?.teams || [];
  const assignableCoaches = coachesList.filter((c) => !isAdminCoach(c.name));
  const targetTeam = freeTeams.find((t) => String(t.id) === targetTeamId);

  function doMove() {
    if (!targetTeam || !targetCoach) return;
    setBusy(true);
    setError("");
    adminSetCoachTeam(selectedRoom, targetCoach, Number(targetTeamId)).then((result) => {
      setBusy(false);
      setConfirmMove(false);
      if (result?.ok) {
        addToast(`${targetCoach} agora gere a equipa "${result.teamName || targetTeam.name}".`);
        setTargetCoach("");
        setTargetTeamId("");
        load(selectedRoom);
      } else {
        setError(result?.error ?? "Erro ao mover treinador.");
      }
    });
  }

  const moveDialog = confirmMove && targetTeam
    ? {
        mode: "confirm",
        title: `Mover ${targetCoach}`,
        description: `${targetCoach} passa a gerir o plantel e as finanças desta equipa.`,
        stats: [{ label: "Equipa", value: `${targetTeam.name} (${targetTeam.division}ª divisão)` }],
        confirmLabel: "Atribuir equipa",
        onConfirm: doMove,
      }
    : null;

  return (
    <section>
      <h3 className="text-xs uppercase tracking-widest text-on-surface-variant font-black mb-1">Mover treinador</h3>
      <p className="text-[11px] text-on-surface-variant/70 mb-3">
        Podes mover qualquer coach de uma das salas deste utilizador para outra equipa livre.
      </p>

      {error && <p className="text-xs text-error font-bold mb-2">{error}</p>}

      <select
        value={selectedRoom}
        onChange={(e) => {
          const code = e.target.value;
          setSelectedRoom(code);
          setTargetCoach("");
          setTargetTeamId("");
          setError("");
          load(code);
        }}
        aria-label="Selecionar sala"
        className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
      >
        <option value="">Seleciona uma sala...</option>
        {rooms.map((room) => (
          <option key={room} value={room}>
            {room}
          </option>
        ))}
      </select>

      {selectedRoom && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin mr-2">sync</span>
              <span className="text-xs">A carregar...</span>
            </div>
          ) : rosterError ? (
            <p className="text-xs text-error font-bold">{rosterError}</p>
          ) : data ? (
            <>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {data.coaches.length === 0 ? (
                  <p className="text-on-surface-variant/60 text-xs py-2">Nenhum treinador humano nesta sala.</p>
                ) : (
                  data.coaches.map((coach) => (
                    <div key={coach.name} className="flex items-center justify-between bg-surface-container-high/50 rounded-md px-3 py-1.5 text-xs">
                      <span className="text-on-surface font-bold">{coach.name}</span>
                      {coach.teamName ? (
                        <span className="text-on-surface-variant">
                          <span className="text-on-surface/80 font-semibold">{coach.teamName}</span> ({coach.division}ª)
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/60 italic">sem equipa</span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {freeTeams.length === 0 ? (
                <p className="text-on-surface-variant/60 text-xs py-1">Não há equipas livres nesta sala.</p>
              ) : (
                <div className="space-y-2 pt-1 border-t border-outline-variant/15">
                  <select
                    value={targetCoach}
                    onChange={(e) => setTargetCoach(e.target.value)}
                    aria-label="Selecionar treinador"
                    className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Treinador...</option>
                    {assignableCoaches.map((coach) => (
                      <option key={coach.name} value={coach.name}>
                        {coach.name}
                        {coach.teamName ? ` (atual: ${coach.teamName})` : ""}
                      </option>
                    ))}
                  </select>

                  <select
                    value={targetTeamId}
                    onChange={(e) => setTargetTeamId(e.target.value)}
                    aria-label="Selecionar equipa"
                    className="w-full rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Equipa...</option>
                    {freeTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.division}ª divisão)
                      </option>
                    ))}
                  </select>

                  <Button variant="accent" full disabled={!targetCoach || !targetTeamId || busy} onClick={() => setConfirmMove(true)}>
                    Mover treinador
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      <GameDialog dialog={moveDialog} z={MODAL_Z.adminDialog} onClose={() => setConfirmMove(false)} />
    </section>
  );
}
