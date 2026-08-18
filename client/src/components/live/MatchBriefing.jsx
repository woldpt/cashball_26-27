import { useTactics } from "../../contexts/TacticsContext.jsx";
import { TeamCrest } from "./TeamCrest.jsx";

/* ────────────────────────────────────────────────────────────────────────────
 * MatchBriefing — Fase 1 do pré-jogo.
 *
 * Mostra o resumo completo da jornada: manchete, contexto competitivo,
 * dificuldade estimada, estádio e ambiente, ameaças do adversário e a sua
 * formação provável. Termina com um CTA "Avançar para a Tática".
 * A fonte de verdade é o nextMatchSummary servido pelo servidor.
 */

const WEATHER_LABELS = {
  sol: "Sol",
  chuva: "Chuva",
  vento: "Vento",
  chuva_forte: "Tempestade",
  frio: "Frio",
  nevoeiro: "Nevoeiro",
  neve: "Neve",
};

/** Cores por posição (ecrã do briefing) */
const POS_STYLES = {
  GR: { hex: "#eab308", label: "GR" },
  DEF: { hex: "#3b82f6", label: "DEF" },
  MED: { hex: "#10b981", label: "MED" },
  ATA: { hex: "#f43f5e", label: "ATA" },
};

/**
 * Chips de forma recente (V/E/D) de uma equipa.
 * @param {{ last5?: string }} props
 * @returns {JSX.Element}
 */
