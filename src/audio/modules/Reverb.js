import { Module } from '../Module.js';

const SMOOTH = 0.02;
export const MIN_DECAY = 0.3; // s
export const MAX_DECAY = 6;

// Reverb por convolução com uma resposta ao impulso gerada na hora: ruído estéreo cujo volume cai
// exponencialmente. Não precisa de arquivo de áudio.
//
//   in ─┬──────────────────────── dry ─────────────┐
//       └─ predelay ─ damping ─ convolver ─ wet ───┴─ out
//
// `size` é o tempo de decaimento (s); `damping` é a frequência de corte do filtro que escurece
// o som que entra no reverb; `predelay` (ms) separa o som seco do início da cauda.
// Portas: `in` e `out`.
export class Reverb extends Module {
  static type = 'reverb';

  constructor(ctx, { size = 2.5, damping = 6000, predelay = 20, mix = 30 } = {}) {
    super(ctx);
    this.size = size;
    this.damping = damping;
    this.predelay = predelay;
    this.mix = mix;

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.pre = ctx.createDelay(0.2);
    this.tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: damping });
    this.convolver = ctx.createConvolver();
    this.convolver.normalize = true;

    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.pre).connect(this.tone).connect(this.convolver).connect(this.wet).connect(this.output);

    this.inputs.in = this.input;
    this.outputs.out = this.output;

    this.#buildImpulse();
    this.setPredelay(predelay);
    this.setMix(mix);
  }

  #buildImpulse() {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(this.size * rate);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        // -60 dB ao fim do tempo de decaimento (cada canal tem o seu ruído: dá a largura estéreo)
        data[i] = (Math.random() * 2 - 1) * 10 ** (-3 * (i / length));
      }
    }
    this.convolver.buffer = impulse;
  }

  setSize(seconds) {
    this.size = Math.min(MAX_DECAY, Math.max(MIN_DECAY, seconds));
    this.#buildImpulse();
  }

  setDamping(hz) {
    this.damping = hz;
    this.tone.frequency.setTargetAtTime(hz, this.ctx.currentTime, SMOOTH);
  }

  setPredelay(ms) {
    this.predelay = ms;
    this.pre.delayTime.setTargetAtTime(ms / 1000, this.ctx.currentTime, SMOOTH);
  }

  setMix(pct) {
    this.mix = pct;
    const now = this.ctx.currentTime;
    this.dry.gain.setTargetAtTime(1 - pct / 100, now, SMOOTH);
    this.wet.gain.setTargetAtTime(pct / 100, now, SMOOTH);
  }

  getState() {
    const { size, damping, predelay, mix } = this;
    return { size, damping, predelay, mix };
  }

  setState(s) {
    this.setSize(s.size ?? this.size);
    this.setDamping(s.damping ?? this.damping);
    this.setPredelay(s.predelay ?? this.predelay);
    this.setMix(s.mix ?? this.mix);
  }
}
