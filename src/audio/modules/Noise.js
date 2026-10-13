import { Module } from '../Module.js';
import { Gain } from './Gain.js';

export const NOISE_COLORS = [
  { id: 'white', label: 'Branco' }, // todas as frequências com a mesma energia: chiado agudo
  { id: 'pink', label: 'Rosa' }, // mais grave (−3 dB por oitava): soa mais natural, como vento e mar
];

const SECONDS = 2;

// Fonte de ruído. Serve de base para varreduras (risers), chimbais e efeitos: ligue num filtro
// e mexa no corte, ou num envelope para fazer um golpe curto.
export class Noise extends Module {
  static type = 'noise';
  #buffers = {};
  #source = null;

  constructor(ctx, { level = 50, color = 'white' } = {}) {
    super(ctx);
    this.level = new Gain(ctx, level / 100);
    this.outputs.out = this.level.node;
    this.#buffers.white = this.#makeWhite();
    this.#buffers.pink = this.#makePink(this.#buffers.white);
    this.color = color in this.#buffers ? color : 'white';
    this.#play();
  }

  get amount() {
    return Math.round(this.level.value * 100);
  }

  setLevel(pct) {
    this.level.set(pct / 100, 0.01);
  }

  setColor(id) {
    if (!(id in this.#buffers) || id === this.color) return;
    this.color = id;
    this.#play();
  }

  dispose() {
    try { this.#source?.stop(); } catch { /* já parado */ }
  }

  // (re)liga a fonte em laço com o buffer da cor atual
  #play() {
    this.dispose();
    this.#source = this.ctx.createBufferSource();
    this.#source.buffer = this.#buffers[this.color];
    this.#source.loop = true;
    this.#source.connect(this.level.node);
    this.#source.start();
  }

  #makeWhite() {
    const length = Math.round(this.ctx.sampleRate * SECONDS);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Ruído rosa a partir do branco (filtro de Paul Kellet, aproximação de −3 dB/oitava)
  #makePink(white) {
    const src = white.getChannelData(0);
    const buffer = this.ctx.createBuffer(1, src.length, this.ctx.sampleRate);
    const out = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < src.length; i++) {
      const w = src[i];
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buffer;
  }

  getState() {
    return { level: this.amount, color: this.color };
  }

  setState(s) {
    this.setColor(s.color);
    this.setLevel(s.level ?? this.amount);
  }
}
