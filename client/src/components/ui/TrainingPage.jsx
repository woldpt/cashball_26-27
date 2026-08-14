import { useState, useEffect, useRef } from "react";
import { socket } from "../../socket";
import {
  POSITION_TEXT_CLASS,
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
} from "../../constants/index.js";
import { Badge } from "../shared/Badge.jsx";
import { Panel } from "../shared/Panel.jsx";
import { SummaryWidget } from "../shared/SummaryWidget.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";

const TRAINING_FOCUS_STORAGE_KEY = "cashball_training_focus";

const TRAINING_OPTIONS = [
  {
    key: "GR",
    label: "Guarda-redes",
    description: "Melhorar skill dos GR",
    icon: "sports_soccer",
    color: "from-amber-500/20 to-amber-600/10",
    border: "border-amber-500",
  },
  {
    key: "Defesas",
    label: "Defesas",
    description: "Melhorar skill dos defensas",
    icon: "security",
    color: "from-blue-500/20 to-blue-600/10",
    border: "border-blue-500",
  },
  {
    key: "Médios",
    label: "Médios",
    description: "Melhorar skill dos médios",
    icon: "pivot_table_chart",
    color: "from-emerald-500/20 to-emerald-600/10",
    border: "border-emerald-500",
  },
  {
    key: "Avançados",
    label: "Avançados",
    description: "Melhorar skill dos avançados",
    icon: "target",
    color: "from-rose-500/20 to-rose-600/10",
    border: "border-rose-500",
  },
  {
    key: "Forma",
    label: "Forma",
    description: "Melhorar forma geral",
    icon: "favorite",
    color: "from-orange-500/20 to-orange-600/10",
    border: "border-orange-500",
  },
  {
    key: "Resistência",
    label: "Resistência",
    description: "Melhorar resistência",
    icon: "bolt",
    color: "from-purple-500/20 to-purple-600/10",
    border: "border-purple-500",
  },
];

const POSITION_LABELS = {
  GR: "Guarda-redes",
  DEF: "Defesas",
  MED: "Médios",
  ATA: "Avançados",
};

const TRAINING_LABEL_MAP = {
  GR: "Guarda-redes",
  Defesas: "Defesas",
  Médios: "Médios",
  Avançados: "Avançados",
  Forma: "Forma",
  Resistência: "Resistência",
};

const TRAINING_COLOR_MAP = {
  GR: "border-amber-500",
  Defesas: "border-blue-500",
  Médios: "border-emerald-500",
  Avançados: "border-rose-500",
  Forma: "border-orange-500",
  Resistência: "border-purple-500",
};

const ATTRIBUTE_BADGE_COLORS = {
  skill: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
  form: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  resistance: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
};

const ATTRIBUTE_LABEL = {
  skill: "Skill",
  form: "Forma",
  resistance: "Resistência",
};

function getTrainingBorderClass(trainingKey) {
  return TRAINING_COLOR_MAP[trainingKey] || "border-outline";
}

function getTrainingLabel(trainingKey) {
  return TRAINING_LABEL_MAP[trainingKey] || trainingKey;
}

function TrainingOptionCard({ option, selected, isSaved, justSaved, loading }) {
  const { key, label, description, icon, color } = option;
  const isSelected = selected === key;

  return (
    <button
      onClick={() => option.onClick()}
      disabled={loading}
      className={`relative text-left p-4 rounded-lg border-2 transition-all duration-200 group ${
        isSelected
          ? `border-primary bg-primary/10 text-on-surface shadow-lg ${POSITION_GLOW_CLASS[key] || ""}`
          : `border-outline-variant/20 bg-surface-container-low ${color} hover:border-outline-variant/40 text-on-surface-variant`
      } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-black text-sm text-on-surface">{label}</div>
        <span className="material-symbols-outlined text-[20px] shrink-0 text-on-surface-variant group-hover:text-on-surface transition-colors">
          {icon}
        </span>
      </div>
      <div className="text-xs text-on-surface-variant">{description}</div>
      {isSaved && (
        <div
          className={`text-xs font-black mt-2 flex items-center gap-1 ${
            justSaved ? "text-emerald-400" : "text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            check_circle
          </span>
          {justSaved ? "Guardado!" : "Ativo"}
        </div>
      )}
    </button>
  );
}

