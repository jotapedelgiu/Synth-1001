import { Module } from '../Module.js';
import { coefficients } from '../waveforms.js';
import { Gain } from './Gain.js';

export const RATE_MIN = 0.1; // Hz
export const RATE_MAX = 30;

// Oscilador de baixa frequência: não soa, só movimenta outros módulos. Liga-se por um cabo
// às portas de controle (`pitch` do oscilador = vibrato, `cutoff` do filtro = varredura/wah,
// `gain` do mixer = tremolo, `freq` = FM lenta...).
// `depth` é a amplitude da saída em % (0–100), com curva quadrática: a metade de baixo do botão
// dá os desvios pequenos que o `pitch` pede (1 unidade = 1 oitava), e o máximo dá 1 inteira.
export class Lfo extends Module {
  static type = 'lfo';

  constructor(ctx, { rate = 5, depth = 20, waveform = 'sine' } = {}) {
    super(ctx);
    this.rate = rate; // Hz
    this.depth = depth; // %
    this.waveform = waveform;

    this.osc = ctx.createOscillator();
    this.osc.frequency.value = rate;
    this.#applyWave();
    this.amount = new Gain(ctx, this.#amplitude());
    this.osc.connect(this.amount.node);
    this.osc.start();

    this.outputs.out = this.amount.node;
  }

  #amplitude() {
    return (this.depth / 100) ** 2;
  }

  setRate(hz) {
    this.rate = Math.min(RATE_MAX, Math.max(RATE_MIN, hz));
    this.osc.frequency.setTargetAtTime(this.rate, this.ctx.currentTime, 0.01);
  }

  setDepth(pct) {
    this.depth = pct;
    this.amount.set(this.#amplitude(), 0.01);
  }

  setWaveform(name) {
    this.waveform = name;
    this.#applyWave();
  }

  #applyWave() {
    const { real, imag } = coefficients(this.waveform, 0);
    this.osc.setPeriodicWave(this.ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
  }

  dispose() {
    try { this.osc.stop(); } catch { /* já parado */ }
  }

  getState() {
    const { rate, depth, waveform } = this;
    return { rate, depth, waveform };
  }

  setState(s) {
    if (s.waveform) this.setWaveform(s.waveform);
    this.setRate(s.rate ?? this.rate);
    this.setDepth(s.depth ?? this.depth);
  }
}
