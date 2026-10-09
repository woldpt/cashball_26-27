import type { ActiveGame } from "./types";
import { logClubNews, recordTransfer, getTeamsWithCoachNames, currentEpoch, currentSlot } from "./coreHelpers";
import { signingWage, AUCTION_BID_STEP, CONTRACT_LENGTH_WEEKS, NPC_BUY_FLOOR_MARGIN, CONTRACT_REQUEST_RESET_SQL, NPC_LIST_SQUAD_THRESHOLDS, AUCTION_NPC_WINDOW_MS, AUCTION_NPC_GAP_MIN_MS, AUCTION_NPC_GAP_MAX_MS, AUCTION_NPC_CLOSE_MARGIN_MS } from "./gameConstants";

type AnyRow = Record<string, any>;

type NpcQueueItem = { kind: "entry" | "counter"; npcTeamId: number; maxBid: number };

/**
 * Próximo instante em que um NPC pode licitar: nunca antes da janela final,
 * nunca antes de `gapMs` depois do lance de NPC anterior, nunca perto do fecho.
 * Devolve null se já não há tempo.
 */
export function nextNpcReleaseAt(args: {
  now: number;
  endsAt: number;
  lastReleaseAt: number | null;
  gapMs: number;
}): number | null {
  const windowStart = args.endsAt - AUCTION_NPC_WINDOW_MS;
  const closeAt = args.endsAt - AUCTION_NPC_CLOSE_MARGIN_MS;
  let at = Math.max(args.now, windowStart);
  if (args.lastReleaseAt != null) at = Math.max(at, args.lastReleaseAt + args.gapMs);
  return at < closeAt ? at : null;
}

type PlaceBid = (game: ActiveGame, teamId: number, playerId: number, bidAmount: number) => Promise<any>;

/** Fila de lances de NPC de um leilão: um lance libertado de cada vez, espaçado e só na janela final. */
function enqueueNpcBid(game: ActiveGame, playerId: number, item: NpcQueueItem, placeAuctionBid: PlaceBid) {
  const auction = game.auctions?.[playerId] as any;
  if (!auction) return;
  if (!auction.npcQueue) auction.npcQueue = [];
  // Um NPC só fica uma vez na fila (o sorteio repete-se a cada lance)
  if (auction.npcQueue.some((q: NpcQueueItem) => q.npcTeamId === item.npcTeamId)) return;
  auction.npcQueue.push(item);
  pumpNpcQueue(game, playerId, placeAuctionBid);
}

function pumpNpcQueue(game: ActiveGame, playerId: number, placeAuctionBid: PlaceBid) {
  const auction = game.auctions?.[playerId] as any;
  if (!auction) return;
  if (auction.status !== "open") {
    auction.npcQueue = [];
    return;
  }
  if (auction.npcPumpTimer || !auction.npcQueue?.length) return;
  const at = nextNpcReleaseAt({
    now: Date.now(),
    endsAt: auction.endsAt,
    lastReleaseAt: auction.npcLastReleaseAt ?? null,
    gapMs: AUCTION_NPC_GAP_MIN_MS + Math.random() * (AUCTION_NPC_GAP_MAX_MS - AUCTION_NPC_GAP_MIN_MS),
  });
  if (at == null) {
    auction.npcQueue = [];
    return;
  }
  auction.npcPumpTimer = setTimeout(() => {
    auction.npcPumpTimer = null;
    releaseNpcBid(game, playerId, placeAuctionBid);
  }, at - Date.now());
}

