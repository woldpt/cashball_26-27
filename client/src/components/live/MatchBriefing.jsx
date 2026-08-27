import { useTactics } from "../../contexts/TacticsContext.jsx";
import { useGame } from "../../contexts/GameContext.jsx";
import { TeamCrest } from "./TeamCrest.jsx";

/* ────────────────────────────────────────────────────────────────────────────
 * MatchBriefing — Fase 1 do pré-jogo.
 *
 * Mostra o resumo completo da jornada: manchete, contexto competitivo,
 * dificuldade estimada, estádio e ambiente, ameaças do adversário e a sua
 * formação provável. Termina com um CTA "Avançar para a Tática".
 * A fonte de verdade é o nextMatchSummary servido pelo servidor.
 *
 * Desktop (lg+): hero (manchete + dificuldade + CTA na mesma linha) seguido
 * de uma grelha de duas colunas (confronto + scouting). Ocupa toda a largura
 * e a altura útil da viewport (100dvh - header/paddings do GameLayout), com
 * os cards a esticar e as células centradas, sem barras de scroll no caso
 * normal. Mobile/tablet mantêm um fluxo vertical legível.
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
          className={`w-3.5 h-3.5 rounded-sm text-[7px] font-black flex items-center justify-center ${
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
    <span className="flex items-center gap-1.5 text-[11px] font-black tabular-nums leading-none">
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
    <div className="min-w-0 bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-2.5 py-1.5 lg:py-2.5 flex flex-col items-center justify-center text-center">
      <span className="text-[7px] uppercase tracking-widest text-gray-600 font-black mb-0.5 lg:mb-1">
        {label}
      </span>
      <div className="flex items-center justify-center gap-1.5 w-full">
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
 * Tile genérico da faixa de metadados (label pequeno + conteúdo compacto).
 * @param {{ label: string, children: import("react").ReactNode }} props
 * @returns {JSX.Element}
 */
