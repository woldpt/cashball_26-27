import { PRESSURE_OPTIONS } from "../../constants/index.js";

const ORDER_MINUTES = [60, 70, 80];
const ORDER_WHEN = [
  ["LOSING", "a perder"],
  ["DRAWING", "empatado"],
  ["WINNING", "a ganhar"],
];
const ORDER_STYLES = [
  ["Defensive", "Defensivo"],
  ["Balanced", "Neutro"],
  ["Offensive", "Ofensivo"],
];
const ORDER_SELECT_CLS =
  "bg-surface-container-low/80 border border-outline-variant/30 rounded-md px-1.5 py-1 text-[11px] font-bold text-on-surface";

/**
 * OrdersCard — até 2 ordens para o jogo: "aos 70', se estiver a perder →
 * Ofensivo, pressão alta". O servidor aplica-as sozinho na hora certa.
 * Partilhado pela Tática e pelo intervalo (Intervenção).
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
    <div className={`bg-surface-container border border-outline-variant/25 rounded-2xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/15">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Ordens para o jogo</span>
        {orders.length < 2 && (
          <button
            type="button"
            onClick={() => setOrders([...orders, { minute: 70, when: "LOSING", style: "Offensive", pressure: "ALTA" }])}
            className="text-[9px] text-[#4ade80] uppercase font-black hover:brightness-125"
          >
            + Ordem
          </button>
        )}
      </div>
      {orders.length === 0 ? (
        <p className="px-3 py-2 text-[10px] text-gray-500 font-semibold leading-snug">
          Ex.: aos 70&apos;, se estiveres a perder, a equipa passa a Ofensivo sem parares o jogo.
        </p>
      ) : (
        <div className="px-3 py-2 space-y-2">
          {orders.map((o, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-gray-400">
              <span>Aos</span>
              <select aria-label="Minuto" className={ORDER_SELECT_CLS} value={o.minute} onChange={(e) => change(i, { minute: Number(e.target.value) })}>
                {ORDER_MINUTES.map((m) => (
                  <option key={m} value={m}>{m}&apos;</option>
                ))}
              </select>
              <span>se</span>
              <select aria-label="Resultado" className={ORDER_SELECT_CLS} value={o.when} onChange={(e) => change(i, { when: e.target.value })}>
                {ORDER_WHEN.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <span>→</span>
              <select aria-label="Mentalidade" className={ORDER_SELECT_CLS} value={o.style} onChange={(e) => change(i, { style: e.target.value })}>
                {ORDER_STYLES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select aria-label="Pressão" className={ORDER_SELECT_CLS} value={o.pressure ?? "MEDIA"} onChange={(e) => change(i, { pressure: e.target.value })}>
                {PRESSURE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>pressão {label.toLowerCase()}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Apagar ordem"
                onClick={() => setOrders(orders.filter((_, j) => j !== i))}
                className="ml-auto text-gray-600 hover:text-red-400 text-xs font-black px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
