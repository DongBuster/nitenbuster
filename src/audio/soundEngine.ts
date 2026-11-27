export type SfxType =
  | 'draw'
  | 'play'
  | 'freeze'
  | 'boomerang'
  | 'shovel'
  | 'taser'
  | 'banana'
  | 'bomb'
  | 'egg'
  | 'crossbow'
  | 'potion'
  | 'paws'
  | 'win'
  | 'lose'
  | 'click'
  | 'punch'
  | 'ko'
  | 'pickup'
  | 'roll'
  | 'countdown'
  | 'roundStart'
  | 'tileFall'
  | 'grab'
  | 'blockPickup'
  | 'blockPlace'
  | 'lineClear'
  | 'candyBomb'
  | 'reroll'
  | 'allClear'
  | 'glassCrack'
  | 'glassShatter'
  | 'checkpoint'
  | 'glassLift'
  | 'paddleSplash'
  | 'raftBoost'
  | 'ropePull'
  | 'cartClack'
  | 'shoot'
  | 'hit'
  | 'levelUp'
  | 'bossWarn';

export interface AudioPreferences {
  sfxEnabled?: boolean;
  bgmEnabled?: boolean;
  volume?: number;
}

interface InternalAudioState {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  volume: number;
}

const prefs: InternalAudioState = {
  sfxEnabled: true,
  bgmEnabled: false,
  volume: 0.65,
};

let audioCtx: AudioContext | null = null;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmStep = 0;

function isBrowserAudioAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.AudioContext !== 'undefined' ||
    typeof (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext !== 'undefined'
  );
}

function getAudioContext(): AudioContext | null {
  if (!isBrowserAudioAvailable()) return null;
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  opts: {
    freq: number;
    endFreq?: number;
    type?: OscillatorType;
    startOffset?: number;
    duration?: number;
    gain?: number;
  },
): void {
  const now = ctx.currentTime + (opts.startOffset ?? 0);
  const dur = opts.duration ?? 0.14;
  const peak = Math.max(0.0001, (opts.gain ?? 0.25) * prefs.volume);

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, opts.endFreq),
      now + dur,
    );
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

const NOISE_CACHE_DURATION_SEC = 0.25;
const noiseBufferCache = new WeakMap<AudioContext, AudioBuffer>();

