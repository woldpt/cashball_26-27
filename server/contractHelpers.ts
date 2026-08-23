import type { ActiveGame, PlayerSession } from "./types";
import {
  CONTRACT_LENGTH_MATCHWEEKS,
  getAgentName,
  fairWeeklyWage,
} from "./gameConstants";
import {
  currentEpoch,
  contractEndInfo,
} from "./coreHelpers";

type AnyRow = Record<string, any>;

type RunAll = <T extends AnyRow = AnyRow>(
  db: any,
  sql: string,
  params?: any[],
) => Promise<T[]>;

type RunGet = <T extends AnyRow = AnyRow>(
  db: any,
  sql: string,
  params?: any[],
) => Promise<T | null>;

interface ContractDeps {
  io: any;
  runAll: RunAll;
  runGet: RunGet;
  startAuction: (game: ActiveGame, player: any, startingPrice: number, callback?: (...args: any[]) => void, isExClub?: boolean) => void;
  getSeasonEndMatchweek: (matchweek: number) => number;
}

export function createContractHelpers(deps: ContractDeps) {
  const { io, runAll, runGet, startAuction, getSeasonEndMatchweek } = deps;

  const effectiveValue = (player: any): number => {
    const base = player.value || (player.skill || 0) * 20000;
    const resFactor = 0.9 + ((player.resistance || 3) / 5) * 0.2;
    const formFactor = (player.form || 90) / 90;
    const starFactor = player.is_star ? 1.2 : 1;
    return Math.round(base * resFactor * formFactor * starFactor);
  };

  const fairWageOf = (player: any): number => {
    return fairWeeklyWage(player.skill);
  };

  /**
   * Dispara um pedido de renovação do "Agente do Jogador".
   * Emite o evento dedicado `contractRequest` (nunca matchActionRequired).
   */
  const maybeTriggerContractRequest = (
    game: ActiveGame,
    player: any,
    isRenegotiation = false,
  ) => {
    if (!player || !player.team_id) return;
    if (player.contract_request_pending) return;

    const wage = player.wage || 0;
    const fairWage = fairWageOf(player);
    const demandBase = isRenegotiation
      ? Math.max(Math.round(fairWage * 1.15), Math.round(wage * 1.2))
      : Math.max(fairWage, Math.round(wage * 1.05), wage + 100);

    const cap = isRenegotiation ? Math.round(wage * 1.2) : Math.round(wage * 1.25);
    const requestedWage = Math.min(
      Math.round(demandBase * (1.0 + Math.random() * 0.15)),
      cap,
    );
    const end = contractEndInfo(player);

    game.db.run(
      "UPDATE players SET contract_request_pending = 1, contract_requested_wage = ? WHERE id = ?",
      [requestedWage, player.id],
      () => {
        const coach = (
          Object.values(game.playersByName) as PlayerSession[]
        ).find((p) => p.teamId === player.team_id && p.socketId);
        if (!coach) {
          game.db.run(
            "UPDATE players SET contract_request_pending = 0 WHERE id = ?",
            [player.id],
          );
          return;
        }

        io.to(coach.socketId as string).emit("contractRequest", {
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          skill: player.skill,
          wage,
          requestedWage,
          agent: getAgentName(player.id),
          contractEndSeason: end.season,
          contractEndMatchweek: end.matchweek,
          isRenegotiation,
        });
      },
    );
  };

  /**
   * Renegociação de agente para jogadores subvalorizados (salário muito abaixo
   * do valor de mercado). Substitui a antiga query morta dos 28 matchweeks.
   */
  const processAgentRenegotiations = async (game: ActiveGame) => {
    const candidates = await runAll(
      game.db,
      `SELECT * FROM players
       WHERE team_id IS NOT NULL
         AND transfer_status = 'none'
         AND contract_request_pending = 0
         AND contract_start_epoch > 0`,
    );

    for (const player of candidates) {
      const wage = player.wage || 0;
      if (wage <= 0) continue;
      // Só agentes de jogadores muito subvalorizados se mexem (e com calma)
      if (wage >= fairWageOf(player) * 0.7) continue;
      if (Math.random() > 0.12) continue;

      const coach = (Object.values(game.playersByName) as PlayerSession[]).find(
        (p) => p.teamId === player.team_id && p.socketId,
      );
      if (!coach) continue;

      maybeTriggerContractRequest(game, player, true);
    }
  };

  const POS_MIN: Record<string, number> = { GR: 2, DEF: 4, MED: 4, ATA: 3 };

  const processContractExpiries = async (game: ActiveGame) => {
    const now = currentEpoch(game);

    const expired = await runAll(
      game.db,
      `SELECT p.*, t.name AS team_name
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE p.team_id IS NOT NULL
          AND p.contract_start_epoch > 0
          AND p.contract_start_epoch + ? <= ?`,
      [CONTRACT_LENGTH_MATCHWEEKS, now],
    );

    for (const player of expired) {
      const coach = (Object.values(game.playersByName) as PlayerSession[]).find(
        (pl) => pl.teamId === player.team_id && pl.socketId,
      );

      // NPC team: renew if player needed (position below min) and team financially healthy
      if (!coach) {
        const team = await runGet(
          game.db,
          "SELECT budget FROM teams WHERE id = ?",
          [player.team_id],
        );
        if (team) {
          const posCounts = await runAll(
            game.db,
            "SELECT position, COUNT(*) as cnt FROM players WHERE team_id = ? GROUP BY position",
            [player.team_id],
          );
          const posMap: Record<string, number> = {};
          for (const row of posCounts) posMap[row.position] = row.cnt;
          const posCount = posMap[player.position] ?? 0;
          const posMin = POS_MIN[player.position] ?? 3;
          const isNeeded = posCount < posMin;
          const isAffordable = (team as any).budget > 5000;

          if (isNeeded && isAffordable) {
            const fairWage = fairWageOf(player);
            const seasonEnd = getSeasonEndMatchweek(game.matchweek);
            await new Promise<void>((resolve) => {
              game.db.run(
                "UPDATE players SET wage = ?, contract_until_matchweek = ?, contract_start_epoch = ?, joined_matchweek = ?, contract_request_pending = 0, contract_requested_wage = 0, transfer_status = 'none', transfer_price = 0 WHERE id = ?",
                [fairWage, seasonEnd, now, game.matchweek, player.id],
                () => resolve(),
              );
            });
            continue;
          }
        }
      }

      // Auction path: human decline or NPC surplus/unaffordable
      const agent = getAgentName(player.id);
      const auctionPrice = Math.max(
        Math.round(effectiveValue(player) * 0.65),
        Math.max(Math.round((player.skill || 0) * 40), 500) * 12,
      );
      await new Promise<void>((resolve) => {
        game.db.run(
          "UPDATE players SET contract_start_epoch = 0, contract_request_pending = 0, contract_requested_wage = 0 WHERE id = ?",
          [player.id],
          () => {
            startAuction(game, player, auctionPrice, () => {
              if (coach) {
                io.to(coach.socketId as string).emit(
                  "systemMessage",
                  `💼 ${agent} fez as malas: ${player.name} recusou esperar mais e foi parar ao leilão. Nem uma despedida.`,
                );
              }
              resolve();
            }, true);
          },
        );
      });
    }

    // Prestes a expirar (últimas 3 jornadas) → pedido do agente
    const soonExpiring = await runAll(
      game.db,
      `SELECT * FROM players
       WHERE team_id IS NOT NULL
         AND contract_start_epoch > 0
         AND contract_request_pending = 0
         AND contract_start_epoch + ? <= ?
         AND contract_start_epoch + ? > ?`,
      [CONTRACT_LENGTH_MATCHWEEKS - 3, now, CONTRACT_LENGTH_MATCHWEEKS, now],
    );

    for (const player of soonExpiring) {
      // Todos pedem renovação — sem aleatoriedade, sem exclusões.
      maybeTriggerContractRequest(game, player, false);
    }
  };

  return {
    maybeTriggerContractRequest,
    processAgentRenegotiations,
    processContractExpiries,
  };
}
