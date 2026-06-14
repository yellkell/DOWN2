/*
 * Procedural synthwave engine.
 *
 * DOWN 2 is a rhythm game, so the soundtrack is generated rather than streamed:
 * a Web Audio scheduler emits a four-on-the-floor synthwave groove and exposes a
 * sample-accurate beat clock. The gameplay reads `getBeat()` to spawn obstacles
 * that land exactly on the beat — that is what makes the dodging feel "to the
 * music". Generating the audio also keeps the project self-contained (no large
 * licensed tracks to ship) and lets the beat grid stay locked to the visuals.
 */

// Classic synthwave minor progression in A minor: i - VI - III - VII (Am - F - C - G).
// Values are MIDI-ish semitone offsets from A2 (root of each chord, low to high).
const PROGRESSION = [
  { root: 0, triad: [0, 3, 7] }, // Am
  { root: -4, triad: [0, 4, 7] }, // F
  { root: 3, triad: [0, 4, 7] }, // C
  { root: -2, triad: [0, 4, 7] }, // G
];

const A2 = 110; // Hz — reference pitch for the bass register.

function semitoneToHz(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12);
}

export type BeatListener = (beatIndex: number) => void;

export class Synthwave {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;

  private bpm = 120;
  private secondsPerBeat = 0.5;
  private startTime = 0; // ctx time when the groove began
  private nextNoteTime = 0; // ctx time of the next 16th to schedule
  private current16th = 0; // running 16th-note counter
  private schedulerId = 0;

  private running = false;
  private intensity = 0; // 0..1 — layers in extra parts as phases escalate
  private beatListeners: BeatListener[] = [];

  /** Resume/create the AudioContext from a user gesture and start the groove. */
  start(): void {
    if (this.running) return;
    if (!this.ctx) this.init();
    const ctx = this.ctx!;
    if (ctx.state === 'suspended') ctx.resume();

    this.running = true;
    this.startTime = ctx.currentTime + 0.08;
    this.nextNoteTime = this.startTime;
    this.current16th = 0;
    this.musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 1.5);
    this.scheduler();
  }

  /** Fade out and stop scheduling (used on game over / win). */
  stop(): void {
    if (!this.ctx || !this.running) return;
    this.running = false;
    window.clearTimeout(this.schedulerId);
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  }

  /** Whether the AudioContext exists and is running. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Fractional beats elapsed since the groove started. Drives obstacle timing. */
  getBeat(): number {
    if (!this.ctx || !this.running) return 0;
    return (this.ctx.currentTime - this.startTime) / this.secondsPerBeat;
  }

  get beatDuration(): number {
    return this.secondsPerBeat;
  }

  /** 0..1 — escalates the mix (adds arp + lead) as the descent gets harder. */
  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(1, level));
  }

  onBeat(listener: BeatListener): void {
    this.beatListeners.push(listener);
  }

  private init(): void {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.55;

    // A gentle limiter keeps the synth stack from clipping on loud beats.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0001;

    this.musicGain.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
  }

  // Look-ahead scheduler: queue every 16th note that falls inside the next slice.
  private scheduler = (): void => {
    if (!this.running || !this.ctx) return;
    const ctx = this.ctx;
    const scheduleAhead = 0.12; // seconds
    while (this.nextNoteTime < ctx.currentTime + scheduleAhead) {
      this.scheduleStep(this.current16th, this.nextNoteTime);
      this.nextNoteTime += this.secondsPerBeat / 4; // advance one 16th
      this.current16th++;
    }
    this.schedulerId = window.setTimeout(this.scheduler, 25);
  };

  private scheduleStep(step16: number, when: number): void {
    const stepInBar = step16 % 16; // 16 sixteenths per 4/4 bar
    const bar = Math.floor(step16 / 16);
    const chord = PROGRESSION[bar % PROGRESSION.length];

    // Notify listeners on each quarter-note beat (visual pulse hooks).
    if (stepInBar % 4 === 0) {
      const beatIndex = Math.round((when - this.startTime) / this.secondsPerBeat);
      for (const l of this.beatListeners) l(beatIndex);
    }

    // --- Kick: four on the floor ---
    if (stepInBar % 4 === 0) this.kick(when);

    // --- Sub bass: root on every eighth, octave-walking the chord ---
    if (stepInBar % 2 === 0) {
      const freq = semitoneToHz(A2, chord.root + (stepInBar % 4 === 0 ? 0 : 12));
      this.bass(when, freq);
    }

    // --- Off-beat hat for drive ---
    if (stepInBar % 2 === 1) this.hat(when, 0.12);

    // --- Arp: layers in with intensity, climbing the triad on 16ths ---
    if (this.intensity > 0.15 && step16 % 1 === 0 && stepInBar % 2 === 0) {
      const note = chord.triad[(step16 / 2) % chord.triad.length | 0];
      const freq = semitoneToHz(A2 * 4, chord.root + note);
      this.arp(when, freq, 0.06 + this.intensity * 0.06);
    }

    // --- Lead pad chord stabs on the downbeat at high intensity ---
    if (this.intensity > 0.5 && stepInBar === 0) {
      for (const n of chord.triad) {
        this.pad(when, semitoneToHz(A2 * 2, chord.root + n), 0.05);
      }
    }
  }

  private kick(when: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    gain.gain.setValueAtTime(0.9, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.24);
  }

  private bass(when: number, freq: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480 + this.intensity * 400;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.32, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.26);
  }

  private arp(when: number, freq: number, level: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.16);
  }

  private pad(when: number, freq: number, level: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.55);
  }

  private hat(when: number, level: number): void {
    const ctx = this.ctx!;
    // White-noise burst through a high-pass for a closed-hat tick.
    const dur = 0.05;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.musicGain);
    src.start(when);
    src.stop(when + dur);
  }
}
