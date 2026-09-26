let _ctx = null;

const getCtx = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) _ctx = new AC();
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
};

const playSequence = (sequence, type) => {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    sequence.forEach(({ freq, time, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + time);
      gain.gain.setValueAtTime(vol, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch {
    // ignore
  }
};

export const playNotification = () =>
  playSequence(
    [
      { freq: 880, time: 0, dur: 0.22, vol: 0.07 },
      { freq: 1100, time: 0.13, dur: 0.22, vol: 0.07 },
    ],
    "sine",
  );

// Som especial para golos — mais grave, forte e memorável
export const playGoalSound = () =>
  playSequence(
    [
      { freq: 523, time: 0, dur: 0.12, vol: 0.25 }, // Dó
      { freq: 659, time: 0.1, dur: 0.12, vol: 0.22 }, // Mi
      { freq: 784, time: 0.2, dur: 0.35, vol: 0.28 }, // Sol (nota de celebração)
    ],
    "triangle",
  );

// Fanfarra para contratação de jogador — arpejo ascendente festivo
export const playSigningSound = () =>
  playSequence(
    [
      { freq: 523, time: 0, dur: 0.14, vol: 0.16 }, // Dó
      { freq: 659, time: 0.11, dur: 0.14, vol: 0.18 }, // Mi
      { freq: 784, time: 0.22, dur: 0.14, vol: 0.2 }, // Sol
      { freq: 1046, time: 0.33, dur: 0.42, vol: 0.24 }, // Dó agudo (celebração)
    ],
    "triangle",
  );

// Som de vaia dos adeptos após derrota — drone descendente grave e curto
export const playBooSound = () =>
  playSequence(
    [
      { freq: 330, time: 0, dur: 0.2, vol: 0.14 },
      { freq: 262, time: 0.16, dur: 0.24, vol: 0.16 },
      { freq: 196, time: 0.34, dur: 0.55, vol: 0.18 },
    ],
    "sawtooth",
  );

// Som descendente para golo anulado pelo VAR
export const playVarSound = () =>
  playSequence(
    [
      { freq: 440, time: 0, dur: 0.16, vol: 0.11 },
      { freq: 330, time: 0.15, dur: 0.32, vol: 0.09 },
    ],
    "sine",
  );
