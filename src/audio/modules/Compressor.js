import { Module } from '../Module.js';

const SMOOTH = 0.01;

// Compressor: reduz o volume do que passa do limiar (threshold), aproximando o som forte do
// fraco. Com o ganho de compensação (makeup) sobe o resultado, e o som fica mais cheio e
// uniforme. Portas: `in` e `out`.
export class Compressor extends Module {
  static type = 'compressor';

  constructor(ctx, { threshold = -24, ratio = 4, attack = 10, release = 200, makeup = 6 } = {}) {
    super(ctx);
    this.threshold = threshold; // dB
    this.ratio = ratio;
    this.attack = attack; // ms
    this.release = release; // ms
    this.makeup = makeup; // dB

    this.node = new DynamicsCompressorNode(ctx, { knee: 12 });
    this.makeupGain = ctx.createGain();
    this.node.connect(this.makeupGain);

    this.inputs.in = this.node;
    this.outputs.out = this.makeupGain;

    this.setState({ threshold, ratio, attack, release, makeup });
  }

  // Quanto o compressor está reduzindo agora, em dB (negativo ou zero)
  get reduction() {
    return this.node.reduction;
  }

  setThreshold(db) {
    this.threshold = db;
    this.node.threshold.setTargetAtTime(db, this.ctx.currentTime, SMOOTH);
  }

  setRatio(ratio) {
    this.ratio = ratio;
    this.node.ratio.setTargetAtTime(ratio, this.ctx.currentTime, SMOOTH);
  }

  setAttack(ms) {
    this.attack = ms;
    this.node.attack.setTargetAtTime(ms / 1000, this.ctx.currentTime, SMOOTH);
  }

  setRelease(ms) {
    this.release = ms;
    this.node.release.setTargetAtTime(ms / 1000, this.ctx.currentTime, SMOOTH);
  }

  setMakeup(db) {
    this.makeup = db;
    this.makeupGain.gain.setTargetAtTime(10 ** (db / 20), this.ctx.currentTime, SMOOTH);
  }

  getState() {
    const { threshold, ratio, attack, release, makeup } = this;
    return { threshold, ratio, attack, release, makeup };
  }

  setState(s) {
    this.setThreshold(s.threshold ?? this.threshold);
    this.setRatio(s.ratio ?? this.ratio);
    this.setAttack(s.attack ?? this.attack);
    this.setRelease(s.release ?? this.release);
    this.setMakeup(s.makeup ?? this.makeup);
  }
}
