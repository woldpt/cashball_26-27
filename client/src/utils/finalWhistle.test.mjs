/**
 * Teste do apito final (corre com `node`).
 *
 *   node client/src/utils/finalWhistle.test.mjs
 */
import assert from "node:assert/strict";
import { computeFinalWhistle } from "./finalWhistle.js";

// 1. Liga com `mom`: vitória em casa.
{
  const w = computeFinalWhistle({
    matchResults: {
      matchweek: 5,
      results: [{ homeTeamId: 1, awayTeamId: 2, finalHomeGoals: 2, finalAwayGoals: 1, mom: 9 }],
    },
    cupRoundResults: null,
    myTeamId: 1,
    season: 1,
  });
  assert.equal(w.key, "league:1:5");
  assert.equal(w.competition, "league");
  assert.equal(w.outcome, "win");
  assert.equal(w.myGoals, 2);
  assert.equal(w.oppGoals, 1);
}

// 2. Liga sem `mom` (direto a decorrer): ainda não apita.
{
  const w = computeFinalWhistle({
    matchResults: {
      matchweek: 5,
      results: [{ homeTeamId: 1, awayTeamId: 2, finalHomeGoals: 0, finalAwayGoals: 0 }],
    },
    cupRoundResults: null,
    myTeamId: 1,
    season: 1,
  });
  assert.equal(w, null);
}

// 3. Liga fora: derrota e empate.
{
  const base = {
    matchResults: {
      matchweek: 5,
      results: [{ homeTeamId: 1, awayTeamId: 2, finalHomeGoals: 3, finalAwayGoals: 1, mom: 9 }],
    },
    cupRoundResults: null,
    myTeamId: 2,
    season: 1,
  };
  assert.equal(computeFinalWhistle(base).outcome, "loss");
  const draw = computeFinalWhistle({
    ...base,
    matchResults: {
      matchweek: 5,
      results: [{ homeTeamId: 1, awayTeamId: 2, homeGoals: 1, awayGoals: 1, mom: 9 }],
    },
  });
  assert.equal(draw.outcome, "draw");
  assert.equal(draw.myGoals, 1);
}

// 4. Taça sem `winnerId`: há prolongamento — o apito espera.
{
  const w = computeFinalWhistle({
    matchResults: null,
    cupRoundResults: {
      round: 2,
      season: 1,
      results: [{ homeTeamId: 1, awayTeamId: 2, homeGoals: 1, awayGoals: 1 }],
    },
    myTeamId: 1,
    season: 1,
  });
  assert.equal(w, null);
}

// 5. Taça decidida: só há vitória ou derrota.
{
  const decided = (winnerId) =>
    computeFinalWhistle({
      matchResults: null,
      cupRoundResults: {
        round: 2,
        season: 1,
        roundName: "Meia-final",
        results: [{ homeTeamId: 1, awayTeamId: 2, homeGoals: 2, awayGoals: 2, winnerId }],
      },
      myTeamId: 1,
      season: 1,
    });
  assert.equal(decided(1).outcome, "win");
  assert.equal(decided(1).key, "cup:1:2");
  assert.equal(decided(2).outcome, "loss");
}

// 6. Amigável (ronda 0): decide pelos golos, sem `winnerId`.
{
  const w = computeFinalWhistle({
    matchResults: null,
    cupRoundResults: {
      round: 0,
      season: 1,
      results: [{ homeTeamId: 1, awayTeamId: 2, homeGoals: 0, awayGoals: 0 }],
    },
    myTeamId: 2,
    season: 1,
  });
  assert.equal(w.outcome, "draw");
  assert.equal(w.key, "friendly:1:1");
}

// 7. Sem o meu jogo em campo: silêncio.
{
  const w = computeFinalWhistle({
    matchResults: {
      matchweek: 5,
      results: [{ homeTeamId: 3, awayTeamId: 4, finalHomeGoals: 1, finalAwayGoals: 0, mom: 7 }],
    },
    cupRoundResults: null,
    myTeamId: 1,
    season: 1,
  });
  assert.equal(w, null);
}

// 8. Sem equipa (espetador sem clube): silêncio.
{
  const w = computeFinalWhistle({
    matchResults: null,
    cupRoundResults: null,
    myTeamId: null,
    season: 1,
  });
  assert.equal(w, null);
}

console.log("finalWhistle: 8/8 OK");