function HistoryRecordRow({ record }) {
  const delta = record.new_value - record.old_value;
  const isPositive = delta > 0;

  const badgeColor = ATTRIBUTE_BADGE_COLORS[record.attribute] || ATTRIBUTE_BADGE_COLORS.skill;
  const badgeLabel = ATTRIBUTE_LABEL[record.attribute] || record.attribute;

  return (
    <div className="flex items-center justify-between text-sm p-2 rounded hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-on-surface-variant truncate text-xs">
          {record.player_name}
        </span>
        <span
          className={`text-[9px] font-black uppercase px-1.5 py-px rounded ${badgeColor.bg} ${badgeColor.text} ${badgeColor.border} tracking-widest whitespace-nowrap`}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <span className="text-on-surface-variant text-xs w-8 text-right tabular-nums">
          {record.old_value}
        </span>
        <span className="text-on-surface-variant/50">→</span>
        <span
          className={`font-black text-xs w-8 text-right tabular-nums ${
            isPositive ? "text-emerald-400" : "text-on-surface-variant/50"
          }`}
        >
          {record.new_value}
        </span>
        <span
          className={`text-xs ml-1 w-14 text-right tabular-nums ${
            isPositive ? "text-emerald-400/70" : "text-on-surface-variant/40"
          }`}
        >
          {record.new_value === record.old_value
            ? `+${record.delta} prog`
            : `+${delta}`}
        </span>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   me: object,
 *   matchweek: number,
 * }} props
 */
