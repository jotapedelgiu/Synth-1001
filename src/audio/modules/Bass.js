import { Module } from '../Module.js';
import { GateIn } from '../EventPorts.js';
import { coefficients } from '../waveforms.js';

const ATTACK_TAU = 0.004; // s: ataque curto, sem clique
const RELEASE_TAU = 0.025; // s: ao fim da nota o som some em ~80 ms
const DECAY_TAUS = 3; // o decaimento chega a ~95% do caminho no tempo do botão

// Baixo monofônico completo, para não montar Onda + Filtro + Envelope na mão:
//
//   oscilador ─┐
//              ├─ filtro passa-baixas ─ saturação ─ VCA ─ nível ─ saída
//   sub (−1 oit.)┘      ▲                            ▲
//                       └ envelope do filtro         └ envelope de volume (decay/sustain)
//
// Portas: `pitch` (nota, em oitavas, como no Oscilador: o sequenciador liga aqui), `gate`
// (evento: cada nota do sequenciador dispara os dois envelopes) e `out`.
// O envelope do filtro abre o corte no ataque e o fecha no decaimento: o "pluck" do baixo.
export class Bass extends Module {
  static type = 'bass';

  constructor(ctx, params = {}) {
    super(ctx);
    // freq em Hz da nota base (55 = lá 1); o resto em % ou Hz conforme o knob
    this.params = {
      freq: 55, sub: 60, cutoff: 250, q: 6, envAmount: 1800, decay: 250, sustain: 40, drive: 30, level: 70,
      ...params,
    };
    this.waveform = params.waveform ?? 'sawtooth';
    // para o osciloscópio tratar este módulo como uma fonte qualquer
    this.realPhase = true;
    this.phase = 0;
    this.onGate = null; // callback(gateOn) para a interface

    const p = this.params;
    this.main = ctx.createOscillator();
    this.main.frequency.value = p.freq;
    this.subOsc = ctx.createOscillator(); // seno uma oitava abaixo
    this.subOsc.frequency.value = p.freq / 2;
    this.mainGain = ctx.createGain();
    this.mainGain.gain.value = 0.6;
    this.subGain = ctx.createGain();
    this.subGain.gain.value = (p.sub / 100) * 0.8;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = p.cutoff;
    this.filter.Q.value = p.q;

    // envelope do filtro: uma fonte constante que sobe a 1 no ataque e desce a 0, escalada em Hz
    this.envSource = ctx.createConstantSource();
    this.envSource.offset.value = 0;
    this.envAmount = ctx.createGain();
    this.envAmount.gain.value = p.envAmount;
    this.envSource.connect(this.envAmount).connect(this.filter.frequency);

    this.drive = ctx.createWaveShaper();
    this.drive.oversample = '2x';
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    this.out = ctx.createGain();
    this.out.gain.value = p.level / 100;

    this.main.connect(this.mainGain).connect(this.filter);
    this.subOsc.connect(this.subGain).connect(this.filter);
    this.filter.connect(this.drive).connect(this.vca).connect(this.out);

    // 1 unidade de entrada = 1 oitava = 1200 cents, nas duas vozes
    this.pitch = ctx.createGain();
    this.pitch.gain.value = 1200;
    this.pitch.connect(this.main.detune);
    this.pitch.connect(this.subOsc.detune);

    this.inputs.pitch = this.pitch;
    this.inputs.gate = new GateIn({ on: (when) => this.#on(when), off: (when) => this.#off(when) });
    this.outputs.out = this.out;

    this.#applyWave();
    this.#applyDrive();
    this.main.start();
    this.subOsc.start();
    this.envSource.start();
  }

  // para o osciloscópio e o status
  get freq() {
    return Math.round(this.params.freq);
  }

  get amp() {
    return this.params.level;
  }

  // Nota (gate ligado) no instante `when`: abre o volume e o filtro e começa a decair.
  // setTargetAtTime parte do valor que o parâmetro tiver em `when`, então uma nota nova sobre a
  // anterior não dá salto nem clique.
  #on(when) {
    const t = Math.max(when, this.ctx.currentTime);
    const tau = this.params.decay / 1000 / DECAY_TAUS;
    this.vca.gain.cancelScheduledValues(t);
    this.vca.gain.setTargetAtTime(1, t, ATTACK_TAU);
    this.vca.gain.setTargetAtTime(this.params.sustain / 100, t + 0.015, tau);
    this.envSource.offset.cancelScheduledValues(t);
    this.envSource.offset.setTargetAtTime(1, t, ATTACK_TAU / 2);
    this.envSource.offset.setTargetAtTime(0, t + 0.01, tau);
    this.onGate?.(true);
  }

  #off(when) {
    const t = Math.max(when, this.ctx.currentTime);
    this.vca.gain.cancelScheduledValues(t);
    this.vca.gain.setTargetAtTime(0, t, RELEASE_TAU);
    this.onGate?.(false);
  }

  // Gate manual (botão do painel)
  noteOn() {
    this.#on(this.ctx.currentTime);
  }

  noteOff() {
    this.#off(this.ctx.currentTime);
  }

  setFreq(hz) {
    this.params.freq = hz;
    const now = this.ctx.currentTime;
    this.main.frequency.setTargetAtTime(hz, now, 0.01);
    this.subOsc.frequency.setTargetAtTime(hz / 2, now, 0.01);
  }

  setSub(pct) {
    this.params.sub = pct;
    this.subGain.gain.setTargetAtTime((pct / 100) * 0.8, this.ctx.currentTime, 0.01);
  }

  setCutoff(hz) {
    this.params.cutoff = hz;
    this.filter.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
  }

  setQ(q) {
    this.params.q = q;
    this.filter.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01);
  }

  setEnvAmount(hz) {
    this.params.envAmount = hz;
    this.envAmount.gain.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
  }

  // decay e sustain valem a partir da próxima nota
  setDecay(ms) {
    this.params.decay = ms;
  }

  setSustain(pct) {
    this.params.sustain = pct;
  }

  setDrive(pct) {
    this.params.drive = pct;
    this.#applyDrive();
  }

  setLevel(pct) {
    this.params.level = pct;
    this.out.gain.setTargetAtTime(pct / 100, this.ctx.currentTime, 0.01);
  }

  setWaveform(name) {
    this.waveform = name;
    this.#applyWave();
  }

  #applyWave() {
    const { real, imag } = coefficients(this.waveform, 0);
    this.main.setPeriodicWave(this.ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
  }

  // Saturação suave (tanh normalizada): quase linear com drive baixo, bem "suja" com drive alto
  #applyDrive() {
    const d = 0.05 + (this.params.drive / 100) * 7;
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(d * x) / Math.tanh(d);
    }
    this.drive.curve = curve;
  }

  dispose() {
    for (const node of [this.main, this.subOsc, this.envSource]) {
      try { node.stop(); } catch { /* já parado */ }
    }
  }

  getState() {
    return { ...this.params, waveform: this.waveform };
  }

  setState(s) {
    if (s.waveform) this.setWaveform(s.waveform);
    const p = { ...this.params, ...s };
    this.setFreq(p.freq);
    this.setSub(p.sub);
    this.setCutoff(p.cutoff);
    this.setQ(p.q);
    this.setEnvAmount(p.envAmount);
    this.setDecay(p.decay);
    this.setSustain(p.sustain);
    this.setDrive(p.drive);
    this.setLevel(p.level);
  }
}
