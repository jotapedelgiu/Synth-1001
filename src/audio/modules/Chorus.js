import { Module } from '../Module.js';

const SMOOTH = 0.02;
const BASE_DELAY = 0.02; // s: atraso médio de cada voz
const MAX_SWEEP = 0.008; // s: desvio máximo do atraso com a profundidade em 100%

// Chorus: duas cópias atrasadas cujo atraso oscila (um LFO, um em cada sentido). A variação de
// atraso desafina levemente as cópias, e o som parece vir de vários instrumentos juntos.
//
//   in ─┬────────────────────── dry ──────────┐
//       ├─ delay A ─┐                         │
//       └─ delay B ─┴─ wet ───────────────────┴─ out
//   LFO ─ depth ─▶ delay A    LFO ─ −depth ─▶ delay B
//
// Portas: `in` e `out`.
export class Chorus extends Module {
  static type = 'chorus';

  constructor(ctx, { rate = 0.8, depth = 50, mix = 50 } = {}) {
    super(ctx);
    this.rate = rate; // Hz
    this.depth = depth; // %
    this.mix = mix; // %

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.voices = ctx.createGain(); // soma as duas vozes; cada uma entra pela metade
    this.voices.gain.value = 0.5;
    this.wet = ctx.createGain();

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = rate;
    this.sweepA = ctx.createGain();
    this.sweepB = ctx.createGain();
    this.lfo.connect(this.sweepA);
    this.lfo.connect(this.sweepB);

    for (const sweep of [this.sweepA, this.sweepB]) {
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = BASE_DELAY;
      this.input.connect(delay).connect(this.voices);
      sweep.connect(delay.delayTime);
    }
    this.voices.connect(this.wet).connect(this.output);
    this.input.connect(this.dry).connect(this.output);
    this.lfo.start();

    this.inputs.in = this.input;
    this.outputs.out = this.output;

    this.setDepth(depth);
    this.setMix(mix);
  }

  dispose() {
    this.lfo.stop();
  }

  #smooth(param, value) {
    param.setTargetAtTime(value, this.ctx.currentTime, SMOOTH);
  }

  setRate(hz) {
    this.rate = hz;
    this.#smooth(this.lfo.frequency, hz);
  }

  setDepth(pct) {
    this.depth = pct;
    const sweep = (pct / 100) * MAX_SWEEP;
    this.#smooth(this.sweepA.gain, sweep);
    this.#smooth(this.sweepB.gain, -sweep);
  }

  setMix(pct) {
    this.mix = pct;
    this.#smooth(this.dry.gain, 1 - pct / 200); // mantém o corpo do som seco mesmo com mix alto
    this.#smooth(this.wet.gain, pct / 100);
  }

  getState() {
    const { rate, depth, mix } = this;
    return { rate, depth, mix };
  }

  setState(s) {
    this.setRate(s.rate ?? this.rate);
    this.setDepth(s.depth ?? this.depth);
    this.setMix(s.mix ?? this.mix);
  }
}