export function TrainingPage({ me, matchweek }) {
  const [selectedTraining, setSelectedTraining] = useState(() => {
    return localStorage.getItem(TRAINING_FOCUS_STORAGE_KEY) || null;
  });
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [historyCalendarIndex, setHistoryCalendarIndex] = useState(null);
  const [savedTraining, setSavedTraining] = useState(() => {
    return localStorage.getItem(TRAINING_FOCUS_STORAGE_KEY) || null;
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Persist selected training to localStorage
  useEffect(() => {
    if (selectedTraining != null) {
      localStorage.setItem(TRAINING_FOCUS_STORAGE_KEY, selectedTraining);
    } else {
      localStorage.removeItem(TRAINING_FOCUS_STORAGE_KEY);
    }
  }, [selectedTraining]);

  // Fetch current training and history on component mount
  useEffect(() => {
    if (!me?.teamId) return;

    socket.emit("getTrainingFocus", (focus) => {
      setSavedTraining(focus);
      setSelectedTraining(focus);
    });

    // Pass null → backend returns history for the latest event with rows
    socket.emit("getTrainingHistory", null, (history) => {
      setTrainingHistory(history || []);
      if (history && history.length > 0 && history[0].calendar_index != null) {
        setHistoryCalendarIndex(history[0].calendar_index);
      } else {
        setHistoryCalendarIndex(null);
      }
    });
  }, [me?.teamId, matchweek]);

  const savedTimeoutRef = useRef(null);

  // Listen for training focus updates
  useEffect(() => {
    const handleTrainingUpdated = (data) => {
      if (data.teamId === me?.teamId) {
        setSavedTraining(data.trainingFocus);
        setSaved(true);
        clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
      }
    };

    socket.on("trainingFocusUpdated", handleTrainingUpdated);
    return () => {
      socket.off("trainingFocusUpdated", handleTrainingUpdated);
      clearTimeout(savedTimeoutRef.current);
    };
  }, [me?.teamId]);

  const handleSetTraining = (trainingKey) => {
    if (!me?.teamId) return;
    setLoading(true);
    setError("");

    let cleared = false;
    const clearLoading = () => {
      if (cleared) return;
      cleared = true;
      setLoading(false);
    };

    // Fallback in case the server never acks (avoid permanently disabled buttons)
    const fallback = setTimeout(clearLoading, 4000);

    socket.emit("setTrainingFocus", trainingKey, (ok) => {
      clearTimeout(fallback);
      if (ok) {
        setSelectedTraining(trainingKey);
        setSavedTraining(trainingKey);
      } else {
        setError("Erro ao guardar foco de treino.");
      }
      clearLoading();
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

  const historyCount = trainingHistory.length;

  return (
    <div className="space-y-4">
      {/* ── Summary Widgets ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryWidget
          label="Foco Atual"
          value={savedTraining ? getTrainingLabel(savedTraining) : "Nenhum"}
          valueClass="text-2xl"
          accentClass={
            savedTraining
              ? getTrainingBorderClass(savedTraining)
              : "border-outline-variant"
          }
        />
        <SummaryWidget label="Jornada" value={matchweek} valueClass="text-2xl" />
        <SummaryWidget
          label="Jogadores Treinados"
          value={historyCount}
          valueClass="text-2xl"
          accentClass="border-tertiary"
          valueColorClass="text-tertiary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── TRAINING SELECTION PANEL ──────────────────────────────────── */}
        <Panel title="Foco de Treino" meta={`Jornada ${matchweek}`} padded={false}>
          <div className="p-3 md:p-4 space-y-4">
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error-container/30 border border-error/40 text-error text-xs font-black uppercase tracking-widest">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRAINING_OPTIONS.map((option) => (
                <TrainingOptionCard
                  key={option.key}
                  option={{ ...option, onClick: () => handleSetTraining(option.key) }}
                  selected={selectedTraining}
                  isSaved={savedTraining === option.key}
                  justSaved={saved}
                  loading={loading}
                />
              ))}
            </div>

            <div className="bg-surface-container-high/50 rounded-lg p-4 border border-outline-variant/25 border-l-4 border-blue-500">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-400 shrink-0 mt-0.5">
                  info
                </span>
                <div>
                  <h3 className="font-black text-on-surface mb-2">Como funciona?</h3>
                  <ul className="text-xs text-on-surface-variant space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">→</span> Escolha um foco no
                      início da jornada (league ou taça)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">→</span> Apenas jogadores
                      que jogaram beneficiam
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">→</span> Aplicado
                      automaticamente após a jornada
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* ── TRAINING HISTORY PANEL ───────────────────────────────────── */}
        <Panel
          title="Relatório do Último Treino"
          meta={
            historyCalendarIndex != null
              ? `evento #${historyCalendarIndex + 1}`
              : undefined
          }
        >
          {trainingHistory.length === 0 ? (
            <EmptyState
              emoji="📊"
              title="Ainda não há histórico de treino — escolha um foco e jogue uma jornada."
            />
          ) : (
            <div className="space-y-4">
              {Object.entries(historyByPosition).map(([position, records]) => {
                const posGlow = POSITION_GLOW_CLASS[position] || "";
                const posBgGrad =
                  POSITION_BG_GRADIENT_CLASS[position] || "from-zinc-500/4";
                const posText =
                  POSITION_TEXT_CLASS[position] || "text-on-surface-variant";
                const posLabel = POSITION_LABELS[position] || position;

                return (
                  <div
                    key={position}
                    className={`relative rounded-lg p-4 border border-outline-variant/25 ${posGlow} bg-gradient-to-r ${posBgGrad} via-surface-container/70 to-surface/30 shadow-sm shadow-black/30`}
                  >
                    <h3
                      className={`font-black mb-3 flex items-center gap-2 ${posText}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        group
                      </span>
                      {posLabel}
                    </h3>

                      <div className="space-y-1">
                        {records.map((record, idx) => (
                          <HistoryRecordRow key={idx} record={record} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </Panel>
      </div>
    </div>
  );
}
