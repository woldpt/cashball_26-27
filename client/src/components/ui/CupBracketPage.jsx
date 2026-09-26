import { useState, useMemo, useEffect, startTransition } from "react";
import { readableColor } from "../../utils/colorHelpers.js";
import { TeamCrest } from "../shared/TeamCrest.jsx";
import { Panel } from "../shared/Panel.jsx";
import { TabBar } from "../shared/TabBar.jsx";

const ROUND_NAMES = [
  "",
  "16 avos de final",
  "Oitavos de final",
  "Quartos de final",
  "Meias-finais",
  "Final",
];
const ROUND_SHORT = ["", "16 avos", "Oitavos", "Quartos", "Meias", "Final"];

// ── Bracket layout constants (px) ──────────────────────────────────────────
const BK_CARD_H = 60;
const BK_CARD_W = 176;
const BK_GAP_W = 48;
const BK_SLOT_H = 84; // vertical slot per QF match
const BK_PAIR_GAP = 32; // extra gap between the two QF pairs

// Pre-computed vertical positions
const QF_TOPS = [
  0,
  BK_SLOT_H,
  BK_SLOT_H * 2 + BK_PAIR_GAP,
  BK_SLOT_H * 3 + BK_PAIR_GAP,
];
const SF_CENTERS = [
  (QF_TOPS[0] + BK_CARD_H / 2 + QF_TOPS[1] + BK_CARD_H / 2) / 2,
  (QF_TOPS[2] + BK_CARD_H / 2 + QF_TOPS[3] + BK_CARD_H / 2) / 2,
];
const SF_TOPS = SF_CENTERS.map((c) => c - BK_CARD_H / 2);
const FN_CENTER = (SF_CENTERS[0] + SF_CENTERS[1]) / 2;
const FN_TOP = FN_CENTER - BK_CARD_H / 2;
const BK_TOTAL_H = QF_TOPS[3] + BK_SLOT_H;

// Horizontal column positions
const QF_X = 0;
const SF_X = BK_CARD_W + BK_GAP_W;
const FN_X = (BK_CARD_W + BK_GAP_W) * 2;
const WN_X = FN_X + BK_CARD_W + 28;
const SVG_W = WN_X + 148;

// SVG connector mid-points
const MID_QF_SF = (BK_CARD_W + SF_X) / 2;
const MID_SF_FN = (SF_X + BK_CARD_W + FN_X) / 2;

// ── Helpers ─────────────────────────────────────────────────────────────────
function winnerOf(match) {
  if (!match?.played || !match.winnerId) return null;
  if (match.winnerId === match.homeTeam?.id) return match.homeTeam;
  if (match.winnerId === match.awayTeam?.id) return match.awayTeam;
  return null;
}

function connColor(match) {
  const w = winnerOf(match);
  return w?.color_primary || "#424843";
}

function connOpacity(match) {
  return match?.played ? 0.65 : 0.25;
}

// ── Team name as link to the team page (internal helper, not a component) ──
function TeamName({ team, onOpenTeam, fallback = "?", className = "", style }) {
  if (!team?.id || !onOpenTeam) {
    return (
      <span className={className} style={style}>
        {fallback}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpenTeam(team)}
      title={`Ver plantel — ${team.name}`}
      className={`${className} hover:underline`}
      style={style}
    >
      {team.name}
    </button>
  );
}

