/**
 * staffHelpers.ts — funcionários do clube (contratação, despedimento, NPC).
 *
 * O que vive aqui: tabela de preços (delegada em `gameConstants`), nomes de
 * humor por papel/nível, leitura do estado para a UI, e as transições de
 * contratação/despedimento com débito atómico do orçamento.
 *
 * O que NÃO vive aqui: os efeitos no jogo. Cada efeito é aplicado no sítio
 * que o consome (treino em `trainingHelpers`, folha semanal em
 * `weeklyFlowHelpers`) — este módulo só responde a "que níveis tem esta
 * equipa" (`fetchStaffLevels`) e "quanto paga por semana" (`fetchStaffSalaryTotals`).
 */
import type { ActiveGame } from "./types";
import { dbAllAsync, dbGetAsync } from "./game/dbAsync";
import {
  STAFF_SLOTS,
  STAFF_MAX_LEVEL,
  STAFF_ROLES,
  STAFF_SIGNING_WEEKS,
  STAFF_SEVERANCE_WEEKS,
  STAFF_NPC_LEVEL_BY_DIVISION,
  STAFF_TRAINING_PER_LEVEL,
  STAFF_RESISTANCE_PER_LEVEL,
  STAFF_ATTENDANCE_PER_LEVEL,
  STAFF_FANS_DECAY_REDUCTION_PER_LEVEL,
  STAFF_INJURY_REDUCTION_PER_LEVEL,
  STAFF_INJURY_WEEKS_PER_2_LEVELS,
  STAFF_INJURY_SKILL_LOSS_PER_LEVEL,
  type StaffRole,
  staffSalaryFor,
  staffSigningFee,
  staffSeverance,
} from "./gameConstants";
import { currentSlot, logClubNews, runExec } from "./coreHelpers";

/**
 * Reserva de tesouraria exigida aos NPCs antes de contratar: o custo de
 * assinatura não pode comer mais de 1/4 do que têm em caixa.
 */
const NPC_HIRE_RESERVE = 4;

/** Nome de cada funcionário, determinístico por papel e nível (sem RNG). */
const STAFF_NAMES: Record<StaffRole, string[]> = {
  auxiliar: [
    "Zé Traininho",
    "Mestre Fontes",
    "Prof. Cabrita",
    "Eng. Táctica",
    "Doutor Futebol",
  ],
  fisico: [
    "Sargento Brás",
    "Enf. Cardio",
    "Mestre Flexões",
    "Dra. Recuperação",
    "Sr. Alongamento",
  ],
  comunicacao: [
    "Tó Megafone",
    "Dona Bilhete",
    "Zé Cartaz",
    "Dra. Imprensa",
    "Senhor Estrondo",
  ],
  medico: [
    "Dr. Ossos",
    "Enf. Pensos",
    "Dr. Gelo",
    "Dra. Radiografia",
    "Prof. Milagre",
  ],
};

/** Nome canónico de um funcionário (nível clampado à tabela). */
export function staffNameFor(role: StaffRole | string, level: number): string {
  const list = STAFF_NAMES[role as StaffRole] ?? [];
  const lvl = Math.min(STAFF_MAX_LEVEL, Math.max(1, Math.floor(Number(level) || 1)));
  return list[lvl - 1] ?? "Funcionário";
}

export interface StaffMember {
  role: string;
  level: number;
  name: string;
  salaryWeekly: number;
  hiredSlot: number;
  /** Números do efeito — o cliente formata, nunca recalcula. */
  effect: Record<string, number>;
  /** Indemnização de despedimento. */
  severance: number;
}

export interface StaffState {
  /** Papéis disponíveis (ordem canónica). */
  roles: string[];
  slots: number;
  used: number;
  maxLevel: number;
  /** Tabela de salários por nível (índice 0 = nível 1). */
  salaries: number[];
  signingWeeks: number;
  severanceWeeks: number;
  budget: number;
  /** Total pago por semana em funcionários. */
  salaryWeekly: number;
  /** Efeito de cada papel em cada nível (índice 0 = nível 1) — a pré-visualização da contratação. */
  previews: Record<string, Array<Record<string, number>>>;
  members: StaffMember[];
}

