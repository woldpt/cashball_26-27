let _ctx = null;

const getCtx = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) _ctx = new AC();
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
};

// Sino suave: fundamental + parcial inarmónico (×2,76) a decair mais depressa.
const bell = (ctx, t, freq, dur, vol) => {
  [[1, vol, dur], [2.76, vol * 0.35, dur * 0.4]].forEach(([m, v, d]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq * m;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + d);
  });
};

const play = (fn) => {
  try {
    const ctx = getCtx();
    if (ctx) fn(ctx, ctx.currentTime + 0.02);
  } catch {
    // ignore
  }
};

// Notificação: ping de sino em duas notas.
export const playNotification = () =>
  play((ctx, t) => {
    bell(ctx, t, 880, 0.5, 0.07);
    bell(ctx, t + 0.13, 1175, 0.6, 0.07);
  });

// Golo: ding triunfal de sino; só o golo nosso traz o rugido da bancada.
export const playGoalSound = (mine = true) =>
  play((ctx, t) => {
    bell(ctx, t, 523, 0.5, 0.16);
    bell(ctx, t + 0.1, 659, 0.5, 0.16);
    bell(ctx, t + 0.2, 784, 0.9, 0.2);
    if (mine) crowd(ctx, t, "win");
  });

// Contratação: arpejo de sino ascendente, brilhante.
export const playSigningSound = () =>
  play((ctx, t) => {
    [523, 659, 784, 1046].forEach((f, i) =>
      bell(ctx, t + i * 0.11, f, i === 3 ? 1.1 : 0.5, 0.13),
    );
  });

// Vaia: "ooo" grave a descer com vibrato (sawtooth filtrado) + bancada em lamento.
const boo = (ctx, t) => {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(240, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 1.1);
  const vib = ctx.createOscillator();
  const vibG = ctx.createGain();
  vib.frequency.value = 5.5;
  vibG.gain.value = 6;
  vib.connect(vibG).connect(o.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  o.connect(lp).connect(g).connect(ctx.destination);
  o.start(t);
  vib.start(t);
  o.stop(t + 1.2);
  vib.stop(t + 1.2);
  crowd(ctx, t, "loss");
};
export const playBooSound = () => play(boo);

// VAR: dois bips secos + "bwom" descendente de sala de vídeo.
export const playVarSound = () =>
  play((ctx, t) => {
    [0, 0.16].forEach((dt) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 1000;
      g.gain.setValueAtTime(0.05, t + dt);
      g.gain.setValueAtTime(0.0001, t + dt + 0.09);
      o.connect(g).connect(ctx.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.1);
    });
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(330, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(130, t + 0.95);
    lp.type = "lowpass";
    lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.46);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    o.connect(lp).connect(g).connect(ctx.destination);
    o.start(t + 0.4);
    o.stop(t + 0.95);
  });

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
    draw: { f0: 450, f1: 450, peak: 0.12, rise: 0.8, dur: 3 },
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
    if (outcome === "loss") boo(ctx, t + 0.9);
    else crowd(ctx, t + 0.9, outcome);
  } catch {
    // ignore
  }
};
