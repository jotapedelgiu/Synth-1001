import { Module } from '../Module.js';
import { Gain } from './Gain.js';
import { coefficients } from '../waveforms.js';

// Oscilador (seno, serra, quadrada ou triângulo) com amplitude, fase e entrada de FM.
// Portas: `freq` (modulação de frequência), `pitch` (nota, em oitavas: 1 = +1 oitava) e `out`.
// Se `realPhase` for falso, a fase é só guardada: quem exibe o sinal a usa como
// posição horizontal em relação ao trigger (a voz de referência).
export class Oscillator extends Module {
  static type = 'oscillator';

  constructor(ctx, { freq = 440, amp = 80, phase = 0, realPhase = false, fmDepth = 100, waveform = 'sine' } = {}) {
    super(ctx);
    this.freq = freq;
    this.amp = amp; // %
    this.phase = phase; // graus
    this.fmDepth = fmDepth; // Hz de desvio para um sinal de amplitude 1 na entrada `freq`
    this.realPhase = realPhase;
    this.waveform = waveform;

    this.osc = ctx.createOscillator();
    this.osc.frequency.value = freq;
    this.#applyWave();
    this.level = new Gain(ctx, amp / 100);
    this.osc.connect(this.level.node);

    // O sinal que chega em `freq` é escalado por fmDepth e somado à frequência
    this.fm = new Gain(ctx, fmDepth);
    this.fm.connect(this.osc.frequency);

    // `pitch`: 1 unidade de entrada = 1 oitava = 1200 cents no detune
    this.pitch = new Gain(ctx, 1200);
    this.pitch.connect(this.osc.detune);

    this.inputs.freq = this.fm.node;
    this.inputs.pitch = this.pitch.node;
    this.outputs.out = this.level.node;
  }

  start(when) {
    this.osc.start(when);
  }

  dispose() {
    try { this.osc.stop(); } catch { /* ainda não tinha começado */ }
  }

  setFreq(hz) {
    this.freq = hz;
    this.osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
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

  setFmDepth(hz) {
    this.fmDepth = hz;
    this.fm.set(hz, 0.01);
  }

  // Troca a forma de onda. Com fase real, a onda já sai deslocada; sem ela, a fase fica
  // por conta de quem exibe o sinal (posição horizontal).
  #applyWave() {
    const { real, imag } = coefficients(this.waveform, this.realPhase ? this.phase : 0);
    this.osc.setPeriodicWave(
      this.ctx.createPeriodicWave(real, imag, { disableNormalization: true }),
    );
  }

  getState() {
    const { freq, amp, phase, fmDepth, waveform } = this;
    return { freq, amp, phase, fmDepth, waveform };
  }

  setState(s) {
    if (s.waveform) this.setWaveform(s.waveform);
    this.setFreq(s.freq ?? this.freq);
    this.setAmp(s.amp ?? this.amp);
    this.setPhase(s.phase ?? this.phase);
    this.setFmDepth(s.fmDepth ?? this.fmDepth);
  }
}
