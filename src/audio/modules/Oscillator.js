import { Module } from '../Module.js';
import { Gain } from './Gain.js';
import { coefficients } from '../waveforms.js';

// Oscilador (seno, serra, quadrada ou triângulo) com amplitude, fase e entrada de FM.
// Portas: `freq` (modulação de frequência), `pitch` (nota, em oitavas: 1 = +1 oitava) e `out`.
// `unison` (cents): duas cópias levemente desafinadas (uma acima, outra abaixo) engrossam o som,
// o "supersaw" dos synths de trance. Com 0 só a voz central toca.
// Se `realPhase` for falso, a fase é só guardada: quem exibe o sinal a usa como
// posição horizontal em relação ao trigger (a voz de referência).
export class Oscillator extends Module {
  static type = 'oscillator';

  constructor(ctx, { freq = 440, amp = 80, phase = 0, realPhase = false, fmDepth = 100, waveform = 'sine', unison = 0 } = {}) {
    super(ctx);
    this.freq = freq;
    this.amp = amp; // %
    this.phase = phase; // graus
    this.fmDepth = fmDepth; // Hz de desvio para um sinal de amplitude 1 na entrada `freq`
    this.realPhase = realPhase;
    this.waveform = waveform;
    this.unison = unison;

    this.level = new Gain(ctx, amp / 100);
    // voz central e as duas desafinadas, cada uma com o seu ganho
    this.voices = [0, -1, 1].map((side) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      osc.connect(gain).connect(this.level.node);
      return { osc, gain, side };
    });
    this.osc = this.voices[0].osc; // a voz central
    this.#applyWave();
    this.#applyUnison(false);

    // O sinal que chega em `freq` é escalado por fmDepth e somado à frequência
    this.fm = new Gain(ctx, fmDepth);
    for (const { osc } of this.voices) this.fm.connect(osc.frequency);

    // `pitch`: 1 unidade de entrada = 1 oitava = 1200 cents no detune
    this.pitch = new Gain(ctx, 1200);
    for (const { osc } of this.voices) this.pitch.connect(osc.detune);

    this.inputs.freq = this.fm.node;
    this.inputs.pitch = this.pitch.node;
    this.outputs.out = this.level.node;
  }

  start(when) {
    for (const { osc } of this.voices) osc.start(when);
  }

  dispose() {
    for (const { osc } of this.voices) {
      try { osc.stop(); } catch { /* ainda não tinha começado */ }
    }
  }

  setFreq(hz) {
    this.freq = hz;
    for (const { osc } of this.voices) osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
  }

  setAmp(pct) {
    this.amp = pct;
    this.level.set(pct / 100, 0.01);
  }

  setPhase(deg) {
    this.phase = deg;
    if (this.realPhase) this.#applyWave();
  }

  setWaveform(name) {
    this.waveform = name;
    this.#applyWave();
  }

  setUnison(cents) {
    this.unison = cents;
    this.#applyUnison(true);
  }

  // As vozes de fora entram aos poucos nos primeiros cents; a central cede um pouco de volume
  #applyUnison(smooth) {
    const mix = Math.min(1, this.unison / 5);
    const now = this.ctx.currentTime;
    for (const { osc, gain, side } of this.voices) {
      const level = side === 0 ? 1 - 0.4 * mix : 0.4 * mix;
      const cents = side * this.unison;
      if (smooth) {
        gain.gain.setTargetAtTime(level, now, 0.01);
        osc.detune.setTargetAtTime(cents, now, 0.01);
      } else {
        gain.gain.value = level;
        osc.detune.value = cents;
      }
    }
  }

  setFmDepth(hz) {
    this.fmDepth = hz;
    this.fm.set(hz, 0.01);
  }

  // Troca a forma de onda. Com fase real, a onda já sai deslocada; sem ela, a fase fica
  // por conta de quem exibe o sinal (posição horizontal).
  #applyWave() {
    const { real, imag } = coefficients(this.waveform, this.realPhase ? this.phase : 0);
    const wave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    for (const { osc } of this.voices) osc.setPeriodicWave(wave);
  }

  getState() {
    const { freq, amp, phase, fmDepth, waveform, unison } = this;
    return { freq, amp, phase, fmDepth, waveform, unison };
  }

  setState(s) {
    if (s.waveform) this.setWaveform(s.waveform);
    this.setFreq(s.freq ?? this.freq);
    this.setAmp(s.amp ?? this.amp);
    this.setPhase(s.phase ?? this.phase);
    this.setFmDepth(s.fmDepth ?? this.fmDepth);
    this.setUnison(s.unison ?? this.unison);
  }
}