function FormChips({ last5 = "" }) {
  if (!last5) return <span className="text-[9px] text-gray-700 font-bold">—</span>;
  return (
    <div className="flex gap-0.5 shrink-0">
      {last5.split("").map((r, i) => (
        <span
          key={i}
          className={`w-4 h-4 rounded-sm text-[8px] font-black flex items-center justify-center ${
            r === "V"
              ? "bg-green-500/20 text-green-400"
              : r === "D"
                ? "bg-red-500/20 text-red-400"
                : "bg-gray-700/40 text-gray-500"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

/**
 * Registo V/E/D a duas cores (vitórias verdes, derrotas vermelhas).
 * @param {{ v: number, e: number, d: number }} props
 * @returns {JSX.Element}
 */
function RecordText({ v, e, d }) {
  return (
    <span className="flex items-center gap-2 text-[13px] font-black tabular-nums leading-none">
      <span className="text-green-400">{v}</span>
      <span className="text-gray-300">{e}</span>
      <span className="text-red-400">{d}</span>
    </span>
  );
}

/**
 * Tile comparativo "eu vs adversário" — valor da esquerda (tu) e da direita (adv).
 * @param {{ label: string, mine: import("react").ReactNode, theirs: import("react").ReactNode }} props
 * @returns {JSX.Element}
 */
function CompareStat({ label, mine, theirs }) {
  return (
    <div className="min-w-0 bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-2.5 py-2">
      <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black mb-1">
        {label}
      </span>
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-sm font-black tabular-nums text-white leading-none truncate">
          {mine}
        </span>
        <span className="w-px h-4 bg-[#222] shrink-0" />
        <span className="text-sm font-black tabular-nums text-gray-400 leading-none truncate">
          {theirs}
        </span>
      </div>
    </div>
  );
}

/**
 * Card de antevisão do próximo confronto — comparação direta das duas equipas,
 * forma recente, confronto direto, jogador-perigo, odds, árbitro e tempo.
 * As odds vêm calculadas pelo servidor (nextMatchSummary.odds) — a mesma fonte
 * usada no evento de apostas durante o jogo, para garantir valores idênticos.
 * @param {{ nextMatchSummary: Object, teamInfo: Object|null }} props
 * @returns {JSX.Element|null}
 */
function NextMatchCard({ nextMatchSummary, teamInfo }) {
  if (!nextMatchSummary || !nextMatchSummary.opponent) return null;
  const s = nextMatchSummary;
  const opp = s.opponent;
  const myTeam = s.team ?? {};
  const isHome = s.venue === "Casa";
  const myName = teamInfo?.name ?? s.team?.name ?? "A minha equipa";

  // Pontos + diferença
  const myPts = teamInfo?.points ?? myTeam.points ?? 0;
  const ptsDiff = myPts - (opp.points ?? 0);
  const ptsDiffColor =
    ptsDiff > 0
      ? "text-green-400"
      : ptsDiff < 0
        ? "text-red-400"
        : "text-gray-500";

  // Golos e moral
  const myGF = teamInfo?.goals_for ?? 0;
  const myGA = teamInfo?.goals_against ?? 0;
  const myMorale = teamInfo?.morale ?? 75;
  const oppMorale = opp.morale ?? 75;

  // Qualidade média (força da equipa) — barra comparativa
  const myAvg = teamInfo?.avgSkill ?? myTeam.avgSkill ?? null;
  const oppAvg = opp.avgSkill ?? null;
  const maxAvg = Math.max(myAvg ?? 0, oppAvg ?? 0, 1);

  // Último confronto — dados normalizados vindos do servidor
  const lc = opp.lastConfrontation;
  const lcView = lc
    ? (() => {
        const label =
          lc.result === "V"
            ? "Vitória"
            : lc.result === "D"
              ? "Derrota"
              : "Empate";
        const labelClass =
          lc.result === "V"
            ? "bg-green-500/15 text-green-400"
            : lc.result === "D"
              ? "bg-red-500/15 text-red-400"
              : "bg-gray-700/30 text-gray-500";
        const comp =
          lc.competition === "cup"
            ? (lc.cupRoundName ?? "Taça")
            : `Liga · J${lc.matchweek}`;
        let score = `${lc.goalsFor}–${lc.goalsAgainst}`;
        if (lc.penalties)
          score += ` (g.p. ${lc.penalties.goalsFor}–${lc.penalties.goalsAgainst})`;
        else if (lc.extraTime) score += " (pro.)";
        return { label, labelClass, comp, score, venue: lc.venue, season: lc.season };
      })()
    : null;

  // Odds + probabilidade implícita
  const odds = s.odds ?? { home: "—", draw: "—", away: "—" };
  const homeTeamName = isHome ? (s.team?.name ?? "Casa") : (opp.name ?? "Visitado");
  const awayTeamName = isHome ? (opp.name ?? "Visitante") : (s.team?.name ?? "Visitante");
  const oddsList = [
    { key: "home", label: homeTeamName, value: odds.home, color: "text-sky-400", bg: "bg-sky-500/10" },
    { key: "draw", label: "Empate", value: odds.draw, color: "text-gray-300", bg: "bg-gray-700/20" },
    { key: "away", label: awayTeamName, value: odds.away, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];
  const numOdds = oddsList.map((o) => {
    const n = Number.parseFloat(o.value);
    return Number.isFinite(n) && n > 1 ? n : null;
  });
  const invSum = numOdds.reduce((acc, n) => acc + (n ? 1 / n : 0), 0);
  const probs = numOdds.map((n) =>
    n && invSum ? Math.round((1 / n / invSum) * 100) : null,
  );

  // Árbitro — balance favorece a equipa do utilizador (favorsTeamA)
  const ref = s.referee;
  const refFavoursMe = ref?.favorsTeamA ?? true;

  // Tempo
  const wf = s.weatherForecast;
  const weatherLabel = wf
    ? (WEATHER_LABELS[wf.condition] ?? wf.condition)
    : null;

  const h2h = opp.h2hRecord;

  const competition = s.isCup
    ? (s.cupRoundName ?? "Taça")
    : `Jornada ${s.matchweek}`;

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
      {/* Cabeçalho: competição + venue */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          {s.isCup ? (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              🏆 Taça
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500">
              ⚽ Liga
            </span>
          )}
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
            {competition}
          </span>
        </div>
        <span
          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${s.venue === "Jamor" ? "bg-amber-500/15 text-amber-400" : isHome ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}
        >
          {s.venue === "Jamor" ? "🏟️ Jamor" : isHome ? "Casa" : "Fora"}
        </span>
      </div>

      {/* Corpo */}
      <div className="px-4 py-3 flex flex-col md:flex-row gap-3">
        {/* ── Coluna principal: comparação ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          {/* Hero VS */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <TeamCrest team={teamInfo ?? { name: myName }} size="md" isMine />
              <span className="text-xs font-black text-white truncate max-w-full">
                {myName}
              </span>
              <span className="text-[9px] text-gray-600 font-bold">
                {s.team?.position ? `${s.team.position}º` : "—"}
              </span>
            </div>
            <span className="shrink-0 text-[10px] font-black text-gray-600 px-2 py-1 rounded-full border border-[#222] bg-[#161616]">
              VS
            </span>
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <TeamCrest team={opp} size="md" />
              <span className="text-xs font-black text-white truncate max-w-full">
                {opp.name}
              </span>
              <span className="text-[9px] text-gray-600 font-bold">
                {opp.position ? `${opp.position}º` : "—"}
              </span>
            </div>
          </div>

          {/* Grelha de stats comparativos */}
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-widest text-gray-600 font-black">
              Tu vs Adversário
            </span>
            {ptsDiff !== 0 && (
              <span className={`text-[9px] font-black tabular-nums ${ptsDiffColor}`}>
                {ptsDiff > 0 ? "▲" : "▼"} {Math.abs(ptsDiff)} pts
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
            <CompareStat
              label="Posição"
              mine={s.team?.position ? `${s.team.position}º` : "—"}
              theirs={opp.position ? `${opp.position}º` : "—"}
            />
            <CompareStat label="Pontos" mine={myPts} theirs={opp.points ?? 0} />
            <CompareStat label="GM" mine={myGF} theirs={opp.goalsFor ?? 0} />
            <CompareStat label="GS" mine={myGA} theirs={opp.goalsAgainst ?? 0} />
            <CompareStat
              label="Moral"
              mine={myMorale}
              theirs={oppMorale}
            />
            <CompareStat
              label="Qualidade"
              mine={myAvg ?? "—"}
              theirs={oppAvg ?? "—"}
            />
          </div>

          {/* Registo V/E/D */}
          <div className="bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2">
            <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black mb-1.5">
              Registo
            </span>
            <div className="flex items-center justify-between gap-2">
              <RecordText
                v={teamInfo?.wins ?? myTeam.wins ?? 0}
                e={teamInfo?.draws ?? myTeam.draws ?? 0}
                d={teamInfo?.losses ?? myTeam.losses ?? 0}
              />
              <span className="text-[8px] text-gray-700 font-black uppercase tracking-widest">
                V · E · D
              </span>
              <RecordText
                v={opp.wins ?? 0}
                e={opp.draws ?? 0}
                d={opp.losses ?? 0}
              />
            </div>
          </div>

          {/* Força da equipa (qualidade média) */}
          {myAvg != null && oppAvg != null && (
            <div className="bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[7px] uppercase tracking-widest text-gray-600 font-black">
                  Força da equipa
                </span>
                <span className="text-[9px] font-black tabular-nums text-gray-400">
                  <span className="text-white">{myAvg}</span>
                  <span className="text-gray-700"> vs </span>
                  <span>{oppAvg}</span>
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden flex">
                <div
                  className="h-full rounded-l-full"
                  style={{
                    width: `${(myAvg / maxAvg) * 50}%`,
                    background: "linear-gradient(90deg,#4ade80,#22c55e)",
                  }}
                />
                <div className="h-full flex-1" style={{ width: `${50 - (myAvg / maxAvg) * 50}%` }} />
                <div
                  className="h-full rounded-r-full"
                  style={{
                    width: `${(oppAvg / maxAvg) * 50}%`,
                    background: opp.color_primary || "#f43f5e",
                    opacity: 0.85,
                  }}
                />
                <div className="h-full flex-1" style={{ width: `${50 - (oppAvg / maxAvg) * 50}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Coluna lateral: scouting ── */}
        <div className="md:w-72 shrink-0 flex flex-col gap-2.5">
          {/* Forma recente */}
          <div className="bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2 space-y-1.5">
            <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black">
              Forma recente
            </span>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[9px] font-black text-white truncate">
                {myName}
              </span>
              <FormChips last5={myTeam.last5} />
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[9px] font-black text-gray-400 truncate">
                {opp.name}
              </span>
              <FormChips last5={opp.last5} />
            </div>
          </div>

          {/* Jogador-perigo + confronto direto */}
          {(opp.topScorer || (h2h && h2h.total > 0)) && (
            <div className="bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2 space-y-2">
              {opp.topScorer && (
                <div>
                  <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black mb-0.5">
                    Melhor marcador
                  </span>
                  <span className="text-[11px] font-black text-white">
                    ⚽ {opp.topScorer.name}
                  </span>
                  <span className="text-[10px] font-black text-amber-400 ml-1 tabular-nums">
                    ({opp.topScorer.goals})
                  </span>
                </div>
              )}
              {h2h && h2h.total > 0 && (
                <div>
                  <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black mb-0.5">
                    Confronto direto
                  </span>
                  <span className="text-[11px] font-black tabular-nums">
                    <span className="text-green-400">{h2h.wins}</span>
                    <span className="text-gray-700"> / </span>
                    <span className="text-gray-300">{h2h.draws}</span>
                    <span className="text-gray-700"> / </span>
                    <span className="text-red-400">{h2h.losses}</span>
                    <span className="text-gray-600 text-[9px] ml-1">
                      ({h2h.total} jogos)
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Último confronto */}
          <div className="bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2">
            <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black mb-1">
              Último confronto
            </span>
            {lcView ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-white tabular-nums leading-none">
                    {lcView.score}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${lcView.labelClass}`}
                  >
                    {lcView.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-[9px] text-gray-600 uppercase font-bold">
                    {lcView.venue}
                  </span>
                  <span className="text-[9px] text-gray-700">·</span>
                  <span className="text-[9px] text-gray-600 font-bold">
                    {lcView.comp}
                  </span>
                  {lcView.season && (
                    <>
                      <span className="text-[9px] text-gray-700">·</span>
                      <span className="text-[9px] text-gray-600">
                        Época {lcView.season}
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <span className="text-[10px] text-gray-700 font-bold italic">
                Sem histórico
              </span>
            )}
          </div>

          {/* Odds */}
          <div className="bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2">
            <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black mb-1.5">
              Apostas
            </span>
            <div className="flex gap-1.5">
              {oddsList.map((o, i) => (
                <div
                  key={o.key}
                  className={`flex-1 ${o.bg} rounded-lg px-1.5 py-1.5 flex flex-col items-center gap-0.5 min-w-0`}
                >
                  <span className="text-[8px] text-gray-600 font-black uppercase truncate max-w-full">
                    {o.label}
                  </span>
                  <span className={`text-[12px] font-black tabular-nums ${o.color}`}>
                    {o.value}
                  </span>
                  {probs[i] != null && (
                    <span className="text-[8px] font-black tabular-nums text-gray-500">
                      {probs[i]}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Árbitro + Tempo */}
          <div className="flex gap-2">
            {ref && (
              <div className="flex-1 min-w-0 bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2">
                <span className="block text-[7px] uppercase tracking-widest text-gray-600 font-black mb-0.5">
                  Árbitro
                </span>
                <span className="text-[10px] font-bold text-gray-400 truncate block">
                  {ref.name}
                </span>
                <div className="mt-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden relative">
                  <div
                    className="absolute inset-y-0 left-0 rounded-l-full"
                    style={{
                      width: `${ref.balance}%`,
                      background: teamInfo?.color_primary || "#16a34a",
                      opacity: 0.9,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 rounded-r-full"
                    style={{
                      width: `${100 - ref.balance}%`,
                      background: opp?.color_primary || "#dc2626",
                      opacity: 0.9,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[8px] font-black text-gray-500 tabular-nums">
                    {ref.balance}%
                  </span>
                  <span
                    className={`text-[8px] font-black uppercase ${refFavoursMe ? "text-green-400" : "text-red-400"}`}
                  >
                    {refFavoursMe ? "Favorece-te" : "Contra ti"}
                  </span>
                </div>
              </div>
            )}
            {wf && (
              <div className="shrink-0 flex flex-col items-center justify-center gap-0.5 bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-3 py-2">
                <span className="text-[7px] uppercase tracking-widest text-gray-600 font-black">
                  Tempo
                </span>
                <span className="text-xl leading-none">{wf.emoji}</span>
                <span className="text-[8px] text-gray-500 font-bold">
                  {weatherLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Medidor de dificuldade estimada — 5 segmentos + rótulo.
 * @param {{ score?: number, label?: string }} props
 * @returns {JSX.Element}
 */
function DifficultyGauge({ score = 50, label = "Equilibrado" }) {
  const filled = Math.max(0, Math.min(5, Math.round(((score ?? 50) / 100) * 5)));
  const theme =
    score <= 40
      ? { seg: "bg-gradient-to-b from-green-300 to-green-500", text: "text-green-400" }
      : score <= 62
        ? { seg: "bg-gradient-to-b from-amber-200 to-amber-500", text: "text-amber-400" }
        : score <= 80
          ? { seg: "bg-gradient-to-b from-orange-400 to-red-500", text: "text-orange-400" }
          : { seg: "bg-gradient-to-b from-red-500 to-red-700", text: "text-red-400" };
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[7px] uppercase tracking-widest text-gray-600 font-black">
          Dificuldade
        </span>
        <span className={`text-[9px] font-black uppercase ${theme.text}`}>
          {label}
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              i <= filled ? theme.seg : "bg-gray-700/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Estádio e ambiente — lotação esperada e receita potencial (jogos em casa).
 * @param {{ stadium?: { capacity?: number, expectedAttendance?: number, revenue?: number } | null }} props
 * @returns {JSX.Element|null}
 */
function StadiumCard({ stadium }) {
  if (!stadium) return null;
  const att = stadium.expectedAttendance ?? 0;
  const cap = stadium.capacity ?? 10000;
  const fill = cap > 0 ? Math.round((att / cap) * 100) : 0;
  return (
    <div className="flex-1 min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl px-4 py-3">
      <span className="block text-[9px] uppercase tracking-widest text-gray-600 font-black mb-2">
        🏟️ Estádio e ambiente
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-white tabular-nums leading-none">
          {att.toLocaleString("pt-PT")}
        </span>
        <span className="text-[9px] text-gray-600 font-bold uppercase">
          espectadores esperados
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600"
          style={{ width: `${fill}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-[9px] font-bold">
        <span className="text-gray-600 tabular-nums">Cap. {cap.toLocaleString("pt-PT")}</span>
        <span className="text-green-400 tabular-nums">
          +{(stadium.revenue ?? 0).toLocaleString("pt-PT")}€ receita
        </span>
      </div>
    </div>
  );
}

/**
 * Mini-campo com a formação provável do adversário.
 * @param {{ formation?: { formation?: string, players?: Array<{ name: string, position: string, skill: number }> } | null }} props
 * @returns {JSX.Element|null}
 */
function OpponentFormation({ formation }) {
  if (!formation || !formation.formation) return null;
  const players = formation.players ?? [];
  const rows = ["ATA", "MED", "DEF", "GR"].map((pos) =>
    players.filter((p) => p.position === pos),
  );
  const rowYs = ["10%", "32%", "57%", "78%"];
  return (
    <div className="flex-1 min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
          🔎 Formação provável
        </span>
        <span className="text-[10px] font-black text-white tabular-nums">
          {formation.formation}
        </span>
      </div>
      <div
        className="relative w-full"
        style={{
          aspectRatio: "16/10",
          background:
            "radial-gradient(ellipse at 50% 25%, #1f5c1a 0%, #123a0d 50%, #09200a 100%)",
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 16 10"
          preserveAspectRatio="none"
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="0.12"
        >
          <rect x="0.6" y="0.6" width="14.8" height="8.8" rx="0.08" />
          <line x1="0.6" y1="5" x2="15.4" y2="5" />
          <circle cx="8" cy="5" r="1.6" />
          <rect x="2.8" y="7.6" width="10.4" height="1.8" />
          <rect x="4.2" y="8.6" width="7.6" height="0.8" />
        </svg>
        {rows.map((rowPlayers, ri) =>
          rowPlayers.length > 0 ? (
            <div
              key={ri}
              className="absolute w-full flex justify-evenly items-start px-2"
              style={{ top: rowYs[ri] }}
            >
              {rowPlayers.map((p, i) => {
                const style = POS_STYLES[p.position] || { hex: "#6b7280" };
                return (
                  <div key={`${p.name}-${i}`} className="flex flex-col items-center">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-[10px]"
                      style={{
                        background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.28) 0%, transparent 65%), ${style.hex}`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.12)",
                      }}
                    >
                      {p.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <span
                      className="mt-0.5 text-[7px] font-bold leading-none text-white/80"
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95)" }}
                    >
                      {p.skill ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

/**
 * Ameaças do adversário — grelha com os jogadores-perigo.
 * @param {{ threats?: Array<{ role: string, name: string, skill: number|null, form: number|null, goals: number|null }> }} props
 * @returns {JSX.Element|null}
 */
function ThreatGrid({ threats }) {
  if (!threats || threats.length === 0) return null;
  const META = {
    goleador: { icon: "⚽", label: "Melhor marcador" },
    qualidade: { icon: "💎", label: "Maior qualidade" },
    forma: { icon: "🔥", label: "Em grande forma" },
  };
  return (
    <div className="flex-1 min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl px-4 py-3">
      <span className="block text-[9px] uppercase tracking-widest text-gray-600 font-black mb-2">
        ⚠️ Ameaças do adversário
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {threats.map((t) => {
          const meta = META[t.role] ?? { icon: "❗", label: t.role };
          const value =
            t.role === "goleador"
              ? `${t.goals} golos`
              : t.role === "forma"
                ? `Forma ${t.form ?? "—"}`
                : `Skill ${t.skill ?? "—"}`;
          return (
            <div
              key={t.role}
              className="bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-2.5 py-2"
            >
              <span className="text-[7px] uppercase tracking-widest text-gray-600 font-black">
                {meta.icon} {meta.label}
              </span>
              <span className="block text-[11px] font-black text-white truncate mt-0.5">
                {t.name}
              </span>
              <span className="text-[9px] font-black tabular-nums text-amber-400">
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Fase 1 do pré-jogo — Briefing da jornada.
 * @returns {JSX.Element|null}
 */
export function MatchBriefing() {
  const { nextMatchSummary, teamInfo, setPrepPhase } = useTactics();
  if (!nextMatchSummary) return null;

  const s = nextMatchSummary;
  const opponent = s.opponent;

  return (
    <div className="space-y-3">
      {/* Header: manchete + contexto + dificuldade + CTA */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            📋 Briefing da Jornada
          </span>
          <span className="text-[9px] uppercase tracking-widest text-gray-700 font-bold">
            {s.isCup
              ? (s.cupRoundName ?? "Taça")
              : `Jornada ${s.matchweek}`}
          </span>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          <p className="text-sm font-bold text-white leading-relaxed">
            {s.headline ?? "Tudo em aberto nesta jornada."}
          </p>
          {s.stakes && (
            <span className="inline-flex self-start items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 border border-[#222] text-gray-300">
              🎯 {s.stakes}
            </span>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="sm:w-52 shrink-0">
              <DifficultyGauge score={s.difficulty?.score} label={s.difficulty?.label} />
            </div>
            <button
              onClick={() => setPrepPhase("tactics")}
              className={`flex-1 py-3.5 font-black rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 text-green-950 shadow-xl shadow-green-500/20 hover:brightness-110`}
              style={{
                background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
              }}
            >
              Avançar para a Tática →
            </button>
          </div>
        </div>
      </div>

      {/* Antevisão completa */}
      {opponent && (
        <NextMatchCard nextMatchSummary={nextMatchSummary} teamInfo={teamInfo} />
      )}

      {/* Estádio + Formação provável */}
      <div className="flex flex-col md:flex-row gap-3">
        {s.stadium ? (
          <StadiumCard stadium={s.stadium} />
        ) : opponent ? (
          <div className="flex-1 min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-gray-600 font-black">
              🏟️ Estádio e ambiente
            </span>
            <span className="text-[11px] font-black text-white">
              {s.venue === "Jamor"
                ? "Neutro — Jamor"
                : s.venue === "Casa"
                  ? "Jogas em casa"
                  : "Jogas fora"}
            </span>
          </div>
        ) : null}
        {opponent?.probableFormation && (
          <OpponentFormation formation={opponent.probableFormation} />
        )}
      </div>

      {/* Ameaças */}
      <ThreatGrid threats={opponent?.threats} />
    </div>
  );
}
