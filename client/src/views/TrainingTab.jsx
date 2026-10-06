import { useState, useEffect, useRef } from "react";
import { PlayerLink } from "../components/shared/PlayerLink.jsx";
import { socket } from "../socket.js";
import {
  POSITION_TEXT_CLASS,
  POSITION_GLOW_CLASS,
  POSITION_BG_GRADIENT_CLASS,
  POSITION_BAR_CLASS,
  POSITION_BORDER_CLASS,
  POSITION_BADGE_BG_CLASS,
} from "../constants/index.js";
import { staffRoleMeta } from "../constants/staff.js";
import { Panel } from "../components/shared/Panel.jsx";
import { TransferHeader } from "../components/transfers/TransferChrome.jsx";
import { EmptyState } from "../components/shared/EmptyState.jsx";

const TRAINING_FOCUS_STORAGE_BASE_KEY = "cashball_training_focus";

/**
 * Chave de localStorage por sala — evita o flash do foco de outra sala
 * no mesmo browser. A leitura mantém fallback para a chave antiga (sem sala).
 * @param {string} [roomCode]
 */
function trainingFocusKey(roomCode) {
  return roomCode
    ? `${TRAINING_FOCUS_STORAGE_BASE_KEY}:${roomCode}`
    : TRAINING_FOCUS_STORAGE_BASE_KEY;
}

/**
 * socket.emit com fallback de timeout — se o servidor nunca ackar,
 * invoca o resolve com null em vez de deixar a UI pendurada.
 * Substitui o timeout ad-hoc que só existia no setTrainingFocus.
 * @template T
 * @param {string} event
 * @param {any[]} args
 * @param {number} [ms]
 * @returns {Promise<T|null>}
 */
function emitWithTimeout(event, args, ms = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.emit(event, ...args, (result) => {
      clearTimeout(timer);
      resolve(result ?? null);
    });
  });
}

/**
 * @param {string} [roomCode]
 */
function readStoredTrainingFocus(roomCode) {
  return (
    localStorage.getItem(trainingFocusKey(roomCode)) ||
    localStorage.getItem(TRAINING_FOCUS_STORAGE_BASE_KEY) ||
    null
  );
}

/* ═══════════════════════════════════════════════════════════════
   Maps de estilo por opção de treino.  GR/DEF/MED/ATA puxam
   tokens canónicos de posição; Forma/Resistência usam cores
   dedicadas (orange / purple) mas o mesmo padrão visual.
   ═══════════════════════════════════════════════════════════════ */
const TRAINING_META = {
  GR: {
    label: "Guarda-redes",
    description: "Skill dos guarda-redes",
    icon: "sports_soccer",
    pos: "GR",
    attr: "skill",
  },
  Defesas: {
    label: "Defesas",
    description: "Skill dos defesas",
    icon: "security",
    pos: "DEF",
    attr: "skill",
  },
  Médios: {
    label: "Médios",
    description: "Skill dos médios",
    icon: "pivot_table_chart",
    pos: "MED",
    attr: "skill",
  },
  Avançados: {
    label: "Avançados",
    description: "Skill dos avançados",
    icon: "target",
    pos: "ATA",
    attr: "skill",
  },
  Forma: {
    label: "Forma",
    description: "Forma dos jogadores",
    icon: "favorite",
    attr: "form",
    chip: "bg-orange-400/20",
    bar: "from-orange-300 via-orange-400 to-orange-600",
    glow: "hover:border-orange-400/70 hover:shadow-orange-400/30",
    bgGrad: "from-orange-500/8",
    text: "text-orange-400",
    border: "border-orange-400",
  },
  Resistência: {
    label: "Resistência",
    description: "Resistência física",
    icon: "bolt",
    attr: "resistance",
    chip: "bg-purple-400/20",
    bar: "from-purple-300 via-purple-400 to-purple-600",
    glow: "hover:border-purple-400/70 hover:shadow-purple-400/30",
    bgGrad: "from-purple-500/8",
    text: "text-purple-400",
    border: "border-purple-400",
  },
};

