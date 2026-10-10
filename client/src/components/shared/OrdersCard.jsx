import { PRESSURE_OPTIONS } from "../../constants/index.js";

/* Valores de cada parte da frase, pela ordem em que um toque os percorre.
 * As cores seguem os botões de mentalidade/pressão e o semáforo do resultado. */
const MINUTES = [60, 70, 80].map((m) => ({ value: m, label: `${m}'`, accent: "#a78bfa" }));
const WHEN = [
  { value: "LOSING", label: "a perder", accent: "#f43f5e" },
  { value: "DRAWING", label: "empatado", accent: "#f59e0b" },
  { value: "WINNING", label: "a ganhar", accent: "#4ade80" },
];
const STYLES = [
  { value: "Defensive", label: "Defensivo", accent: "#3b82f6" },
  { value: "Balanced", label: "Neutro", accent: "#6366f1" },
  { value: "Offensive", label: "Ofensivo", accent: "#f59e0b" },
];
const PRESSURES = PRESSURE_OPTIONS.map((o) => ({ ...o, label: `pressão ${o.label.toLowerCase()}` }));

const NEW_ORDER = { minute: 70, when: "LOSING", style: "Offensive", pressure: "ALTA" };

/**
 * Pílula de uma parte da ordem: mostra o valor atual e um toque passa ao seguinte.
 * @param {Object} props
 * @param {Array<{value: (string|number), label: string, accent: string}>} props.list
 * @param {string|number} props.value
 * @param {string} props.name - O que esta parte é (ex. "Minuto"), para leitores de ecrã.
 * @param {(value: (string|number)) => void} props.onChange
 * @returns {JSX.Element}
 */
function CyclePill({ list, value, name, onChange }) {
  const idx = Math.max(0, list.findIndex((o) => o.value === value));
  const cur = list[idx];
  const next = list[(idx + 1) % list.length];
  return (
    <button
      type="button"
      onClick={() => onChange(next.value)}
      aria-label={`${name}: ${cur.label}. Tocar para mudar para ${next.label}`}
      className="inline-flex min-h-8 items-center rounded-full border px-2.5 text-[11px] font-black uppercase tracking-wide transition-all duration-150 hover:brightness-125 active:scale-95"
      style={{ background: `${cur.accent}24`, borderColor: `${cur.accent}80`, color: cur.accent }}
    >
      {cur.label}
    </button>
  );
}

/**
 * OrdersCard — até 2 ordens para o jogo, escritas como uma frase:
 * "Aos 70' · se a perder → Ofensivo · pressão alta". Cada parte é uma
 * pílula que muda com um toque; o servidor aplica a ordem sozinho na hora
 * certa. Partilhado pela Tática e pelo intervalo (Intervenção).
 * @param {Object} props
 * @param {{orders?: Array<{minute: number, when: string, style: string, pressure?: string}>}} props.tactic
 * @param {(patch: Object) => void} props.onUpdateTactic
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export function OrdersCard({ tactic, onUpdateTactic, className = "" }) {
  const orders = tactic?.orders ?? [];
  const setOrders = (next) => onUpdateTactic({ orders: next });
  const change = (i, patch) => setOrders(orders.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className={`rounded-xl border border-outline-variant/25 bg-surface-container/60 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-outline-variant/15">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          <span aria-hidden="true">📋</span>
          Ordens para o jogo
        </span>
        {orders.length < 2 && (
          <button
            type="button"
            onClick={() => setOrders([...orders, NEW_ORDER])}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 text-[10px] font-black uppercase tracking-wider text-primary transition-all hover:bg-primary/25 active:scale-95"
          >
            + Ordem
          </button>
        )}
      </div>
      {orders.length === 0 ? (
        <p className="px-3 py-2.5 text-[11px] font-medium leading-snug text-on-surface-variant">
          Deixa instruções programadas: por exemplo, aos 70&apos;, se estiveres a perder, a equipa passa a
          Ofensivo sem parares o jogo.
        </p>
      ) : (
        <div className="space-y-2 p-2.5">
          {orders.map((o, i) => (
            <div
              key={i}
              className="relative flex flex-wrap items-center gap-x-1.5 gap-y-1.5 rounded-lg border border-outline-variant/20 bg-surface-container-low/60 py-2 pl-2.5 pr-10 text-[11px] font-semibold text-on-surface-variant"
            >
              <span>Aos</span>
              <CyclePill list={MINUTES} value={o.minute} name="Minuto" onChange={(v) => change(i, { minute: v })} />
              <span>se</span>
              <CyclePill list={WHEN} value={o.when} name="Resultado" onChange={(v) => change(i, { when: v })} />
              <span aria-hidden="true">→</span>
              <CyclePill list={STYLES} value={o.style} name="Mentalidade" onChange={(v) => change(i, { style: v })} />
              <CyclePill
                list={PRESSURES}
                value={o.pressure ?? "MEDIA"}
                name="Pressão"
                onChange={(v) => change(i, { pressure: v })}
              />
              <button
                type="button"
                aria-label="Apagar ordem"
                onClick={() => setOrders(orders.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/60 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
              >
                ✕
              </button>
            </div>
          ))}
          <p className="px-0.5 text-[10px] font-medium text-on-surface-variant/70">Toca numa palavra colorida para a mudar.</p>
        </div>
      )}
    </div>
  );
}