// ── Compact bracket team row (internal helper, not a component) ──────────────
function BracketTeamRow({ team, isWinner, played, score, onOpenTeam }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 transition-opacity ${
        played && !isWinner ? "opacity-30" : ""
      }`}
      style={{ height: BK_CARD_H / 2 - 1 }}
    >
      <TeamCrest team={team} size="w-[18px] h-[18px] text-[8px]" />
      <TeamName
        team={team}
        onOpenTeam={onOpenTeam}
        fallback={played ? "?" : "···"}
        className="flex-1 min-w-0 truncate text-left text-[10px] font-bold leading-none text-on-surface-variant"
        style={{ color: readableColor(team?.color_primary) }}
      />
      {played && (
        <span
          className={`text-[11px] font-black tabular-nums shrink-0 ${isWinner ? "text-on-surface" : "text-on-surface-variant/40"}`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ── Compact bracket card ─────────────────────────────────────────────────────
function BracketCard({ match, myTeamId, onOpenTeam }) {
  const {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    homeEtScore,
    awayEtScore,
    homePenalties,
    awayPenalties,
    winnerId,
    played,
  } = match || {};
  const homeWins = played && winnerId === homeTeam?.id;
  const awayWins = played && winnerId === awayTeam?.id;
  const isMyMatch =
    myTeamId && (homeTeam?.id === myTeamId || awayTeam?.id === myTeamId);
  const hasPens = played && (homePenalties > 0 || awayPenalties > 0);
  const finalHome = (homeScore || 0) + (homeEtScore || 0);
  const finalAway = (awayScore || 0) + (awayEtScore || 0);

  return (
    <div
      className={`rounded-md border overflow-hidden relative transition-all ${
        isMyMatch
          ? "border-primary/40 bg-primary/10"
          : "border-outline-variant/25 bg-surface-container-high"
      }`}
      style={{ width: BK_CARD_W, height: BK_CARD_H }}
    >
      <BracketTeamRow
        team={homeTeam}
        isWinner={homeWins}
        played={played}
        score={finalHome}
        onOpenTeam={onOpenTeam}
      />
      <div className="h-px bg-outline-variant/15 mx-2" />
      <BracketTeamRow
        team={awayTeam}
        isWinner={awayWins}
        played={played}
        score={finalAway}
        onOpenTeam={onOpenTeam}
      />
      {hasPens && (
        <div className="absolute top-0.5 right-1.5 text-[7px] text-amber-400/60 font-black uppercase tracking-wide">
          g.p.
        </div>
      )}
    </div>
  );
}

// ── Desktop bracket tree (rounds 3-5) ────────────────────────────────────────
function BracketTree({ rounds, myTeamId, onOpenTeam }) {
  const qf = useMemo(
    () => rounds.find((r) => r.round === 3)?.matches || [],
    [rounds],
  );
  const sf = useMemo(
    () => rounds.find((r) => r.round === 4)?.matches || [],
    [rounds],
  );
  const fn = useMemo(
    () => rounds.find((r) => r.round === 5)?.matches || [],
    [rounds],
  );

  if (!qf.length) return null;

  const winner = fn[0] ? winnerOf(fn[0]) : null;

  const qfsfLines = [
    {
      from: [BK_CARD_W, QF_TOPS[0] + BK_CARD_H / 2],
      to: [SF_X, SF_CENTERS[0]],
      m: qf[0],
    },
    {
      from: [BK_CARD_W, QF_TOPS[1] + BK_CARD_H / 2],
      to: [SF_X, SF_CENTERS[0]],
      m: qf[1],
    },
    {
      from: [BK_CARD_W, QF_TOPS[2] + BK_CARD_H / 2],
      to: [SF_X, SF_CENTERS[1]],
      m: qf[2],
    },
    {
      from: [BK_CARD_W, QF_TOPS[3] + BK_CARD_H / 2],
      to: [SF_X, SF_CENTERS[1]],
      m: qf[3],
    },
  ];
  const sffnLines = [
    {
      from: [SF_X + BK_CARD_W, SF_CENTERS[0]],
      to: [FN_X, FN_CENTER],
      m: sf[0],
    },
    {
      from: [SF_X + BK_CARD_W, SF_CENTERS[1]],
      to: [FN_X, FN_CENTER],
      m: sf[1],
    },
  ];

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="relative"
        style={{ width: SVG_W, height: BK_TOTAL_H + 20, paddingTop: 20 }}
      >
        {/* Column labels */}
        {[
          { label: "Quartos de final", x: QF_X },
          { label: "Meias-finais", x: SF_X },
          { label: "Final", x: FN_X },
        ].map(({ label, x }) => (
          <div
            key={label}
            className="absolute text-[8px] font-black uppercase tracking-widest text-on-surface-variant/30"
            style={{ left: x, top: 0 }}
          >
            {label}
          </div>
        ))}

        {/* SVG connector lines */}
        <svg
          className="absolute left-0 pointer-events-none"
          style={{ top: 20 }}
          width={SVG_W}
          height={BK_TOTAL_H}
        >
          {qfsfLines.map((l, i) => (
            <path
              key={`qf-${i}`}
              d={`M ${l.from[0]},${l.from[1]} H ${MID_QF_SF} V ${l.to[1]} H ${l.to[0]}`}
              fill="none"
              stroke={connColor(l.m)}
              strokeWidth="1.5"
              strokeOpacity={connOpacity(l.m)}
            />
          ))}
          {sf.length > 0 &&
            sffnLines.map((l, i) => (
              <path
                key={`sf-${i}`}
                d={`M ${l.from[0]},${l.from[1]} H ${MID_SF_FN} V ${l.to[1]} H ${l.to[0]}`}
                fill="none"
                stroke={connColor(l.m)}
                strokeWidth="1.5"
                strokeOpacity={connOpacity(l.m)}
              />
            ))}
        </svg>

        {/* QF cards */}
        {qf.slice(0, 4).map((m, i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: QF_X, top: 20 + QF_TOPS[i] }}
          >
            <BracketCard match={m} myTeamId={myTeamId} onOpenTeam={onOpenTeam} />
          </div>
        ))}

        {/* SF cards */}
        {sf.slice(0, 2).map((m, i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: SF_X, top: 20 + SF_TOPS[i] }}
          >
            <BracketCard match={m} myTeamId={myTeamId} onOpenTeam={onOpenTeam} />
          </div>
        ))}

        {/* Final card */}
        {fn.length > 0 && (
          <div className="absolute" style={{ left: FN_X, top: 20 + FN_TOP }}>
            <BracketCard match={fn[0]} myTeamId={myTeamId} onOpenTeam={onOpenTeam} />
          </div>
        )}

        {/* Champion display */}
        <div
          className="absolute flex flex-col items-center justify-center gap-2 text-center"
          style={{
            left: WN_X,
            top: 20 + FN_TOP - 28,
            width: 140,
            height: BK_CARD_H + 56,
          }}
        >
          {winner ? (
            <>
              <span
                className="material-symbols-outlined text-amber-400"
                style={{
                  fontSize: 30,
                  filter: "drop-shadow(0 0 8px rgba(245,158,11,0.6))",
                }}
              >
                emoji_events
              </span>
              <TeamCrest
                team={winner}
                size="w-9 h-9 text-sm"
                className="border-2 border-amber-500/50 shadow-lg shadow-amber-500/20"
              />
              <div>
                <TeamName
                  team={winner}
                  onOpenTeam={onOpenTeam}
                  className="text-left text-[10px] font-black"
                  style={{ color: readableColor(winner.color_primary) }}
                />
                <div className="text-[8px] text-amber-400/70 font-black uppercase tracking-wider">
                  Campeão
                </div>
              </div>
            </>
          ) : fn.length > 0 ? (
            <>
              <span
                className="material-symbols-outlined text-amber-400/30 animate-pulse"
                style={{ fontSize: 30 }}
              >
                emoji_events
              </span>
              <div className="text-[9px] text-on-surface-variant/30 font-bold uppercase tracking-wider animate-pulse">
                Por disputar
              </div>
            </>
          ) : (
            <span
              className="material-symbols-outlined text-amber-400/20"
              style={{ fontSize: 30 }}
            >
              emoji_events
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Full match row (list view) ────────────────────────────────────────────────
function MatchRow({ match, myTeamId, players, onOpenTeam }) {
  if (!match) return null;
  const {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    homeEtScore,
    awayEtScore,
    homePenalties,
    awayPenalties,
    winnerId,
    played,
  } = match;
  const homeWins = played && winnerId === homeTeam?.id;
  const awayWins = played && winnerId === awayTeam?.id;
  const isMyMatch =
    myTeamId && (homeTeam?.id === myTeamId || awayTeam?.id === myTeamId);
  const hasPens = played && (homePenalties > 0 || awayPenalties > 0);
  const hadET = played && (homeEtScore || 0) + (awayEtScore || 0) > 0;
  const finalHome = (homeScore || 0) + (homeEtScore || 0);
  const finalAway = (awayScore || 0) + (awayEtScore || 0);
  const homeCoach = players?.find((p) => p.teamId === homeTeam?.id)?.name;
  const awayCoach = players?.find((p) => p.teamId === awayTeam?.id)?.name;

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 rounded-md border border-outline-variant/25 bg-surface-container transition-all duration-200 hover:-translate-y-px hover:shadow-lg shadow-sm shadow-black/30 ${
        isMyMatch
          ? "border-primary/40 bg-primary/10"
          : ""
      }`}
    >
      {isMyMatch && (
        <span className="absolute -top-2 left-4 px-2 py-0.5 bg-amber-500 text-black text-[8px] font-black uppercase rounded-full tracking-widest">
          O seu jogo
        </span>
      )}

      {/* Home */}
      <div
        className={`flex-1 flex items-center justify-end gap-2 min-w-0 ${played && !homeWins ? "opacity-40" : ""}`}
      >
        <div className="text-right min-w-0">
          <TeamName
            team={homeTeam}
            onOpenTeam={onOpenTeam}
            className="block w-full text-right font-black text-xs truncate text-on-surface"
            style={{ color: readableColor(homeTeam?.color_primary) }}
          />
          {homeCoach && (
            <span className="block text-[9px] text-on-surface-variant/60 font-bold truncate">
              {homeCoach}
            </span>
          )}
        </div>
        <div
          className="shrink-0 rounded-full"
          style={
            played && homeWins
              ? { boxShadow: `0 0 8px ${homeTeam?.color_primary}50` }
              : undefined
          }
        >
          <TeamCrest team={homeTeam} size="w-8 h-8 text-xs" />
        </div>
      </div>

      {/* Score / VS */}
      <div className="shrink-0 flex flex-col items-center gap-0.5">
        {played ? (
          <>
            <span className="font-black text-sm text-on-surface tabular-nums">
              {finalHome} – {finalAway}
            </span>
            {hadET && !hasPens && (
              <span className="text-[8px] text-on-surface-variant/50 font-bold uppercase tracking-wide">
                p.e.
              </span>
            )}
            {hasPens && (
              <span className="text-[8px] text-amber-400/70 font-bold">
                (g.p. {homePenalties}–{awayPenalties})
              </span>
            )}
          </>
        ) : (
          <span className="text-xs font-black text-on-surface-variant/25 animate-pulse">
            vs
          </span>
        )}
      </div>

      {/* Away */}
      <div
        className={`flex-1 flex items-center gap-2 min-w-0 ${played && !awayWins ? "opacity-40" : ""}`}
      >
        <div
          className="shrink-0 rounded-full"
          style={
            played && awayWins
              ? { boxShadow: `0 0 8px ${awayTeam?.color_primary}50` }
              : undefined
          }
        >
          <TeamCrest team={awayTeam} size="w-8 h-8 text-xs" />
        </div>
        <div className="min-w-0">
          <TeamName
            team={awayTeam}
            onOpenTeam={onOpenTeam}
            className="block w-full text-left font-black text-xs truncate text-on-surface"
            style={{ color: readableColor(awayTeam?.color_primary) }}
          />
          {awayCoach && (
            <span className="block text-[9px] text-on-surface-variant/60 font-bold truncate">
              {awayCoach}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export function CupBracketPage({
  bracketData,
  me,
  players,
  onRequestRefresh,
  onOpenTeamSquad,
}) {
  const rounds = useMemo(() => bracketData?.rounds || [], [bracketData]);

  // Most advanced round with match data
  const activeRound = useMemo(() => {
    for (let r = 5; r >= 1; r--) {
      if (rounds.find((rd) => rd.round === r)?.matches?.length > 0) return r;
    }
    return 1;
  }, [rounds]);

  const [selectedRound, setSelectedRound] = useState(null);

  useEffect(() => {
    if (bracketData) startTransition(() => setSelectedRound(activeRound));
  }, [bracketData, activeRound]);

  const currentRound = selectedRound ?? activeRound;
  const currentRoundData = rounds.find((r) => r.round === currentRound);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!bracketData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span
          className="material-symbols-outlined text-amber-400/30 animate-pulse"
          style={{ fontSize: 48 }}
        >
          emoji_events
        </span>
        <p className="text-on-surface-variant/40 font-bold text-sm">
          A carregar…
        </p>
        <button
          onClick={onRequestRefresh}
          className="text-xs text-primary/50 hover:text-primary transition-colors font-bold"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── No data ────────────────────────────────────────────────────────────────
  if (!rounds.length || !rounds.some((r) => r.matches?.length > 0)) {
    return (
      <div className="bg-surface-container rounded-md border border-outline-variant/20 p-10 text-center">
        <span
          className="material-symbols-outlined text-amber-400/20 block mb-3"
          style={{ fontSize: 48 }}
        >
          emoji_events
        </span>
        <p className="text-on-surface-variant/60 font-bold text-sm">
          A Taça de Portugal ainda não começou esta época.
        </p>
      </div>
    );
  }

  // Progress stat
  const totalRounds = 5;
  const completedRounds = rounds.filter(
    (r) => r.matches?.length > 0 && r.matches.every((m) => m.played),
  ).length;
  const champion = (() => {
    const fn = rounds.find((r) => r.round === 5);
    return fn ? winnerOf(fn.matches?.[0]) : null;
  })();
  const hasQF = (rounds.find((r) => r.round === 3)?.matches?.length || 0) > 0;

  return (
    <div className="space-y-5">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <Panel
        icon="emoji_events"
        title="Árvore de Knockout"
        meta={`Taça de Portugal · Temporada ${bracketData.season}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            {champion ? (
              <>
                <TeamCrest team={champion} size="w-5 h-5 text-[9px]" />
                <TeamName
                  team={champion}
                  onOpenTeam={onOpenTeamSquad}
                  className="text-left text-[9px] font-black uppercase tracking-wider"
                  style={{ color: readableColor(champion.color_primary) }}
                />
                <span className="text-[8px] text-amber-400/60 font-bold">
                  Campeão
                </span>
              </>
            ) : (
              <span className="text-[9px] text-on-surface-variant/40 font-bold uppercase tracking-wider">
                Em curso
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i < completedRounds
                    ? "bg-amber-400 w-2 h-2"
                    : i === completedRounds
                      ? "bg-amber-400/40 w-2 h-2 animate-pulse"
                      : "bg-outline-variant/30 w-1.5 h-1.5"
                }`}
              />
            ))}
          </div>
        </div>
      </Panel>

      {/* ── ROUND TABS ──────────────────────────────────────────────────────── */}
      <TabBar
        tabs={[1, 2, 3, 4, 5].map((r) => {
          const rd = rounds.find((x) => x.round === r);
          const hasData = (rd?.matches?.length || 0) > 0;
          const allPlayed = hasData && rd.matches.every((m) => m.played);
          return {
            key: String(r),
            label: (
              <span className="inline-flex items-center gap-1">
                {allPlayed && currentRound !== r && (
                  <span className="material-symbols-outlined text-[10px] leading-none text-primary/60">
                    check
                  </span>
                )}
                {ROUND_SHORT[r]}
              </span>
            ),
          };
        })}
        active={String(currentRound)}
        onChange={(k) => {
          const n = Number(k);
          if ((rounds.find((x) => x.round === n)?.matches?.length || 0) > 0) {
            setSelectedRound(n);
          }
        }}
        disabledKeys={[1, 2, 3, 4, 5]
          .filter(
            (r) => (rounds.find((x) => x.round === r)?.matches?.length || 0) === 0,
          )
          .map(String)}
        className="overflow-x-auto hide-scrollbar [&>button]:shrink-0"
      />

      {/* ── DESKTOP BRACKET TREE (rounds 3-5 only) ──────────────────────────── */}
      {currentRound >= 3 && hasQF && (
        <div className="hidden lg:block">
          <div className="bg-surface-container rounded-md border border-outline-variant/15 px-6 pt-3 pb-6">
            <BracketTree
              rounds={rounds}
              myTeamId={me?.teamId}
              onOpenTeam={onOpenTeamSquad}
            />
          </div>
        </div>
      )}

      {/* ── MATCH LIST ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 px-1 mb-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40">
            {ROUND_NAMES[currentRound]}
          </span>
          <div className="flex-1 h-px bg-outline-variant/15" />
          {currentRoundData && (
            <span className="text-[9px] text-on-surface-variant/30 font-bold shrink-0">
              {currentRoundData.matches.filter((m) => m.played).length} /{" "}
              {currentRoundData.matches.length} jogados
            </span>
          )}
        </div>

        {(currentRoundData?.matches || []).map((match, i) => (
          <MatchRow
            key={match.id ?? i}
            match={match}
            myTeamId={me?.teamId}
            players={players}
            onOpenTeam={onOpenTeamSquad}
          />
        ))}

        {!currentRoundData?.matches?.length && (
          <div className="bg-surface-container rounded-md py-8 text-center">
            <p className="text-on-surface-variant/50 text-sm font-bold">
              Sem jogos nesta ronda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
