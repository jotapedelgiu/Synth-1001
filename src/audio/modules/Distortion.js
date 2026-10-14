import { Module } from '../Module.js';

const SMOOTH = 0.01;
const MAX_DRIVE = 30; // ganho antes da curva com o drive em 100%
const CURVE_SIZE = 2048;

// Saturação: o sinal é amplificado (drive) e passa por uma curva tanh, que arredonda os picos e
// cria harmônicos. Soma corpo e "calor" ao som.
//
//   in ─┬─────────────────────────────────── dry ─┐
//       └─ drive ─ shaper(4x) ─ tone ─ level ─ wet ┴─ out
//
// `tone` é um passa-baixas que tira o chiado dos harmônicos agudos. Portas: `in` e `out`.
export class Distortion extends Module {
  static type = 'distortion';

  constructor(ctx, { drive = 40, tone = 6000, level = 50, mix = 100 } = {}) {
    super(ctx);
    this.drive = drive; // %
    this.tone = tone; // Hz
    this.level = level; // %
    this.mix = mix; // %

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.preGain = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = softClipCurve();
    this.shaper.oversample = '4x'; // evita o serrilhado (aliasing) dos harmônicos novos
    this.toneFilter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: tone });
    this.levelGain = ctx.createGain();

    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.preGain).connect(this.shaper).connect(this.toneFilter).connect(this.levelGain).connect(this.wet).connect(this.output);

    this.inputs.in = this.input;
    this.outputs.out = this.output;

    this.setDrive(drive);
    this.setLevel(level);
    this.setMix(mix);
  }

  #smooth(param, value) {
    param.setTargetAtTime(value, this.ctx.currentTime, SMOOTH);
  }

  setDrive(pct) {
    this.drive = pct;
    this.#smooth(this.preGain.gain, 1 + (pct / 100) * (MAX_DRIVE - 1));
  }

  setTone(hz) {
    this.tone = hz;
    this.#smooth(this.toneFilter.frequency, hz);
  }

  setLevel(pct) {
    this.level = pct;
    this.#smooth(this.levelGain.gain, pct / 100);
  }

  setMix(pct) {
    this.mix = pct;
    this.#smooth(this.dry.gain, 1 - pct / 100);
    this.#smooth(this.wet.gain, pct / 100);
  }

  getState() {
    const { drive, tone, level, mix } = this;
    return { drive, tone, level, mix };
  }

  setState(s) {
    this.setDrive(s.drive ?? this.drive);
    this.setTone(s.tone ?? this.tone);
    this.setLevel(s.level ?? this.level);
    this.setMix(s.mix ?? this.mix);
  }
}

// tanh(3x) para x em [-1, 1]; fora disso o WaveShaper mantém o valor das pontas (corte duro)
function softClipCurve() {
  const curve = new Float32Array(CURVE_SIZE);
  for (let i = 0; i < CURVE_SIZE; i++) {
    const x = (i / (CURVE_SIZE - 1)) * 2 - 1;
    curve[i] = Math.tanh(3 * x);
  }
  return curve;
}