function createWhiteNoiseBuffer(
  ctx: AudioContext,
  durationSec: number,
): AudioBuffer {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function getWhiteNoiseBuffer(
  ctx: AudioContext,
  durationSec: number,
): AudioBuffer {
  if (durationSec <= NOISE_CACHE_DURATION_SEC) {
    let cached = noiseBufferCache.get(ctx);
    if (!cached) {
      cached = createWhiteNoiseBuffer(ctx, NOISE_CACHE_DURATION_SEC);
      noiseBufferCache.set(ctx, cached);
    }
    return cached;
  }
  return createWhiteNoiseBuffer(ctx, durationSec);
}

function playNoiseBurst(
  ctx: AudioContext,
  opts: {
    duration?: number;
    startOffset?: number;
    gain?: number;
    filterFreq?: number;
    filterType?: BiquadFilterType;
  },
): void {
  const rawDur = opts.duration ?? 0.12;
  const dur = Math.max(
    0.001,
    Number.isFinite(rawDur) ? rawDur : 0.12,
  );
  const now = ctx.currentTime + (opts.startOffset ?? 0);

  const src = ctx.createBufferSource();
  src.buffer = getWhiteNoiseBuffer(ctx, dur);

  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType ?? 'bandpass';
  filter.frequency.setValueAtTime(opts.filterFreq ?? 1200, now);

  const gainNode = ctx.createGain();
  const peak = Math.max(0.0001, (opts.gain ?? 0.18) * prefs.volume);
  gainNode.gain.setValueAtTime(peak, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  src.start(now, 0, dur);
}

export function playSfx(type: SfxType, opts?: { combo?: number }): void {
  if (!prefs.sfxEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    switch (type) {
      case 'click':
        playTone(ctx, { freq: 620, endFreq: 420, type: 'triangle', duration: 0.055, gain: 0.18 });
        break;

      case 'draw':
        playNoiseBurst(ctx, { duration: 0.09, filterFreq: 1800, gain: 0.15 });
        playTone(ctx, { freq: 320, endFreq: 480, type: 'sine', duration: 0.08, gain: 0.12 });
        break;

      case 'play':
        playNoiseBurst(ctx, { duration: 0.055, filterFreq: 1400, gain: 0.16 });
        playTone(ctx, { freq: 440, endFreq: 660, type: 'triangle', duration: 0.1, gain: 0.22 });
        break;

      case 'freeze':
        playTone(ctx, { freq: 1175, type: 'sine', startOffset: 0, duration: 0.18, gain: 0.16 });
        playTone(ctx, { freq: 1568, type: 'sine', startOffset: 0.06, duration: 0.2, gain: 0.15 });
        playTone(ctx, { freq: 2093, type: 'sine', startOffset: 0.12, duration: 0.28, gain: 0.14 });
        break;

      case 'boomerang':
        playTone(ctx, { freq: 280, endFreq: 680, type: 'sine', startOffset: 0, duration: 0.13, gain: 0.2 });
        playTone(ctx, { freq: 680, endFreq: 310, type: 'sine', startOffset: 0.13, duration: 0.15, gain: 0.18 });
        break;

      case 'shovel':
        playNoiseBurst(ctx, { duration: 0.14, filterFreq: 700, filterType: 'lowpass', gain: 0.22 });
        playTone(ctx, { freq: 220, endFreq: 130, type: 'triangle', duration: 0.14, gain: 0.24 });
        break;

      case 'taser':
        playTone(ctx, { freq: 880, endFreq: 1320, type: 'sawtooth', startOffset: 0, duration: 0.06, gain: 0.14 });
        playTone(ctx, { freq: 1240, endFreq: 620, type: 'sawtooth', startOffset: 0.06, duration: 0.07, gain: 0.14 });
        playTone(ctx, { freq: 960, endFreq: 1480, type: 'sawtooth', startOffset: 0.13, duration: 0.08, gain: 0.12 });
        break;

      case 'banana':
        playTone(ctx, { freq: 520, endFreq: 1080, type: 'sine', startOffset: 0, duration: 0.1, gain: 0.22 });
        playTone(ctx, { freq: 1080, endFreq: 240, type: 'sine', startOffset: 0.1, duration: 0.22, gain: 0.22 });
        break;

      case 'bomb':
        playNoiseBurst(ctx, { duration: 0.32, filterFreq: 420, filterType: 'lowpass', gain: 0.34 });
        playTone(ctx, { freq: 150, endFreq: 42, type: 'triangle', duration: 0.34, gain: 0.34 });
        break;

      case 'egg':
        playTone(ctx, { freq: 440, type: 'sine', startOffset: 0, duration: 0.07, gain: 0.16 });
        playTone(ctx, { freq: 554, type: 'sine', startOffset: 0.06, duration: 0.07, gain: 0.16 });
        playTone(ctx, { freq: 659, type: 'sine', startOffset: 0.12, duration: 0.07, gain: 0.18 });
        playTone(ctx, { freq: 880, type: 'triangle', startOffset: 0.18, duration: 0.16, gain: 0.22 });
        break;

      case 'crossbow':
        playTone(ctx, { freq: 260, endFreq: 180, type: 'sawtooth', startOffset: 0, duration: 0.08, gain: 0.18 });
        playTone(ctx, { freq: 920, endFreq: 1680, type: 'sine', startOffset: 0.05, duration: 0.11, gain: 0.14 });
        break;

      case 'potion':
        playTone(ctx, { freq: 523, type: 'sine', startOffset: 0, duration: 0.12, gain: 0.16 });
        playTone(ctx, { freq: 659, type: 'sine', startOffset: 0.06, duration: 0.12, gain: 0.16 });
        playTone(ctx, { freq: 784, type: 'sine', startOffset: 0.12, duration: 0.14, gain: 0.18 });
        playTone(ctx, { freq: 1046, type: 'sine', startOffset: 0.18, duration: 0.22, gain: 0.18 });
        break;

      case 'paws':
        playTone(ctx, { freq: 659, type: 'triangle', startOffset: 0, duration: 0.11, gain: 0.24 });
        playTone(ctx, { freq: 988, type: 'triangle', startOffset: 0.1, duration: 0.22, gain: 0.26 });
        break;

      case 'win':
        playTone(ctx, { freq: 523.25, type: 'triangle', startOffset: 0, duration: 0.14, gain: 0.24 });
        playTone(ctx, { freq: 659.25, type: 'triangle', startOffset: 0.11, duration: 0.14, gain: 0.24 });
        playTone(ctx, { freq: 783.99, type: 'triangle', startOffset: 0.22, duration: 0.14, gain: 0.26 });
        playTone(ctx, { freq: 1046.5, type: 'triangle', startOffset: 0.33, duration: 0.38, gain: 0.28 });
        break;

      case 'lose':
        playTone(ctx, { freq: 392, type: 'triangle', startOffset: 0, duration: 0.18, gain: 0.2 });
        playTone(ctx, { freq: 370, type: 'triangle', startOffset: 0.18, duration: 0.18, gain: 0.2 });
        playTone(ctx, { freq: 349, type: 'triangle', startOffset: 0.36, duration: 0.18, gain: 0.18 });
        playTone(ctx, { freq: 311, endFreq: 277, type: 'triangle', startOffset: 0.54, duration: 0.34, gain: 0.2 });
        break;

      case 'punch':
        playNoiseBurst(ctx, { duration: 0.08, filterFreq: 550, filterType: 'lowpass', gain: 0.28 });
        playTone(ctx, { freq: 185, endFreq: 68, type: 'triangle', duration: 0.11, gain: 0.28 });
        break;

      case 'ko':
        playTone(ctx, { freq: 580, endFreq: 130, type: 'sine', duration: 0.34, gain: 0.24 });
        playNoiseBurst(ctx, { duration: 0.18, startOffset: 0.22, filterFreq: 380, filterType: 'lowpass', gain: 0.22 });
        break;

      case 'pickup':
        playTone(ctx, { freq: 660, type: 'sine', startOffset: 0, duration: 0.08, gain: 0.18 });
        playTone(ctx, { freq: 880, type: 'sine', startOffset: 0.06, duration: 0.12, gain: 0.2 });
        break;

      case 'roll':
        playNoiseBurst(ctx, { duration: 0.12, filterFreq: 1300, gain: 0.15 });
        playTone(ctx, { freq: 240, endFreq: 420, type: 'sine', duration: 0.11, gain: 0.14 });
        break;

      case 'countdown':
        playTone(ctx, { freq: 523.25, type: 'triangle', duration: 0.1, gain: 0.2 });
        break;

      case 'roundStart':
        playTone(ctx, { freq: 783.99, type: 'triangle', startOffset: 0, duration: 0.12, gain: 0.24 });
        playTone(ctx, { freq: 1046.5, type: 'triangle', startOffset: 0.08, duration: 0.22, gain: 0.26 });
        break;

      case 'tileFall':
        playNoiseBurst(ctx, { duration: 0.16, filterFreq: 460, filterType: 'lowpass', gain: 0.18 });
        playTone(ctx, { freq: 160, endFreq: 85, type: 'sine', duration: 0.18, gain: 0.16 });
        break;

      case 'grab':
        playTone(ctx, { freq: 310, endFreq: 470, type: 'triangle', duration: 0.08, gain: 0.18 });
        break;

      case 'blockPickup':
        playTone(ctx, { freq: 380, endFreq: 520, type: 'sine', duration: 0.06, gain: 0.14 });
        break;

      case 'blockPlace':
        playTone(ctx, { freq: 240, endFreq: 170, type: 'triangle', duration: 0.085, gain: 0.22 });
        playTone(ctx, { freq: 520, type: 'sine', startOffset: 0.015, duration: 0.05, gain: 0.12 });
        break;

      case 'lineClear': {
        const combo = Math.min(6, Math.max(1, Number.isFinite(opts?.combo) ? Math.floor(opts!.combo!) : 1));
        const base = 440 * Math.pow(1.09, combo - 1);
        playTone(ctx, { freq: base, type: 'triangle', startOffset: 0, duration: 0.12, gain: 0.22 });
        playTone(ctx, { freq: base * 1.25, type: 'triangle', startOffset: 0.055, duration: 0.13, gain: 0.22 });
        playTone(ctx, { freq: base * 1.5, type: 'sine', startOffset: 0.11, duration: 0.22, gain: 0.24 });
        break;
      }

      case 'candyBomb':
        playNoiseBurst(ctx, { duration: 0.22, filterFreq: 680, filterType: 'lowpass', gain: 0.26 });
        playTone(ctx, { freq: 620, endFreq: 1240, type: 'triangle', startOffset: 0.04, duration: 0.18, gain: 0.22 });
        break;

      case 'reroll':
        playTone(ctx, { freq: 392, type: 'sine', startOffset: 0, duration: 0.07, gain: 0.16 });
        playTone(ctx, { freq: 523.25, type: 'sine', startOffset: 0.055, duration: 0.07, gain: 0.18 });
        playTone(ctx, { freq: 659.25, type: 'triangle', startOffset: 0.11, duration: 0.12, gain: 0.2 });
        break;

      case 'allClear': {
        playNoiseBurst(ctx, {
          duration: 0.28,
          filterFreq: 1100,
          filterType: 'bandpass',
          gain: 0.24,
        });
        playTone(ctx, {
          freq: 196,
          endFreq: 82,
          type: 'triangle',
          duration: 0.16,
          gain: 0.16,
        });
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        notes.forEach((freq, idx) => {
          playTone(ctx, {
            freq,
            type: idx >= 3 ? 'sine' : 'triangle',
            startOffset: idx * 0.055,
            duration: idx === notes.length - 1 ? 0.42 : 0.16,
            gain: 0.22,
          });
        });
        break;
      }

      case 'glassCrack':
        playTone(ctx, { freq: 2400, endFreq: 900, type: 'triangle', duration: 0.07, gain: 0.2 });
        playTone(ctx, { freq: 3600, type: 'sine', startOffset: 0.01, duration: 0.045, gain: 0.14 });
        break;

      case 'glassShatter': {
        playNoiseBurst(ctx, { duration: 0.14, filterFreq: 3400, filterType: 'highpass', gain: 0.24 });
        const shards = [3200, 2650, 2100, 1750];
        shards.forEach((freq, idx) => {
          playTone(ctx, {
            freq,
            endFreq: freq * 0.85,
            type: idx % 2 === 0 ? 'triangle' : 'sine',
            startOffset: idx * 0.04,
            duration: 0.14,
            gain: 0.18,
          });
        });
        break;
      }

      case 'checkpoint':
        playTone(ctx, { freq: 523, type: 'triangle', startOffset: 0, duration: 0.11, gain: 0.18 });
        playTone(ctx, { freq: 659, type: 'triangle', startOffset: 0.08, duration: 0.11, gain: 0.18 });
        playTone(ctx, { freq: 784, type: 'sine', startOffset: 0.16, duration: 0.22, gain: 0.22 });
        break;

      case 'glassLift':
        playTone(ctx, { freq: 320, endFreq: 480, type: 'sine', duration: 0.09, gain: 0.06 });
        break;

      case 'paddleSplash':
        playNoiseBurst(ctx, {
          duration: 0.14,
          filterFreq: 1350,
          filterType: 'bandpass',
          gain: 0.19,
        });
        playTone(ctx, { freq: 210, endFreq: 120, type: 'sine', duration: 0.13, gain: 0.12 });
        break;

      case 'raftBoost':
        playNoiseBurst(ctx, {
          duration: 0.18,
          filterFreq: 1850,
          filterType: 'bandpass',
          gain: 0.16,
        });
        playTone(ctx, { freq: 392, endFreq: 784, type: 'triangle', startOffset: 0, duration: 0.15, gain: 0.18 });
        playTone(ctx, { freq: 987.77, type: 'sine', startOffset: 0.08, duration: 0.18, gain: 0.16 });
        break;

      case 'ropePull':
        playTone(ctx, { freq: 290, endFreq: 195, type: 'sawtooth', startOffset: 0, duration: 0.05, gain: 0.11 });
        playTone(ctx, { freq: 410, endFreq: 540, type: 'triangle', startOffset: 0.045, duration: 0.065, gain: 0.14 });
        break;

      case 'cartClack':
        playNoiseBurst(ctx, {
          duration: 0.045,
          filterFreq: 2600,
          filterType: 'highpass',
          gain: 0.16,
        });
        playTone(ctx, { freq: 520, endFreq: 860, type: 'triangle', startOffset: 0.01, duration: 0.08, gain: 0.18 });
        break;

      case 'shoot':
        playTone(ctx, { freq: 480, endFreq: 210, type: 'triangle', duration: 0.065, gain: 0.14 });
        playNoiseBurst(ctx, {
          duration: 0.03,
          filterFreq: 1800,
          filterType: 'bandpass',
          gain: 0.08,
        });
        break;

      case 'hit':
        playTone(ctx, { freq: 340, endFreq: 160, type: 'sine', duration: 0.045, gain: 0.1 });
        playNoiseBurst(ctx, {
          duration: 0.025,
          filterFreq: 2400,
          filterType: 'highpass',
          gain: 0.06,
        });
        break;

      case 'levelUp':
        playTone(ctx, { freq: 523.25, type: 'triangle', startOffset: 0, duration: 0.11, gain: 0.18 });
        playTone(ctx, { freq: 659.25, type: 'triangle', startOffset: 0.06, duration: 0.11, gain: 0.19 });
        playTone(ctx, { freq: 783.99, type: 'triangle', startOffset: 0.12, duration: 0.12, gain: 0.2 });
        playTone(ctx, { freq: 1046.5, type: 'sine', startOffset: 0.18, duration: 0.24, gain: 0.22 });
        break;

      case 'bossWarn':
        playTone(ctx, { freq: 146.83, endFreq: 130.81, type: 'sawtooth', startOffset: 0, duration: 0.22, gain: 0.14 });
        playTone(ctx, { freq: 146.83, endFreq: 116.54, type: 'sawtooth', startOffset: 0.26, duration: 0.3, gain: 0.16 });
        playTone(ctx, { freq: 73.42, type: 'triangle', startOffset: 0, duration: 0.56, gain: 0.14 });
        break;
    }
  } catch {
    // Ignore Web Audio errors in restricted environments
  }
}

// Cozy Winter Cabin pentatonic music-box / marimba melody (Hz, 0 = rest)
const CABIN_MELODY: number[] = [
  523.25, 659.25, 783.99, 659.25,
  880.0, 783.99, 659.25, 0,
  587.33, 659.25, 783.99, 587.33,
  523.25, 0, 392.0, 0,
];

const CABIN_BASS: number[] = [
  261.63, 0, 0, 0,
  220.0, 0, 0, 0,
  196.0, 0, 0, 0,
  261.63, 0, 196.0, 0,
];

export function startBgm(): void {
  if (!prefs.bgmEnabled) return;
  if (!isBrowserAudioAvailable()) return;
  if (bgmTimer !== null) return;

  bgmTimer = setInterval(() => {
    if (!prefs.bgmEnabled) {
      stopBgm();
      return;
    }
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const idx = bgmStep % CABIN_MELODY.length;
    const note = CABIN_MELODY[idx];
    const bass = CABIN_BASS[idx];
    bgmStep++;

    if (note > 0) {
      playTone(ctx, {
        freq: note,
        type: 'sine',
        duration: 0.34,
        gain: 0.055,
      });
    }
    if (bass > 0) {
      playTone(ctx, {
        freq: bass,
        type: 'triangle',
        duration: 0.55,
        gain: 0.04,
      });
    }
  }, 440);
}

export function stopBgm(): void {
  if (bgmTimer !== null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

export function setAudioPreferences(next: AudioPreferences): void {
  if (typeof next.sfxEnabled === 'boolean') {
    prefs.sfxEnabled = next.sfxEnabled;
  }
  if (typeof next.volume === 'number' && Number.isFinite(next.volume)) {
    prefs.volume = Math.min(1, Math.max(0, next.volume));
  }
  if (typeof next.bgmEnabled === 'boolean') {
    prefs.bgmEnabled = next.bgmEnabled;
    if (prefs.bgmEnabled) {
      startBgm();
    } else {
      stopBgm();
    }
  }
}

export function getAudioPreferences(): Required<AudioPreferences> {
  return { ...prefs };
}
