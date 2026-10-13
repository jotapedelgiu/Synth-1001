import { Module } from '../Module.js';

export const STAGE_OPTIONS = [2, 4, 6, 8];
const MAX_STAGES = Math.max(...STAGE_OPTIONS);
const MAX_SWEEP_CENTS = 2400; // profundidade 100% = ±2 oitavas ao redor da frequência central
const SMOOTH = 0.02;

// Phaser: uma cadeia de filtros passa-tudo (allpass) cuja frequência é varrida por um LFO.
// Somar o sinal original com o defasado cria "vales" (notches) que sobem e descem no espectro.
//
//   in ─┬─────────────────────────── dry ────────────────┐
//       └─ (+) ─ allpass ─ … ─ allpass ─┬──────── wet ───┴─ out
//          ▲                            └─ delay ─ feedback ─┐
//          └───────────────────────────────────────────────┘
//   LFO ─ depth ─▶ detune de cada allpass
//
// Cada par de estágios produz um vale. O ciclo de realimentação passa por um DelayNode
// (mínimo de um bloco de 128 amostras), o que o Web Audio exige para não silenciar o ciclo.
// Portas: `in` e `out`.
export class Phaser extends Module {
  static type = 'phaser';

  constructor(ctx, { rate = 0.5, depth = 60, center = 800, feedback = 40, mix = 50, stages = 4 } = {}) {
    super(ctx);
    this.rate = rate; // Hz
    this.depth = depth; // %
    this.center = center; // Hz
    this.feedback = feedback; // %
    this.mix = mix; // %
    this.stages = stages;

    this.input = ctx.createGain();
    this.sum = ctx.createGain(); // entrada + realimentação
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.feedbackDelay = ctx.createDelay(0.1);
    this.feedbackDelay.delayTime.value = 0;
    this.feedbackGain = ctx.createGain();

    this.allpass = Array.from({ length: MAX_STAGES }, () => {
      const f = ctx.createBiquadFilter();
      f.type = 'allpass';
      f.frequency.value = center;
      f.Q.value = 0.7;
      return f;
    });

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = rate;
    this.sweep = ctx.createGain();
    this.lfo.connect(this.sweep);
    for (const f of this.allpass) this.sweep.connect(f.detune);
    this.lfo.start();

    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.sum);
    this.wet.connect(this.output);
    this.feedbackDelay.connect(this.feedbackGain).connect(this.sum);

    this.inputs.in = this.input;
    this.outputs.out = this.output;

    this.#wire();
    this.#applyAll();
  }

  dispose() {
    this.lfo.stop();
  }

  // Religa a cadeia: sum → allpass[0..stages-1] → wet (e → realimentação)
  #wire() {
    const chain = this.allpass;
    this.sum.disconnect();
    for (const f of chain) f.disconnect();
    let node = this.sum;
    for (let i = 0; i < this.stages; i++) {
      node.connect(chain[i]);
      node = chain[i];
    }
    node.connect(this.wet);
    node.connect(this.feedbackDelay);
  }

  #smooth(param, value) {
    param.setTargetAtTime(value, this.ctx.currentTime, SMOOTH);
  }

  #applyAll() {
    this.setDepth(this.depth);
    this.setFeedback(this.feedback);
    this.setMix(this.mix);
  }

  setRate(hz) {
    this.rate = hz;
    this.#smooth(this.lfo.frequency, hz);
  }

  setDepth(pct) {
    this.depth = pct;
    this.#smooth(this.sweep.gain, (pct / 100) * MAX_SWEEP_CENTS);
  }

  setCenter(hz) {
    this.center = hz;
    for (const f of this.allpass) this.#smooth(f.frequency, hz);
  }

  setFeedback(pct) { // 0–90 (acima disso a ressonância dispara)
    this.feedback = pct;
    this.#smooth(this.feedbackGain.gain, pct / 100);
  }

  setMix(pct) {
    this.mix = pct;
    this.#smooth(this.dry.gain, 1 - pct / 100);
    this.#smooth(this.wet.gain, pct / 100);
  }

  setStages(n) {
    this.stages = n;
    this.#wire();
  }

  getState() {
    const { rate, depth, center, feedback, mix, stages } = this;
    return { rate, depth, center, feedback, mix, stages };
  }

  setState(s) {
    this.setRate(s.rate ?? this.rate);
    this.setDepth(s.depth ?? this.depth);
    this.setCenter(s.center ?? this.center);
    this.setFeedback(s.feedback ?? this.feedback);
    this.setMix(s.mix ?? this.mix);
    if (STAGE_OPTIONS.includes(s.stages)) this.setStages(s.stages);
  }
}