/** Números do efeito de um papel a um nível (o rótulo é do cliente). */
export function staffEffectNumbers(role: string, level: number): Record<string, number> {
  const lvl = Math.min(STAFF_MAX_LEVEL, Math.max(1, Math.floor(Number(level) || 1)));
  if (role === "auxiliar") {
    return { trainingPct: Math.round(STAFF_TRAINING_PER_LEVEL * lvl * 100) };
  }
  if (role === "fisico") {
    return {
      restedForm: Math.floor(lvl / 2),
      resistance: Math.round(STAFF_RESISTANCE_PER_LEVEL * lvl * 10) / 10,
      decayPct: Math.round(0.08 * lvl * 100),
    };
  }
  if (role === "comunicacao") {
    return {
      attendancePct: Math.round(STAFF_ATTENDANCE_PER_LEVEL * lvl * 100),
      fansDecayPct: Math.round(STAFF_FANS_DECAY_REDUCTION_PER_LEVEL * lvl * 100),
    };
  }
  if (role === "medico") {
    return {
      injuryPct: Math.round(STAFF_INJURY_REDUCTION_PER_LEVEL * lvl * 100),
      weeksCut: Math.floor(lvl / 2) * STAFF_INJURY_WEEKS_PER_2_LEVELS,
      skillSaved: lvl * STAFF_INJURY_SKILL_LOSS_PER_LEVEL,
    };
  }
  return {};
}

/** Funcionários contratados por uma equipa. */
export function fetchTeamStaff(game: ActiveGame, teamId: number): Promise<any[]> {
  return dbAllAsync(
    game.db,
    "SELECT role, level, name, salary_weekly, hired_slot FROM team_staff WHERE team_id = ? ORDER BY role",
    [teamId],
  );
}

/**
 * Níveis por equipa, para quem aplica efeitos no jogo:
 * `Map<teamId, { auxiliar: 3, fisico: 2 }>` (papéis ausentes não existem no
 * mapa). Uma query só, à imagem do `trainingByTeam`.
 */
export async function fetchStaffLevels(
  game: ActiveGame,
  teamIds: number[],
): Promise<Map<number, Record<string, number>>> {
  const map = new Map<number, Record<string, number>>();
  if (!teamIds || teamIds.length === 0) return map;
  const placeholders = teamIds.map(() => "?").join(",");
  const rows = await dbAllAsync<{ team_id: number; role: string; level: number }>(
    game.db,
    `SELECT team_id, role, level FROM team_staff WHERE team_id IN (${placeholders})`,
    teamIds,
  ).catch(() => []);
  for (const row of rows || []) {
    const entry = map.get(row.team_id) ?? {};
    entry[row.role] = Number(row.level) || 0;
    map.set(row.team_id, entry);
  }
  return map;
}

/** Total de salários de funcionários por equipa (folha semanal). */
export async function fetchStaffSalaryTotals(
  game: ActiveGame,
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const rows = await dbAllAsync<{ team_id: number; total: number }>(
    game.db,
    "SELECT team_id, COALESCE(SUM(salary_weekly), 0) AS total FROM team_staff GROUP BY team_id",
  ).catch(() => []);
  for (const row of rows || []) map.set(row.team_id, Number(row.total) || 0);
  return map;
}

