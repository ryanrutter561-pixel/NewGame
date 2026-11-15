/**
 * Procedural sound effects (Web Audio) — no audio files needed.
 * Everything renders through `renderSound(ctx, out, name, time)` so the same code can play live
 * or be rendered offline (for tests / exporting previews).
 */

export type SoundName = 'move' | 'capture' | 'check' | 'checkmate' | 'win' | 'loss' | 'draw';

export const SOUND_NAMES: SoundName[] = ['move', 'capture', 'check', 'checkmate', 'win', 'loss', 'draw'];

type Ctx = BaseAudioContext;
interface Out { ctx: Ctx; out: AudioNode }

const noiseCache = new WeakMap<Ctx, AudioBuffer>();
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

/** Percussive envelope: quick attack, exponential decay. */
function perc(g: AudioParam, t: number, peak: number, attack: number, decay: number) {
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  endFreq?: number;
  lowpass?: number;
  vibrato?: number;
}

function tone(v: Out, t: number, freq: number, dur: number, o: ToneOpts = {}) {
  const { ctx } = v;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t + dur);
  const g = ctx.createGain();
  perc(g.gain, t, o.gain ?? 0.3, o.attack ?? 0.005, dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(v.out);
  osc.start(t);
  osc.stop(t + (o.attack ?? 0.005) + dur + 0.05);
}

function noise(v: Out, t: number, dur: number, o: { gain?: number; freq?: number; q?: number; type?: BiquadFilterType; attack?: number } = {}) {
  const { ctx } = v;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.value = o.freq ?? 1000;
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  perc(g.gain, t, o.gain ?? 0.3, o.attack ?? 0.002, dur);
  src.connect(f).connect(g).connect(v.out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

/**
 * Brass-like voice: two detuned saws through a lowpass whose cutoff blooms then settles.
 * `mute` adds a bandpass for a Harmon-muted trumpet colour.
 */
function horn(v: Out, t: number, freq: number, dur: number, o: { gain?: number; cutoff?: number; vibrato?: number; endFreq?: number; mute?: boolean; attack?: number } = {}) {
  const { ctx } = v;
  const peak = o.gain ?? 0.15;
  const cutoff = o.cutoff ?? 1800;
  const attack = o.attack ?? 0.035;
  const release = 0.12;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(peak * 0.55, t + Math.max(attack + 0.01, dur));
  g.gain.linearRampToValueAtTime(0, t + dur + release);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(cutoff * 0.25, t);
  lp.frequency.exponentialRampToValueAtTime(cutoff, t + attack + 0.03);
  lp.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + dur + release);

  let chain: AudioNode = lp;
  if (o.mute) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.2;
    lp.connect(bp);
    chain = bp;
  }
  chain.connect(g).connect(v.out);

  let lfo: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  if (o.vibrato) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(freq * o.vibrato, t + Math.min(dur, 0.35));
    lfo.connect(lfoGain);
    lfo.start(t);
    lfo.stop(t + dur + release + 0.05);
  }
  for (const detune of [-6, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t + dur + release);
    if (lfoGain) lfoGain.connect(osc.frequency);
    osc.connect(lp);
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
  }
}

/** Felt-bottomed wooden piece set down on a board. */
function tock(v: Out, t: number, k = 1) {
  const pitch = 0.9 + Math.random() * 0.2;
  noise(v, t, 0.035, { freq: 1700 * pitch, q: 2.5, gain: 0.45 * k });
  tone(v, t, 210 * pitch, 0.07, { endFreq: 110, gain: 0.4 * k });
}

function timpani(v: Out, t: number, freq: number, k = 1) {
  tone(v, t, freq * 1.08, 0.55, { endFreq: freq, gain: 0.5 * k, attack: 0.004 });
  noise(v, t, 0.18, { type: 'lowpass', freq: 380, q: 0.7, gain: 0.35 * k });
}

function bassPluck(v: Out, t: number, freq: number, dur = 0.8, k = 1) {
  tone(v, t, freq, dur, { type: 'triangle', gain: 0.32 * k, attack: 0.006, lowpass: 600 });
  tone(v, t, freq * 2, dur * 0.4, { gain: 0.08 * k, attack: 0.004 });
}

/** Soft electric-piano-ish chord tone. */
function keys(v: Out, t: number, freqs: number[], dur: number, k = 1) {
  for (const f of freqs) {
    tone(v, t, f, dur, { type: 'triangle', gain: 0.07 * k, attack: 0.01, lowpass: 2400 });
    tone(v, t, f * 2, dur * 0.35, { gain: 0.02 * k, attack: 0.005 });
  }
}

// Note frequencies.
const N = {
  D2: 73.42, Eb2: 77.78, C2: 65.41, G2: 98.0, A2: 110.0, C3: 130.81, D3: 146.83, F3: 174.61, Ab3: 207.65,
  G3: 196.0, B3: 246.94, Bb3: 233.08, C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, Fs4: 369.99,
  G4: 392.0, Gs4: 415.3, A4: 440.0, C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, G5: 783.99,
};

