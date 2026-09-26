let audioCtx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('mln131-muted') === '1';
} catch {
  muted = false;
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
  return audioCtx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    ensureContext();
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function tone(freq: number, startDelay: number, duration: number, type: OscillatorType = 'sine', volume = 0.18) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const start = ctx.currentTime + startDelay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

export const sfx = {
  tick: () => tone(1250, 0, 0.05, 'square', 0.05),
  correct: () => {
    tone(660, 0, 0.12, 'sine', 0.16);
    tone(990, 0.09, 0.18, 'sine', 0.16);
  },
  roundStart: () => {
    tone(440, 0, 0.1, 'triangle', 0.14);
    tone(660, 0.1, 0.14, 'triangle', 0.14);
  },
  fanfare: () => {
    tone(523, 0, 0.12, 'sine', 0.16);
    tone(659, 0.1, 0.12, 'sine', 0.16);
    tone(784, 0.2, 0.16, 'sine', 0.16);
    tone(1047, 0.3, 0.3, 'sine', 0.18);
  },
  wrong: () => {
    tone(220, 0, 0.2, 'sawtooth', 0.1);
    tone(160, 0.12, 0.26, 'sawtooth', 0.1);
  },
  finish: () => {
    tone(523, 0, 0.14, 'sine', 0.16);
    tone(659, 0.12, 0.14, 'sine', 0.16);
    tone(784, 0.24, 0.14, 'sine', 0.16);
    tone(1047, 0.36, 0.2, 'sine', 0.18);
    tone(784, 0.56, 0.14, 'sine', 0.14);
    tone(1047, 0.68, 0.5, 'sine', 0.18);
  },
  pop: () => tone(880, 0, 0.06, 'sine', 0.09),
};

export function isMuted() {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem('mln131-muted', next ? '1' : '0');
  } catch {
    /* ignore */
  }
}
