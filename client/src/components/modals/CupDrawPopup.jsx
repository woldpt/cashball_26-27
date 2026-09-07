import { socket } from "../../socket.js";
import { ModalShell } from "../shared/ModalShell.jsx";
import { Button } from "../shared/Button.jsx";
import { MODAL_Z } from "../../constants/index.js";

/**
 * Detecta cores pretas/muito escuras (luminância percebida < ~40/255) para
 * substituir a cor do nome por branco e garantir legibilidade.
 * @param {string|null|undefined} hex
 * @returns {boolean}
 */
function isDarkColor(hex) {
  if (typeof hex !== "string") return false;
  const m = hex.trim().replace(/^#/, "");
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b < 40;
}

/**
 * Cor de legibilidade do nome da equipa: preto/escura → branco.
 * @param {{ color_primary?: string }} [team]
 * @returns {string}
 */
function teamNameColor(team) {
  return team?.color_primary && !isDarkColor(team.color_primary)
    ? team.color_primary
    : "#fff";
}

/**
 * Ícone de equipa: crest com fallback para inicial (mesmo padrão das
 * restantes páginas do jogo); círculo neutro enquanto não revelado.
 * @param {{ team: object|null, revealed: boolean }} props
 */
function TeamCrestIcon({ team, revealed }) {
  const initial = team?.name?.[0] ?? "?";
  if (!revealed) {
    return (
      <div
        className="w-8 h-8 rounded-full shrink-0 border border-white/10"
        style={{ background: "#27272a" }}
      />
    );
  }
  if (team?.crest) {
    return (
      <>
        <img
          src={team.crest}
          alt={team?.name || "crest"}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fb = e.currentTarget.nextElementSibling;
            if (fb) fb.style.display = "flex";
          }}
          className="w-8 h-8 rounded-full object-contain bg-white p-1 shrink-0 border border-white/10"
          loading="lazy"
        />
        <div
          className="w-8 h-8 rounded-full hidden items-center justify-center font-black text-xs shrink-0 border border-white/10"
          style={{
            background: team?.color_primary || "#333",
            color: team?.color_secondary || "#fff",
          }}
        >
          {initial}
        </div>
      </>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 border border-white/10"
      style={{
        background: team?.color_primary || "#333",
        color: team?.color_secondary || "#fff",
      }}
    >
      {initial}
    </div>
  );
}

/**
 * @param {{ cupDraw: object|null, cupDrawRevealIdx: number, me: object, players: object[], showCupDrawPopup: boolean, setShowCupDrawPopup: function, setCupDrawRevealIdx: function }} props
 */