/** Estado completo para a secção «Funcionários» do Clube (payload do socket). */
export async function buildStaffState(
  game: ActiveGame,
  teamId: number,
): Promise<StaffState | null> {
  const team = await dbGetAsync<{ budget: number }>(
    game.db,
    "SELECT budget FROM teams WHERE id = ?",
    [teamId],
  ).catch(() => undefined);
  if (!team) return null;
  const rows = await fetchTeamStaff(game, teamId).catch(() => []);
  const previews: Record<string, Array<Record<string, number>>> = {};
  for (const role of STAFF_ROLES) {
    previews[role] = Array.from({ length: STAFF_MAX_LEVEL }, (_, i) =>
      staffEffectNumbers(role, i + 1),
    );
  }
  const members: StaffMember[] = (rows || []).map((r: any) => ({
    role: String(r.role),
    level: Number(r.level) || 1,
    name: String(r.name || staffNameFor(r.role, r.level)),
    salaryWeekly: Number(r.salary_weekly) || staffSalaryFor(r.level),
    hiredSlot: Number(r.hired_slot) || 0,
    effect: staffEffectNumbers(r.role, r.level),
    severance: staffSeverance(r.level),
  }));
  return {
    roles: [...STAFF_ROLES],
    slots: STAFF_SLOTS,
    used: members.length,
    maxLevel: STAFF_MAX_LEVEL,
    salaries: Array.from({ length: STAFF_MAX_LEVEL }, (_, i) => staffSalaryFor(i + 1)),
    signingWeeks: STAFF_SIGNING_WEEKS,
    severanceWeeks: STAFF_SEVERANCE_WEEKS,
    budget: Number(team.budget) || 0,
    salaryWeekly: members.reduce((sum, m) => sum + m.salaryWeekly, 0),
    previews,
    members,
  };
}

export interface HireResult {
  ok: boolean;
  /** Código de erro (ver `ERROR_MESSAGES` no socket handler). */
  error?: string;
  cost?: number;
  salaryWeekly?: number;
}

/**
 * Contrata um funcionário: valida papel/nível/lugares/saldo e debita a
 * assinatura numa transação. O INSERT vai primeiro (a UNIQUE(team_id, role)
 * é a autoridade contra duplicados) e o débito é condicional ao saldo
 * (`WHERE budget >= ?`), por isso não há forma de ficar com o dinheiro
 * tomado sem funcionário nem com funcionário sem pagar.
 */
export async function hireStaff(
  game: ActiveGame,
  teamId: number,
  role: string,
  level: number,
): Promise<HireResult> {
  if (!STAFF_ROLES.includes(role as StaffRole)) return { ok: false, error: "invalid_role" };
  const lvl = Math.floor(Number(level));
  if (!(lvl >= 1 && lvl <= STAFF_MAX_LEVEL)) return { ok: false, error: "invalid_level" };

  const taken = await dbGetAsync(
    game.db,
    "SELECT 1 AS x FROM team_staff WHERE team_id = ? AND role = ?",
    [teamId, role],
  ).catch(() => undefined);
  if (taken) return { ok: false, error: "role_taken" };

  const countRow = await dbGetAsync<{ n: number }>(
    game.db,
    "SELECT COUNT(*) AS n FROM team_staff WHERE team_id = ?",
    [teamId],
  ).catch(() => undefined);
  if ((countRow?.n ?? 0) >= STAFF_SLOTS) return { ok: false, error: "no_slots" };

  const cost = staffSigningFee(lvl);
  const salary = staffSalaryFor(lvl);
  try {
    await runExec(game.db, "BEGIN");
    const insert = await runExec(
      game.db,
      "INSERT INTO team_staff (team_id, role, level, name, salary_weekly, hired_slot) VALUES (?, ?, ?, ?, ?, ?)",
      [teamId, role, lvl, staffNameFor(role, lvl), salary, currentSlot(game)],
    ).catch((err: any) => {
      // UNIQUE(team_id, role) — corrida perdida para outra contratação.
      throw err;
    });
    if (insert.changes === 0) {
      await runExec(game.db, "ROLLBACK").catch(() => {});
      return { ok: false, error: "db" };
    }
    const paid = await runExec(
      game.db,
      "UPDATE teams SET budget = budget - ? WHERE id = ? AND budget >= ?",
      [cost, teamId, cost],
    );
    if (paid.changes === 0) {
      await runExec(game.db, "ROLLBACK").catch(() => {});
      return { ok: false, error: "no_budget" };
    }
    await runExec(game.db, "COMMIT");
  } catch (err) {
    await runExec(game.db, "ROLLBACK").catch(() => {});
    console.error(`[${game.roomCode}] staff: hire failed:`, err);
    return { ok: false, error: "db" };
  }

  logClubNews(game, "staff_hire", `${staffNameFor(role, lvl)} contratado`, teamId, {
    amount: cost,
    slot: currentSlot(game),
    description: `Funcionário contratado (nível ${lvl}) — assinatura de ${cost}€, ${salary}€ por semana.`,
  });
  return { ok: true, cost, salaryWeekly: salary };
}

