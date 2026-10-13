import { Module } from '../Module.js';
import { Gain } from './Gain.js';

const OUTPUT_LEVEL = 0.3; // limita o volume no alto-falante

// Saída de áudio do computador.
export class Speaker extends Module {
  static type = 'speaker';

  constructor(ctx) {
    super(ctx);
    this.active = true;
    this.level = new Gain(ctx, OUTPUT_LEVEL);
    this.level.connect(ctx.destination);
    this.inputs.in = this.level.node;
  }

  dispose() {
    this.level.node.disconnect(); // sai do destino de áudio
  }

  setActive(on) {
    this.active = on;
    this.level.set(on ? OUTPUT_LEVEL : 0);
  }

  getState() {
    return { active: this.active };
  }

  setState(s) {
    if (typeof s.active === 'boolean') this.setActive(s.active);
  }
}
