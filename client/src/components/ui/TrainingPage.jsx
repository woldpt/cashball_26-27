import React, { useState, useEffect } from "react";
import { socket } from "../../socket";

const TRAINING_OPTIONS = [
  { key: "GR", label: "Guarda-redes", description: "Melhorar habilidades dos GR" },
  { key: "Defesas", label: "Defesas", description: "Melhorar habilidades dos defensas" },
  { key: "Médios", label: "Médios", description: "Melhorar habilidades dos médios" },
  { key: "Avançados", label: "Avançados", description: "Melhorar habilidades dos avançados" },
  { key: "Forma", label: "Forma", description: "Melhorar forma geral (+10 pontos)" },
  { key: "Resistência", label: "Resistência", description: "Melhorar resistência (+0.2 escala 1-5)" },
];

const POSITION_LABELS = {
  GR: "Guarda-redes",
  DEF: "Defesas",
  MED: "Médios",
  ATA: "Avançados",
};

const POSITION_TEXT_CLASS = {
  GR: "text-yellow-500",
  DEF: "text-blue-500",
  MED: "text-emerald-500",
  ATA: "text-rose-500",
};

export function TrainingPage({ me, players, matchweek }) {
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [savedTraining, setSavedTraining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch current training and history on component mount
  useEffect(() => {
    if (!me?.teamId) return;

    // Get current training focus
    socket.emit("getTrainingFocus", (focus) => {
      setSavedTraining(focus);
      setSelectedTraining(focus);
    });

    // Get last week's history
    socket.emit("getTrainingHistory", matchweek - 1, (history) => {
      setTrainingHistory(history);
    });
  }, [me?.teamId, matchweek]);

  // Listen for training focus updates
  useEffect(() => {
    const handleTrainingUpdated = (data) => {
      if (data.teamId === me?.teamId) {
        setSavedTraining(data.trainingFocus);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    };

    socket.on("trainingFocusUpdated", handleTrainingUpdated);
    return () => socket.off("trainingFocusUpdated", handleTrainingUpdated);
  }, [me?.teamId]);

  const handleSetTraining = (trainingKey) => {
    if (!me?.teamId) return;
    setLoading(true);

    socket.emit("setTrainingFocus", trainingKey, () => {
      setSelectedTraining(trainingKey);
      setSavedTraining(trainingKey);
      setLoading(false);
    });
  };

  // Group history by position
  const historyByPosition = {};
  trainingHistory.forEach((record) => {
    if (!historyByPosition[record.position]) {
      historyByPosition[record.position] = [];
    }
    historyByPosition[record.position].push(record);
  });

  return (
    <div className="space-y-6">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-1">
          Treino Semanal
        </h1>
        <p className="text-zinc-400 text-sm">
          Escolha o foco de treino para melhorar os atributos da sua equipa
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── TRAINING SELECTION ────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white mb-3">
            Foco de Treino - Jornada {matchweek}
          </h2>

          <div className="space-y-2">
            {TRAINING_OPTIONS.map(({ key, label, description }) => (
              <button
                key={key}
                onClick={() => handleSetTraining(key)}
                disabled={loading}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedTraining === key
                    ? "border-primary bg-primary/20 text-white"
                    : "border-outline-variant/20 bg-surface-container hover:border-outline-variant/40 text-zinc-300"
                } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="font-bold">{label}</div>
                <div className="text-xs text-zinc-400 mt-1">{description}</div>
                {savedTraining === key && (
                  <div className={`text-xs font-semibold mt-2 ${saved ? "text-green-400" : "text-primary"}`}>
                    {saved ? "✓ Guardado!" : "✓ Ativo nesta jornada"}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="bg-surface-container-high rounded-lg p-4 border border-outline-variant/20 mt-4">
            <h3 className="font-bold text-white mb-2">ℹ️ Como funciona?</h3>
            <ul className="text-xs text-zinc-400 space-y-2">
              <li>• Escolha um foco de treino no início da jornada</li>
              <li>• Apenas jogadores que jogam beneficiam do treino</li>
              <li>• Treinos de posição: +0.5 de skill</li>
              <li>• Forma: +10 pontos (máx 100)</li>
              <li>• Resistência: +0.2 (escala 1-5)</li>
              <li>• O treino é aplicado automaticamente após a jornada</li>
            </ul>
          </div>
        </div>

        {/* ── TRAINING HISTORY ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white mb-3">
            Relatório - Jornada {matchweek - 1}
          </h2>

          {trainingHistory.length === 0 ? (
            <div className="bg-surface-container rounded-lg p-6 text-center">
              <p className="text-zinc-400 text-sm">
                Nenhum treino foi aplicado ainda nesta jornada.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(historyByPosition).map(([position, records]) => (
                <div key={position} className="bg-surface-container rounded-lg p-4">
                  <h3 className={`font-bold mb-3 ${POSITION_TEXT_CLASS[position] || "text-white"}`}>
                    {POSITION_LABELS[position] || position}
                  </h3>

                  <div className="space-y-2">
                    {records.map((record, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm border-b border-outline-variant/10 pb-2 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400">{record.player_name}</span>
                          <span className="text-xs px-2 py-1 bg-surface-container-high rounded text-zinc-400">
                            {record.attribute === "skill"
                              ? "Skill"
                              : record.attribute === "form"
                                ? "Forma"
                                : "Resistência"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">
                            {Math.round(record.old_value * 10) / 10}
                          </span>
                          <span className="text-zinc-600">→</span>
                          <span className="text-green-500 font-semibold">
                            {Math.round(record.new_value * 10) / 10}
                          </span>
                          <span className="text-green-500/70 text-xs ml-1">
                            (+{Math.round((record.new_value - record.old_value) * 10) / 10})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