export interface FireResult {
  ok: boolean;
  error?: string;
  severance?: number;
}

/**
 * Despede um funcionário: remove a linha e paga a indemnização. Sem saldo não
 * se despede (o clube fica com o funcionário até poder pagar) — evita ficar
 * com saldo negativo por causa de um despedimento.
 */
export async function fireStaff(
  game: ActiveGame,
  teamId: number,
  role: string,
): Promise<FireResult> {
  const member = await dbGetAsync<{ level: number; name: string }>(
    game.db,
    "SELECT level, name FROM team_staff WHERE team_id = ? AND role = ?",
    [teamId, role],
  ).catch(() => undefined);
  if (!member) return { ok: false, error: "not_found" };

  const severance = staffSeverance(member.level);
  try {
    await runExec(game.db, "BEGIN");
    const paid = await runExec(
      game.db,
      "UPDATE teams SET budget = budget - ? WHERE id = ? AND budget >= ?",
      [severance, teamId, severance],
    );
    if (paid.changes === 0) {
      await runExec(game.db, "ROLLBACK").catch(() => {});
      return { ok: false, error: "db" };
    }
    await runExec(game.db, "DELETE FROM team_staff WHERE team_id = ? AND role = ?", [
      teamId,
      role,
    ]);
    await runExec(game.db, "COMMIT");
  } catch (err) {
    await runExec(game.db, "ROLLBACK").catch(() => {});
    console.error(`[${game.roomCode}] staff: fire failed:`, err);
    return { ok: false, error: "db" };
  }

  logClubNews(game, "staff_fire", `${member.name} despedido`, teamId, {
    amount: severance,
    slot: currentSlot(game),
    description: `Funcionário despedido — indemnização de ${severance}€.`,
  });
  return { ok: true, severance };
}

/**
 * Direção dos NPCs: uma contratação por semana, da lista de papéis por
 * preencher, ao nível da divisão, e só com reserva de tesouraria.
 * Espelha o `ensureNpcTrainingFocus`: sem isto os humanos (que já treinam
 * 8 vs 5) somavam funcionários por cima e o fosso rebentava.
 * Divisão 5 fica de fora (invisível, não investe) — mesma regra do treino.
 */
export async function ensureNpcStaff(game: ActiveGame): Promise<void> {
  const humanTeamIds = new Set<number>(
    Object.values(game.playersByName || {})
      .map((p: any) => p?.teamId)
      .filter((id: any) => id != null),
  );
  const teams = await dbAllAsync<{ id: number; division: number; budget: number }>(
    game.db,
    "SELECT id, division, budget FROM teams",
  ).catch(() => []);
  for (const team of teams || []) {
    if (humanTeamIds.has(team.id)) continue;
    const division = Number(team.division ?? 4);
    if (division === 5) continue;
    const level = STAFF_NPC_LEVEL_BY_DIVISION[division] ?? 1;
    const cost = staffSigningFee(level);
    if ((team.budget || 0) < cost * NPC_HIRE_RESERVE) continue;

    const rows = await dbAllAsync<{ role: string }>(
      game.db,
      "SELECT role FROM team_staff WHERE team_id = ?",
      [team.id],
    ).catch(() => []);
    if ((rows?.length ?? 0) >= STAFF_SLOTS) continue;
    const role = STAFF_ROLES.find((r) => !(rows || []).some((row) => row.role === r));
    if (!role) continue;
    await hireStaff(game, team.id, role, level);
  }
}
