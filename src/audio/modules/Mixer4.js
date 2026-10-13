import { Module } from '../Module.js';

export const CHANNELS = 4;
export const EQ_RANGE = 12; // dB, para mais e para menos

const LOW_HZ = 200;
const MID_HZ = 1000;
const HIGH_HZ = 4000;
const SMOOTH = 0.01; // s: constante de tempo das mudanças de parâmetro (evita cliques)

// Mixer de 4 canais com master. Cada canal tem:
//   trim  → equalizador de 3 bandas (graves, médios, agudos) → fader (nível, mute/solo) → pan
//   e, depois do fader, um envio auxiliar (`send`) para um efeito externo.
// Portas: `ch1`..`ch4` (entradas), `return` (volta do efeito, soma no master antes do fader),
// `out` (master) e `send` (soma dos envios auxiliares dos 4 canais).
//
// Solo: com algum canal em solo, só os canais em solo soam (mute sempre vence).
// Os medidores (pico em 0–1) leem um AnalyserNode depois do fader de cada canal e do master.
export class Mixer4 extends Module {
  static type = 'mixer4';

  constructor(ctx) {
    super(ctx);
    this.master = 1;
    this.channels = Array.from({ length: CHANNELS }, (_, i) => this.#createChannel(i));

    this.bus = ctx.createGain();
    this.masterGain = ctx.createGain();
    this.sendBus = ctx.createGain();
    this.masterMeter = ctx.createAnalyser();
    this.masterMeter.fftSize = 256;

    this.bus.connect(this.masterGain);
    this.masterGain.connect(this.masterMeter);
    this.inputs.return = this.bus;
    this.outputs.out = this.masterGain;
    this.outputs.send = this.sendBus;

    for (const ch of this.channels) {
      ch.pan.connect(this.bus);
      ch.sendGain.connect(this.sendBus);
    }
    this.#applyLevels();
  }

  #createChannel(i) {
    const ctx = this.ctx;
    const shelf = (type, frequency) => new BiquadFilterNode(ctx, { type, frequency, gain: 0 });

    const ch = {
      level: 0.8, eq: { low: 0, mid: 0, high: 0 }, panValue: 0, trimDb: 0, send: 0, mute: false, solo: false,
      trim: ctx.createGain(),
      low: shelf('lowshelf', LOW_HZ),
      mid: new BiquadFilterNode(ctx, { type: 'peaking', frequency: MID_HZ, Q: 0.8, gain: 0 }),
      high: shelf('highshelf', HIGH_HZ),
      fader: ctx.createGain(),
      sendGain: ctx.createGain(),
      meter: ctx.createAnalyser(),
      // o StereoPanner deixa um sinal mono em estéreo (o AudioParam `pan` vai de -1 a 1)
      pan: new StereoPannerNode(ctx, { pan: 0 }),
    };
    ch.meter.fftSize = 256;
    ch.sendGain.gain.value = 0;

    ch.trim.connect(ch.low).connect(ch.mid).connect(ch.high).connect(ch.fader);
    ch.fader.connect(ch.pan);
    ch.fader.connect(ch.sendGain);
    ch.fader.connect(ch.meter);
    this.inputs[`ch${i + 1}`] = ch.trim;
    return ch;
  }

  #smooth(param, value) {
    param.setTargetAtTime(value, this.ctx.currentTime, SMOOTH);
  }

  // O que cada fader recebe: nível, ou 0 se mutado / fora do solo
  #applyLevels() {
    const anySolo = this.channels.some((c) => c.solo);
    for (const ch of this.channels) {
      const silent = ch.mute || (anySolo && !ch.solo);
      this.#smooth(ch.fader.gain, silent ? 0 : ch.level);
    }
  }

  // --- canal (0–3) ---
  setTrim(i, db) {
    this.channels[i].trimDb = db;
    this.#smooth(this.channels[i].trim.gain, 10 ** (db / 20));
  }

  setEq(i, band, db) { // band: 'low' | 'mid' | 'high'
    this.channels[i].eq[band] = db;
    this.#smooth(this.channels[i][band].gain, db);
  }

  setLevel(i, level) {
    this.channels[i].level = level;
    this.#applyLevels();
  }

  setPan(i, pan) { // -1 (esquerda) … +1 (direita)
    this.channels[i].panValue = pan;
    this.#smooth(this.channels[i].pan.pan, pan);
  }

  setSend(i, level) {
    this.channels[i].send = level;
    this.#smooth(this.channels[i].sendGain.gain, level);
  }

  setMute(i, on) {
    this.channels[i].mute = on;
    this.#applyLevels();
  }

  setSolo(i, on) {
    this.channels[i].solo = on;
    this.#applyLevels();
  }

  setMaster(level) {
    this.master = level;
    this.#smooth(this.masterGain.gain, level);
  }

  // Pico recente (0–1) do canal `i`, ou do master quando `i` é omitido
  peak(i) {
    const analyser = i === undefined ? this.masterMeter : this.channels[i].meter;
    this.#buffer ??= new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(this.#buffer);
    let peak = 0;
    for (const v of this.#buffer) peak = Math.max(peak, Math.abs(v));
    return Math.min(1, peak);
  }

  #buffer = null;

  getState() {
    return {
      master: this.master,
      channels: this.channels.map(({ trimDb, eq, send, panValue, level, mute, solo }) => (
        { trimDb, eq: { ...eq }, send, pan: panValue, level, mute, solo }
      )),
    };
  }

  setState(s) {
    s.channels?.slice(0, CHANNELS).forEach((c, i) => {
      this.setTrim(i, c.trimDb ?? 0);
      for (const band of ['low', 'mid', 'high']) this.setEq(i, band, c.eq?.[band] ?? 0);
      this.setSend(i, c.send ?? 0);
      this.setPan(i, c.pan ?? 0);
      this.channels[i].level = c.level ?? this.channels[i].level;
      this.channels[i].mute = Boolean(c.mute);
      this.channels[i].solo = Boolean(c.solo);
    });
    this.#applyLevels();
    this.setMaster(s.master ?? this.master);
  }
}
