import { formatCurrency } from "../../utils/formatters.js";

/**
 * @param {{ playerHistoryModal: object|null, setPlayerHistoryModal: function }} props
 */
export function PlayerHistoryModal({
  playerHistoryModal,
  setPlayerHistoryModal,
}) {
  if (!playerHistoryModal) return null;

  const { player, transfers } = playerHistoryModal;
  if (!player) return null;

  const positionLabels = {
    GK: "Guarda-redes",
    DEF: "Defesa",
    MID: "Médio",
    ATT: "Avançado",
  };

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 p-4"
      onClick={() => setPlayerHistoryModal(null)}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 bg-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              {player.is_star === 1 && (
                <span className="text-amber-400 text-sm">★</span>
              )}
              <span className="font-black text-white text-lg">
                {player.name}
              </span>
            </div>
            <div className="text-zinc-400 text-xs mt-0.5">
              {positionLabels[player.position] || player.position} ·{" "}
              {player.nationality} · {player.age} anos
            </div>
          </div>
          <button
            type="button"
            className="text-zinc-400 hover:text-white text-xl leading-none"
            onClick={() => setPlayerHistoryModal(null)}
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-0 border-b border-zinc-700">
          {[
            { label: "Skill", value: player.skill },
            { label: "Golos", value: player.career_goals ?? player.goals ?? 0 },
            {
              label: "Vermelhos",
              value: player.career_reds ?? player.red_cards ?? 0,
            },
            {
              label: "Lesões",
              value: player.career_injuries ?? player.injuries ?? 0,
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center py-3 border-r border-zinc-700 last:border-r-0"
            >
              <span className="text-white font-black text-lg">{value}</span>
              <span className="text-zinc-500 text-xs">{label}</span>
            </div>
          ))}
        </div>

        {/* Current club + value */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-700 text-sm">
          <span className="text-zinc-400">Clube actual</span>
          <span className="text-white font-semibold">
            {player.team_name || "Sem clube"}
          </span>
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-700 text-sm">
          <span className="text-zinc-400">Valor de mercado</span>
          <span className="text-amber-400 font-semibold">
            {formatCurrency(player.value || 0)}
          </span>
        </div>

        {/* Transfer history */}
        <div className="px-6 py-4">
          <div className="text-zinc-400 text-xs uppercase tracking-widest mb-3 font-semibold">
            Historial de transferências
          </div>
          {transfers.length === 0 ? (
            <div className="text-zinc-600 text-sm italic">
              Sem transferências registadas
            </div>
          ) : (
            <div className="space-y-2">
              {transfers.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-500 shrink-0 w-16 text-xs">
                    Ano {t.year}
                    {t.matchweek ? ` · J${t.matchweek}` : ""}
                  </span>
                  <span className="text-zinc-400 shrink-0 text-xs">
                    {t.related_team_name || "—"} →
                  </span>
                  <span className="text-white font-semibold truncate">
                    {t.team_name || "?"}
                  </span>
                  {t.amount > 0 && (
                    <span className="text-amber-400 text-xs shrink-0 ml-auto">
                      {formatCurrency(t.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
