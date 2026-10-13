import { Module } from '../Module.js';

export const FFT_SIZE = 16384; // histórico ≈ 340 ms @48 kHz; menor = menos latência

// Entrada do osciloscópio: captura contínua do sinal que chega em `in`.
// O disparo e a exibição ficam em scope/Trigger e scope/ScopeView.
export class Scope extends Module {
  static type = 'scope';

  constructor(ctx, fftSize) {
    super(ctx);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0;
    this.inputs.in = this.analyser;
  }

  dispose() {
    this.analyser.disconnect();
  }

  // Preenche `buffer` com as últimas `fftSize` amostras (a mais recente no fim)
  capture(buffer) {
    this.analyser.getFloatTimeDomainData(buffer);
  }
}
