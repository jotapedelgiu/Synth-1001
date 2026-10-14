import { Module } from '../Module.js';
import { GateIn, NoteIn } from '../EventPorts.js';
import { coefficients } from '../waveforms.js';

export const NOTE_MIN = 33; // A1
export const NOTE_MAX = 81; // A5

const ATTACK_TAU = 0.003; // s: ataque curto, sem clique
const RELEASE_TAU = 0.02; // s: ao fim da nota o som some em ~60 ms
const DECAY_TAUS = 3; // o decaimento chega a ~95% do caminho no tempo do botão
const ENV_CENTS = 60; // cents de abertura do filtro por 1% do knob Env (100% = 5 oitavas)
const ACCENT_CENTS = 24; // cents a mais no filtro por 1% do knob Accent (100% = 2 oitavas)
const ACCENT_TAU = 0.05; // s: o empurrão do accent no filtro é curto, qualquer que seja o decay
const ACCENT_BOOST = 0.8; // quanto o volume cresce com o accent em 100%

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

// Sintetizador acid (no estilo do TB-303), para melodias e linhas "borbulhantes":
//
//   oscilador ─ filtro passa-baixas 24 dB/oit. ─ saturação ─ VCA ─ accent ─ nível ─ saída
//                      ▲                                        ▲
//                      └ envelope do filtro (+ accent)          └ volume do accent
//
// A "bolha" é o filtro bem ressonante abrindo no ataque de cada nota e fechando no decaimento.
// O envelope move o corte em oitavas (não em Hz), então o efeito é o mesmo em notas graves e agudas.
//
// Portas: `pitch` (nota, em oitavas: o sequenciador liga aqui; o slide vem dele), `gate` (evento:
// dispara o envelope), `accent` (evento: enquanto ligado, a nota soa mais forte e o filtro abre
// mais), `key` (evento: o tom, vindo do gerador de acordes) e `out`.
export class Acid extends Module {
  static type = 'acid';

