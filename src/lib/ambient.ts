// A gentle, generative bedtime score — a warm sustained pad with occasional
// soft "music-box" twinkles, all synthesized with the Web Audio API (no audio
// files to ship). It plays quietly under the storyteller's voice to make the
// world feel alive and calm. Must start from a user gesture (the Begin tap).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bellTimer: ReturnType<typeof setTimeout> | null = null;
let muted = false;

const LEVEL = 0.5; // master target; pad/bells are scaled well below this
const PENTATONIC = [0, 2, 4, 7, 9]; // major pentatonic — always pretty, never tense

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function startAmbient(): void {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // warm pad through a soft lowpass — a gentle D major-ish chord
  const padGain = ctx.createGain();
  padGain.gain.value = 0.05;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 850;
  filter.Q.value = 0.4;
  padGain.connect(filter);
  filter.connect(master);

  const root = 50; // D3
  for (const n of [root, root + 7, root + 12, root + 16]) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midiToFreq(n);
    const og = ctx.createGain();
    og.gain.value = 0.25;
    // a very slow detune shimmer so the pad breathes
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 3;
    lfo.connect(lfoG);
    lfoG.connect(osc.detune);
    osc.connect(og);
    og.connect(padGain);
    osc.start();
    lfo.start();
  }

  master.gain.linearRampToValueAtTime(muted ? 0 : LEVEL, ctx.currentTime + 4);
  scheduleBell();
}

function scheduleBell(): void {
  if (!ctx) return;
  const delay = 4500 + Math.random() * 7000;
  bellTimer = setTimeout(() => {
    playBell();
    scheduleBell();
  }, delay);
}

function playBell(): void {
  if (!ctx || !master) return;
  const octave = 72 + 12 * Math.floor(Math.random() * 2);
  const note = octave + PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = midiToFreq(note);
  const g = ctx.createGain();
  g.gain.value = 0;
  osc.connect(g);
  g.connect(master);
  const t = ctx.currentTime;
  g.gain.linearRampToValueAtTime(0.11, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 2.6);
  osc.start(t);
  osc.stop(t + 2.7);
}

export function setAmbientMuted(m: boolean): void {
  muted = m;
  if (master && ctx) {
    master.gain.linearRampToValueAtTime(m ? 0 : LEVEL, ctx.currentTime + 0.5);
  }
}

export function isAmbientMuted(): boolean {
  return muted;
}

export function stopAmbient(): void {
  if (bellTimer) clearTimeout(bellTimer);
  bellTimer = null;
  if (ctx) {
    master?.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    const closing = ctx;
    setTimeout(() => {
      try {
        void closing.close();
      } catch {
        /* ignore */
      }
    }, 1400);
  }
  ctx = null;
  master = null;
}
