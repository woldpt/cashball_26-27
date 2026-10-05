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

// ── Apito final realista (síntese Web Audio, sem ficheiros) ──────────────
// Apito de bolinha: tom ~2,9 kHz com trilo de amplitude (~38 Hz, a bolinha),
// leve subida de tom ao encher, e sopro de ar (ruído filtrado). Três silvos:
// curto-curto-longo. Por baixo, a bancada reage consoante o desfecho.
let _noise = null;
const noiseBuffer = (ctx) => {
  if (_noise && _noise.sampleRate === ctx.sampleRate) return _noise;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (_noise = buf);
};

const blast = (ctx, t, dur, vol) => {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vol, t + 0.025);
  out.gain.setValueAtTime(vol, t + dur - 0.05);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(ctx.destination);
  // Trilo da bolinha: LFO a modular o ganho do tom.
  const trill = ctx.createGain();
  trill.gain.value = 0.65;
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 38;
  lfoDepth.gain.value = 0.35;
  lfo.connect(lfoDepth).connect(trill.gain);
  trill.connect(out);
  [2880, 2915].forEach((f) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.06);
    o.connect(trill);
    o.start(t);
    o.stop(t + dur);
  });
  // Sopro de ar.
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value = 2.5;
  const ng = ctx.createGain();
  ng.gain.value = 0.5;
  n.connect(bp).connect(ng).connect(out);
  n.start(t);
  n.stop(t + dur);
  lfo.start(t);
  lfo.stop(t + dur);
};

// Bancada: ruído filtrado com swell. win = rugido que sobe e fica;
// loss = lamento grave que desce; draw = murmúrio morno.
const crowd = (ctx, t, outcome) => {
  const cfg = {
    win: { f0: 500, f1: 1100, peak: 0.16, rise: 0.9, dur: 4.2 },
    draw: { f0: 450, f1: 450, peak: 0.07, rise: 0.8, dur: 3 },
    loss: { f0: 700, f1: 260, peak: 0.1, rise: 0.5, dur: 3.2 },
  }[outcome] || { f0: 450, f1: 450, peak: 0.07, rise: 0.8, dur: 3 };
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  n.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(cfg.f0, t);
  bp.frequency.linearRampToValueAtTime(cfg.f1, t + cfg.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(cfg.peak, t + cfg.rise);
  g.gain.setValueAtTime(cfg.peak, t + cfg.dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.dur);
  n.connect(bp).connect(g).connect(ctx.destination);
  n.start(t);
  n.stop(t + cfg.dur);
};

/**
 * Apito final: curto-curto-longo + reação da bancada.
 * @param {"win"|"loss"|"draw"} [outcome] Desfecho do meu jogo.
 */
export const playWhistleSound = (outcome) => {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    blast(ctx, t, 0.22, 0.2);
    blast(ctx, t + 0.34, 0.22, 0.2);
    blast(ctx, t + 0.68, 0.9, 0.24);
    crowd(ctx, t + 0.9, outcome);
  } catch {
    // ignore
  }
};
