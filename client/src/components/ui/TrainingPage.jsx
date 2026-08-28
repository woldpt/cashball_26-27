import { useState, useEffect, useRef } from "react";
import { socket } from "../../socket";
import {
  POSITION_TEXT_CLASS,
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  POSITION_BAR_CLASS,
  POSITION_BORDER_CLASS,
} from "../../constants/index.js";
import { Badge } from "../shared/Badge.jsx";
import { Panel } from "../shared/Panel.jsx";
import { SummaryWidget } from "../shared/SummaryWidget.jsx";
import { EmptyState } from "../shared/EmptyState.jsx";

const TRAINING_FOCUS_STORAGE_KEY = "cashball_training_focus";

/* ═══════════════════════════════════════════════════════════════
   Maps de estilo por opção de treino.  GR/DEF/MED/ATA puxam
   tokens canónicos de posição; Forma/Resistência usam cores
   dedicadas (orange / purple) mas o mesmo padrão visual.
   ═══════════════════════════════════════════════════════════════ */
const TRAINING_META = {
  GR: {
    label: "Guarda-redes",
    description: "Melhorar skill dos GR",
    icon: "sports_soccer",
    pos: "GR",
  },
  Defesas: {
    label: "Defesas",
    description: "Melhorar skill dos defensas",
    icon: "security",
    pos: "DEF",
  },
  Médios: {
    label: "Médios",
    description: "Melhorar skill dos médios",
    icon: "pivot_table_chart",
    pos: "MED",
  },
  Avançados: {
    label: "Avançados",
    description: "Melhorar skill dos avançados",
    icon: "target",
    pos: "ATA",
  },
  Forma: {
    label: "Forma",
    description: "Melhorar forma geral",
    icon: "favorite",
    bar: "from-orange-300 via-orange-400 to-orange-600",
    glow: "hover:border-orange-400/70 hover:shadow-orange-400/30",
    bgGrad: "from-orange-500/8",
    text: "text-orange-400",
    border: "border-orange-400",
  },
  Resistência: {
    label: "Resistência",
    description: "Melhorar resistência",
    icon: "bolt",
    bar: "from-purple-300 via-purple-400 to-purple-600",
    glow: "hover:border-purple-400/70 hover:shadow-purple-400/30",
    bgGrad: "from-purple-500/8",
    text: "text-purple-400",
    border: "border-purple-400",
  },
};

const TRAINING_OPTIONS = Object.keys(TRAINING_META);

const POSITION_LABELS = {
  GR: "Guarda-redes",
  DEF: "Defesas",
  MED: "Médios",
  ATA: "Avançados",
};

const ATTR_COLUMNS = [
  { key: "skill", label: "Skill" },
  { key: "form", label: "Forma" },
  { key: "resistance", label: "Resist." },
];

/* ═══════════════════════════════════════════════════════════════
   Helpers de estilo — resolve tokens canónicos ou metas dedicadas
   ═══════════════════════════════════════════════════════════════ */
function getMeta(key) {
  const m = TRAINING_META[key];
  const pos = m.pos;
  return {
    bar: pos ? POSITION_BAR_CLASS[pos] : m.bar,
    glow: pos ? POSITION_GLOW_CLASS[pos] : m.glow,
    bgGrad: pos ? POSITION_BG_GRADIENT_CLASS[pos] : m.bgGrad,
    text: pos ? POSITION_TEXT_CLASS[pos] : m.text,
    border: pos ? POSITION_BORDER_CLASS[pos] : m.border,
  };
}

function getTrainingLabel(trainingKey) {
  return TRAINING_META[trainingKey]?.label || trainingKey;
}

/* ═══════════════════════════════════════════════════════════════
   Card de opção de treino — agora com faixa lateral, glow e
   gradiente de fundo, alinhado com PlayerRow (STYLE.md §4).
   ═══════════════════════════════════════════════════════════════ */
