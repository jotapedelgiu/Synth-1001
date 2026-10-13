import { Module } from '../Module.js';
import { Gain } from './Gain.js';

const MAX_TIME = 2; // s
const DAMPING_HZ = 5000; // cada repetição perde agudos, como numa fita

// Delay com realimentação e mixagem seco/molhado.
//
//   in ─┬──────────── dry ───────────────┐
//       └─ delay ─┬─────────── wet ──────┴─ out
//             ▲   └─ damping ─ feedback ─┐
//             └────────────────────────┘
//
// Portas: `in` e `out`. O ciclo de realimentação passa por um DelayNode, o que o Web Audio permite.
export class Delay extends Module {
  static type = 'delay';
  #stopTempo = null;

  // `tempo` (opcional): o andamento compartilhado, que o eco sincronizado acompanha
  constructor(ctx, { time = 250, feedback = 40, mix = 30, tempo = null } = {}) {
    super(ctx);
    this.tempo = tempo;
    this.time = time; // ms
    this.sync = 0.5; // duração do eco em tempos (0,5 = colcheia); null = tempo livre, em ms
    this.onTime = null; // callback(ms) quando o tempo muda por sincronia (a interface atualiza o knob)
    this.feedback = feedback; // %
    this.mix = mix; // %

    this.input = new Gain(ctx);
    this.output = new Gain(ctx);
    this.dry = new Gain(ctx, 1 - mix / 100);
    this.wet = new Gain(ctx, mix / 100);
    this.feedbackGain = new Gain(ctx, feedback / 100);

    this.delay = ctx.createDelay(MAX_TIME);
    this.delay.delayTime.value = time / 1000;
    this.damping = ctx.createBiquadFilter();
    this.damping.type = 'lowpass';
    this.damping.frequency.value = DAMPING_HZ;

    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.delay);
    this.delay.connect(this.wet.node);
    this.wet.connect(this.output);
    this.delay.connect(this.damping);
    this.damping.connect(this.feedbackGain.node);
    this.feedbackGain.connect(this.delay);

    this.inputs.in = this.input.node;
    this.outputs.out = this.output.node;

    if (tempo) {
      this.#stopTempo = tempo.onChange((bpm) => this.applyTempo(bpm));
      this.applyTempo(tempo.bpm);
    }
  }

  dispose() {
    this.#stopTempo?.();
  }

  // Mudar o tempo aos poucos faz o eco "deslizar" de afinação, como um delay de fita
  setTime(ms) {
    this.time = ms;
    this.delay.delayTime.setTargetAtTime(ms / 1000, this.ctx.currentTime, 0.05);
  }

  // Sincroniza o eco com o andamento: `beats` é a duração em tempos (0,25 = semicolcheia,
  // 0,5 = colcheia, 0,75 = colcheia pontuada, 1 = semínima); null volta ao tempo livre.
  setSync(beats, bpm) {
    this.sync = beats;
    if (beats) this.applyTempo(bpm);
  }

  // Chamado quando o BPM muda: recalcula o tempo se estiver sincronizado
  applyTempo(bpm) {
    if (!this.sync) return;
    const ms = Math.min(MAX_TIME * 1000, (60000 / bpm) * this.sync);
    this.setTime(ms);
    this.onTime?.(ms);
  }

  setFeedback(pct) {
    this.feedback = pct;
    this.feedbackGain.set(pct / 100, 0.01);
  }

  setMix(pct) {
    this.mix = pct;
    this.dry.set(1 - pct / 100, 0.01);
    this.wet.set(pct / 100, 0.01);
  }

  getState() {
    const { time, sync, feedback, mix } = this;
    return { time, sync, feedback, mix };
  }

  setState(s) {
    this.sync = s.sync ?? null;
    if (this.sync && this.tempo) this.applyTempo(this.tempo.bpm);
    else this.setTime(s.time ?? this.time);
    this.setFeedback(s.feedback ?? this.feedback);
    this.setMix(s.mix ?? this.mix);
  }
}