const TRAINING_OPTIONS = Object.keys(TRAINING_META);

// Dois grupos no seletor: skill por posição e condição física.
const TRAINING_GROUPS = [
  { label: "Posições · skill", keys: TRAINING_OPTIONS.filter((k) => TRAINING_META[k].pos) },
  { label: "Físico", keys: TRAINING_OPTIONS.filter((k) => !TRAINING_META[k].pos) },
];

const POSITION_LABELS = {
  GR: "Guarda-redes",
  DEF: "Defesas",
  MED: "Médios",
  ATA: "Avançados",
};

// Ordem canónica dos grupos no relatório — igual à do plantel em MySquadTab.
const POSITION_ORDER = ["GR", "DEF", "MED", "ATA"];

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
    chip: pos ? POSITION_BADGE_BG_CLASS[pos] : m.chip,
  };
}

function getTrainingLabel(trainingKey) {
  return TRAINING_META[trainingKey]?.label || trainingKey;
}

/**
 * Cartão de opção de treino: faixa lateral + ícone em chip na cor do foco
 * (STYLE.md §4). Ícone por cima do título para caber a 320px em 2 colunas.
 * @param {{
 *   optionKey: string,
 *   isSaved: boolean,
 *   justSaved: boolean,
 *   loading: boolean,
 *   pending: boolean,
 *   onClick: () => void,
 * }} props
 * @returns {JSX.Element}
 */
