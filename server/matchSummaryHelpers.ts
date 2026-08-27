import type { ActiveGame } from "./types";
import { SEASON_CALENDAR } from "./gameConstants";
import { updateTacticFamiliarity } from "./game/tacticFamiliarity";
import { computeMatchOdds } from "./game/commentary";
import { calculateMatchAttendance } from "./coreHelpers";
import {
  isPlayerAvailable,
  withJuniorGRs,
  ensureFullBench,
} from "./game/playerUtils";

interface MatchSummaryDeps {
  runAll: <T extends Record<string, any> = Record<string, any>>(
    db: any,
    sql: string,
    params?: any[],
  ) => Promise<T[]>;
  runGet: <T extends Record<string, any> = Record<string, any>>(
    db: any,
    sql: string,
    params?: any[],
  ) => Promise<T | null>;
  getStandingsRows: (teams?: Record<string, any>[]) => Record<string, any>[];
  generateFixturesForDivision: (
    db: any,
    division: number,
    matchweek: number,
    seeds: number[],
  ) => Promise<any[]>;
  pickRefereeSummary: (
    roomCode: string,
    teamId: number,
    opponentId: number,
    matchweek: number,
  ) => { name: string; balance: number; favorsTeamA: boolean };
}

export function createMatchSummaryHelpers(deps: MatchSummaryDeps) {
  const {
    runAll,
    runGet,
    getStandingsRows,
    generateFixturesForDivision,
    pickRefereeSummary,
  } = deps;

  async function ensureFixtureSeeds(
    game: ActiveGame,
    divs: number[],
  ): Promise<void> {
    let changed = false;
    for (const div of divs) {
      // Query current teams in this division from DB (source of truth)
      const rows = await runAll<{ id: number }>(
        game.db,
        "SELECT id FROM teams WHERE division = ? ORDER BY id",
        [div],
      );
      if (rows.length < 2) continue;

      const dbIds = rows.map((r) => r.id);
      const seedIds = game.fixtureSeeds[div] || [];
      const dbSet = new Set(dbIds);

      // Validate: seeds must contain exactly the same teams as the DB
      const seedsMatch =
        seedIds.length === dbIds.length &&
        seedIds.every((id) => dbSet.has(id));

      if (seedsMatch) continue;

      // Regenerate: Fisher-Yates shuffle for unpredictability (mirrors applySeasonEnd)
      const shuffled = [...dbIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      game.fixtureSeeds[div] = shuffled;
      changed = true;
    }
    // Seeds will be persisted by checkAllReady when the match starts.
    void changed;
  }

  function generateWeatherForecast(seed: number) {
    // PRNG determinística (xorshift32) para garantir previsão estável por jornada
    let s = seed >>> 0 || 1;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const weatherRoll = (s >>> 0) / 0xffffffff;
    let condition: string;
    let emoji: string;
    if (weatherRoll < 0.35) {
      condition = "sol";
      emoji = "☀️";
    } else if (weatherRoll < 0.65) {
      condition = "chuva";
      emoji = "🌧️";
    } else if (weatherRoll < 0.8) {
      condition = "vento";
      emoji = "💨";
    } else if (weatherRoll < 0.88) {
      condition = "chuva_forte";
      emoji = "⛈️";
    } else if (weatherRoll < 0.95) {
      condition = "frio";
      emoji = "🥶";
    } else if (weatherRoll < 0.98) {
      condition = "nevoeiro";
      emoji = "🌫️";
    } else {
      condition = "neve";
      emoji = "❄️";
    }
    return { condition, emoji };
  }

  /**
   * Deriva a formação (def-med-ata) e os titulares a partir de um lineup gravado.
   */
  function deriveFormationFromLineup(lineup: any[]) {
    // Titulares vêm sempre primeiro no lineup (snapshot = [...titulares, ...suplentes]).
    // Não confiar no flag is_starter: jogadores auto-picked fora do tactic.positions
    // (suspensos/lesionados substituídos, juniores) ficam marcados como false.
    const starters = (lineup || [])
      .filter((p: any) => p.position && p.name)
      .slice(0, 11);
    if (starters.length === 0) return null;
    const def = starters.filter((p: any) => p.position === "DEF").length;
    const med = starters.filter((p: any) => p.position === "MED").length;
    const ata = starters.filter((p: any) => p.position === "ATA").length;
    const gr = starters.filter((p: any) => p.position === "GR").length;
    if (gr < 1) return null;
    return {
      formation: `${Math.min(def, 5)}-${Math.min(med, 5)}-${Math.min(ata, 5)}`,
      players: starters.map((p: any) => ({
        name: p.name,
        position: p.position,
        skill: p.skill,
      })),
    };
  }

  /**
   * Preenche uma formação (def-med-ata) com os melhores jogadores por skill,
   * tapando faltas de posição com os restantes jogadores de campo disponíveis.
   */
  function pickBestXI(players: any[], formation: string) {
    const parts = formation.split("-");
    const counts = {
      GR: 1,
      DEF: Math.min(parseInt(parts[0], 10) || 4, 5),
      MED: Math.min(parseInt(parts[1], 10) || 4, 5),
      ATA: Math.min(parseInt(parts[2], 10) || 2, 5),
    };
    const pickBest = (pool: any[], n: number) =>
      [...pool].sort((a, b) => (b.skill || 0) - (a.skill || 0)).slice(0, n);

    const starters = [
      ...pickBest(players.filter((p) => p.position === "GR"), counts.GR),
      ...pickBest(players.filter((p) => p.position === "DEF"), counts.DEF),
      ...pickBest(players.filter((p) => p.position === "MED"), counts.MED),
      ...pickBest(players.filter((p) => p.position === "ATA"), counts.ATA),
    ];

    if (starters.length < 11) {
      const inSet = new Set(starters.map((p) => p.id));
      const remaining = [...players]
        .filter((p) => !inSet.has(p.id) && p.position !== "GR")
        .sort((a, b) => (b.skill || 0) - (a.skill || 0));
      starters.push(...remaining.slice(0, 11 - starters.length));
    }

    return starters.slice(0, 11);
  }

  /**
   * Formação provável do adversário — melhores jogadores disponíveis por skill,
   * dispostos na formação preferida do último jogo de liga (fallback 4-4-2).
   */
  async function getOpponentProbableFormation(
    game: ActiveGame,
    opponentId: number,
  ) {
    const mw = game.matchweek || 1;

    // Formação preferida a partir do lineup do último jogo de liga.
    let preferred = "4-4-2";
    const row: any = await runGet(
      game.db,
      `SELECT home_team_id, away_team_id, home_lineup, away_lineup
       FROM matches
       WHERE played = 1 AND (home_team_id = ? OR away_team_id = ?)
       ORDER BY season DESC, matchweek DESC, id DESC
       LIMIT 1`,
      [opponentId, opponentId],
    );
    if (row) {
      try {
        const lineup = JSON.parse(
          row.home_team_id === opponentId
            ? row.home_lineup
            : row.away_lineup,
        ) as any[];
        const derived = deriveFormationFromLineup(lineup);
        if (derived?.formation) preferred = derived.formation;
      } catch {
        // ignora lineup corrompido — mantém o fallback
      }
    }

    // Melhores jogadores disponíveis (reais + juniores para garantir 11).
    const rows = await runAll<{
      id: number;
      name: string;
      position: string;
      skill: number;
      suspension_until_matchweek: number;
      injury_until_matchweek: number;
      transfer_cooldown_until_matchweek: number;
    }>(
      game.db,
      `SELECT id, name, position, skill,
              suspension_until_matchweek, injury_until_matchweek,
              transfer_cooldown_until_matchweek
       FROM players
       WHERE team_id = ? AND id > 0`,
      [opponentId],
    );
    const available = rows.filter((p) => isPlayerAvailable(p, mw));
    const pool = ensureFullBench(
      withJuniorGRs(available, opponentId, mw),
      opponentId,
      mw,
    );

    const xi = pickBestXI(pool, preferred);
    if (xi.length === 0) return null;

    const def = xi.filter((p) => p.position === "DEF").length;
    const med = xi.filter((p) => p.position === "MED").length;
    const ata = xi.filter((p) => p.position === "ATA").length;
    const gr = xi.filter((p) => p.position === "GR").length;
    if (gr < 1) return null;

    return {
      formation: `${Math.min(def, 5)}-${Math.min(med, 5)}-${Math.min(ata, 5)}`,
      players: xi.map((p) => ({
        name: p.name,
        position: p.position,
        skill: p.skill,
        isJunior: p.isJunior === true || p.id < 0,
      })),
    };
  }

  /**
   * Ameaças do adversário: melhor marcador, melhor qualidade e melhor forma.
   */
  async function getOpponentThreats(
    game: ActiveGame,
    opponentId: number,
    topScorer: { name: string; goals: number } | null,
  ) {
    const bestSkill: any = await runGet(
      game.db,
      "SELECT name, skill, form FROM players WHERE team_id = ? AND id > 0 ORDER BY skill DESC, form DESC LIMIT 1",
      [opponentId],
    );
    const bestForm: any = await runGet(
      game.db,
      "SELECT name, skill, form FROM players WHERE team_id = ? AND id > 0 ORDER BY form DESC, skill DESC LIMIT 1",
      [opponentId],
    );

    const threats: {
      role: "goleador" | "qualidade" | "forma";
      name: string;
      skill: number | null;
      form: number | null;
      goals: number | null;
    }[] = [];

    if (topScorer) {
      threats.push({
        role: "goleador",
        name: topScorer.name,
        skill: null,
        form: null,
        goals: topScorer.goals,
      });
    }
    if (
      bestSkill &&
      bestSkill.name &&
      !threats.some((t) => t.name === bestSkill.name)
    ) {
      threats.push({
        role: "qualidade",
        name: bestSkill.name,
        skill: bestSkill.skill ?? null,
        form: bestSkill.form ?? null,
        goals: null,
      });
    }
    if (
      bestForm &&
      bestForm.name &&
      !threats.some((t) => t.name === bestForm.name)
    ) {
      threats.push({
        role: "forma",
        name: bestForm.name,
        skill: bestForm.skill ?? null,
        form: bestForm.form ?? null,
        goals: null,
      });
    }
    return threats;
  }

  /**
   * Contexto competitivo derivado das posições na divisão (ambas as equipas).
   */
  function buildStakes(
    myPosition: number | null,
    oppPosition: number | null,
    isCup: boolean,
  ) {
    if (isCup) return "Eliminatórias — cada golo decide o futuro na prova.";
    const pos = myPosition ?? null;
    if (pos === null) return "Jogo de campeonato.";
    const oppPos = oppPosition ?? null;
    const minPos = Math.min(pos, oppPos ?? Number.POSITIVE_INFINITY);
    const gap =
      oppPos !== null ? Math.abs(pos - oppPos) : Number.POSITIVE_INFINITY;
    if (gap >= 4) return "Desnível na tabela — somar pontos é o objetivo.";
    if (minPos <= 2) return "Duelo no topo — importante para a luta pelo título.";
    if (minPos <= 4) return "Jogo decisivo para a zona de cima da tabela.";
    return "Jogo de campeonato — somar pontos é o objetivo.";
  }

  /**
   * Manchete de imprensa determinística (mesmo estado ⇒ mesmo texto).
   *
   * A classificação manda: frases de forma só são usadas quando as posições
   * estão próximas (nunca podem contradizer a tabela mostrada no briefing).
   * Em semanas de taça (sem posições) usa-se apenas a forma recente.
   */
  function buildHeadline(ctx: {
    myName: string;
    oppName: string;
    myLast5: string;
    oppLast5: string;
    h2hWins: number;
    h2hLosses: number;
    venue: string;
    myPosition: number | null;
    oppPosition: number | null;
    myPoints: number | null;
    oppPoints: number | null;
  }) {
    const myForm =
      (ctx.myLast5.match(/V/g) || []).length -
      (ctx.myLast5.match(/D/g) || []).length;
    const oppForm =
      (ctx.oppLast5.match(/V/g) || []).length -
      (ctx.oppLast5.match(/D/g) || []).length;

    // Venue real do encontro (o Jamor só na final): "Casa", "Fora" ou "Jamor".
    const base =
      ctx.venue === "Fora"
        ? `${ctx.myName} visita ${ctx.oppName}`
        : `${ctx.myName} recebe ${ctx.oppName} ${
            ctx.venue === "Jamor" ? "no Jamor" : "em casa"
          }`;

    // ── Semanas de taça: sem classificação — só forma recente (neutro) ─────
    if (ctx.myPosition === null || ctx.oppPosition === null) {
      if (
        ctx.h2hWins + ctx.h2hLosses >= 2 &&
        Math.abs(ctx.h2hWins - ctx.h2hLosses) >= 2
      ) {
        const dom = ctx.h2hWins > ctx.h2hLosses;
        return `${base}. O historial favorece ${dom ? ctx.myName : ctx.oppName}, mas este jogo é novo.`;
      }
      if (myForm >= 2 && oppForm < 0) {
        return `${base}. A tua boa forma enfrenta um adversário em quebra — momento para pressionar.`;
      }
      if (myForm < 0 && oppForm >= 2) {
        return `${base}. ${ctx.oppName} chega em grande forma e a tua equipa precisa de reagir.`;
      }
      if (myForm === oppForm) {
        return `${base}. Equilíbrio total no momento — tudo pode acontecer.`;
      }
      return `${base}. Tudo em aberto nesta jornada.`;
    }

    const myPos = ctx.myPosition;
    const oppPos = ctx.oppPosition;
    const gap = Math.abs(myPos - oppPos);
    const minPos = Math.min(myPos, oppPos);
    const ptsGap =
      ctx.myPoints != null && ctx.oppPoints != null
        ? Math.abs(ctx.myPoints - ctx.oppPoints)
        : null;

    // 1. Grande desnível — a classificação manda, a forma não fala.
    if (gap >= 4 || (ptsGap !== null && ptsGap >= 9)) {
      return myPos < oppPos
        ? `${base}. Claro favorito pela classificação, mas sem espaço para facilitar.`
        : `${base}. ${ctx.oppName} chega muito acima na tabela — missão complicada.`;
    }

    // 2. Duelo de topo.
    if (minPos <= 2) {
      return `${base}. Encontro entre candidatos ao título — jogo de seis pontos.`;
    }

    // 3. Zona de cima da tabela.
    if (minPos <= 4) {
      return `${base}. Duelo importante na zona de cima da tabela.`;
    }

    // 4. Posições próximas — a forma recente é consistente com a tabela.
    if (gap <= 2) {
      if (
        ctx.h2hWins + ctx.h2hLosses >= 2 &&
        Math.abs(ctx.h2hWins - ctx.h2hLosses) >= 2
      ) {
        const dom = ctx.h2hWins > ctx.h2hLosses;
        return `${base}. O historial favorece ${dom ? ctx.myName : ctx.oppName}, mas este jogo é novo.`;
      }
      if (myForm >= 2 && oppForm < 0) {
        return `${base}. A tua boa forma enfrenta um adversário em quebra — momento para pressionar.`;
      }
      if (myForm < 0 && oppForm >= 2) {
        return `${base}. ${ctx.oppName} chega em grande forma e a tua equipa precisa de reagir.`;
      }
      if (myForm === oppForm) {
        return `${base}. Equilíbrio total no momento — tudo pode acontecer.`;
      }
    }

    // 5. Meio da tabela.
    return `${base}. Jogo equilibrado entre equipas do meio da tabela.`;
  }

  /**
   * Dificuldade estimada a partir das probabilidades implícitas das odds.
   * Usa a odd da TUA equipa (casa ou fora) — não a da equipa da casa.
   */
  function computeDifficulty(odds: Record<string, string>, isHome: boolean) {
    const parse = (v: string | undefined): number | null => {
      const n = Number.parseFloat(String(v ?? ""));
      return Number.isFinite(n) && n > 1 ? n : null;
    };
    const home = parse(odds.home);
    const draw = parse(odds.draw);
    const away = parse(odds.away);
    const vals = [home, draw, away].filter((v): v is number => v !== null);
    if (vals.length === 0) return { score: 50, label: "Equilibrado" };
    const invSum = vals.reduce((s, v) => s + 1 / v, 0);
    const myOdds = isHome ? home : away;
    const myProb = myOdds ? (1 / myOdds / invSum) * 100 : 33;
    const score = Math.round(Math.max(0, Math.min(100, 100 - myProb)));
    const label =
      score <= 40
        ? "Fácil"
        : score <= 62
          ? "Equilibrado"
          : score <= 80
            ? "Difícil"
            : "Muito difícil";
    return { score, label };
  }

  /**
   * Info do estádio para jogos em casa: capacidade, assistência esperada e receita.
   */
  async function buildStadiumInfo(
    game: ActiveGame,
    homeTeamId: number,
    awayTeamId: number,
  ) {
    const team = await runGet<{ stadium_capacity?: number }>(
      game.db,
      "SELECT stadium_capacity FROM teams WHERE id = ?",
      [homeTeamId],
    );
    const capacity = team?.stadium_capacity || 10000;
    const expectedAttendance = await calculateMatchAttendance(
      game.db,
      homeTeamId,
      awayTeamId,
    );
    return {
      capacity,
      expectedAttendance,
      revenue: expectedAttendance * 15,
    };
  }

  async function getLastConfrontation(
    game: ActiveGame,
    teamAId: number,
    teamBId: number,
  ) {
    const leagueRow: any = await runGet(
      game.db,
      `SELECT season, matchweek, home_team_id, away_team_id, home_score, away_score
       FROM matches
       WHERE played = 1
         AND ((home_team_id = ? AND away_team_id = ?)
           OR (home_team_id = ? AND away_team_id = ?))
       ORDER BY season DESC, matchweek DESC, id DESC
       LIMIT 1`,
      [teamAId, teamBId, teamBId, teamAId],
    );

    const cupRow: any = await runGet(
      game.db,
      `SELECT season, round, home_team_id, away_team_id, home_score, away_score,
              home_et_score, away_et_score, home_penalties, away_penalties
       FROM cup_matches
       WHERE played = 1
         AND ((home_team_id = ? AND away_team_id = ?)
           OR (home_team_id = ? AND away_team_id = ?))
       ORDER BY season DESC, round DESC
       LIMIT 1`,
      [teamAId, teamBId, teamBId, teamAId],
    );

    if (!leagueRow && !cupRow) return null;

    // Pick the more recent of the two using calendarIndex within season.
    const leagueIdx = leagueRow
      ? (SEASON_CALENDAR.find(
          (e) => e.type === "league" && e.matchweek === leagueRow.matchweek,
        )?.calendarIndex ?? -1)
      : -1;
    const cupIdx = cupRow
      ? (SEASON_CALENDAR.find(
          (e) => e.type === "cup" && e.round === cupRow.round,
        )?.calendarIndex ?? -1)
      : -1;

    let pick: "league" | "cup";
    if (!leagueRow) pick = "cup";
    else if (!cupRow) pick = "league";
    else if (cupRow.season !== leagueRow.season)
      pick = cupRow.season > leagueRow.season ? "cup" : "league";
    else pick = cupIdx > leagueIdx ? "cup" : "league";

    if (pick === "league") {
      const isHome = leagueRow.home_team_id === teamAId;
      const goalsFor = isHome ? leagueRow.home_score : leagueRow.away_score;
      const goalsAgainst = isHome ? leagueRow.away_score : leagueRow.home_score;
      const result =
        goalsFor > goalsAgainst ? "V" : goalsFor < goalsAgainst ? "D" : "E";
      return {
        season: leagueRow.season,
        competition: "league" as const,
        matchweek: leagueRow.matchweek,
        venue: isHome ? "Casa" : ("Fora" as "Casa" | "Fora"),
        goalsFor,
        goalsAgainst,
        result,
      };
    }

    const isHome = cupRow.home_team_id === teamAId;
    const goalsFor = isHome ? cupRow.home_score : cupRow.away_score;
    const goalsAgainst = isHome ? cupRow.away_score : cupRow.home_score;
    const cupEntry = SEASON_CALENDAR.find(
      (e) => e.type === "cup" && e.round === cupRow.round,
    ) as Extract<(typeof SEASON_CALENDAR)[number], { type: "cup" }> | undefined;

    const hasEt = cupRow.home_et_score != null && cupRow.away_et_score != null;
    const hasPen =
      cupRow.home_penalties != null && cupRow.away_penalties != null;

    // Determine result including ET/penalties for cup ties.
    let result: "V" | "E" | "D";
    if (hasPen) {
      const myPen = isHome ? cupRow.home_penalties : cupRow.away_penalties;
      const opPen = isHome ? cupRow.away_penalties : cupRow.home_penalties;
      result = myPen > opPen ? "V" : "D";
    } else if (hasEt) {
      const myEt =
        (isHome ? cupRow.home_score : cupRow.away_score) +
        (isHome ? cupRow.home_et_score : cupRow.away_et_score);
      const opEt =
        (isHome ? cupRow.away_score : cupRow.home_score) +
        (isHome ? cupRow.away_et_score : cupRow.home_et_score);
      result = myEt > opEt ? "V" : myEt < opEt ? "D" : "E";
    } else {
      result =
        goalsFor > goalsAgainst ? "V" : goalsFor < goalsAgainst ? "D" : "E";
    }

    return {
      season: cupRow.season,
      competition: "cup" as const,
      cupRound: cupRow.round,
      cupRoundName: cupEntry?.roundName ?? null,
      venue: cupRow.round === 5 ? "Jamor" : isHome ? "Casa" : "Fora",
      goalsFor,
      goalsAgainst,
      result,
      ...(hasEt
        ? {
            extraTime: {
              goalsFor: isHome ? cupRow.home_et_score : cupRow.away_et_score,
              goalsAgainst: isHome
                ? cupRow.away_et_score
                : cupRow.home_et_score,
            },
          }
        : {}),
      ...(hasPen
        ? {
            penalties: {
              goalsFor: isHome ? cupRow.home_penalties : cupRow.away_penalties,
              goalsAgainst: isHome
                ? cupRow.away_penalties
                : cupRow.home_penalties,
            },
          }
        : {}),
    };
  }

  async function getTeamRecentResults(
    game: ActiveGame,
    teamId: number,
    limit = 5,
  ) {
    const rows = await runAll(
      game.db,
      `SELECT m.matchweek, m.home_team_id, m.away_team_id, m.home_score, m.away_score,
              h.name AS home_name, a.name AS away_name
       FROM matches m
       LEFT JOIN teams h ON h.id = m.home_team_id
       LEFT JOIN teams a ON a.id = m.away_team_id
       WHERE m.played = 1 AND m.season = ? AND (m.home_team_id = ? OR m.away_team_id = ?)
       ORDER BY m.season DESC, m.matchweek DESC, m.id DESC
       LIMIT ?`,
      [game.season, teamId, teamId, limit],
    );

    const recent = rows.map((row: any) => {
      const isHome = row.home_team_id === teamId;
      const goalsFor = isHome ? row.home_score : row.away_score;
      const goalsAgainst = isHome ? row.away_score : row.home_score;
      if (goalsFor > goalsAgainst) return "V";
      if (goalsFor < goalsAgainst) return "D";
      return "E";
    });

    return recent.join("");
  }

  /**
   * Qualidade média do plantel (skills dos jogadores reais).
   */
  async function getTeamAvgSkill(game: ActiveGame, teamId: number) {
    const row = await runGet<{ avgSkill: number | null }>(
      game.db,
      "SELECT ROUND(AVG(COALESCE(skill, 0))) AS avgSkill FROM players WHERE team_id = ? AND team_id IS NOT NULL",
      [teamId],
    );
    return row?.avgSkill ?? null;
  }

  /**
   * Enriquecimento do adversário: qualidade média do plantel, melhor marcador
   * e registo global de confrontos diretos (liga + taça).
   */
  async function getOpponentOverview(
    game: ActiveGame,
    teamId: number,
    opponentId: number,
  ) {
    const avgSkill = await getTeamAvgSkill(game, opponentId);

    const topScorerRow = await runGet(
      game.db,
      `SELECT name, goals FROM players
       WHERE team_id = ? AND id > 0
       ORDER BY goals DESC, skill DESC
       LIMIT 1`,
      [opponentId],
    );

    const topScorerName: string | null = topScorerRow?.name ?? null;
    const topScorerGoals: number = topScorerRow?.goals ?? 0;

    const h2hRow = await runGet(
      game.db,
      `SELECT
         SUM(CASE WHEN r.w = 'V' THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN r.w = 'E' THEN 1 ELSE 0 END) AS draws,
         SUM(CASE WHEN r.w = 'D' THEN 1 ELSE 0 END) AS losses,
         COUNT(*) AS total
       FROM (
         SELECT CASE WHEN home_score > away_score THEN 'V' WHEN home_score < away_score THEN 'D' ELSE 'E' END AS w
         FROM matches WHERE played = 1 AND home_team_id = ? AND away_team_id = ?
         UNION ALL
         SELECT CASE WHEN home_score < away_score THEN 'V' WHEN home_score > away_score THEN 'D' ELSE 'E' END AS w
         FROM matches WHERE played = 1 AND away_team_id = ? AND home_team_id = ?
         UNION ALL
         SELECT CASE WHEN home_score > away_score THEN 'V' WHEN home_score < away_score THEN 'D' ELSE 'E' END AS w
         FROM cup_matches WHERE played = 1 AND home_team_id = ? AND away_team_id = ?
         UNION ALL
         SELECT CASE WHEN home_score < away_score THEN 'V' WHEN home_score > away_score THEN 'D' ELSE 'E' END AS w
         FROM cup_matches WHERE played = 1 AND away_team_id = ? AND home_team_id = ?
       ) r`,
      [teamId, opponentId, opponentId, teamId, teamId, opponentId, opponentId, teamId],
    );

    return {
      avgSkill,
      topScorer:
        topScorerName && topScorerGoals > 0
          ? { name: topScorerName, goals: topScorerGoals }
          : null,
      h2hRecord: {
        wins: h2hRow?.wins ?? 0,
        draws: h2hRow?.draws ?? 0,
        losses: h2hRow?.losses ?? 0,
        total: h2hRow?.total ?? 0,
      },
    };
  }

  /**
   * Objeto adversário completo usado em semanas de liga e de taça.
   */
  async function buildOpponentSummary(
    game: ActiveGame,
    teamId: number,
    opponent: Record<string, any>,
    position: number | null,
  ) {
    const overview = await getOpponentOverview(game, teamId, opponent.id);
    const probableFormation = await getOpponentProbableFormation(
      game,
      opponent.id,
    );
    return {
      id: opponent.id,
      name: opponent.name,
      division: opponent.division,
      position,
      points: opponent.points || 0,
      goalsFor: opponent.goals_for || 0,
      goalsAgainst: opponent.goals_against || 0,
      color_primary: opponent.color_primary || null,
      color_secondary: opponent.color_secondary || null,
      morale: opponent.morale ?? 50,
      wins: opponent.wins || 0,
      draws: opponent.draws || 0,
      losses: opponent.losses || 0,
      avgSkill: overview.avgSkill,
      topScorer: overview.topScorer,
      h2hRecord: overview.h2hRecord,
      threats: await getOpponentThreats(
        game,
        opponent.id,
        overview.topScorer,
      ),
      probableFormation,
      last5: await getTeamRecentResults(game, opponent.id, 5),
      lastConfrontation: await getLastConfrontation(game, teamId, opponent.id),
    };
  }

  async function buildNextMatchSummary(game: ActiveGame, teamId: number) {
    const team = await runGet(game.db, "SELECT * FROM teams WHERE id = ?", [
      teamId,
    ]);
    if (!team) return null;

    const currentEntry = SEASON_CALENDAR[game.calendarIndex];

    // ── CUP WEEK ────────────────────────────────────────────────────────────
    if (currentEntry?.type === "cup") {
      const cupMatch = await runGet(
        game.db,
        "SELECT * FROM cup_matches WHERE season = ? AND round = ? AND (home_team_id = ? OR away_team_id = ?) AND played = 0",
        [game.season, currentEntry.round, teamId, teamId],
      );
      if (!cupMatch) {
        // Team is eliminated from this round — return spectator summary (no opponent)
        return {
          matchweek: game.matchweek,
          isCup: true,
          cupRound: (currentEntry as any).round,
          cupRoundName: (currentEntry as any).roundName,
          opponent: null,
        };
      }

      const isHome = cupMatch.home_team_id === teamId;
      const opponentId = isHome ? cupMatch.away_team_id : cupMatch.home_team_id;
      const opponent = await runGet(
        game.db,
        "SELECT * FROM teams WHERE id = ?",
        [opponentId],
      );
      if (!opponent) return null;

      const referee = pickRefereeSummary(
        game.roomCode,
        team.id,
        opponent.id,
        game.matchweek,
      );

      const weatherSeedCup =
        (game.season ?? 1) * 1000 +
        (game.matchweek ?? 1) * 31 +
        team.id +
        opponent.id;
      const weather = generateWeatherForecast(weatherSeedCup);

      const odds = computeMatchOdds(
        { division: isHome ? team.division : opponent.division, position: null },
        { division: isHome ? opponent.division : team.division, position: null },
      );

      const venue =
        currentEntry.round === 5 ? "Jamor" : isHome ? "Casa" : "Fora";
      const opponentSummary = await buildOpponentSummary(
        game,
        team.id,
        opponent,
        null,
      );
      const last5 = await getTeamRecentResults(game, team.id, 5);
      const opponentName = opponent.name ?? "Adversário";

      return {
        matchweek: game.matchweek,
        isCup: true,
        fixtureKey: `${cupMatch.home_team_id}-${cupMatch.away_team_id}`,
        cupRound: currentEntry.round,
        cupRoundName: currentEntry.roundName,
        venue,
        odds,
        difficulty: computeDifficulty(odds, isHome),
        headline: buildHeadline({
          myName: team.name,
          oppName: opponentName,
          myLast5: last5,
          oppLast5: opponentSummary?.last5 ?? "",
          h2hWins: opponentSummary?.h2hRecord?.wins ?? 0,
          h2hLosses: opponentSummary?.h2hRecord?.losses ?? 0,
          venue,
          myPosition: null,
          oppPosition: null,
          myPoints: null,
          oppPoints: null,
        }),
        stakes: buildStakes(null, null, true),
        stadium: isHome
          ? await buildStadiumInfo(game, team.id, opponent.id)
          : null,
        team: {
          id: team.id,
          name: team.name,
          division: team.division,
          position: null,
          last5,
          avgSkill: await getTeamAvgSkill(game, team.id),
        },
        opponent: opponentSummary,
        referee,
        weatherForecast: weather,
      };
    }

    // ── LEAGUE WEEK ─────────────────────────────────────────────────────────
    const standings = getStandingsRows(
      await runAll(
        game.db,
        "SELECT id, name, division, points, wins, draws, losses, goals_for, goals_against FROM teams WHERE division = ?",
        [team.division],
      ),
    );
    const standingsIndex = new Map(
      standings.map((standingTeam, index) => [standingTeam.id, index + 1]),
    );

    // Fonte única de verdade: se o lobby já preparou as fixtures (finalizeLeagueEvent),
    // usa EXATAMENTE essas — o jogo real vai jogá-las. Evita divergência de
    // casa/fora entre o briefing e a partida. Fallback determinístico se não
    // houver fixtures preparadas (restore/crash).
    let fixture: any = null;
    const prepped = game.currentFixtures ?? [];
    if (prepped.length > 0 && !(prepped[0] as any)?.round) {
      fixture =
        prepped.find(
          (f: any) => f.homeTeamId === team.id || f.awayTeamId === team.id,
        ) ?? null;
    }
    if (!fixture) {
      await ensureFixtureSeeds(game, [team.division]);
      const fixtures = await generateFixturesForDivision(
        game.db,
        team.division,
        game.matchweek,
        game.fixtureSeeds?.[team.division] ?? [],
      );
      fixture =
        fixtures.find(
          (entry: any) =>
            entry.homeTeamId === team.id || entry.awayTeamId === team.id,
        ) || null;
    }
    if (!fixture) return null;

    const isHome = fixture.homeTeamId === team.id;
    const opponentId = isHome ? fixture.awayTeamId : fixture.homeTeamId;
    const opponent = await runGet(game.db, "SELECT * FROM teams WHERE id = ?", [
      opponentId,
    ]);
    if (!opponent) return null;

    const referee = pickRefereeSummary(
      game.roomCode,
      team.id,
      opponent.id,
      game.matchweek,
    );

    const weatherSeedLeague =
      (game.season ?? 1) * 1000 +
      (game.matchweek ?? 1) * 31 +
      team.id +
      opponent.id;
    const weather = generateWeatherForecast(weatherSeedLeague);

    const odds = computeMatchOdds(
      {
        division: isHome ? team.division : opponent.division,
        position: isHome
          ? standingsIndex.get(team.id) || null
          : standingsIndex.get(opponent.id) || null,
      },
      {
        division: isHome ? opponent.division : team.division,
        position: isHome
          ? standingsIndex.get(opponent.id) || null
          : standingsIndex.get(team.id) || null,
      },
    );

    const opponentSummary = await buildOpponentSummary(
      game,
      team.id,
      opponent,
      standingsIndex.get(opponent.id) || null,
    );
    const myPosition = standingsIndex.get(team.id) || null;
    const oppPosition = standingsIndex.get(opponent.id) || null;
    const last5 = await getTeamRecentResults(game, team.id, 5);
    const opponentName = opponent.name ?? "Adversário";

    return {
      matchweek: game.matchweek,
      isCup: false,
      fixtureKey: `${fixture.homeTeamId}-${fixture.awayTeamId}`,
      venue: isHome ? "Casa" : "Fora",
      odds,
      difficulty: computeDifficulty(odds, isHome),
      headline: buildHeadline({
        myName: team.name,
        oppName: opponentName,
        myLast5: last5,
        oppLast5: opponentSummary?.last5 ?? "",
        h2hWins: opponentSummary?.h2hRecord?.wins ?? 0,
        h2hLosses: opponentSummary?.h2hRecord?.losses ?? 0,
        venue: isHome ? "Casa" : "Fora",
        myPosition,
        oppPosition,
        myPoints: team.points ?? null,
        oppPoints: opponent.points ?? null,
      }),
      stakes: buildStakes(myPosition, oppPosition, false),
      stadium: isHome
        ? await buildStadiumInfo(game, team.id, opponent.id)
        : null,
      team: {
        id: team.id,
        name: team.name,
        division: team.division,
        position: myPosition,
        last5,
        avgSkill: await getTeamAvgSkill(game, team.id),
      },
      opponent: opponentSummary,
      referee,
      weatherForecast: weather,
    };
  }

  function persistMatchResults(
    game: ActiveGame,
    fixtures: any[],
    matchweek: number,
    onDone?: () => void,
  ) {
    // Match fatigue is live-only. Keep the historical lineup skill snapshot,
    // but do not carry minutes/fatigue badges into the next match or history.
    const historicalLineup = (lineup: any[] = []) =>
      lineup.map(({ matchMinutes, fatigueLoss, ...player }) => player);

    let remaining = fixtures.length;
    if (remaining === 0) {
      if (onDone) onDone();
      return;
    }

    game.db.serialize(() => {
      fixtures.forEach((match) => {
        game.db.run(
          "DELETE FROM matches WHERE matchweek = ? AND home_team_id = ? AND away_team_id = ? AND competition = 'League'",
          [matchweek, match.homeTeamId, match.awayTeamId],
          () => {
            game.db.run(
              `INSERT INTO matches (
                season, matchweek, home_team_id, away_team_id, home_score, away_score, played, narrative, competition, attendance, home_lineup, away_lineup
              ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'League', ?, ?, ?)`,
              [
                game.season,
                matchweek,
                match.homeTeamId,
                match.awayTeamId,
                match.finalHomeGoals,
                match.finalAwayGoals,
                JSON.stringify(match.events || []),
                match.attendance || 0,
                JSON.stringify(historicalLineup(match.homeLineup || [])),
                JSON.stringify(historicalLineup(match.awayLineup || [])),
              ],
              () => {
                // Update player form after match
                const homeLineupIds = (match.homeLineup || [])
                  .map((p: any) => p.id)
                  .filter((id: number) => id > 0);
                const awayLineupIds = (match.awayLineup || [])
                  .map((p: any) => p.id)
                  .filter((id: number) => id > 0);
                const homeWon = match.finalHomeGoals > match.finalAwayGoals;
                const awayWon = match.finalAwayGoals > match.finalHomeGoals;
                const drew = !homeWon && !awayWon;

                const applyFormDelta = (ids: number[], won: boolean) => {
                  if (ids.length === 0) return;
                  const delta = drew
                    ? Math.floor(Math.random() * 5) - 2 // -2 a +2
                    : won
                      ? 5 + Math.floor(Math.random() * 6) // +5 a +10
                      : -(5 + Math.floor(Math.random() * 6)); // -5 a -10
                  const ph = ids.map(() => "?").join(",");
                  game.db.run(
                    `UPDATE players SET form = MIN(130, MAX(70, form + ?)) WHERE id IN (${ph})`,
                    [delta, ...ids],
                  );
                };

                applyFormDelta(homeLineupIds, homeWon);
                applyFormDelta(awayLineupIds, awayWon);

                // Registra táctica para cada equipa (humana ou NPC) nos fixtures
                const recordTacticHistory = (
                  teamId: number,
                  tactic: any,
                  result: string,
                ) => {
                  if (!tactic?.formation || !tactic?.style) return;
                  // Memória táctica: +1 estrela por jogo (liga) para todas as equipas
                  updateTacticFamiliarity(game, teamId, tactic, matchweek, result);
                  const playerState = Object.values(game.playersByName).find(
                    (p) => p.teamId === teamId && p.socketId,
                  );
                  if (playerState) {
                    // Linha de auditoria (apenas coaches humanos)
                    game.db.run(
                      "INSERT INTO player_tactic_history (team_id, player_name, formation, style, matchweek, competition, result) VALUES (?, ?, ?, ?, ?, ?, ?)",
                      [
                        teamId,
                        playerState.name,
                        tactic.formation,
                        tactic.style,
                        matchweek,
                        "league",
                        result,
                      ],
                    );
                  }
                };

                const homeResult = homeWon ? "V" : drew ? "E" : "D";
                const awayResult = awayWon ? "V" : drew ? "E" : "D";
                recordTacticHistory(match.homeTeamId, match._t1, homeResult);
                recordTacticHistory(match.awayTeamId, match._t2, awayResult);

                remaining -= 1;
                if (remaining === 0 && onDone) onDone();
              },
            );
          },
        );
      });
    });
  }

  return {
    getTeamRecentResults,
    buildNextMatchSummary,
    persistMatchResults,
  };
}
