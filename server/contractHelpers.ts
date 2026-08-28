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

/**
 * Probabilidade/jornada de o agente ligar por um jogador cujo contrato
 * terminou (lock fim) e ainda não tem pedido pendente. Não é usada na 1.ª
 * semana após o fim do lock (nunca "logo após o unlock"), apenas nas
 * seguintes — atraso aleatório em vez de chamada imediata.
 * O rolamento é por candidato expirado (não por equipa): com k candidatos,
 * a probabilidade de pelo menos uma chamada na semana ≈ 1 − 0.75^k;
 * o orçamento semanal limita de qualquer forma a 1 proposta/equipa.
 * Só equipas humanas; NPCs processam no posto, sem este atraso.
 */
const AGENT_CALL_CHANCE_WEEKLY = 0.25;

/**
 * Regra do jogo: um treinador recebe no máximo 1 proposta de contrato nova
 * por semana (renovações + renegociações partilham o mesmo orçamento).
 * O agente NUNCA liga durante o lock do contrato vigente — pedidos só
 * começam após `contract_start_epoch + CONTRACT_LENGTH_MATCHWEEKS` (jogador
 * desbloqueado para transferência) e nunca na própria semana do fim do lock;
 * nas semanas seguintes, com a probabilidade acima. O conjunto `usedProposals`
 * (teamIds) é criado uma vez por processamento semanal e passado a todos os
 * processos de contratos. Re-emissões de pedidos já pendentes NÃO contam.
 */
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
   *
   * Se o treinador estiver offline, o pedido fica persistido
   * (`contract_request_pending = 1`) e é re-emitido no reconnect / no fluxo
   * semanal — NUNCA é descartado: o jogador só pode sair depois da decisão.
   */
  const maybeTriggerContractRequest = (
    game: ActiveGame,
    player: any,
    isRenegotiation = false,
  ): Promise<void> => {
    if (!player || !player.team_id) return Promise.resolve();
    if (player.contract_request_pending) return Promise.resolve();

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

    return new Promise<void>((resolve) => {
      game.db.run(
        "UPDATE players SET contract_request_pending = 1, contract_requested_wage = ?, contract_request_is_renegotiation = ? WHERE id = ?",
        [requestedWage, isRenegotiation ? 1 : 0, player.id],
        () => {
          const coach = (
            Object.values(game.playersByName) as PlayerSession[]
          ).find((p) => p.teamId === player.team_id && p.socketId);
          if (!coach) {
            // Treinador offline → pedido persistido; será re-emitido depois.
            resolve();
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
          resolve();
        },
      );
    });
  };

  /**
   * Re-emite pedidos de contrato pendentes (`contract_request_pending = 1`)
   * para treinadores online. Cobre: treinador offline na emissão original,
   * modal descartado sem resposta e reconexões. NÃO consome o orçamento
   * semanal de propostas — são as mesmas propostas, não novas.
   */
  const resendPendingContractRequests = async (game: ActiveGame) => {
    const pending = await runAll(
      game.db,
      `SELECT * FROM players
       WHERE team_id IS NOT NULL
         AND contract_request_pending = 1
         AND contract_requested_wage > 0`,
    );

    for (const player of pending) {
      const coach = (Object.values(game.playersByName) as PlayerSession[]).find(
        (p) => p.teamId === player.team_id && p.socketId,
      );
      if (!coach) continue;

      const end = contractEndInfo(player);
      io.to(coach.socketId as string).emit("contractRequest", {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        skill: player.skill,
        wage: player.wage,
        requestedWage: player.contract_requested_wage,
        agent: getAgentName(player.id),
        contractEndSeason: end.season,
        contractEndMatchweek: end.matchweek,
        isRenegotiation: !!player.contract_request_is_renegotiation,
      });
    }
  };

  /**
   * Renegociação de agente para jogadores subvalorizados (salário muito abaixo
   * do valor de mercado). Só depois do lock do contrato terminar — durante o
   * contrato em vigor o agente não pede renegociação, independentemente. Como
   * nas renovações, também não liga na própria semana do fim do lock.
   */
  const processAgentRenegotiations = async (
    game: ActiveGame,
    usedProposals: Set<number>,
  ) => {
    const now = currentEpoch(game);
    const candidates = await runAll(
      game.db,
      `SELECT * FROM players
       WHERE team_id IS NOT NULL
         AND transfer_status = 'none'
         AND contract_request_pending = 0
         AND contract_start_epoch > 0
         AND contract_start_epoch + ? <= ?`,
      [CONTRACT_LENGTH_MATCHWEEKS, now],
    );

    for (const player of candidates) {
      // Mesmo "nunca logo após o unlock" das renovações: a 1.ª semana após o
      // fim do lock não conta.
      if (now - player.contract_start_epoch - CONTRACT_LENGTH_MATCHWEEKS < 1)
        continue;
      // 1 proposta/treinador/semana — se a renovação já ocupou o slot, espera.
      if (usedProposals.has(player.team_id)) continue;

      const wage = player.wage || 0;
      if (wage <= 0) continue;
      // Só agentes de jogadores muito subvalorizados se mexem (e com calma)
      if (wage >= fairWageOf(player) * 0.7) continue;
      if (Math.random() > 0.12) continue;

      // Só equipas humanas recebem negociações (NPCs não têm treinador
      // para decidir). Treinador offline conta como humana — o pedido fica
      // persistido e é re-emitido no reconnect.
      const humanSession = (
        Object.values(game.playersByName) as PlayerSession[]
      ).find((p) => p.teamId === player.team_id);
      if (!humanSession) continue;

      await maybeTriggerContractRequest(game, player, true);
      usedProposals.add(player.team_id);
    }
  };

  const POS_MIN: Record<string, number> = { GR: 2, DEF: 4, MED: 4, ATA: 3 };

  const processContractExpiries = async (
    game: ActiveGame,
    usedProposals: Set<number>,
  ) => {
    const now = currentEpoch(game);

    const expiredRaw = await runAll(
      game.db,
      `SELECT p.*, t.name AS team_name
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE p.team_id IS NOT NULL
          AND p.contract_start_epoch > 0
          AND p.contract_start_epoch + ? <= ?`,
      [CONTRACT_LENGTH_MATCHWEEKS, now],
    );
    // Ordem aleatória: se vários jogadores da mesma equipa estiverem sem
    // contrato, ninguém fica privilegiado pela ordem da base de dados.
    const expired = [...expiredRaw];
    for (let i = expired.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [expired[i], expired[j]] = [expired[j], expired[i]];
    }

    for (const player of expired) {
      // Um treinador que já entrou na sala fica em playersByName mesmo offline
      // (socketId null) — é o discriminador entre equipa humana e NPC.
      const humanSession = (
        Object.values(game.playersByName) as PlayerSession[]
      ).find((pl) => pl.teamId === player.team_id);
      const coach = humanSession?.socketId ? humanSession : null;

      // Equipa humana: o jogador NUNCA sai sem a decisão do treinador no
      // modal. Se o pedido já está pendente, espera-se pela resposta; se nunca
      // foi feito, dispara-se agora (fica persistido se o treinador estiver
      // offline). Se o orçamento semanal já foi usado, espera-se pela semana
      // seguinte. Em nenhum caso há leilão automático.
      if (humanSession) {
        if (player.contract_request_pending) continue;
        if (!usedProposals.has(player.team_id)) {
          // Nunca "logo após o unlock": a 1.ª semana após o fim do lock não
          // conta. Sem estado extra: semanas que "falham" são retomadas no
          // processamento seguinte (probabilidade/jornada).
          const weeksSinceEnd =
            now - player.contract_start_epoch - CONTRACT_LENGTH_MATCHWEEKS;
          if (weeksSinceEnd < 1) continue;
          if (Math.random() > AGENT_CALL_CHANCE_WEEKLY) continue;
          await maybeTriggerContractRequest(game, player, false);
          usedProposals.add(player.team_id);
        }
        continue;
      }

      // NPC team: renew if player needed (position below min) and team financially healthy
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
              "UPDATE players SET wage = ?, contract_until_matchweek = ?, contract_start_epoch = ?, joined_matchweek = ?, contract_request_pending = 0, contract_requested_wage = 0, contract_request_is_renegotiation = 0, transfer_status = 'none', transfer_price = 0 WHERE id = ?",
              [fairWage, seasonEnd, now, game.matchweek, player.id],
              () => resolve(),
            );
          });
          continue;
        }
      }

      // Auction path: NPC surplus/unaffordable
      const agent = getAgentName(player.id);
      const auctionPrice = Math.max(
        Math.round(effectiveValue(player) * 0.65),
        Math.max(Math.round((player.skill || 0) * 40), 500) * 12,
      );
      await new Promise<void>((resolve) => {
        game.db.run(
          "UPDATE players SET contract_start_epoch = 0, contract_request_pending = 0, contract_requested_wage = 0, contract_request_is_renegotiation = 0 WHERE id = ?",
          [player.id],
          () => {
            startAuction(game, player, auctionPrice, resolve, true);
          },
        );
      });
    }

  };

  return {
    maybeTriggerContractRequest,
    resendPendingContractRequests,
    processAgentRenegotiations,
    processContractExpiries,
  };
}
