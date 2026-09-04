import estadio5000 from "../assets/estadio5000.jpg";
import estadio15000 from "../assets/estadio15000.jpg";
import estadio30000 from "../assets/estadio30000.jpg";
import estadio50000 from "../assets/estadio50000.jpg";
import { socket } from "../socket.js";
import { DIVISION_NAMES, STADIUM_EXPANSION_COST as EXPANSION_COST } from "../constants/index.js";
import { formatCurrency } from "../utils/formatters.js";
import { SummaryWidget } from "../components/shared/SummaryWidget.jsx";
import { Panel } from "../components/shared/Panel.jsx";
import { Button } from "../components/shared/Button.jsx";

const SEATS_PER_BUILD = 5000;
const MAX_CAPACITY = 120000;

/**
 * @param {{
 *   teamInfo: object,
 *   currentBudget: number,
 *   capacityRevPerGame: number,
 *   financeData: object|null,
 *   setGameDialog: function,
 * }} props
 */
export function StadiumTab({
  teamInfo,
  currentBudget,
  capacityRevPerGame,
  financeData,
  setGameDialog,
}) {
  const stadiumCapacity = teamInfo?.stadium_capacity || 10000;
  const division = teamInfo?.division || 1;

  const homeMatches =
    financeData?.homeMatchesPlayed || 0;
  const avgAttendance =
    homeMatches > 0
      ? Math.round(
          (financeData?.ticketBreakdown || []).reduce(
            (sum, t) => sum + (t.attendance || 0),
            0,
          ) / homeMatches,
        )
      : null;

  const atMaxCapacity = stadiumCapacity >= MAX_CAPACITY;

  const stadiumImg =
    stadiumCapacity >= 50000
      ? estadio50000
      : stadiumCapacity >= 30000
        ? estadio30000
        : stadiumCapacity >= 15000
          ? estadio15000
          : estadio5000;

  return (
    <div className="space-y-4">
      {/* ── HERO: ESTÁDIO ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-outline-variant/25 overflow-hidden relative bg-surface-container">
        <div
          className="h-32 sm:h-56 relative flex items-end"
          style={{
            backgroundImage: `url(${stadiumImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="relative px-5 pb-4 w-full">
            <p
              className="text-[10px] font-black uppercase tracking-widest mb-1 drop-shadow"
              style={{ color: teamInfo?.color_primary || "#4ade80" }}
            >
              Recinto Principal
            </p>
            <h2 className="font-headline text-lg sm:text-2xl font-black text-white leading-tight drop-shadow">
              {teamInfo?.stadium_name || "Estádio Municipal"}
            </h2>
            <p className="text-[11px] text-white/70 font-bold mt-1 drop-shadow">
              {DIVISION_NAMES[division] || `Divisão ${division}`} ·{" "}
              {stadiumCapacity.toLocaleString("pt-PT")} lugares
            </p>
          </div>
        </div>
      </div>

      {/* ── ROW: STATS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <SummaryWidget
          label="Capacidade Actual"
          value={stadiumCapacity.toLocaleString("pt-PT")}
          sub="lugares"
          compactMobile
          valueClass="text-lg sm:text-2xl"
        />
        <SummaryWidget
          label="Receita máx. / jogo"
          value={formatCurrency(capacityRevPerGame)}
          sub="15€ × lotação"
          compactMobile
          valueClass="text-lg sm:text-2xl"
          accentClass="border-tertiary"
          valueColorClass="text-tertiary"
        />
        <SummaryWidget
          label="Assistência Média"
          value={
            avgAttendance != null
              ? avgAttendance.toLocaleString("pt-PT")
              : "—"
          }
          sub={`${homeMatches} jogo(s) em casa`}
          compactMobile
          valueClass="text-lg sm:text-2xl"
          accentClass="border-amber-400"
        />
      </div>

      {/* ── EXPANSÃO ──────────────────────────────────────────────── */}
      <Panel
        title="Expansão do Estádio"
        icon="stadium"
        meta={atMaxCapacity ? "Capacidade Máxima" : undefined}
        padded={false}
      >
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
            <div className="bg-surface rounded-md border border-outline-variant/15 p-3 sm:p-4 flex flex-col gap-1">
              <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-wider">
                Custo por Obra
              </span>
              <span className="text-tertiary font-headline font-bold text-xl tabular-nums">
                {formatCurrency(EXPANSION_COST)}
              </span>
              <span className="text-on-surface-variant text-[10px]">
                +{SEATS_PER_BUILD.toLocaleString("pt-PT")} lugares
              </span>
            </div>
            <div className="bg-surface rounded-md border border-outline-variant/15 p-3 sm:p-4 flex flex-col gap-1">
              <span className="text-on-surface-variant text-[10px] font-black uppercase tracking-wider">
                Ganho Receita / Obra
              </span>
              <span className="text-primary font-headline font-bold text-xl tabular-nums">
                {formatCurrency(SEATS_PER_BUILD * 15)}
              </span>
              <span className="text-on-surface-variant text-[10px]">
                por jogo em casa
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            full
            disabled={atMaxCapacity || currentBudget < EXPANSION_COST}
            onClick={() => {
              setGameDialog({
                mode: "confirm",
                title: "Expandir Estádio — 300.000€",
                description: `Aumenta a capacidade em 5.000 lugares. Receita máxima por jogo sobe ${formatCurrency(SEATS_PER_BUILD * 15)}.`,
                confirmLabel: "Confirmar Expansão",
                onConfirm: () => socket.emit("buildStadium"),
                onCancel: () => {},
              });
            }}
          >
            Expandir Estádio — {formatCurrency(EXPANSION_COST)}
          </Button>

          {atMaxCapacity ? (
            <p className="text-on-surface-variant text-[10px] text-center mt-2 uppercase tracking-wider opacity-60">
              Capacidade máxima atingida ({MAX_CAPACITY.toLocaleString("pt-PT")} lugares)
            </p>
          ) : currentBudget < EXPANSION_COST ? (
            <p className="text-on-surface-variant text-[10px] text-center mt-2 uppercase tracking-wider opacity-60">
              Saldo insuficiente · faltam{" "}
              {formatCurrency(EXPANSION_COST - currentBudget)}
            </p>
          ) : null}
        </div>
    </Panel>
    </div>
  );
}