/** Each sound schedules itself at time t and returns its length in seconds. */
const SOUNDS: Record<SoundName, (v: Out, t: number) => number> = {
  move: (v, t) => { tock(v, t); return 0.2; },

  capture: (v, t) => {
    tock(v, t, 1.25);
    tone(v, t, 130, 0.18, { endFreq: 55, gain: 0.45 });
    // The captured piece tipping over.
    tock(v, t + 0.075, 0.55);
    noise(v, t + 0.08, 0.06, { freq: 3200, q: 3, gain: 0.12 });
    return 0.35;
  },

  check: (v, t) => {
    // A tense, clashing piano stab (minor second) over a low thud.
    keys(v, t + 0.02, [N.Gs4, N.A4], 0.7, 2.2);
    tone(v, t + 0.02, N.A2, 0.5, { type: 'triangle', gain: 0.22, lowpass: 500 });
    noise(v, t + 0.02, 0.4, { type: 'highpass', freq: 6000, gain: 0.05 });
    return 0.9;
  },

  checkmate: (v, t) => {
    // Dun… dun… DUNNN.
    const hits = [t + 0.05, t + 0.32];
    for (const h of hits) {
      horn(v, h, N.D3, 0.14, { gain: 0.16, cutoff: 1200 });
      horn(v, h, N.D2, 0.14, { gain: 0.14, cutoff: 900 });
      timpani(v, h, N.D2);
    }
    const big = t + 0.68;
    for (const f of [N.D2, N.A2, N.D3, N.F3, N.Ab3]) horn(v, big, f, 1.5, { gain: 0.09, cutoff: 1500, vibrato: 0.004 });
    timpani(v, big, N.D2, 1.3);
    noise(v, big, 1.6, { type: 'highpass', freq: 5000, gain: 0.07, attack: 0.02 });
    return 2.5;
  },

  win: (v, t) => {
    // Muted-trumpet blues lick resolving to a warm 6/9 chord.
    const lick: [number, number, number][] = [
      [N.G4, 0, 0.1], [N.C5, 0.12, 0.1], [N.Eb5, 0.24, 0.07], [N.E5, 0.31, 0.12], [N.G5, 0.47, 1.0],
    ];
    for (const [f, dt, d] of lick) horn(v, t + dt, f, d, { gain: 0.12, cutoff: 3200, mute: true, vibrato: d > 0.5 ? 0.012 : 0 });
    bassPluck(v, t + 0.47, N.C2, 1.2);
    keys(v, t + 0.47, [N.G3, N.E4, N.A4, N.D5], 1.6);
    noise(v, t + 0.47, 0.9, { type: 'highpass', freq: 7000, gain: 0.04 }); // brushed cymbal
    return 2.3;
  },

  loss: (v, t) => {
    // A slow descending horn line over a minor drone.
    const line: [number, number, number, number?][] = [
      [N.Eb4, 0, 0.3], [N.D4, 0.36, 0.3], [N.C4, 0.72, 0.3], [N.B3, 1.08, 1.1, N.Bb3],
    ];
    for (const [f, dt, d, end] of line) horn(v, t + dt, f, d, { gain: 0.11, cutoff: 1100, mute: true, vibrato: d > 0.5 ? 0.01 : 0, endFreq: end });
    tone(v, t, N.C2, 2.3, { type: 'triangle', gain: 0.18, attack: 0.3, lowpass: 400 });
    tone(v, t, N.Eb2, 2.3, { type: 'triangle', gain: 0.1, attack: 0.3, lowpass: 400 });
    bassPluck(v, t + 1.08, N.C2, 1.2, 0.8);
    return 2.7;
  },

  draw: (v, t) => {
    // Unresolved — a tritone that just hangs there.
    keys(v, t, [N.C4, N.Fs4], 1.4, 1.6);
    bassPluck(v, t, N.C2, 1.0, 0.7);
    return 1.6;
  },
};

/** Smoky-room reverb + gentle compression. Returns the node sounds should connect to. */
export function buildBus(ctx: Ctx, dest: AudioNode, volume = 0.7): AudioNode {
  const input = ctx.createGain();
  const master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;

  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;

  input.connect(master);
  input.connect(verb).connect(wet).connect(master);
  master.connect(comp).connect(dest);
  return input;
}

/** Per-sound level trims so clicks, stings and fanfares sit together (tuned by offline render). */
const LEVEL: Record<SoundName, number> = {
  move: 1.9, capture: 1.75, check: 1.5, checkmate: 0.8, win: 0.85, loss: 1.75, draw: 1.6,
};

export function renderSound(ctx: Ctx, out: AudioNode, name: SoundName, t: number): number {
  const trim = ctx.createGain();
  trim.gain.value = LEVEL[name];
  trim.connect(out);
  return SOUNDS[name]({ ctx, out: trim }, t);
}

/** Live player. Safe to call anywhere — it's a no-op where Web Audio isn't available. */
class SoundEngine {
  enabled = true;
  private ctx: AudioContext | null = null;
  private bus: AudioNode | null = null;

  /** Create/resume the audio context. Call from a user gesture (browsers require one). */
  unlock(): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.bus = buildBus(this.ctx, this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(...names: SoundName[]): void {
    if (typeof window !== 'undefined') {
      for (const name of names) window.dispatchEvent(new CustomEvent('noir-sound', { detail: name }));
    }
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx || !this.bus) return;
    const t = this.ctx.currentTime + 0.01;
    for (const name of names) renderSound(this.ctx, this.bus, name, t);
  }
}

export const sound = new SoundEngine();
