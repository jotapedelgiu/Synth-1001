import { Module } from '../Module.js';
import { Gain } from './Gain.js';

export const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'];

// Filtro biquad: passa-baixas, passa-altas ou passa-faixa.
// Portas: `in`, `out` e `cutoff` (modulação da frequência de corte: o sinal que chega
// é escalado por cvDepth e somado ao corte, como o FM do oscilador).
export class Filter extends Module {
  static type = 'filter';

  constructor(ctx, { type = 'lowpass', cutoff = 10000, q = 1, cvDepth = 1000 } = {}) {
    super(ctx);
    this.type = type;
    this.cutoff = cutoff; // Hz
    this.q = q;
    this.cvDepth = cvDepth; // Hz de desvio para um sinal de amplitude 1

    this.node = ctx.createBiquadFilter();
    this.node.type = type;
    this.node.frequency.value = cutoff;
    this.node.Q.value = q;

    this.cv = new Gain(ctx, cvDepth);
    this.cv.connect(this.node.frequency);

    this.inputs.in = this.node;
    this.inputs.cutoff = this.cv.node;
    this.outputs.out = this.node;
  }

  setType(type) {
    this.type = type;
    this.node.type = type;
  }

  setCutoff(hz) {
    this.cutoff = hz;
    this.node.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
  }

  setQ(q) {
    this.q = q;
    this.node.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01);
  }

  setCvDepth(hz) {
    this.cvDepth = hz;
    this.cv.set(hz, 0.01);
  }

  getState() {
    const { type, cutoff, q, cvDepth } = this;
    return { type, cutoff, q, cvDepth };
  }

  setState(s) {
    if (FILTER_TYPES.includes(s.type)) this.setType(s.type);
    this.setCutoff(s.cutoff ?? this.cutoff);
    this.setQ(s.q ?? this.q);
    this.setCvDepth(s.cvDepth ?? this.cvDepth);
  }
}
