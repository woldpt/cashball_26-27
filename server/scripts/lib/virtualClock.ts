/**
 * Relógio virtual para o simulador de épocas.
 *
 * Troca `setTimeout`/`clearTimeout`/`Date.now` globais: os temporizadores
 * ficam numa fila ordenada por hora virtual e disparam logo que o processo
 * fica parado (nenhuma operação de BD em curso), saltando o relógio para a
 * hora de cada um. Uma espera de 7 s ou um leilão de 2 min passam num
 * instante, pela mesma ordem em que passariam a sério.
 *
 * "Parado" mede-se pelas operações de sqlite em voo: sem isto um vigia de
 * 5 minutos disparava antes de a escrita que ele vigia ter acabado.
 */
import sqlite3 from "sqlite3";

type Timer = { id: number; at: number; fn: (...a: any[]) => void; args: any[]; dead: boolean };

const realSetImmediate = setImmediate;
const realDateNow = Date.now.bind(Date);

let now = realDateNow();
let seq = 0;
let inFlight = 0;
let idleTurns = 0;
const timers: Timer[] = [];

function wrap(proto: any, method: string) {
  const original = proto[method];
  proto[method] = function (this: any, ...args: any[]) {
    const last = args.length - 1;
    // Sem callback ninguém espera pelo fim: não conta (e algumas escritas
    // preparadas sem callback nunca avisam que acabaram).
    if (typeof args[last] !== "function") return original.apply(this, args);
    inFlight++;
    let settled = false;
    const cb = args[last];
    args[last] = function (this: any, ...cbArgs: any[]) {
      if (!settled) {
        settled = true;
        inFlight--;
      }
      return cb.apply(this, cbArgs);
    };
    return original.apply(this, args);
  };
}

function pump() {
  if (inFlight > 0) idleTurns = 0;
  else idleTurns++;
  // Duas voltas paradas: dá tempo às continuações de promessas de lançarem
  // o trabalho seguinte antes de o relógio saltar.
  if (idleTurns >= 2 && timers.length > 0) {
    let best = 0;
    for (let i = 1; i < timers.length; i++) {
      if (timers[i].at < timers[best].at || (timers[i].at === timers[best].at && timers[i].id < timers[best].id)) best = i;
    }
    const [t] = timers.splice(best, 1);
    idleTurns = 0;
    if (!t.dead) {
      now = Math.max(now, t.at);
      t.fn(...t.args);
    }
  }
  realSetImmediate(pump);
}

/** Liga o relógio virtual. Chamar antes de carregar o servidor. */
export function installVirtualClock(): { now: () => number } {
  // Só os métodos da ligação: por dentro chamam os do Statement, e quando o
  // SQL nem compila o erro volta pela ligação e o Statement nunca responde.
  for (const m of ["run", "get", "all", "exec"]) wrap((sqlite3 as any).Database.prototype, m);

  (globalThis as any).setTimeout = (fn: (...a: any[]) => void, ms = 0, ...args: any[]) => {
    const t: Timer = { id: ++seq, at: now + Math.max(0, Number(ms) || 0), fn, args, dead: false };
    timers.push(t);
    const handle: any = {
      __t: t,
      ref: () => handle,
      unref: () => handle,
      hasRef: () => true,
      refresh: () => {
        t.at = now + Math.max(0, Number(ms) || 0);
        return handle;
      },
      [Symbol.toPrimitive]: () => t.id,
    };
    return handle;
  };
  (globalThis as any).clearTimeout = (handle: any) => {
    const t: Timer | undefined = handle?.__t;
    if (!t) return;
    t.dead = true;
    const i = timers.indexOf(t);
    if (i >= 0) timers.splice(i, 1);
  };
  Date.now = () => now;
  realSetImmediate(pump);
  return { now: () => now };
}