function releaseNpcBid(game: ActiveGame, playerId: number, placeAuctionBid: PlaceBid) {
  const auction = game.auctions?.[playerId] as any;
  if (!auction || auction.status !== "open") return;
  // Temporizador antigo (ex.: antes de uma pausa): reagenda dentro da janela certa
  if (Date.now() < auction.endsAt - AUCTION_NPC_WINDOW_MS) {
    pumpNpcQueue(game, playerId, placeAuctionBid);
    return;
  }
  const item: NpcQueueItem | undefined = auction.npcQueue?.shift();
  if (item) {
    auction.npcLastReleaseAt = Date.now();
    let highAmt = -1;
    let highTeam: number | null = null;
    for (const [tid, val] of Object.entries(auction.bids || {})) {
      const b = Number((val as any)?.amount || 0);
      if (b > highAmt) { highAmt = b; highTeam = Number(tid); }
    }
    const leaderIsNpc = highTeam === item.npcTeamId;
    if (item.kind === "entry") {
      // Preço atual + incremento; se já não couber no limite do NPC, desiste em silêncio
      const amount = highTeam != null ? highAmt + AUCTION_BID_STEP : auction.startingPrice;
      if (auction.bids[item.npcTeamId] == null && !leaderIsNpc && amount <= item.maxBid) {
        placeAuctionBid(game, item.npcTeamId, playerId, amount);
      }
    } else if (!leaderIsNpc && Math.random() <= 0.6) {
      // Contra-lance: 60% de hipótese, e só uma vez por leilão
      if (!auction.npcRelicitationCount) auction.npcRelicitationCount = {};
      const counterBid = highAmt + AUCTION_BID_STEP;
      if (counterBid <= item.maxBid) {
        auction.npcRelicitationCount[item.npcTeamId] = (auction.npcRelicitationCount[item.npcTeamId] ?? 0) + 1;
        placeAuctionBid(game, item.npcTeamId, playerId, counterBid);
      }
    }
  }
  pumpNpcQueue(game, playerId, placeAuctionBid);
}

type RunAll = <T extends AnyRow = AnyRow>(
  db: any,
  sql: string,
  params?: any[],
) => Promise<T[]>;

interface NpcTransferDeps {
  runAll: RunAll;
  getSeasonEndMatchweek: (matchweek: number) => number;
  io: any;
}

