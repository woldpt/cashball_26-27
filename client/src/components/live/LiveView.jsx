import { useCallback, useMemo, useState } from "react";
import { socket } from "../../socket.js";
import { useGame } from "../../contexts/GameContext.jsx";
import { DIVISION_NAMES } from "../../constants/index.js";
import { LiveMatchHero } from "./LiveMatchHero.jsx";
import { CupFinalStage } from "./CupFinalStage.jsx";
import { LiveFixtureRow } from "./LiveFixtureRow.jsx";
import { LivePitchStrip } from "./LivePitchStrip.jsx";
import { LiveStandingsPanel } from "./LiveStandings.jsx";
import { isDrawnAt90, liveScore } from "./liveHelpers.js";

/* ── LiveView — tab "live": a jornada a decorrer ─────────────────────────
 *
 * Linha 1: o meu jogo (hero) + classificação virtual ao lado.
 * Linha 2: a minha divisão aberta; as outras recolhidas (abertas se houver
 * treinador humano). Taça: hero + restantes jogos da ronda.
 * Quando o marcador do hero sai do ecrã, um marcador compacto fica preso ao
 * topo (o contentor é `overflow-clip`, que não quebra o `sticky`).
 */

const LEAGUE_DIVS = [1, 2, 3, 4];

/** Antepassado com scroll vertical (raiz do IntersectionObserver). */
function scrollParent(node) {
  let el = node.parentElement;
  while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
    el = el.parentElement;
  }
  return el;
}

