import { getStandingsRows } from "./coreHelpers";
import { DIVISION_NAMES } from "./gameConstants";
import type { ActiveGame } from "./types";

// Notícias automáticas do rodapé "Notícias CM": factos reais derivados de
// resultados, classificações, leilões e Taça — zero filler inventado. O
// cliente consome via `systemMessage { broadcast, cm }` sem mudanças.

/** Emite uma linha para o rodapé (efémera, só vive na sessão do cliente). */
export function emitCmNews(game: ActiveGame, io: any, text: string): void {
  io.to(game.roomCode).emit("systemMessage", {
    text,
    broadcast: true,
    cm: true,
  });
}

export interface CmLeader {
  id: number;
  name: string;
  points: number;
}

/** Líder de cada divisão pela ordenação oficial (determinística em empates). */
export function readCmLeaders(db: any): Promise<Map<number, CmLeader>> {
  return new Promise((resolve) => {
    db.all(
      "SELECT id, division, name, points, goals_for, goals_against FROM teams",
      (err: any, rows: any[]) => {
        const leaders = new Map<number, CmLeader>();
        if (err || !rows) return resolve(leaders);
        const byDiv = new Map<number, any[]>();
        for (const t of rows) {
          const list = byDiv.get(t.division) || [];
          list.push(t);
          byDiv.set(t.division, list);
        }
        for (const [div, list] of byDiv) {
          const top = getStandingsRows(list)[0];
          if (top) leaders.set(div, { id: top.id, name: top.name, points: top.points || 0 });
        }
        resolve(leaders);
      },
    );
  });
}

/** Divisões cujo líder mudou (ignora arranque com tabela a zeros). */
export function diffCmLeaders(
  before: Map<number, CmLeader>,
  after: Map<number, CmLeader>,
): Array<{ div: number; name: string }> {
  const changed: Array<{ div: number; name: string }> = [];
  for (const [div, curr] of after) {
    const prev = before.get(div);
    if (prev && prev.id !== curr.id && curr.points > 0) {
      changed.push({ div, name: curr.name });
    }
  }
  return changed;
}

export function cmLeaderText(div: number, name: string): string {
  return `👑 MUDANÇA NO TOPO: ${name} é o novo líder da ${DIVISION_NAMES[div] || `Divisão ${div}`}!`;
}

export interface CmGoleada {
  winner: string;
  loser: string;
  hg: number;
  ag: number;
}

/** Maior goleada dos jogos; null se nenhuma chegar à margem mínima. */
export function pickCmGoleada(fixtures: any[], minMargin = 4): CmGoleada | null {
  let best: CmGoleada | null = null;
  let bestMargin = minMargin - 1;
  for (const f of fixtures || []) {
    const hg = Number(f.finalHomeGoals);
    const ag = Number(f.finalAwayGoals);
    if (!Number.isFinite(hg) || !Number.isFinite(ag) || hg === ag) continue;
    const margin = Math.abs(hg - ag);
    if (margin <= bestMargin) continue;
    const homeWon = hg > ag;
    bestMargin = margin;
    best = {
      winner: homeWon
        ? (f.homeTeam?.name ?? `Equipa ${f.homeTeamId}`)
        : (f.awayTeam?.name ?? `Equipa ${f.awayTeamId}`),
      loser: homeWon
        ? (f.awayTeam?.name ?? `Equipa ${f.awayTeamId}`)
        : (f.homeTeam?.name ?? `Equipa ${f.homeTeamId}`),
      hg: homeWon ? hg : ag,
      ag: homeWon ? ag : hg,
    };
  }
  return best;
}

export function cmGoleadaText(g: CmGoleada): string {
  return `💥 GOLEADA DA JORNADA: ${g.winner} esmaga ${g.loser} por ${g.hg}-${g.ag}!`;
}

function cmEuros(value: number): string {
  return `${new Intl.NumberFormat("pt-PT").format(value)}€`;
}

/**
 * Verdadeiro se a venda (já persistida em `transfer_history`) é o recorde da
 * sala: há outras vendas e nenhuma igualou/superou o valor. Persistente —
 * sobrevive a restarts do servidor, ao contrário de um máximo em memória.
 */
export function cmIsRecordSale(db: any, amount: number): Promise<boolean> {
  return new Promise((resolve) => {
    db.get(
      "SELECT COUNT(*) AS total, SUM(amount >= ?) AS top FROM transfer_history",
      [amount],
      (err: any, row: any) => {
        if (err || !row) return resolve(false);
        resolve(row.total > 1 && row.top === 1);
      },
    );
  });
}

export function cmAuctionText(playerName: string, buyerTeamName: string, finalBid: number): string {
  return `💰 MERCADO: ${playerName} reforça ${buyerTeamName} por ${cmEuros(finalBid)}!`;
}

export function cmBombText(playerName: string, buyerTeamName: string, finalBid: number): string {
  return `💣 BOMBA DE MERCADO: ${buyerTeamName} paga ${cmEuros(finalBid)} por ${playerName} — recorde da sala!`;
}

export function cmUpsetText(winnerName: string, winnerDiv: number, loserName: string): string {
  return `🏆 TOMBA-GIGANTES: ${winnerName} (${DIVISION_NAMES[winnerDiv] || `Divisão ${winnerDiv}`}) elimina ${loserName} da Taça!`;
}
