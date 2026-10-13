import { Module } from '../Module.js';

// Ganho simples. Serve de mixer (várias entradas somam em `in`), de VCA
// (sinal de controle na porta `gain`) e de chave liga/desliga.
export class Gain extends Module {
  static type = 'mixer';

  constructor(ctx, level = 1) {
    super(ctx);
    this.value = level; // último nível pedido (a interface lê daqui)
    this.node = ctx.createGain();
    this.node.gain.value = level;
    this.inputs.in = this.node;
    this.inputs.gain = this.node.gain;
    this.outputs.out = this.node;
  }

  // `smooth` > 0 suaviza a transição (constante de tempo em segundos), evitando cliques
  set(level, smooth = 0) {
    this.value = level;
    if (smooth > 0) this.node.gain.setTargetAtTime(level, this.ctx.currentTime, smooth);
    else this.node.gain.value = level;
  }

  getState() {
    return { level: this.value };
  }

  setState(s) {
    this.set(s.level ?? this.value);
  }
}