export function createNpcTransferHelpers(deps: NpcTransferDeps) {
  const { runAll, getSeasonEndMatchweek, io } = deps;

  const processNpcTransferActivity = async (
    game: ActiveGame,
    listPlayerOnMarket: (
      game: ActiveGame,
      playerId: number,
      mode: string,
      price: number,
      callback?: (...args: any[]) => void,
    ) => void,
  ) => {
    const humanTeamIds = new Set(
      Object.values(game.playersByName)
        .map((p) => p.teamId)
        .filter(Boolean),
    );

    const allTeams = await runAll(
      game.db,
      "SELECT * FROM teams WHERE budget > 20000",
    );
    const npcTeams = allTeams.filter((team) => !humanTeamIds.has(team.id));
    if (npcTeams.length === 0) return;

    const marketPlayers = await runAll(
      game.db,
      "SELECT * FROM players WHERE team_id IS NOT NULL AND transfer_status = 'fixed' AND (contract_start_epoch = 0 OR contract_start_epoch + ? <= ?) ORDER BY skill DESC, value ASC",
      [CONTRACT_LENGTH_WEEKS, currentEpoch(game)],
    );

    for (const npcTeam of npcTeams) {
      const squadRows = await runAll(
        game.db,
        "SELECT id FROM players WHERE team_id = ?",
        [npcTeam.id],
      );
      if (squadRows.length >= 24) continue;
      if (Math.random() > 0.65) continue;

      // Nível da equipa: média dos 14 melhores (não do plantel inteiro —
      // suplentes e juniores puxavam a fasquia para baixo). Só compra quem
      // está à altura: rejeita abaixo de (nível − margem), sem teto acima.
      const levelRows = await runAll<{ skill?: number }>(
        game.db,
        "SELECT skill FROM players WHERE team_id = ? AND id > 0 ORDER BY skill DESC LIMIT 14",
        [npcTeam.id],
      );
      const teamLevel = levelRows.length > 0
        ? levelRows.reduce((s, p) => s + (p.skill || 0), 0) / levelRows.length
        : 0;

      for (const player of marketPlayers) {
        if (player.team_id === npcTeam.id) continue;
        if (teamLevel > 0 && (player.skill || 0) < teamLevel - NPC_BUY_FLOOR_MARGIN) continue;

        const listedPrice =
          player.transfer_status === "fixed" && player.transfer_price > 0
            ? player.transfer_price
            : Math.round((player.value || 0) * 1.2);
        if (listedPrice <= 0) continue;
        if (listedPrice > npcTeam.budget * 0.7) continue;
        if (Math.random() > 0.75) continue;

        // Contra-oferta: quando o preço pedido aperta o orçamento (entre 35% e 70%),
        // o NPC negocia e compra a 85% do preço listado em vez de ignorar a lista.
        const price =
          listedPrice > npcTeam.budget * 0.35
            ? Math.round(listedPrice * 0.85)
            : listedPrice;
        if (price <= 0) continue;

        await new Promise((resolve) => {
          game.db.run(
            "UPDATE teams SET budget = budget - ? WHERE id = ?",
            [price, npcTeam.id],
            resolve,
          );
        });

        if (player.team_id) {
          await new Promise((resolve) => {
            game.db.run(
              "UPDATE teams SET budget = budget + ? WHERE id = ?",
              [price, player.team_id],
              resolve,
            );
          });
        }

        // Conditional UPDATE: only proceed if the player is still on the transfer list.
        // This prevents a double-sale when two NPC teams share the same marketPlayers snapshot.
        const changes = await new Promise<number>((resolve) => {
          game.db.run(
            `UPDATE players SET team_id = ?, wage = ?, transfer_status = 'none', transfer_price = 0, contract_until_matchweek = ?, contract_start_epoch = ?, joined_matchweek = ?, transfer_cooldown_until_matchweek = ?, morale = MIN(50, morale + 8), ${CONTRACT_REQUEST_RESET_SQL} WHERE id = ? AND transfer_status = 'fixed' AND (contract_start_epoch = 0 OR contract_start_epoch + ? <= ?)`,
            [
              npcTeam.id,
              signingWage(player),
              getSeasonEndMatchweek(game.matchweek),
              currentEpoch(game),
              currentSlot(game),
              currentSlot(game),
              player.id,
              CONTRACT_LENGTH_WEEKS,
              currentEpoch(game),
            ],
            function (this: any) {
              resolve(this.changes ?? 0);
            },
          );
        });

        if (changes === 0) {
          // Player was already sold to another NPC — roll back the budget deduction
          await new Promise((resolve) => {
            game.db.run(
              "UPDATE teams SET budget = budget + ? WHERE id = ?",
              [price, npcTeam.id],
              resolve,
            );
          });
          if (player.team_id) {
            await new Promise((resolve) => {
              game.db.run(
                "UPDATE teams SET budget = budget - ? WHERE id = ?",
                [price, player.team_id],
                resolve,
              );
            });
          }
          continue; // try next player
        }

        // Remove from in-memory snapshot so no other NPC can re-buy this player
        const idx = marketPlayers.indexOf(player);
        if (idx > -1) marketPlayers.splice(idx, 1);

        // Log club news for seller (human team) when NPC buys from transfer list
        if (player.team_id && humanTeamIds.has(player.team_id)) {
          logClubNews(
            game,
            "transfer_out",
            `${player.name} vendido (Lista de Transferências)`,
            player.team_id,
            {
              player_name: player.name,
              player_id: player.id,
              related_team_id: npcTeam.id,
              related_team_name: npcTeam.name,
              amount: price,
              description: `${player.name} foi vendido por €${price}.`,
            },
            io,
          );
          // Broadcast updated team budgets
          getTeamsWithCoachNames(game.db)
            .then((teams) => io.to(game.roomCode).emit("teamsData", teams))
            .catch(() => {});
        }

        // Registo no histórico global de transferências (venda a NPC)
        recordTransfer(
          game,
          {
            playerId: player.id,
            playerName: player.name,
            position: player.position,
            skill: player.skill,
            isStar: player.is_star,
            photo: player.photo || null,
            sellerTeamId: player.team_id,
            sellerTeamName: player.team_name || null,
            buyerTeamId: npcTeam.id,
            buyerTeamName: npcTeam.name,
            amount: price,
            source: "npc",
          },
          io,
        );

        npcTeam.budget -= price;
        break;
      }
    }

    const allNpcTeams = (await runAll(game.db, "SELECT * FROM teams")).filter(
      (team) => !humanTeamIds.has(team.id),
    );

    const npcListings: Array<{
      candidate: any;
      price: number;
    }> = [];
    for (const npcTeam of allNpcTeams) {
      const squad = await runAll(
        game.db,
        "SELECT * FROM players WHERE team_id = ? AND transfer_status = 'none' AND contract_request_pending = 0 AND (contract_start_epoch = 0 OR contract_start_epoch + ? <= ?) ORDER BY skill ASC",
        [npcTeam.id, CONTRACT_LENGTH_WEEKS, currentEpoch(game)],
      );

      const listChance =
        NPC_LIST_SQUAD_THRESHOLDS.find((t) => squad.length > t.size)?.chance ?? 0;
      if (listChance === 0 || Math.random() > listChance) continue;

      const candidate = squad[0];
      if (!candidate) continue;

      const price = Math.round((candidate.value || 0) * 1.0);
      if (price <= 0) continue;

      npcListings.push({ candidate, price });
    }

    if (npcListings.length === 0) return;

    for (const { candidate, price } of npcListings) {
      await new Promise((resolve) => {
        listPlayerOnMarket(game, candidate.id, "fixed", price, resolve);
      });
    }
  };

  const scheduleNpcAuctionBids = (
    game: ActiveGame,
    playerId: number,
    placeAuctionBid: (
      game: ActiveGame,
      teamId: number,
      playerId: number,
      bidAmount: number,
    ) => Promise<any>,
  ) => {
    const auction = game.auctions?.[playerId] as any;
    if (!auction) return;
    // Também chamado na retoma após pausa: a fila tem de voltar a andar mesmo sem sorteios novos
    pumpNpcQueue(game, playerId, placeAuctionBid);

    const humanTeamIds = new Set(
      Object.values(game.playersByName)
        .map((p) => p.teamId)
        .filter(Boolean),
    );

    // Buscar todos os dados necessários numa só query:
    // equipas com orçamento acima do preço base, divisão da equipa vendedora, e
    // composição do plantel de cada candidata (para avaliar necessidades por posição).
    game.db.get(
      "SELECT division FROM teams WHERE id = ?",
      [auction.sellerTeamId],
      (errDiv: any, sellerRow: any) => {
        const sellerDivision: number = sellerRow?.division ?? 3;

        game.db.all(
          "SELECT position, skill, value, wage, is_star FROM players WHERE id = ?",
          [playerId],
          (errP: any, playerRows: any[]) => {
            const playerInfo = playerRows?.[0] ?? null;
            if (!playerInfo) return;

            const playerValue = playerInfo.value || 0;
            const playerPosition: string = playerInfo.position || "MED";
            const playerSkill: number = playerInfo.skill || 50;

            game.db.all(
              "SELECT * FROM teams WHERE budget > ?",
              [auction.startingPrice],
              (err: any, teams: any[]) => {
                if (err || !teams) return;
                const npcTeams = teams.filter(
                  (team) =>
                    !humanTeamIds.has(team.id) &&
                    team.id !== auction.sellerTeamId &&
                    Math.abs((team.division ?? 3) - sellerDivision) <= 2,
                );
                if (npcTeams.length === 0) return;

                // Para cada equipa NPC elegível, verificar necessidades de plantel
                // e calcular probabilidade de interesse
                let processed = 0;
                for (const npcTeam of npcTeams) {
                  game.db.all(
                    "SELECT id, position, skill FROM players WHERE team_id = ?",
                    [npcTeam.id],
                    (errS: any, squadRows: any[]) => {
                      processed++;
                      if (errS || !squadRows) {
                        if (processed === npcTeams.length) return;
                        return;
                      }

                      // Contar jogadores por posição — só o plantel principal
                      // (id > 0); juniores (ids negativos) não contam para
                      // necessidades (o avgSkill abaixo já os exclui).
                      const seniorRows = squadRows.filter(
                        (p: any) => (p as any).id > 0,
                      );
                      const posCounts: Record<string, number> = { GR: 0, DEF: 0, MED: 0, ATA: 0 };
                      for (const p of seniorRows) {
                        if (posCounts[p.position] !== undefined) posCounts[p.position]++;
                      }

                      // Mínimos recomendados por posição para um plantel funcional
                      const POS_MIN: Record<string, number> = { GR: 2, DEF: 4, MED: 4, ATA: 3 };
                      const posMin = POS_MIN[playerPosition] ?? 3;
                      const posCount = posCounts[playerPosition] ?? 0;
                      const hasUrgentNeed = posCount < posMin;
                      const hasModerateNeed = posCount >= posMin && seniorRows.length < 20;

                      // Calcular nível médio do plantel pelos 14 melhores — NPC só compra
                      // se o jogador estiver à altura (piso: nível − margem, sem teto).
                      const levelRows = [...squadRows]
                        .filter((p) => (p as any).id > 0)
                        .sort((a, b) => ((b as any).skill || 0) - ((a as any).skill || 0))
                        .slice(0, 14);
                      const avgSkill = levelRows.length > 0
                        ? levelRows.reduce((s, p) => s + ((p as any).skill || 0), 0) / levelRows.length
                        : playerSkill;
                      if (playerSkill < avgSkill - NPC_BUY_FLOOR_MARGIN) return;

                      // Probabilidade de participação
                      let interestProb = 0.0;
                      if (hasUrgentNeed) interestProb += 0.7;
                      else if (hasModerateNeed) interestProb += 0.35;
                      else interestProb += 0.20; // pode reforçar mesmo sem necessidade urgente

                      // NPC de divisão mais forte → mais confiante/agressivo
                      const npcDiv = npcTeam.division ?? 3;
                      if (npcDiv < sellerDivision) interestProb *= 1.3;
                      else if (npcDiv > sellerDivision) interestProb *= 0.7;

                      // Cap a 85%
                      interestProb = Math.min(interestProb, 0.85);

                      if (Math.random() > interestProb) return;

                      // Orçamento máximo que este NPC está disposto a pagar
                      const budgetCap = Math.round(npcTeam.budget * 0.6);
                      const valueCap = Math.round(playerValue * 2.5);
                      const maxBid = Math.min(budgetCap, valueCap);
                      if (maxBid < auction.startingPrice) return;

                      // Entra na fila da janela final; o valor é recalculado ao libertar
                      enqueueNpcBid(game, playerId, { kind: "entry", npcTeamId: npcTeam.id, maxBid }, placeAuctionBid);
                    },
                  );
                }
              },
            );
          },
        );
      },
    );
  };

  /**
   * Agendado quando um NPC perde a liderança de um leilão.
   * Dá ao NPC uma oportunidade de relicitar (máximo 1 vez por leilão).
   */
  const scheduleNpcCounterBid = (
    game: ActiveGame,
    playerId: number,
    npcTeamId: number,
    placeAuctionBid: (
      game: ActiveGame,
      teamId: number,
      playerId: number,
      bidAmount: number,
    ) => Promise<any>,
  ) => {
    const auction = game.auctions?.[playerId] as any;
    if (!auction) return;

    // Inicializar contador de relicitações se necessário
    if (!auction.npcRelicitationCount) auction.npcRelicitationCount = {};
    if ((auction.npcRelicitationCount[npcTeamId] ?? 0) >= 1) return; // já relicitou

    // Orçamento lido já: o limite de 60% fixa-se aqui; o lance é decidido na janela final
    game.db.get(
      "SELECT budget FROM teams WHERE id = ?",
      [npcTeamId],
      (err: any, teamRow: any) => {
        if (err || !teamRow) return;
        enqueueNpcBid(game, playerId, { kind: "counter", npcTeamId, maxBid: Math.round(teamRow.budget * 0.6) }, placeAuctionBid);
      },
    );
  };

  return {
    processNpcTransferActivity,
    scheduleNpcAuctionBids,
    scheduleNpcCounterBid,
  };
}
