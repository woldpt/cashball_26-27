/**
 * API mínima do sqlite3 usada pelo engine (audit: antes era `type Db = any`,
 * o que desligava o typecheck em todos os acessos à BD do módulo).
 * Só run/get/all com callbacks de erro — o resto do sqlite3 não é usado aqui.
 */
export type Db = {
  run(
    sql: string,
    params?: any[],
    callback?: (this: unknown, err: Error | null) => void,
  ): unknown;
  get(
    sql: string,
    params?: any[],
    callback?: (this: unknown, err: Error | null, row?: any) => void,
  ): unknown;
  all(
    sql: string,
    params?: any[],
    callback?: (this: unknown, err: Error | null, rows?: any[]) => void,
  ): unknown;
};

// Helpers promisificados (a DB é callback-style) — ÚNICA implementação.
// Antes cada função enrolava o seu `new Promise` à mão (~7 cópias).
export function dbRunAsync(db: Db, sql: string, params: any[] = []): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    db.run(sql, params, (err: any) => (err ? reject(err) : resolve()));
  });
}

export function dbAllAsync<T = any>(db: Db, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err: any, rows: T[]) =>
      err ? reject(err) : resolve(rows || []),
    );
  });
}

export function dbGetAsync<T = any>(
  db: Db,
  sql: string,
  params: any[] = [],
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err: any, row: T) =>
      err ? reject(err) : resolve(row ?? undefined),
    );
  });
}
