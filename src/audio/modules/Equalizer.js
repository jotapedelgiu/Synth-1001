import { Module } from '../Module.js';

export const EQ_RANGE = 12; // dB, para mais e para menos
const LOW_HZ = 200;
const MID_HZ = 1000;
const HIGH_HZ = 4000;
const SMOOTH = 0.01;

// Equalizador de 3 bandas: graves e agudos em "prateleira" (shelf), médios em pico.
// Portas: `in` e `out`.
export class Equalizer extends Module {
  static type = 'equalizer';

  constructor(ctx, { low = 0, mid = 0, high = 0 } = {}) {
    super(ctx);
    this.gains = { low, mid, high }; // dB
    this.bands = {
      low: new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: LOW_HZ, gain: low }),
      mid: new BiquadFilterNode(ctx, { type: 'peaking', frequency: MID_HZ, Q: 0.8, gain: mid }),
      high: new BiquadFilterNode(ctx, { type: 'highshelf', frequency: HIGH_HZ, gain: high }),
    };
    this.bands.low.connect(this.bands.mid).connect(this.bands.high);

    this.inputs.in = this.bands.low;
    this.outputs.out = this.bands.high;
  }

  setBand(band, db) { // band: 'low' | 'mid' | 'high'
    this.gains[band] = db;
    this.bands[band].gain.setTargetAtTime(db, this.ctx.currentTime, SMOOTH);
  }

  getState() {
    return { ...this.gains };
  }

  setState(s) {
    for (const band of ['low', 'mid', 'high']) this.setBand(band, s[band] ?? this.gains[band]);
  }
}