function TrainingOptionCard({ optionKey, selected, isSaved, justSaved, loading, onClick }) {
  const meta = TRAINING_META[optionKey];
  const style = getMeta(optionKey);
  const isSelected = selected === optionKey;

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`relative group flex items-stretch rounded-lg overflow-hidden border-2 transition-all duration-200 text-left ${
        isSelected
          ? `${style.border} bg-primary/10 text-on-surface shadow-lg ${style.glow}`
          : `border-outline-variant/25 bg-gradient-to-r ${style.bgGrad} via-surface-container/70 to-surface/30 ${style.glow} shadow-sm shadow-black/30 hover:border-outline-variant/50`
      } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {/* Faixa lateral colorida */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${style.bar}`} />

      <div className="flex-1 p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`font-black text-sm ${isSelected ? "text-on-surface" : style.text}`}>
            {meta.label}
          </div>
          <span
            className={`material-symbols-outlined text-[20px] shrink-0 transition-colors ${
              isSelected ? "text-on-surface" : "text-on-surface-variant group-hover:text-on-surface"
            }`}
          >
            {meta.icon}
          </span>
        </div>
        <div className="text-xs text-on-surface-variant">{meta.description}</div>

        {isSaved && (
          <div
            className={`text-xs font-black mt-2 flex items-center gap-1 ${
              justSaved ? "text-emerald-400" : "text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            {justSaved ? "Guardado!" : "Ativo"}
          </div>
        )}
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DeltaCell — agora como Badge estilo §5 do STYLE.md.
   ═══════════════════════════════════════════════════════════════ */
function DeltaCell({ record }) {
  if (!record) {
    return <span className="text-on-surface-variant/30 tabular-nums">—</span>;
  }
  const delta = record.new_value - record.old_value;
  const isUp = delta > 0;
  return (
    <Badge
      variant={isUp ? "sold" : "error"}
      title={`${record.old_value} → ${record.new_value}`}
    >
      <span className="material-symbols-outlined text-[10px] leading-none align-middle mr-0.5">
        {isUp ? "arrow_upward" : "arrow_downward"}
      </span>
      {Math.abs(delta)}
    </Badge>
  );
}

/**
 * Agrupa os registos de histórico por jogador (preservando a ordem
 * por posição).  Registos sem mudança de nível são ignorados, e
 * jogadores sem qualquer progressão/degradação são omitidos.
 * @param {object[]} records
 * @returns {Array<{ player_id: number, name: string, changes: object[] }>}
 */
function groupByPlayer(records) {
  const map = new Map();
  for (const r of records || []) {
    if (r.new_value === r.old_value) continue;
    if (!map.has(r.player_id)) {
      map.set(r.player_id, {
        player_id: r.player_id,
        name: r.player_name,
        changes: [],
      });
    }
    map.get(r.player_id).changes.push(r);
  }
  return Array.from(map.values());
}

/**
 * Card de jogador no relatório — layout horizontal compacto
 * com colunas de atributo, seguindo o padrão PlayerRow.
 * @param {{
 *   player: { player_id: number, name: string, changes: object[] },
 *   position: string,
 * }} props
 */
function PlayerReportRow({ player, position }) {
  const byAttr = {};
  for (const c of player.changes) byAttr[c.attribute] = c;

  const bar = POSITION_BAR_CLASS[position] || "from-zinc-500 to-zinc-600";
  const glow = POSITION_GLOW_CLASS[position] || "";
  const bgGrad =
    POSITION_BG_GRADIENT_CLASS[position] || "from-zinc-500/4";

  return (
    <div
      className={`relative group flex items-stretch rounded-lg overflow-hidden border border-outline-variant/25 bg-gradient-to-r ${bgGrad} via-surface-container/70 to-surface/30 transition-all duration-200 hover:-translate-y-px hover:shadow-lg ${glow} shadow-sm shadow-black/30`}
    >
      {/* Faixa lateral */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${bar}`} />

      <div className="flex-1 min-w-0 flex items-center px-3 py-2 gap-3">
        {/* Nome */}
        <span className="flex-1 min-w-0 truncate text-sm font-black tracking-tight text-on-surface">
          {player.name}
        </span>

        {/* Separador + deltas */}
        <div className="flex items-center gap-2 shrink-0">
          {ATTR_COLUMNS.map((col) => (
            <div
              key={col.key}
              className="flex flex-col items-center min-w-[48px]"
            >
              <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/70 mb-0.5">
                {col.label}
              </span>
              <DeltaCell record={byAttr[col.key]} />
            </div>
          ))}
        </div>
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

  const uniquePlayerCount = new Set(trainingHistory.map((r) => r.player_id)).size;

  // Players with at least one real attribute change — the only ones the report
  // can display (groupByPlayer drops no-change rows).  If all rows of the
  // latest event are no-change, the report must say so instead of going blank.
  const visiblePlayerCount = new Set(
    trainingHistory
      .filter((r) => r.new_value !== r.old_value)
      .map((r) => r.player_id),
  ).size;

  // Resolve border accent do foco atual
  const focusStyle = savedTraining ? getMeta(savedTraining) : null;

  return (
    <div className="space-y-4">
      {/* ── Summary Widgets ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryWidget
          label="Foco Atual"
          value={savedTraining ? getTrainingLabel(savedTraining) : "Nenhum"}
          compactMobile
          valueClass="text-lg sm:text-2xl"
          accentClass={focusStyle ? focusStyle.border : "border-outline-variant"}
        />
        <SummaryWidget label="Jornada" value={matchweek} compactMobile valueClass="text-lg sm:text-2xl" />
        <SummaryWidget
          label="Jogadores Treinados"
          value={uniquePlayerCount}
          compactMobile
          valueClass="text-lg sm:text-2xl"
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
              {TRAINING_OPTIONS.map((key) => (
                <TrainingOptionCard
                  key={key}
                  optionKey={key}
                  selected={selectedTraining}
                  isSaved={savedTraining === key}
                  justSaved={saved}
                  loading={loading}
                  onClick={() => handleSetTraining(key)}
                />
              ))}
            </div>

            {/* Info card — alinhado com design system */}
            <div className="bg-surface-container-high/50 rounded-lg p-4 border border-outline-variant/25">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant shrink-0 mt-0.5">
                  info
                </span>
                <div>
                  <h3 className="font-black text-on-surface mb-2 text-sm">
                    Como funciona?
                  </h3>
                  <ul className="text-xs text-on-surface-variant space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">→</span>
                      Escolha um foco no início da jornada (league ou taça)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">→</span>
                      Apenas jogadores que jogaram beneficiam
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">→</span>
                      Aplicado automaticamente após a jornada
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">→</span>
                      Atributos não treinados (forma/resistência) degradam-se com o tempo
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
          ) : visiblePlayerCount === 0 ? (
            <EmptyState
              emoji="🧘"
              title="Sem alterações visíveis neste evento"
              description="Nenhum atributo mudou de nível — os jogadores podem ter atingido o limite de potencial, forma ou resistência."
            />
          ) : (
            <div className="space-y-5">
              {Object.entries(historyByPosition).map(([position, records]) => {
                const posText =
                  POSITION_TEXT_CLASS[position] || "text-on-surface-variant";
                const posLabel = POSITION_LABELS[position] || position;
                const players = groupByPlayer(records);
                if (players.length === 0) return null;

                return (
                  <div key={position} className="space-y-2">
                    {/* Header do grupo */}
                    <h3
                      className={`font-black flex items-center gap-2 text-sm ${posText}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        group
                      </span>
                      {posLabel}
                      <Badge variant="neutral" size="sm">
                        {players.length} jogadores
                      </Badge>
                    </h3>

                    {/* Lista de cards */}
                    <div className="space-y-1.5">
                      {players.map((p) => (
                        <PlayerReportRow
                          key={p.player_id}
                          player={p}
                          position={position}
                        />
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