function MetaTile({ label, children }) {
  return (
    <div className="min-w-0 bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-2.5 py-2 lg:py-3 flex flex-col items-center justify-center text-center">
      <span className="text-[7px] uppercase tracking-widest text-gray-600 font-black mb-1">
        {label}
      </span>
      <div className="w-full flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/**
 * Card de antevisão do próximo confronto — comparação direta das duas equipas,
 * forma recente, registo, força, confronto direto, jogador-perigo, odds,
 * árbitro e tempo, tudo numa faixa de metadados compacta.
 * As odds vêm calculadas pelo servidor (nextMatchSummary.odds) — a mesma fonte
 * usada no evento de apostas durante o jogo, para garantir valores idênticos.
 * @param {{ nextMatchSummary: Object, teamInfo: Object|null, onOpenTeamSquad?: (team: Object) => void }} props
 * @returns {JSX.Element|null}
 */
function NextMatchCard({ nextMatchSummary, teamInfo, onOpenTeamSquad }) {
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
  const myMorale = teamInfo?.morale ?? 50;
  const oppMorale = opp.morale ?? 50;

  // Qualidade média (comparativa de qualidade)
  const myAvg = teamInfo?.avgSkill ?? myTeam.avgSkill ?? null;
  const oppAvg = opp.avgSkill ?? null;

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
  const competition = s.isCup
    ? (s.cupRoundName ?? "Taça")
    : `Jornada ${s.matchweek}`;

  return (
    <div className="h-full flex flex-col bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
      {/* Cabeçalho: competição + venue */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a]">
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
      <div className="flex-1 px-4 py-3 lg:py-4 flex flex-col gap-2.5 lg:gap-3 lg:justify-evenly">
        {/* Hero VS — equipa do utilizador à esquerda em casa, à direita fora */}
        {(() => {
          const mySlotTeam = { ...teamInfo, ...myTeam };
          const slots = isHome
            ? [
                { team: mySlotTeam, name: myName, isMine: true },
                { team: opp, name: opp.name, isMine: false },
              ]
            : [
                { team: opp, name: opp.name, isMine: false },
                { team: mySlotTeam, name: myName, isMine: true },
              ];
          const renderSlot = (slot) => (
            <div key={slot.name} className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <TeamCrest team={slot.team} size="md" isMine={slot.isMine} />
              <button
                type="button"
                onClick={() => onOpenTeamSquad?.(slot.team)}
                className="text-xs font-black text-white truncate max-w-full hover:text-emerald-400 hover:underline transition-colors"
                title={`Ver plantel de ${slot.name}`}
              >
                {slot.name}
              </button>
              <span className="text-[9px] text-gray-600 font-bold">
                {slot.team?.position ? `${slot.team.position}º` : "—"}
              </span>
            </div>
          );
          return (
            <div className="flex items-center justify-between gap-2">
              {renderSlot(slots[0])}
              <span className="shrink-0 text-[10px] font-black text-gray-600 px-2 py-1 rounded-full border border-[#222] bg-[#161616]">
                VS
              </span>
              {renderSlot(slots[1])}
            </div>
          );
        })()}

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 lg:flex-1 lg:content-center">
          <CompareStat
            label="Posição"
            mine={s.team?.position ? `${s.team.position}º` : "—"}
            theirs={opp.position ? `${opp.position}º` : "—"}
          />
          <CompareStat
            label="Pontos"
            mine={isHome ? myPts : (opp.points ?? 0)}
            theirs={isHome ? (opp.points ?? 0) : myPts}
          />
          <CompareStat
            label="GM"
            mine={isHome ? myGF : (opp.goalsFor ?? 0)}
            theirs={isHome ? (opp.goalsFor ?? 0) : myGF}
          />
          <CompareStat
            label="GS"
            mine={isHome ? myGA : (opp.goalsAgainst ?? 0)}
            theirs={isHome ? (opp.goalsAgainst ?? 0) : myGA}
          />
          <CompareStat
            label="Moral"
            mine={isHome ? myMorale : oppMorale}
            theirs={isHome ? oppMorale : myMorale}
          />
          <CompareStat
            label="Qualidade"
            mine={isHome ? (myAvg ?? "—") : (oppAvg ?? "—")}
            theirs={isHome ? (oppAvg ?? "—") : (myAvg ?? "—")}
          />
        </div>

        {/* Faixa de metadados compacta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 lg:flex-1 lg:content-center">
          <MetaTile label="Forma recente">
            <div className="flex items-center justify-between gap-1 min-w-0">
              <button
                type="button"
                onClick={() => onOpenTeamSquad?.(teamInfo ?? myTeam)}
                className="text-[9px] font-black text-white truncate hover:text-emerald-400 hover:underline transition-colors"
              >
                {myName}
              </button>
              <FormChips last5={myTeam.last5} />
            </div>
            <div className="flex items-center justify-between gap-1 min-w-0 mt-1">
              <button
                type="button"
                onClick={() => onOpenTeamSquad?.(opp)}
                className="text-[9px] font-black text-gray-400 truncate hover:text-emerald-400 hover:underline transition-colors"
              >
                {opp.name}
              </button>
              <FormChips last5={opp.last5} />
            </div>
          </MetaTile>

          <MetaTile label="Registo">
            <div className="flex items-center justify-between gap-1.5">
              {isHome ? (
                <>
                  <RecordText
                    v={teamInfo?.wins ?? myTeam.wins ?? 0}
                    e={teamInfo?.draws ?? myTeam.draws ?? 0}
                    d={teamInfo?.losses ?? myTeam.losses ?? 0}
                  />
                  <span className="w-px h-4 bg-[#222]" />
                  <RecordText v={opp.wins ?? 0} e={opp.draws ?? 0} d={opp.losses ?? 0} />
                </>
              ) : (
                <>
                  <RecordText v={opp.wins ?? 0} e={opp.draws ?? 0} d={opp.losses ?? 0} />
                  <span className="w-px h-4 bg-[#222]" />
                  <RecordText
                    v={teamInfo?.wins ?? myTeam.wins ?? 0}
                    e={teamInfo?.draws ?? myTeam.draws ?? 0}
                    d={teamInfo?.losses ?? myTeam.losses ?? 0}
                  />
                </>
              )}
            </div>
          </MetaTile>

          <MetaTile label="Último confronto">
            {lcView ? (
              <>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base font-black text-white tabular-nums leading-none">
                    {lcView.score}
                  </span>
                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${lcView.labelClass}`}
                  >
                    {lcView.label}
                  </span>
                </div>
                <span className="block text-[8px] text-gray-600 uppercase font-bold truncate mt-1">
                  {lcView.venue} · {lcView.comp}
                  {lcView.season ? ` · Época ${lcView.season}` : ""}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-gray-700 font-bold italic">
                Sem histórico
              </span>
            )}
          </MetaTile>

          <MetaTile label="Apostas">
            <div className="flex gap-1">
              {oddsList.map((o, i) => (
                <div
                  key={o.key}
                  className={`flex-1 ${o.bg} rounded-md px-1 py-1 flex flex-col items-center gap-0.5 min-w-0`}
                >
                  <span className="text-[7px] text-gray-600 font-black uppercase truncate max-w-full">
                    {o.label}
                  </span>
                  <span className={`text-[12px] font-black tabular-nums ${o.color}`}>
                    {o.value}
                  </span>
                  {probs[i] != null && (
                    <span className="text-[7px] font-black tabular-nums text-gray-500">
                      {probs[i]}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </MetaTile>

          {ref && (
            <MetaTile label="Árbitro">
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
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[7px] font-black text-gray-500 tabular-nums">
                  {ref.balance}%
                </span>
                <span
                  className={`text-[7px] font-black uppercase ${refFavoursMe ? "text-green-400" : "text-red-400"}`}
                >
                  {refFavoursMe ? "Favorece-te" : "Contra ti"}
                </span>
              </div>
            </MetaTile>
          )}

          {wf && (
            <MetaTile label="Tempo">
              <span className="block text-center text-base leading-none">
                {wf.emoji}
              </span>
              <span className="block text-center text-[8px] text-gray-500 font-bold mt-0.5">
                {weatherLabel}
              </span>
            </MetaTile>
          )}
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
            className={`h-1.5 lg:h-2.5 flex-1 rounded-full transition-all duration-300 ${
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
    <div className="min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl px-3.5 py-2 lg:flex-none lg:flex lg:flex-col lg:justify-center">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-widest text-gray-600 font-black">
          🏟️ Estádio
        </span>
        <span className="text-[8px] font-black text-green-400 tabular-nums">
          +{(stadium.revenue ?? 0).toLocaleString("pt-PT")}€
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-base lg:text-lg font-black text-white tabular-nums leading-none">
          {att.toLocaleString("pt-PT")}
        </span>
        <span className="text-[8px] text-gray-600 font-bold uppercase">
          espectadores
        </span>
        <span className="ml-auto text-[8px] text-gray-600 tabular-nums">
          Cap. {cap.toLocaleString("pt-PT")}
        </span>
      </div>
      <div className="mt-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600"
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Mini-campo com a formação provável do adversário (altura fixa para não
 * crescer com a largura da viewport).
 * @param {{ formation?: { formation?: string, players?: Array<{ name: string, position: string, skill: number, isJunior?: boolean }> } | null }} props
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
    <div className="min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden lg:flex-1 lg:flex lg:flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] lg:shrink-0">
        <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
          🔎 Formação provável
        </span>
        <span className="text-[10px] font-black text-white tabular-nums">
          {formation.formation}
        </span>
      </div>
      <div
        className="relative w-full h-56 lg:h-auto lg:flex-1 lg:min-h-[240px]"
        style={{
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
                const isJunior = p.isJunior === true;
                return (
                  <div key={`${p.name}-${i}`} className="flex flex-col items-center">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-[10px]"
                      title={isJunior ? "Júnior" : p.name}
                      style={{
                        background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.28) 0%, transparent 65%), ${style.hex}`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(255,255,255,0.12)",
                      }}
                    >
                      {isJunior ? "JR" : (p.name?.charAt(0)?.toUpperCase() ?? "?")}
                    </div>
                    <span
                      className="mt-0.5 text-[7px] font-bold leading-none text-white/80"
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95)" }}
                    >
                      {isJunior ? "Júnior" : (p.skill ?? "")}
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
    <div className="min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden lg:flex-none lg:flex lg:flex-col">
      <div className="px-4 py-1.5 border-b border-[#1a1a1a]">
        <span className="text-[9px] uppercase tracking-widest text-gray-600 font-black">
          ⚠️ Ameaças do adversário
        </span>
      </div>
      <div className="px-3 py-2 flex flex-col gap-1.5">
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
              className="min-w-0 bg-[#161616]/60 border border-[#1e1e1e] rounded-xl px-2.5 py-2 flex items-center gap-2"
            >
              <span className="shrink-0 text-[7px] uppercase tracking-widest text-gray-600 font-black">
                {meta.icon} {meta.label}
              </span>
              <span className="flex-1 min-w-0 text-[11px] font-black text-white break-words">
                {t.name}
              </span>
              <span className="shrink-0 text-[9px] font-black tabular-nums text-amber-400">
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
 *
 * Desktop: hero compacto na mesma linha + grelha de duas colunas
 * (confronto à esquerda, scouting à direita) para caber sem scroll.
 * Mobile: fluxo vertical.
 * @returns {JSX.Element|null}
 */
export function MatchBriefing() {
  const { nextMatchSummary, teamInfo, setPrepPhase } = useTactics();
  const { handleOpenTeamSquad } = useGame();
  if (!nextMatchSummary) return null;

  const s = nextMatchSummary;
  const opponent = s.opponent;

  return (
    <div className="space-y-3 lg:space-y-0 lg:flex lg:flex-col lg:gap-4 lg:min-h-[max(540px,calc(100dvh-9.5rem))]">
      {/* Header: manchete + contexto + dificuldade + CTA */}
      <div className="lg:shrink-0 bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 lg:py-3 border-b border-[#1a1a1a]">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
            📋 Briefing da Jornada
          </span>
          <span className="text-[9px] uppercase tracking-widest text-gray-700 font-bold">
            {s.isCup
              ? (s.cupRoundName ?? "Taça")
              : `Jornada ${s.matchweek}`}
          </span>
        </div>
        <div className="px-4 py-3 lg:py-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-sm lg:text-base font-bold text-white leading-snug line-clamp-2">
              {s.headline ?? "Tudo em aberto nesta jornada."}
            </p>
            {s.stakes && (
              <span className="mt-1.5 lg:mt-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-[#222] text-gray-300">
                🎯 {s.stakes}
              </span>
            )}
          </div>
          <div className="lg:w-44 shrink-0">
            <DifficultyGauge score={s.difficulty?.score} label={s.difficulty?.label} />
          </div>
          <div className="hidden lg:block w-px self-stretch bg-[#222]" />
          <button
            onClick={() => setPrepPhase("tactics")}
            className={`group w-full lg:w-60 shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 lg:py-3.5 font-black text-xs lg:text-sm uppercase tracking-widest text-green-950 transition-all duration-200 active:scale-95 hover:scale-[1.02] border border-emerald-300/40 shadow-[0_10px_30px_-8px_rgba(34,197,94,0.55)] hover:shadow-[0_14px_40px_-8px_rgba(34,197,94,0.75)]`}
            style={{
              background:
                "linear-gradient(135deg, #86efac 0%, #4ade80 30%, #22c55e 60%, #16a34a 100%)",
            }}
          >
            <span>Avançar para a Tática</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>

      {/* Confronto + scouting */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:flex-1">
        {opponent && (
          <div className="flex-1 min-w-0 lg:flex lg:flex-col">
            <NextMatchCard
              nextMatchSummary={nextMatchSummary}
              teamInfo={teamInfo}
              onOpenTeamSquad={handleOpenTeamSquad}
            />
          </div>
        )}
        <div className="lg:w-72 shrink-0 flex flex-col gap-3 lg:h-full">
          {s.stadium ? (
            <StadiumCard stadium={s.stadium} />
          ) : opponent ? (
            <div className="min-w-0 bg-[#111] border border-[#1e1e1e] rounded-2xl px-4 py-2.5 flex items-center justify-between lg:flex-none">
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
          <ThreatGrid threats={opponent?.threats} />
        </div>
      </div>
    </div>
  );
}