/** @returns {JSX.Element|null} */
export function LiveView() {
  const {
    matchResults,
    matchAction,
    cupMatchRoundName,
    substitutionPause,
    liveMinute,
    isPlayingMatch,
    isMatchActionPending,
    isMatchInProgress,
    showHalftimePanel,
    isLiveSimulation,
    standingsStale,
    goalFlashRef,
    finalWhistle,
    teams,
    teamForms,
    players,
    me,
    myMatch,
    isCupMatch,
    isCupExtraTime,
    cupRoundResults,
    setShowMatchDetail,
    setMatchDetailFixture,
  } = useGame();

  // Marcador do hero fora do ecrã → marcador compacto preso ao topo.
  const [scoreHidden, setScoreHidden] = useState(false);
  const scoreRef = useCallback((node) => {
    if (!node) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setScoreHidden(!entry.isIntersecting),
      { root: scrollParent(node) },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      setScoreHidden(false);
    };
  }, []);

  // Set memorizado: o sortHumanFirst corre O(n log n) comparações por render.
  const humanTeamIds = useMemo(
    () => new Set(players.map((p) => p.teamId)),
    [players],
  );
  // MOM do meu jogo: a liga já traz `mom` no fixture final (matchResults);
  // na Taça o fixture (matchResults simplificado) não traz — procurar no
  // payload da ronda (cupRoundResults.results).
  const myMatchMom = useMemo(() => {
    if (myMatch?.mom) return myMatch.mom;
    if (!isCupMatch || !myMatch || !cupRoundResults?.results) return null;
    const row = cupRoundResults.results.find(
      (r) =>
        Number(r.homeTeamId) === Number(myMatch.homeTeamId) &&
        Number(r.awayTeamId) === Number(myMatch.awayTeamId),
    );
    return row?.mom || null;
  }, [myMatch, isCupMatch, cupRoundResults]);

  // Final da Taça: palco de gala quer participes quer não. Sem o teu jogo,
  // a fixture da final (results[0] — a final é sempre jogo único).
  // Quem joga um amigável nessa semana vê o seu jogo, não o palco.
  const isCupFinal =
    isCupMatch && cupMatchRoundName === "Final" && !myMatch?.isFriendly;
  const finalFixture = isCupFinal
    ? (myMatch ??
        matchResults?.results?.find((r) => !r.isFriendly) ??
        null)
    : null;
  // MOM da final (para o palco): a mesma lookup do teu jogo, mas sobre a
  // fixture da final — quando participas, coincide com myMatchMom.
  const finalMom = useMemo(() => {
    if (!isCupFinal || !finalFixture || !cupRoundResults?.results)
      return null;
    const row = cupRoundResults.results.find(
      (r) =>
        Number(r.homeTeamId) === Number(finalFixture.homeTeamId) &&
        Number(r.awayTeamId) === Number(finalFixture.awayTeamId),
    );
    return row?.mom || null;
  }, [isCupFinal, finalFixture, cupRoundResults]);

  if (!matchResults && !matchAction) return null;

  const results = matchResults?.results || [];
  const isHumanFixture = (m) =>
    humanTeamIds.has(m?.homeTeamId) || humanTeamIds.has(m?.awayTeamId);
  const sortHumanFirst = (a, b) =>
    Number(isHumanFixture(b)) - Number(isHumanFixture(a));
  const isMine = (m) =>
    m.homeTeamId === me.teamId || m.awayTeamId === me.teamId;
  const teamById = (id) => teams.find((t) => t.id === id);

  const openDetail = (fixture) => {
    // Intervalo (ou pausa antes do prolongamento): o painel de intervalo tem
    // prioridade e este detalhe reapareceria na 2.ª parte.
    if (showHalftimePanel) return;
    setMatchDetailFixture(fixture);
    setShowMatchDetail(true);
  };
  // Ação do meu jogo: substituições durante o jogo, detalhe fora dele.
  const onMyMatchAction = () => {
    if (isPlayingMatch && !isMatchActionPending) {
      socket.emit("request_substitution");
    } else {
      openDetail(myMatch);
    }
  };

  const renderRow = (match) => (
    <LiveFixtureRow
      key={`${match.homeTeamId}-${match.awayTeamId}`}
      match={match}
      teams={teams}
      players={players}
      liveMinute={liveMinute}
      goalFlashRef={goalFlashRef}
      isPlayingMatch={isPlayingMatch}
      onOpenDetail={() => openDetail(match)}
    />
  );

  // O hero esconde-se quando o meu jogo acabou aos 90' e outros vão a prolongamento.
  const heroShown =
    !!matchResults && !!myMatch && !(isCupExtraTime && !isDrawnAt90(myMatch));
  const myDiv = teamById(me.teamId)?.division;
  const showStandings = !isCupMatch && results.length > 0;
  const sideColumn = showStandings;

  return (
    <div
      className={`bg-surface-container text-on-surface font-body p-3 sm:p-6 border border-outline-variant/20 shadow-sm relative overflow-clip rounded-lg${isMatchInProgress ? "" : " min-h-150"}`}
    >
      {heroShown && scoreHidden && (
        <StickyScore
          match={myMatch}
          home={teamById(myMatch.homeTeamId)}
          away={teamById(myMatch.awayTeamId)}
          liveMinute={liveMinute}
          canSub={isPlayingMatch && !isMatchActionPending}
          onAction={onMyMatchAction}
        />
      )}

      {/* ── FINAL DA TAÇA: palco de gala (participes ou não) ── */}
      {isCupFinal && finalFixture ? (
        <div className="mb-3" ref={myMatch ? scoreRef : undefined}>
          <CupFinalStage
            finalFixture={finalFixture}
            mom={finalMom}
            teams={teams}
            players={players}
            me={me}
            liveMinute={liveMinute}
            isPlayingMatch={isPlayingMatch}
            isMatchActionPending={isMatchActionPending}
            cupMatchRoundName={cupMatchRoundName}
            substitutionPause={substitutionPause}
            goalFlashRef={goalFlashRef}
            isCupExtraTime={isCupExtraTime}
            matchResults={matchResults}
            finalWhistle={finalWhistle}
            readOnly={!myMatch}
            onScoreClick={myMatch ? onMyMatchAction : undefined}
          />
        </div>
      ) : (
        /* ── LINHA 1: O MEU JOGO + CLASSIFICAÇÃO VIRTUAL ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          <div className={sideColumn ? "lg:col-span-2" : "lg:col-span-3"}>
            {matchResults && (
              <LiveMatchHero
                myMatch={myMatch}
                mom={myMatchMom}
                teams={teams}
                players={players}
                me={me}
                liveMinute={liveMinute}
                isPlayingMatch={isPlayingMatch}
                isMatchActionPending={isMatchActionPending}
                isCupMatch={isCupMatch}
                cupMatchRoundName={cupMatchRoundName}
                substitutionPause={substitutionPause}
                goalFlashRef={goalFlashRef}
                isCupExtraTime={isCupExtraTime}
                matchResults={matchResults}
                finalWhistle={finalWhistle}
                onScoreClick={onMyMatchAction}
                scoreRef={scoreRef}
              />
            )}
          </div>
          {sideColumn && (
          <div className="lg:col-span-1 min-h-0 flex flex-col gap-3">
            {showStandings && (
              <div className="min-h-0 lg:flex-1">
                <LiveStandingsPanel
                  teams={teams}
                  matchResults={matchResults}
                  liveMinute={liveMinute}
                  myTeamId={me.teamId}
                  teamForms={teamForms}
                  applyLiveResults={
                    standingsStale || isLiveSimulation || showHalftimePanel
                  }
                />
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* ── LINHA 2: A MINHA DIVISÃO (aberta) + AS OUTRAS (recolhidas) ── */}
      {!isCupMatch && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {[myDiv, ...LEAGUE_DIVS.filter((d) => d !== myDiv)]
            .filter((div) => div != null)
            .map((div) => {
              const fixtures = results
                .filter(
                  (m) => teamById(m.homeTeamId)?.division === div && !isMine(m),
                )
                .sort(sortHumanFirst);
              const name = DIVISION_NAMES[div] || `Div ${div}`;
              const list =
                fixtures.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant/50 px-3 py-2 text-center italic">
                    Sem jogos
                  </p>
                ) : (
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${div === myDiv ? "xl:grid-cols-4" : "xl:grid-cols-5"}`}
                  >
                    {fixtures.map(renderRow)}
                  </div>
                );
              if (div === myDiv) {
                return (
                  <section key={div} aria-label={name} className="flex flex-col gap-2">
                    <h3 className="px-3 py-2 rounded-t-md border-b-2 border-primary/60 bg-surface-container-high font-headline font-extrabold text-[11px] tracking-tight uppercase text-primary flex items-center gap-1.5">
                      {name}
                      <span className="text-on-surface/40">{fixtures.length}</span>
                      <span className="ml-auto px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/30">
                        A tua divisão
                      </span>
                    </h3>
                    {list}
                  </section>
                );
              }
              const goals = fixtures.reduce((sum, m) => {
                const s = liveScore(m.events, liveMinute);
                return sum + s.home + s.away;
              }, 0);
              return (
                <details
                  key={div}
                  open={fixtures.some(isHumanFixture)}
                  className="group rounded-md bg-surface-container-low border border-outline-variant/15"
                >
                  <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none min-h-11 px-3 py-2 flex items-center gap-2 font-headline font-extrabold text-[11px] tracking-tight uppercase text-on-surface/70 hover:text-on-surface">
                    {name}
                    <span className="text-on-surface/40">{fixtures.length} jogos</span>
                    <span className="ml-auto text-[11px] font-black tabular-nums text-on-surface-variant normal-case tracking-normal">
                      ⚽ {goals}
                    </span>
                    <span
                      aria-hidden
                      className="material-symbols-outlined text-[18px] leading-none transition-transform group-open:rotate-180"
                    >
                      expand_more
                    </span>
                  </summary>
                  <div className="px-2 pb-2">{list}</div>
                </details>
              );
            })}
        </div>
      )}

      {/* ── TAÇA: restantes jogos da ronda (a final tem palco próprio).
          Eliminatórias e amigáveis dos eliminados partilham a grelha, em blocos. ── */}
      {isCupMatch && !isCupFinal && results.length > 0 && (() => {
        const others = results
          .filter((m) => !isMine(m))
          // Após os 90': só mostra jogos ainda no prolongamento (empatados aos 90)
          .filter((m) => liveMinute <= 90 || isDrawnAt90(m))
          .sort(sortHumanFirst);
        const cupGames = others.filter((m) => !m.isFriendly);
        const friendlies = others.filter((m) => m.isFriendly);
        const block = (title, list) =>
          list.length > 0 && (
            <>
              {cupGames.length > 0 && friendlies.length > 0 && (
                <h4 className="col-span-full text-[9px] font-black uppercase tracking-widest text-on-surface-variant mt-1">
                  {title} · {list.length}
                </h4>
              )}
              {list.map(renderRow)}
            </>
          );
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {block(cupMatchRoundName || "Taça", cupGames)}
            {block("Amigáveis", friendlies)}
          </div>
        );
      })()}
      {myMatch && (
        <LivePitchStrip
          emoji={myMatch.events?.find((e) => e.type === "weather")?.emoji}
        />
      )}
    </div>
  );
}

/* ── StickyScore — marcador compacto preso ao topo durante o scroll ───── */
/**
 * Contentor `sticky` de altura 0: não ocupa espaço no fluxo; a barra fica
 * por cima do conteúdo enquanto o marcador do hero estiver fora do ecrã.
 * @param {Object} props
 * @param {Object} props.match
 * @param {Object|undefined} props.home
 * @param {Object|undefined} props.away
 * @param {number} props.liveMinute
 * @param {boolean} props.canSub
 * @param {() => void} props.onAction
 * @returns {JSX.Element}
 */
function StickyScore({ match, home, away, liveMinute, canSub, onAction }) {
  const score = liveScore(match.events, liveMinute);
  const maxMinute = liveMinute > 90 ? 120 : 90;
  const dot = (team) => (
    <span
      aria-hidden
      className="shrink-0 w-2.5 h-2.5 rounded-full"
      style={{ background: team?.color_primary || "#555" }}
    />
  );
  return (
    <div className="sticky top-0 z-30 h-0">
      <div
        className="absolute inset-x-0 top-0 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-high/95 backdrop-blur-sm shadow-lg shadow-black/40"
        style={{ animation: "commentaryFadeIn 0.3s ease" }}
      >
        <div className="flex items-center gap-2 pl-3 pr-1 py-1">
          {dot(home)}
          <span className="min-w-0 flex-1 truncate text-right text-[12px] font-black uppercase tracking-tight">
            {home?.name}
          </span>
          <span className="shrink-0 font-headline font-black text-lg tabular-nums">
            {score.home}:{score.away}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-black uppercase tracking-tight">
            {away?.name}
          </span>
          {dot(away)}
          <span className="shrink-0 w-9 text-right text-[11px] font-black tabular-nums text-on-surface-variant">
            {liveMinute < 1 ? "—" : `${liveMinute}'`}
          </span>
          <button
            type="button"
            onClick={onAction}
            aria-label={canSub ? "Pausa" : "Detalhes do jogo"}
            title={canSub ? "Pausa" : "Detalhes do jogo"}
            className={`shrink-0 w-11 h-11 rounded-md inline-flex items-center justify-center ${
              canSub ? "text-primary hover:bg-primary/10" : "text-on-surface-variant hover:bg-surface-bright"
            }`}
          >
            <span aria-hidden className="material-symbols-outlined text-[22px] leading-none">
              {canSub ? "swap_horiz" : "query_stats"}
            </span>
          </button>
        </div>
        <div
          aria-hidden
          className="h-0.5 bg-primary transition-all duration-1000"
          style={{ width: `${Math.min(100, (liveMinute / maxMinute) * 100)}%` }}
        />
      </div>
    </div>
  );
}