function TrainingOptionCard({ optionKey, isSaved, justSaved, loading, pending, onClick }) {
  const meta = TRAINING_META[optionKey];
  const style = getMeta(optionKey);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-pressed={isSaved}
      className={`relative group flex items-stretch rounded-lg overflow-hidden border text-left transition-all duration-200 bg-gradient-to-r ${style.bgGrad} via-surface-container/70 to-surface/30 ${
        isSaved
          ? `${style.border} shadow-lg shadow-black/40`
          : `border-outline-variant/25 shadow-sm shadow-black/30 hover:-translate-y-px hover:shadow-lg ${style.glow}`
      } ${loading ? `cursor-not-allowed ${pending ? "" : "opacity-50"}` : "cursor-pointer"} ${isSaved && justSaved ? "training-saved-pulse" : ""}`}
    >
      {/* Faixa lateral colorida */}
      <div className={`shrink-0 w-1 bg-gradient-to-b ${style.bar}`} />

      <div className="flex-1 min-w-0 p-3 short:p-2 flex flex-col gap-2 short:gap-1">
        <div className="flex items-start justify-between gap-2">
          <span
            aria-hidden
            className={`inline-flex h-9 w-9 short:h-7 short:w-7 items-center justify-center rounded-md ${style.chip}`}
          >
            <span className={`material-symbols-outlined text-[20px] short:text-[16px] ${style.text}`}>
              {meta.icon}
            </span>
          </span>
          {pending ? (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              A guardar
            </span>
          ) : isSaved ? (
            <span
              className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${
                justSaved ? "text-emerald-400" : style.text
              }`}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              {justSaved ? "Guardado" : "Ativo"}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <div
            className={`font-black font-headline text-sm short:text-xs tracking-tight leading-tight ${
              isSaved ? "text-on-surface" : style.text
            }`}
          >
            {meta.label}
          </div>
          <div className="text-[11px] short:text-[10px] text-on-surface-variant leading-snug mt-0.5">
            {meta.description}
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * Nível depois do treino + variação num chip compacto (cabe em 48px).
 * @param {{ record?: { old_value: number, new_value: number } }} props
 * @returns {JSX.Element}
 */
function DeltaCell({ record }) {
  if (!record) {
    return <span className="text-on-surface-variant/30 tabular-nums">—</span>;
  }
  const delta = record.new_value - record.old_value;
  const isUp = delta > 0;
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${record.old_value} → ${record.new_value}`}
    >
      <span className="text-sm font-black tabular-nums text-on-surface">
        {record.new_value}
      </span>
      <span
        className={`rounded px-1 py-px text-[9px] font-black tabular-nums leading-none ${
          isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-error/15 text-error"
        }`}
      >
        {isUp ? "+" : "−"}
        {Math.abs(delta)}
      </span>
    </span>
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
 * Cabeçalho das colunas de atributo, uma vez por grupo, alinhado com
 * as colunas do PlayerReportRow. A coluna do foco leva a cor do foco;
 * as restantes esbatem-se para o olho ir direto ao que interessa.
 * @param {{ highlightAttr?: string|null, highlightClass?: string }} props
 * @returns {JSX.Element}
 */
function AttrHeader({ highlightAttr, highlightClass }) {
  const cls = (attr) => {
    if (attr === highlightAttr && highlightClass) return highlightClass;
    if (highlightAttr) return "text-on-surface-variant/40";
    return "text-on-surface-variant/70";
  };
  return (
    <div className="flex justify-end gap-1 sm:gap-2 pl-1 pr-3 short:pr-2">
      {ATTR_COLUMNS.map((col) => (
        <span
          key={col.key}
          className={`w-12 sm:w-16 text-center text-[10px] font-black uppercase tracking-widest ${cls(col.key)}`}
        >
          {col.label}
        </span>
      ))}
    </div>
  );
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

      <div className="flex-1 min-w-0 flex items-center px-3 short:px-2 py-2 short:py-1.5 gap-3 short:gap-2">
        {/* Nome */}
        <span className="flex-1 min-w-0 truncate text-sm font-black tracking-tight text-on-surface">
          <PlayerLink playerId={player.player_id}>{player.name}</PlayerLink>
        </span>

        {/* Separador + deltas */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {ATTR_COLUMNS.map((col) => (
            <div key={col.key} className="flex justify-center w-12 sm:w-16">
              <DeltaCell record={byAttr[col.key]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Equipa técnica que ajuda o treino (o Treinador Auxiliar acelera a skill,
 * o Preparador Físico mexe na forma/resistência…), em chips. Sem
 * funcionários não aparece nada.
 *
 * @param {{ staff: object|null }} props
 * @returns {JSX.Element|null}
 */
function StaffTrainingNote({ staff }) {
  const members = staff?.members || [];
  if (members.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        Equipa técnica
      </h3>
      <ul className="flex flex-wrap gap-1.5">
        {members.map((m) => {
          const meta = staffRoleMeta(m.role);
          return (
            <li
              key={m.role}
              className="inline-flex flex-wrap items-baseline gap-x-1.5 rounded-md border border-outline-variant/25 bg-surface-container-high/50 px-2 py-1 text-[10px] text-on-surface-variant"
            >
              <span className="font-black text-on-surface">{meta.label}</span>
              <span className="font-black text-amber-400 tabular-nums">N{m.level}</span>
              <span className="text-tertiary font-bold">{meta.effect(m.effect)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param {{
 *   me: object,
 *   matchweek: number,
 *   staff?: object|null,
 * }} props
 */
export function TrainingTab({ me, matchweek, staff = null }) {
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [historyCalendarIndex, setHistoryCalendarIndex] = useState(null);
  const [savedTraining, setSavedTraining] = useState(() => {
    return readStoredTrainingFocus(me?.roomCode);
  });
  const [pendingKey, setPendingKey] = useState(null);
  const loading = pendingKey != null;
  const [saved, setSaved] = useState(false);
  // Contador de confirmações — remontado na key do cartão, relança o pulso.
  const [savedTick, setSavedTick] = useState(0);
  const [error, setError] = useState("");

  // Persist selected training to localStorage (por sala)
  useEffect(() => {
    const key = trainingFocusKey(me?.roomCode);
    if (savedTraining != null) {
      localStorage.setItem(key, savedTraining);
    } else {
      localStorage.removeItem(key);
    }
  }, [savedTraining, me?.roomCode]);

  // Fetch current training and history on component mount
  useEffect(() => {
    if (!me?.teamId) return;

    let alive = true;
    (async () => {
      const [focus, history] = await Promise.all([
        emitWithTimeout("getTrainingFocus", []),
        emitWithTimeout("getTrainingHistory", [null]),
      ]);
      if (!alive) return;
      if (focus != null) {
        setSavedTraining(focus);
      }
      setTrainingHistory(history || []);
      setHistoryCalendarIndex(history?.[0]?.calendar_index ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [me?.teamId, matchweek]);

  const savedTimeoutRef = useRef(null);

  // Listen for training focus updates
  useEffect(() => {
    const handleTrainingUpdated = (data) => {
      if (data.teamId === me?.teamId) {
        setSavedTraining(data.trainingFocus);
        setSaved(true);
        setSavedTick((t) => t + 1);
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

  const handleSetTraining = async (trainingKey) => {
    if (!me?.teamId || trainingKey === savedTraining) return;
    setPendingKey(trainingKey);
    setError("");

    const ok = await emitWithTimeout("setTrainingFocus", [trainingKey], 4000);
    if (ok) {
      setSavedTraining(trainingKey);
    } else {
      setError("Erro ao guardar foco de treino.");
    }
    setPendingKey(null);
  };

  // Group history by position
  const historyByPosition = {};
  trainingHistory.forEach((record) => {
    if (!historyByPosition[record.position]) {
      historyByPosition[record.position] = [];
    }
    historyByPosition[record.position].push(record);
  });

  // Grupos pela ordem canónica do plantel (GR→ATA); posições desconhecidas
  // (se alguma vez existirem) caem para o fim em vez de desaparecer.
  // Uma única passagem de agrupamento — o relatório e o widget derivam da
  // mesma estrutura, por isso nunca divergem.
  const orderedGroups = [
    ...POSITION_ORDER,
    ...Object.keys(historyByPosition).filter(
      (pos) => !POSITION_ORDER.includes(pos),
    ),
  ]
    .map((position) => ({
      position,
      players: groupByPlayer(historyByPosition[position]),
    }))
    .filter((g) => g.players.length > 0);

  // Jogadores com pelo menos uma mudança real de atributo (o mesmo
  // critério do groupByPlayer) — contador do widget.
  const visiblePlayerCount = orderedGroups.reduce(
    (sum, g) => sum + g.players.length,
    0,
  );

  // Soma dos níveis ganhos/perdidos no último treino (só jogadores visíveis).
  let gains = 0;
  let losses = 0;
  for (const g of orderedGroups)
    for (const p of g.players)
      for (const c of p.changes) {
        const d = c.new_value - c.old_value;
        if (d > 0) gains += d;
        else losses -= d;
      }

  // Resolve border accent do foco atual
  const focusStyle = savedTraining ? getMeta(savedTraining) : null;
  const focusMeta = savedTraining ? TRAINING_META[savedTraining] : null;
  const focusAttr = savedTraining
    ? (TRAINING_META[savedTraining]?.attr ?? null)
    : null;

  return (
    <div className="space-y-4 short:space-y-2">
      <TransferHeader
        icon="fitness_center"
        kicker={`Clube · Jornada ${matchweek}`}
        title="Treino"
        valueLabel="Evolução (níveis)"
        valueClass="text-emerald-400"
        budget={gains - losses}
        format={(n) => `${n > 0 ? "+" : ""}${n}`}
        chips={[
          savedTraining
            ? { label: getTrainingLabel(savedTraining), tone: "neutral", icon: focusMeta?.icon }
            : { label: "sem foco — escolhe abaixo", tone: "warn", icon: "fitness_center" },
          { label: "ganhos", value: `+${gains}`, tone: "good" },
          { label: "perdas", value: `−${losses}`, tone: "bad" },
          { label: "jogadores com mudanças", value: visiblePlayerCount },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 short:gap-2 items-start">
        {/* ── Seletor do foco ───────────────────────────────────────────── */}
        <Panel title="Foco de Treino" icon="fitness_center" meta={`Jornada ${matchweek}`}>
          <div className="space-y-4 short:space-y-2">
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error-container/30 border border-error/40 text-error text-xs font-black uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <div className="space-y-3 short:space-y-2" role="group" aria-label="Escolha o foco de treino">
              {TRAINING_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <h3 className="px-0.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    {group.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 short:gap-1.5">
                    {group.keys.map((key) => (
                      <TrainingOptionCard
                        key={savedTraining === key ? `foco-${savedTick}` : key}
                        optionKey={key}
                        isSaved={savedTraining === key}
                        justSaved={saved}
                        loading={loading}
                        pending={pendingKey === key}
                        onClick={() => handleSetTraining(key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <StaffTrainingNote staff={staff} />

            {/* Regras — fechadas por defeito (no telemóvel ocupavam meio ecrã) */}
            <details className="group rounded-lg border border-outline-variant/25 bg-surface-container-high/40">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 short:py-1.5 text-xs font-black text-on-surface [&::-webkit-details-marker]:hidden">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">info</span>
                Como funciona?
                <span className="material-symbols-outlined ml-auto text-[18px] text-on-surface-variant transition-transform group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <ul className="space-y-1.5 border-t border-outline-variant/15 px-3 py-2.5 text-xs text-on-surface-variant">
                {[
                  "Escolhe um foco no início da jornada (liga ou taça).",
                  "Só os jogadores que jogaram beneficiam.",
                  "É aplicado automaticamente depois da jornada.",
                  "Forma e resistência não treinadas descem com o tempo.",
                ].map((text) => (
                  <li key={text} className="flex items-start gap-2">
                    <span className="text-primary">→</span>
                    {text}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </Panel>

        {/* ── TRAINING HISTORY PANEL ───────────────────────────────────── */}
        <Panel
          title="Último Treino"
          icon="monitoring"
          meta={
            historyCalendarIndex != null
              ? `Semana ${historyCalendarIndex + 1}`
              : undefined
          }
        >
          {trainingHistory.length === 0 ? (
            <EmptyState
              icon="bar_chart"
              title="Ainda não há histórico de treino — escolha um foco e jogue uma jornada."
            />
          ) : visiblePlayerCount === 0 ? (
            <EmptyState
              icon="self_improvement"
              title="Sem alterações visíveis neste evento"
              description="Nenhum atributo mudou de nível — os jogadores podem ter atingido o limite de potencial, forma ou resistência."
            />
          ) : (
            <div className="space-y-4 short:space-y-2">
              {orderedGroups.map(({ position, players }) => {
                const posText =
                  POSITION_TEXT_CLASS[position] || "text-on-surface-variant";
                const posLabel = POSITION_LABELS[position] || position;

                return (
                  <section key={position} aria-label={posLabel} className="space-y-1.5 short:space-y-1">
                    {/* Cabeçalho do grupo (igual ao do plantel) */}
                    <div className="flex items-center gap-2 px-1">
                      <h3 className={`text-[10px] font-black uppercase tracking-widest ${posText}`}>
                        {posLabel}
                      </h3>
                      <span className="text-[9px] text-on-surface-variant/70 font-bold tabular-nums">
                        {players.length} {players.length === 1 ? "jogador" : "jogadores"}
                      </span>
                    </div>

                    {/* Lista de cards */}
                    <div className="space-y-1.5">
                      <AttrHeader
                        highlightAttr={focusAttr}
                        highlightClass={focusStyle?.text}
                      />
                      {players.map((p) => (
                        <PlayerReportRow
                          key={p.player_id}
                          player={p}
                          position={position}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