export function CupDrawPopup({
  cupDraw,
  cupDrawRevealIdx,
  me,
  players = [],
  showCupDrawPopup,
  setShowCupDrawPopup,
  setCupDrawRevealIdx,
}) {
  if (!showCupDrawPopup || !cupDraw || !cupDraw.humanInCup) return null;

  const totalPairs = (cupDraw.fixtures || []).length;
  const fullyRevealed = cupDrawRevealIdx >= totalPairs * 2;

  const coachOf = (teamId) =>
    players.find((p) => p.teamId === teamId)?.name ?? null;

  return (
    <ModalShell
      visible={showCupDrawPopup}
      z={MODAL_Z.cupDraw}
      variant="fullscreen"
      backdropClassName="short:p-2 short:justify-start short:gap-1"
    >
      {/* Header */}
      <div className="w-full text-center mb-6 short:mb-2 shrink-0 pt-4 short:pt-1 px-2 short:px-1">
        <p className="text-xs short:text-[10px] text-amber-400 uppercase font-black tracking-widest sm:tracking-[0.3em] mb-2 short:mb-1">
          Taça de Portugal · Temporada {cupDraw.season}
        </p>
        <h1 className="text-2xl sm:text-3xl short:!text-base font-black text-primary uppercase tracking-tight">
          Sorteio — {cupDraw.roundName}
        </h1>
      </div>

      {/* Saltar botão (skip reveal animation) */}
      {cupDraw.humanInCup && !fullyRevealed && (
        <div className="w-full max-w-3xl flex justify-end mb-2 short:mb-1">
          <button
            onClick={() => {
              const total = (cupDraw.fixtures || []).length * 2;
              setCupDrawRevealIdx(total);
            }}
            className="rounded-sm bg-white/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
          >
            Saltar ⏭
          </button>
        </div>
      )}

      {/* Fixtures — two columns on sm+ screens */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-2 short:gap-1.5">
        {(cupDraw.fixtures || []).map((fixture, pairIdx) => {
          const homeIdx = pairIdx * 2;
          const awayIdx = pairIdx * 2 + 1;
          const homeRevealed = cupDrawRevealIdx > homeIdx;
          const awayRevealed = cupDrawRevealIdx > awayIdx;
          const isMyPair =
            awayRevealed &&
            (fixture.homeTeam?.id === me?.teamId ||
              fixture.awayTeam?.id === me?.teamId);

          const homeCoach = homeRevealed ? coachOf(fixture.homeTeam?.id) : null;
          const awayCoach = awayRevealed ? coachOf(fixture.awayTeam?.id) : null;

          return (
            <div
              key={pairIdx}
              className={`relative flex items-center gap-3 short:gap-2 rounded-xl border px-4 short:px-3 py-3 short:py-2 transition-all duration-300 ${
                isMyPair
                  ? "border-amber-500/60 bg-amber-950/30"
                  : "border-white/8 bg-white/4"
              }`}
            >
              {isMyPair && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 rounded-full text-[9px] font-black text-black uppercase tracking-widest whitespace-nowrap">
                  O seu jogo
                </span>
              )}

              {/* Home team */}
              <div
                className={`flex-1 flex items-center justify-end gap-2 transition-all duration-300 ${
                  homeRevealed ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="text-right min-w-0">
                  <span
                    className="block font-black text-xs truncate"
                    style={{
                      color: homeRevealed
                        ? teamNameColor(fixture.homeTeam)
                        : "transparent",
                    }}
                  >
                    {homeRevealed ? fixture.homeTeam?.name || "?" : "·····"}
                  </span>
                  {homeCoach && (
                    <span className="block text-[9px] text-amber-400 font-bold truncate">
                      {homeCoach}
                    </span>
                  )}
                </div>
                <TeamCrestIcon team={fixture.homeTeam} revealed={homeRevealed} />
              </div>

              {/* VS badge */}
              <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
                <span className="text-zinc-500 text-[9px] font-black uppercase">
                  vs
                </span>
              </div>

              {/* Away team */}
              <div
                className={`flex-1 flex items-center gap-2 transition-all duration-300 ${
                  awayRevealed ? "opacity-100" : "opacity-0"
                }`}
              >
                <TeamCrestIcon team={fixture.awayTeam} revealed={awayRevealed} />
                <div className="min-w-0">
                  <span
                    className="block font-black text-xs truncate"
                    style={{
                      color: awayRevealed
                        ? teamNameColor(fixture.awayTeam)
                        : "transparent",
                    }}
                  >
                    {awayRevealed ? fixture.awayTeam?.name || "?" : "·····"}
                  </span>
                  {awayCoach && (
                    <span className="block text-[9px] text-amber-400 font-bold truncate">
                      {awayCoach}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!fullyRevealed && (
          <div className="text-center py-3 col-span-full">
            <span className="animate-pulse text-primary text-xs font-black uppercase tracking-widest">
              A sortear…
            </span>
          </div>
        )}
      </div>

      {/* Continue button */}
      {cupDraw.humanInCup && fullyRevealed && (
        <div className="mt-6 short:mt-3 w-full max-w-xl shrink-0 pb-4 short:pb-2">
          <Button
            variant="primary"
            size="lg"
            full
            onClick={() => {
              setShowCupDrawPopup(false);
              socket.emit("cupDrawAcknowledged");
            }}
          >
            Continuar →
          </Button>
        </div>
      )}
    </ModalShell>
  );
}
