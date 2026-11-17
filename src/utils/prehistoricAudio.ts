import type { SoundProfile } from '../data/extinctCatalog';

/**
 * Procedural zero-404 Web Audio synthesizer for prehistoric creatures,
 * heavy theropod footsteps, mammoth trumpets, big-cat snarls, and forest wind.
 */
class PrehistoricAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.85, this.ctx.currentTime, 0.03);
    }
  }

  /**
   * Must be called inside a user gesture (click / tap) so Chromium/Safari unlocks AudioContext.
   */
  public unlock(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.85;

      // Gentle master compressor prevents clipping when footsteps + roar overlap
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;

      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);
      this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return true;
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Warm pink/brown-tinted noise
      data[i] = (lastOut + 0.06 * white) / 1.06;
      lastOut = data[i];
      data[i] *= 2.4;
    }
    return buffer;
  }

  private createDistortionCurve(amount = 38): Float32Array<ArrayBuffer> {
    const samples = 1024;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /**
   * Heavy earth-shaking footstep thud as the creature charges through the forest.
   * `proximity` in [0, 1] increases volume & sub-bass punch as it nears the screen.
   */
  public playFootstep(proximity = 0.5, heavy = true): void {
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const vol = (heavy ? 0.52 : 0.24) * (0.35 + proximity * 0.65);

    // Sub-bass impact thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 92 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);

    // Forest dirt & leaf crunch
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = heavy ? 280 : 620;
      filter.Q.value = 1.2;

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(vol * 0.45, now + 0.015);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      src.start(now, Math.random() * 1.2, 0.22);
    }
  }

  /**
   * Triggers the primary vocalization / forest sound for the chosen extinct species.
   */
  public playCreatureVoice(profile: SoundProfile): void {
    if (this.muted) return;
    if (!this.unlock() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    switch (profile) {
      case 'trex-roar':
        this.synthesizeTRexRoar(this.ctx, this.masterGain, now);
        break;
      case 'mammoth-trumpet':
        this.synthesizeMammothTrumpet(this.ctx, this.masterGain, now);
        break;
      case 'bigcat-snarl':
        this.synthesizeBigCatSnarl(this.ctx, this.masterGain, now);
        break;
      case 'raptor-call':
      case 'pterosaur-screech':
        this.synthesizeRaptorScreech(this.ctx, this.masterGain, now, profile === 'pterosaur-screech');
        break;
      case 'herbivore-bellow':
        this.synthesizeHerbivoreBellow(this.ctx, this.masterGain, now);
        break;
      case 'bird-call':
        this.synthesizeDodoCall(this.ctx, this.masterGain, now);
        break;
      case 'ocean-surge':
        this.synthesizeOceanSurge(this.ctx, this.masterGain, now);
        break;
      case 'forest-breeze':
      case 'hominin-ambience':
      default:
        this.synthesizeForestAmbience(this.ctx, this.masterGain, now);
        break;
    }
  }

  /**
   * Iconic multi-layered T-Rex roar:
   * 1) Deep chest sub-growl with 23 Hz FM throat rattle
   * 2) Brassy resonant formant scream (elephant/croc/tiger composite)
   * 3) Wide-jaw breathy rasp & forest canyon echo
   */
  private synthesizeTRexRoar(ctx: AudioContext, dest: AudioNode, start: number): void {
    const dur = 2.95;

    // Master roar envelope + forest canyon echo
    const roarBus = ctx.createGain();
    roarBus.gain.setValueAtTime(0.001, start);
    roarBus.gain.linearRampToValueAtTime(0.95, start + 0.18);
    roarBus.gain.setValueAtTime(0.92, start + 1.35);
    roarBus.gain.exponentialRampToValueAtTime(0.001, start + dur);

    const echoDelay = ctx.createDelay(0.5);
    echoDelay.delayTime.value = 0.24;
    const echoGain = ctx.createGain();
    echoGain.gain.value = 0.26;
    roarBus.connect(dest);
    roarBus.connect(echoDelay);
    echoDelay.connect(echoGain);
    echoGain.connect(dest);

    // Growl LFO (guttural vocal fold flutter ~22 Hz)
    const flutterLfo = ctx.createOscillator();
    flutterLfo.type = 'sine';
    flutterLfo.frequency.setValueAtTime(24, start);
    flutterLfo.frequency.linearRampToValueAtTime(16, start + dur);
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 18;
    flutterLfo.connect(flutterDepth);

    // Layer 1: Sub-chest dual sawtooth growl
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.createDistortionCurve(45);

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.Q.value = 3.2;
    lowFilter.frequency.setValueAtTime(240, start);
    lowFilter.frequency.exponentialRampToValueAtTime(980, start + 0.42);
    lowFilter.frequency.exponentialRampToValueAtTime(220, start + dur);

    for (const detuneHz of [0, 3.2]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(64 + detuneHz, start);
      osc.frequency.exponentialRampToValueAtTime(96 + detuneHz, start + 0.35);
      osc.frequency.exponentialRampToValueAtTime(42 + detuneHz * 0.5, start + dur);
      flutterDepth.connect(osc.frequency);
      osc.connect(shaper);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
    shaper.connect(lowFilter);
    lowFilter.connect(roarBus);

    // Layer 2: Vocal-tract brassy scream through dual formant filters
    const screamOsc = ctx.createOscillator();
    screamOsc.type = 'sawtooth';
    screamOsc.frequency.setValueAtTime(150, start);
    screamOsc.frequency.exponentialRampToValueAtTime(285, start + 0.32);
    screamOsc.frequency.exponentialRampToValueAtTime(118, start + dur * 0.92);
    flutterDepth.connect(screamOsc.frequency);

    const formantA = ctx.createBiquadFilter();
    formantA.type = 'bandpass';
    formantA.frequency.setValueAtTime(460, start);
    formantA.frequency.linearRampToValueAtTime(720, start + 0.45);
    formantA.frequency.linearRampToValueAtTime(380, start + dur);
    formantA.Q.value = 3.4;

    const formantB = ctx.createBiquadFilter();
    formantB.type = 'bandpass';
    formantB.frequency.setValueAtTime(1120, start);
    formantB.frequency.linearRampToValueAtTime(1450, start + 0.4);
    formantB.frequency.linearRampToValueAtTime(790, start + dur);
    formantB.Q.value = 4.0;

    const screamGain = ctx.createGain();
    screamGain.gain.setValueAtTime(0.48, start);

    screamOsc.connect(formantA);
    screamOsc.connect(formantB);
    formantA.connect(screamGain);
    formantB.connect(screamGain);
    screamGain.connect(roarBus);

    screamOsc.start(start);
    screamOsc.stop(start + dur + 0.05);

    // Layer 3: Breathy air blast
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const nBand = ctx.createBiquadFilter();
      nBand.type = 'bandpass';
      nBand.frequency.setValueAtTime(920, start);
      nBand.frequency.linearRampToValueAtTime(1400, start + 0.4);
      nBand.frequency.linearRampToValueAtTime(480, start + dur);
      nBand.Q.value = 1.1;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, start);
      nGain.gain.linearRampToValueAtTime(0.55, start + 0.22);
      nGain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      noise.connect(nBand);
      nBand.connect(nGain);
      nGain.connect(roarBus);
      noise.start(start, 0.1, dur);
    }

    flutterLfo.start(start);
    flutterLfo.stop(start + dur + 0.05);
  }

  private synthesizeMammothTrumpet(ctx: AudioContext, dest: AudioNode, start: number): void {
    const dur = 2.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.75, start + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(420, start);
    formant.frequency.exponentialRampToValueAtTime(960, start + 0.45);
    formant.frequency.exponentialRampToValueAtTime(510, start + dur);
    formant.Q.value = 2.6;

    for (const mult of [1, 1.505]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140 * mult, start);
      osc.frequency.exponentialRampToValueAtTime(340 * mult, start + 0.35);
      osc.frequency.exponentialRampToValueAtTime(165 * mult, start + dur);
      osc.connect(formant);
      osc.start(start);
      osc.stop(start + dur);
    }

    formant.connect(gain);
    gain.connect(dest);
  }

  private synthesizeBigCatSnarl(ctx: AudioContext, dest: AudioNode, start: number): void {
    const dur = 1.85;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.72, start + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, start);
    osc.frequency.linearRampToValueAtTime(165, start + 0.25);
    osc.frequency.exponentialRampToValueAtTime(72, start + dur);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 34;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 22;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1100, start);
    lp.Q.value = 3.0;

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(dest);
    osc.start(start);
    lfo.start(start);
    osc.stop(start + dur);
    lfo.stop(start + dur);
  }

  private synthesizeRaptorScreech(
    ctx: AudioContext,
    dest: AudioNode,
    start: number,
    highPitch: boolean
  ): void {
    const dur = highPitch ? 1.55 : 1.95;

    // Canyon/forest slapback echo
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.001, start);
    bus.gain.linearRampToValueAtTime(0.72, start + 0.08);
    bus.gain.setValueAtTime(0.68, start + 0.55);
    bus.gain.exponentialRampToValueAtTime(0.001, start + dur);

    const echo = ctx.createDelay(0.45);
    echo.delayTime.value = 0.21;
    const echoGain = ctx.createGain();
    echoGain.gain.value = 0.28;
    bus.connect(dest);
    bus.connect(echo);
    echo.connect(echoGain);
    echoGain.connect(dest);

    // Vocal flutter LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(highPitch ? 42 : 31, start);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = highPitch ? 28 : 34;
    lfo.connect(lfoDepth);

    // Layer 1: Piercing dual-detuned raptor shriek
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.createDistortionCurve(32);

    const formantA = ctx.createBiquadFilter();
    formantA.type = 'bandpass';
    formantA.frequency.setValueAtTime(highPitch ? 1320 : 880, start);
    formantA.frequency.exponentialRampToValueAtTime(highPitch ? 1850 : 1240, start + 0.22);
    formantA.frequency.exponentialRampToValueAtTime(highPitch ? 920 : 620, start + dur);
    formantA.Q.value = 2.6;

    const base = highPitch ? 580 : 340;
    for (const det of [0, 7.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(base + det, start);
      osc.frequency.exponentialRampToValueAtTime((base + det) * 1.62, start + 0.16);
      osc.frequency.exponentialRampToValueAtTime((base + det) * 0.64, start + dur);
      lfoDepth.connect(osc.frequency);
      osc.connect(shaper);
      osc.start(start);
      osc.stop(start + dur + 0.04);
    }
    shaper.connect(formantA);
    formantA.connect(bus);

    // Layer 2: Guttural sub-throat chest bark (makes Velociraptor sound ferocious, not a whistle)
    if (!highPitch) {
      const growlOsc = ctx.createOscillator();
      growlOsc.type = 'sawtooth';
      growlOsc.frequency.setValueAtTime(118, start);
      growlOsc.frequency.exponentialRampToValueAtTime(165, start + 0.2);
      growlOsc.frequency.exponentialRampToValueAtTime(74, start + dur * 0.85);
      lfoDepth.connect(growlOsc.frequency);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 540;
      lp.Q.value = 2.4;

      const gGain = ctx.createGain();
      gGain.gain.value = 0.55;
      growlOsc.connect(lp);
      lp.connect(gGain);
      gGain.connect(bus);
      growlOsc.start(start);
      growlOsc.stop(start + dur + 0.04);
    }

    // Layer 3: Sharp hissing breath blast
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(1750, start);
      hp.frequency.linearRampToValueAtTime(980, start + dur);
      hp.Q.value = 1.1;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, start);
      nGain.gain.linearRampToValueAtTime(0.42, start + 0.12);
      nGain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      noise.connect(hp);
      hp.connect(nGain);
      nGain.connect(bus);
      noise.start(start, 0.15, dur);
    }

    lfo.start(start);
    lfo.stop(start + dur + 0.04);
  }

  private synthesizeHerbivoreBellow(ctx: AudioContext, dest: AudioNode, start: number): void {
    const dur = 2.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.7, start + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(84, start);
    osc.frequency.linearRampToValueAtTime(116, start + 0.5);
    osc.frequency.exponentialRampToValueAtTime(58, start + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    lp.Q.value = 2.2;

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + dur);
  }

  private synthesizeDodoCall(ctx: AudioContext, dest: AudioNode, start: number): void {
    for (let i = 0; i < 2; i++) {
      const t0 = start + i * 0.34;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, t0);
      osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.22);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.27);
    }
  }

  private synthesizeOceanSurge(ctx: AudioContext, dest: AudioNode, start: number): void {
    const dur = 2.2;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, start);
    lp.frequency.exponentialRampToValueAtTime(720, start + 0.6);
    lp.frequency.exponentialRampToValueAtTime(160, start + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.55, start + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(dest);
    src.start(start, 0, dur);
  }

  private synthesizeForestAmbience(ctx: AudioContext, dest: AudioNode, start: number): void {
    const dur = 2.0;
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(640, start);
      bp.frequency.linearRampToValueAtTime(980, start + 0.9);
      bp.frequency.linearRampToValueAtTime(520, start + dur);
      bp.Q.value = 1.4;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.28, start + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      src.connect(bp);
      bp.connect(gain);
      gain.connect(dest);
      src.start(start, 0.2, dur);
    }
  }
}

export const prehistoricAudio = new PrehistoricAudioEngine();