  constructor(ctx, params = {}) {
    super(ctx);
    // note em MIDI; cutoff em Hz; decay em ms; o resto em % (q é a ressonância do filtro)
    this.params = {
      note: 57, cutoff: 300, q: 14, env: 60, decay: 200, accent: 60, drive: 35, level: 60,
      ...params,
    };
    this.waveform = params.waveform ?? 'sawtooth';
    // para o osciloscópio tratar este módulo como uma fonte qualquer
    this.realPhase = true;
    this.phase = 0;
    this.key = null; // nota (MIDI) recebida pela porta `key`, ou null se nada estiver ligado
    this.onKey = null; // callback() quando o tom muda, para a interface

    const p = this.params;
    this.osc = ctx.createOscillator();
    this.osc.frequency.value = midiToHz(p.note);
    this.oscGain = ctx.createGain();
    this.oscGain.gain.value = 0.5;

    // dois passa-baixas em série (24 dB/oit.): o primeiro leva a ressonância, o segundo só fecha mais
    this.filters = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
    for (const f of this.filters) {
      f.type = 'lowpass';
      f.frequency.value = p.cutoff;
    }
    this.filters[0].Q.value = p.q;
    this.filters[1].Q.value = 0.7;

    // envelope do filtro e empurrão do accent: fontes constantes (0 a 1) escaladas em cents
    this.envSource = ctx.createConstantSource();
    this.envSource.offset.value = 0;
    this.envAmount = ctx.createGain();
    this.envAmount.gain.value = p.env * ENV_CENTS;
    this.accentSource = ctx.createConstantSource();
    this.accentSource.offset.value = 0;
    this.accentAmount = ctx.createGain();
    this.accentAmount.gain.value = p.accent * ACCENT_CENTS;
    this.envSource.connect(this.envAmount);
    this.accentSource.connect(this.accentAmount);
    for (const f of this.filters) {
      this.envAmount.connect(f.detune);
      this.accentAmount.connect(f.detune);
    }

    this.drive = ctx.createWaveShaper();
    this.drive.oversample = '2x';
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    this.accentVca = ctx.createGain(); // 1 normalmente; maior durante um passo com accent
    this.out = ctx.createGain();
    this.out.gain.value = p.level / 100;

    this.osc.connect(this.oscGain).connect(this.filters[0]).connect(this.filters[1])
      .connect(this.drive).connect(this.vca).connect(this.accentVca).connect(this.out);

    // 1 unidade de entrada = 1 oitava = 1200 cents
    this.pitch = ctx.createGain();
    this.pitch.gain.value = 1200;
    this.pitch.connect(this.osc.detune);

    this.inputs.pitch = this.pitch;
    this.inputs.gate = new GateIn({ on: (when) => this.#on(when), off: (when) => this.#off(when) });
    this.inputs.accent = new GateIn({ on: (when) => this.#accentOn(when), off: (when) => this.#accentOff(when) });
    this.inputs.key = new NoteIn((note) => this.setKey(note));
    this.outputs.out = this.out;

    this.#applyWave();
    this.#applyDrive();
    this.osc.start();
    this.envSource.start();
    this.accentSource.start();
  }

  // Nota base que realmente soa (MIDI). Sem tom ligado é a do knob; com tom, é a nota recebida
  // na oitava mais próxima do knob (que passa a escolher só a oitava).
  get baseNote() {
    const { note } = this.params;
    if (this.key == null) return note;
    return this.key + 12 * Math.round((note - this.key) / 12);
  }

  // para o osciloscópio e o status
  get freq() {
    return Math.round(midiToHz(this.baseNote));
  }

  get amp() {
    return this.params.level;
  }

  // Tom vindo da porta `key` (número MIDI), ou null para voltar à nota do knob
  setKey(note) {
    this.key = note;
    this.#applyNote();
    this.onKey?.();
  }

  // Nota (gate ligado) no instante `when`: abre o volume e o filtro, que logo começa a fechar.
  // setTargetAtTime parte do valor que o parâmetro tiver em `when`, então uma nota nova sobre a
  // anterior não dá salto nem clique.
  #on(when) {
    const t = Math.max(when, this.ctx.currentTime);
    this.vca.gain.cancelScheduledValues(t);
    this.vca.gain.setTargetAtTime(1, t, ATTACK_TAU);
    this.envSource.offset.cancelScheduledValues(t);
    this.envSource.offset.setTargetAtTime(1, t, ATTACK_TAU / 2);
    this.envSource.offset.setTargetAtTime(0, t + 0.01, this.params.decay / 1000 / DECAY_TAUS);
  }

  #off(when) {
    const t = Math.max(when, this.ctx.currentTime);
    this.vca.gain.cancelScheduledValues(t);
    this.vca.gain.setTargetAtTime(0, t, RELEASE_TAU);
  }

  // Accent: mais volume enquanto durar e um empurrão curto a mais no filtro
  #accentOn(when) {
    const t = Math.max(when, this.ctx.currentTime);
    const amount = this.params.accent / 100;
    this.accentVca.gain.cancelScheduledValues(t);
    this.accentVca.gain.setTargetAtTime(1 + amount * ACCENT_BOOST, t, ATTACK_TAU);
    this.accentSource.offset.cancelScheduledValues(t);
    this.accentSource.offset.setTargetAtTime(1, t, ATTACK_TAU / 2);
    this.accentSource.offset.setTargetAtTime(0, t + 0.01, ACCENT_TAU);
  }

  #accentOff(when) {
    const t = Math.max(when, this.ctx.currentTime);
    this.accentVca.gain.cancelScheduledValues(t);
    this.accentVca.gain.setTargetAtTime(1, t, RELEASE_TAU);
  }

  // Gate manual (botão do painel)
  noteOn() {
    this.#on(this.ctx.currentTime);
  }

  noteOff() {
    this.#off(this.ctx.currentTime);
  }

  setNote(midi) {
    this.params.note = midi;
    this.#applyNote();
  }

  #applyNote() {
    this.osc.frequency.setTargetAtTime(midiToHz(this.baseNote), this.ctx.currentTime, 0.01);
  }

  setCutoff(hz) {
    this.params.cutoff = hz;
    for (const f of this.filters) f.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
  }

  setQ(q) {
    this.params.q = q;
    this.filters[0].Q.setTargetAtTime(q, this.ctx.currentTime, 0.01);
  }

  setEnv(pct) {
    this.params.env = pct;
    this.envAmount.gain.setTargetAtTime(pct * ENV_CENTS, this.ctx.currentTime, 0.01);
  }

  // decay vale a partir da próxima nota
  setDecay(ms) {
    this.params.decay = ms;
  }

  setAccent(pct) {
    this.params.accent = pct;
    this.accentAmount.gain.setTargetAtTime(pct * ACCENT_CENTS, this.ctx.currentTime, 0.01);
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
    this.osc.setPeriodicWave(this.ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
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
    for (const node of [this.osc, this.envSource, this.accentSource]) {
      try { node.stop(); } catch { /* já parado */ }
    }
  }

  getState() {
    return { ...this.params, waveform: this.waveform };
  }

  setState(s) {
    if (s.waveform) this.setWaveform(s.waveform);
    const p = { ...this.params, ...s };
    this.setNote(p.note);
    this.setCutoff(p.cutoff);
    this.setQ(p.q);
    this.setEnv(p.env);
    this.setDecay(p.decay);
    this.setAccent(p.accent);
    this.setDrive(p.drive);
    this.setLevel(p.level);
  }
}
