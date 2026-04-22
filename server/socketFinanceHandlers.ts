import type { ActiveGame, PlayerSession } from "./types";
import { runExec } from "./coreHelpers";

interface FinanceHandlerDeps {
  io: any;
  getGameBySocket: (socketId: string) => ActiveGame | null;
  getPlayerBySocket: (
    game: ActiveGame,
    socketId: string,
  ) => PlayerSession | null;
}

export function registerFinanceSocketHandlers(
  socket: any,
  deps: FinanceHandlerDeps,
) {
  const { io, getGameBySocket, getPlayerBySocket } = deps;

  socket.on("buildStadium", async () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const playerState = getPlayerBySocket(game, socket.id);
    if (!playerState) return;

    const team: any = await new Promise((resolve) => {
      game.db.get(
        "SELECT budget, stadium_capacity, name FROM teams WHERE id = ?",
        [playerState.teamId],
        (_err: any, row: any) => resolve(row ?? null),
      );
    });

    const cost = 300000;
    const maxCapacity = 120000;

    if (!team) return;
    if (team.stadium_capacity >= maxCapacity) {
      socket.emit("systemMessage", "Capacidade máxima atingida (120.000 lugares)!");
      return;
    }
    if (team.budget < cost) {
      socket.emit("systemMessage", "Sem dinheiro (Custo: 300.000€)!");
      return;
    }

    const matchweek = game.matchweek || 1;
    try {
      await runExec(game.db, "BEGIN");
      await runExec(
        game.db,
        "UPDATE teams SET budget = budget - ?, stadium_capacity = MIN(stadium_capacity + 5000, ?) WHERE id = ?",
        [cost, maxCapacity, playerState.teamId],
      );
      await runExec(
        game.db,
        "INSERT INTO club_news (team_id, type, title, description, amount, matchweek) VALUES (?, 'stadium_build', 'Expansão do Estádio', '+5000 lugares construídos', ?, ?)",
        [playerState.teamId, cost, matchweek],
      );
      await runExec(game.db, "COMMIT");
    } catch (err) {
      await runExec(game.db, "ROLLBACK").catch(() => {});
      console.error("[buildStadium] Transaction failed:", err);
      socket.emit("systemMessage", "Erro ao construir estádio.");
      return;
    }

    // Emitir teamsData para toda a sala (actualiza budget e capacity)
    game.db.all("SELECT * FROM teams", (_err2: any, teams: any[]) => {
      io.to(game.roomCode).emit("teamsData", teams);
    });
    io.to(game.roomCode).emit("stadiumBuilt", {
      teamId: playerState.teamId,
      teamName: team.name || "",
      newCapacity: (team.stadium_capacity || 10000) + 5000,
    });
    socket.emit("systemMessage", "+5000 Lugares Construídos!");
  });

  socket.on("takeLoan", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const playerState = getPlayerBySocket(game, socket.id);
    if (!playerState) return;

    game.db.get(
      "SELECT budget, loan_amount FROM teams WHERE id = ?",
      [playerState.teamId],
      (err, team) => {
        if (!team) return;
        if (team.loan_amount >= 2500000) {
          socket.emit(
            "systemMessage",
            "Já tens demasiada dívida (máx: 2.500.000€ — 5 empréstimos)!",
          );
          return;
        }
        game.db.run(
          "UPDATE teams SET budget = budget + 500000, loan_amount = loan_amount + 500000 WHERE id = ?",
          [playerState.teamId],
          () => {
            game.db.all("SELECT * FROM teams", (err2, teams) =>
              io.to(game.roomCode).emit("teamsData", teams),
            );
            socket.emit(
              "systemMessage",
              "Empréstimo de 500.000€ aprovado (Juro 1,5%/Semana).",
            );
          },
        );
      },
    );
  });

  socket.on("payLoan", () => {
    const game = getGameBySocket(socket.id);
    if (!game) return;
    const playerState = getPlayerBySocket(game, socket.id);
    if (!playerState) return;

    game.db.get(
      "SELECT budget, loan_amount FROM teams WHERE id = ?",
      [playerState.teamId],
      (err, team) => {
        if (team && team.loan_amount >= 500000 && team.budget >= 500000) {
          game.db.run(
            "UPDATE teams SET budget = budget - 500000, loan_amount = loan_amount - 500000 WHERE id = ?",
            [playerState.teamId],
            () => {
              game.db.all("SELECT * FROM teams", (err2, teams) =>
                io.to(game.roomCode).emit("teamsData", teams),
              );
              socket.emit("systemMessage", "Dívida paga (500.000€) ao Banco.");
            },
          );
        } else {
          socket.emit(
            "systemMessage",
            "Não deves esse valor, ou não tens 500k disponíveis.",
          );
        }
      },
    );
  });
}
