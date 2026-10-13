import { Module } from '../Module.js';
import { ClockIn } from '../EventPorts.js';
import { DEFAULT_KIT, DRUM_KITS } from '../drumKits.js';
import { DRUM_PATTERNS, parseTrack } from '../drumPatterns.js';
import { STEPS, fitBars } from '../steps.js';
import { Gain } from './Gain.js';

export const DRUM_TRACKS = [
  { id: 'kick', name: 'Bumbo' },
  { id: 'snare', name: 'Caixa' },
  { id: 'hat', name: 'Chimbal' },
  { id: 'open', name: 'Aberto' },
  { id: 'clap', name: 'Palma' }, // house, techno, electro: reforça ou substitui a caixa
  { id: 'tom', name: 'Tom' }, // electro, drum & bass e jungle: viradas e rolagens
  { id: 'rim', name: 'Rimshot' }, // estalo seco: ghost notes do jungle, techno, 808
  { id: 'ride', name: 'Prato' }, // prato de condução: jungle e drum & bass
];

// Frequências (Hz) dos seis osciladores quadrados do chimbal, as mesmas usadas no circuito
// do TR-808: não são harmônicas entre si, e é isso que dá o timbre metálico
const METAL_FREQS = [263, 400, 421, 474, 587, 845];

const NOISE_SECONDS = 1;

// O compressor atrasa o sinal em ~6 ms (lookahead). As vozes são agendadas esse tanto antes
// para a bateria ficar alinhada com o resto do patch (que não passa por ele).
const COMPRESSOR_DELAY = 0.006;

// Bateria: bumbo, caixa, chimbal fechado e chimbal aberto.
// Portas: `clock` (entrada, do sequenciador: dá o andamento) e `out` (áudio).
// Cada trilha tem 32 passos (dois compassos); a cada pulso do clock as trilhas ligadas naquele passo tocam,
// agendadas no instante exato do pulso (relógio do áudio). Play, parar e BPM são do
// sequenciador que está ligado ao clock.
//
// O kit de sons é escolhido com setKit(): gravações reais (TR-808, bateria acústica) ou as
// vozes sintetizadas abaixo, que também servem de reserva enquanto as gravações carregam.
//
// Vozes sintetizadas, geradas na hora:
//   bumbo   seno com queda rápida de afinação (230 → 60 → 48 Hz), clique de ataque e
//           saturação suave, que cria harmônicos: o grave é ouvido até em caixas pequenas
//   caixa   dois tons de triângulo (corpo) + ruído filtrado (a "esteira"), levemente saturados
//   chimbal seis quadrados inharmônicos filtrados (metálico); o aberto dura mais e o
//           fechado o corta
// Tudo passa por um compressor, que une os sons e dá peso à batida.
export class DrumMachine extends Module {
  static type = 'drums';
  #oscillators = []; // osciladores do banco metálico, sempre ligados
  #noise;
  #bus; // entrada do compressor: todas as vozes chegam aqui
  #kickDrive;
  #snareDrive;
  #metal; // saída do banco metálico dos chimbais (osciladores sempre ligados)
  #mute; // ganho zero: onde os osciladores-relógio de #metalHit são ligados
  #openChoke = null; // ganho do último chimbal aberto, para o fechado cortá-lo
  #queue = []; // { step, time } recebidos, para a interface acompanhar o passo atual
  #kits = new Map(); // id do kit → { kick: { buffer, gain }, ... } (só os de gravações já carregados)
  #kitRequest = 0; // descarta respostas de pedidos antigos de setKit

  constructor(ctx) {
    super(ctx);
    this.kit = 'synth'; // kit em uso; muda quando setKit() termina de carregar
    this.onKit = null; // callback(id) quando o kit em uso muda
    this.output = new Gain(ctx, 1);
    this.tracks = DRUM_TRACKS.map((t) => ({ ...t, steps: new Array(STEPS).fill(false), level: 80 }));
    this.#noise = this.#makeNoise();

    // vozes → bus → compressor → saída
    this.#bus = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 8;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    this.#bus.connect(compressor).connect(this.output.node);

    this.#kickDrive = this.#saturator(3);
    this.#snareDrive = this.#saturator(1.6);
    this.#kickDrive.connect(this.#bus);
    this.#snareDrive.connect(this.#bus);
    this.#metal = this.#makeMetal();
    this.#mute = ctx.createGain();
    this.#mute.gain.value = 0;
    this.#mute.connect(this.#bus);

    this.inputs.clock = new ClockIn((when, step) => this.#onTick(when, step));
    this.outputs.out = this.output.node;
    this.load(DRUM_PATTERNS[0]);
    this.setKit(DEFAULT_KIT); // as vozes sintetizadas tocam até as gravações carregarem
  }

  // Troca o kit de sons. Kits de gravações são baixados e decodificados na primeira vez.
  // Retorna false se o kit não existe ou não pôde ser carregado (o kit em uso não muda).
  async setKit(id) {
    const def = DRUM_KITS.find((k) => k.id === id);
    if (!def) return false;
    const request = ++this.#kitRequest;
    if (def.files && !this.#kits.has(id)) {
      try {
        this.#kits.set(id, await this.#loadKit(def));
      } catch (err) {
        console.warn(`Kit "${def.name}" não carregou:`, err);
        return false;
      }
    }
    if (request !== this.#kitRequest) return false; // outro pedido chegou depois
    this.kit = id;
    this.onKit?.(id);
    return true;
  }

  // Baixa e decodifica as gravações. Cada uma é normalizada para o mesmo pico (0,9) e recebe
  // o volume relativo do kit, para as trilhas ficarem equilibradas.
  async #loadKit(def) {
    const entries = await Promise.all(
      Object.entries(def.files).map(async ([track, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
        let peak = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
        }
        return [track, { buffer, gain: (0.9 / (peak || 1)) * (def.mix[track] ?? 1) }];
      }),
    );
    return Object.fromEntries(entries);
  }

  dispose() {
    for (const osc of this.#oscillators) osc.stop();
    this.#kitRequest++; // descarta um carregamento de kit em andamento
    this.output.node.disconnect();
  }

  // Carrega uma batida de drumPatterns.js (os arrays dos passos são trocados no lugar)
  load(pattern) {
    for (const track of this.tracks) {
      parseTrack(pattern[track.id] ?? '.'.repeat(16)).forEach((on, i) => { track.steps[i] = on; });
    }
  }

  // Passo que está soando agora (0–31), ou -1 se o clock está parado
  playheadStep() {
    const now = this.audibleTime(); // destaca o que se ouve, não o que está sendo processado
    while (this.#queue.length > 1 && this.#queue[1].time <= now) this.#queue.shift();
    const head = this.#queue[0];
    return head && head.time <= now && now - head.time < 1 ? head.step : -1;
  }

  // Toca uma trilha agora ou no instante `when`
  trigger(id, when = this.ctx.currentTime, level = 1) {
    const sample = this.#kits.get(this.kit)?.[id];
    if (sample) return this.#sample(id, sample, when, level);
    switch (id) {
      case 'kick': return this.#kick(when, level);
      case 'snare': return this.#snare(when, level);
      case 'hat': return this.#hat(when, level);
      case 'open': return this.#open(when, level);
      case 'clap': return this.#clap(when, level);
      case 'tom': return this.#tom(when, level);
      case 'rim': return this.#rim(when, level);
      case 'ride': return this.#ride(when, level);
      default: return undefined;
    }
  }

  #onTick(when, step) {
    this.#queue.push({ step, time: when });
    if (this.#queue.length > 64) this.#queue.splice(0, this.#queue.length - 64);
    const at = Math.max(when - COMPRESSOR_DELAY, this.ctx.currentTime);
    for (const track of this.tracks) {
      if (track.steps[step]) this.trigger(track.id, at, track.level / 100);
    }
  }

  // Toca uma gravação. O chimbal fechado corta o aberto, como nas vozes sintetizadas.
  #sample(id, { buffer, gain }, when, level) {
    if (id === 'hat') this.#openChoke?.gain.setTargetAtTime(0, when, 0.004);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const amp = this.ctx.createGain();
    amp.gain.value = level * gain;
    source.connect(amp).connect(this.#bus);
    source.start(when);
    if (id === 'open') this.#openChoke = amp;
  }

  #kick(when, level) {
    // corpo: seno que cai rápido até ~60 Hz e depois escorrega para 48 Hz
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(230, when);
    osc.frequency.exponentialRampToValueAtTime(60, when + 0.07);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.5);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(level, when);
    amp.gain.setTargetAtTime(0, when + 0.03, 0.13); // segura 30 ms e decai (τ = 130 ms)
    osc.connect(amp).connect(this.#kickDrive);
    osc.start(when);
    osc.stop(when + 1);

    // clique de ataque: ruído agudo bem curto
    const click = this.#noiseSource(when, 0.03);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const clickAmp = this.ctx.createGain();
    clickAmp.gain.setValueAtTime(level * 0.4, when);
    clickAmp.gain.setTargetAtTime(0, when, 0.004);
    click.connect(hp).connect(clickAmp).connect(this.#bus);
  }

  #snare(when, level) {
    // corpo: dois tons de triângulo com queda curta de afinação
    for (const [freq, gain, tau] of [[185, 0.6, 0.05], [330, 0.35, 0.035]]) {
      const tone = this.ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(freq * 1.3, when);
      tone.frequency.exponentialRampToValueAtTime(freq, when + 0.025);
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(level * gain, when);
      amp.gain.setTargetAtTime(0, when, tau);
      tone.connect(amp).connect(this.#snareDrive);
      tone.start(when);
      tone.stop(when + 0.4);
    }

    // esteira: ruído filtrado, mais longo que os tons
    const noise = this.#noiseSource(when, 0.4);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const body = this.ctx.createBiquadFilter(); // realça a região da "esteira"
    body.type = 'peaking';
    body.frequency.value = 3500;
    body.gain.value = 5;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(level * 0.75, when);
    amp.gain.setTargetAtTime(0, when, 0.055);
    noise.connect(hp).connect(body).connect(amp).connect(this.#snareDrive);
  }

  #hat(when, level) {
    this.#openChoke?.gain.setTargetAtTime(0, when, 0.004); // o fechado corta o aberto
    this.#metalHit(when, level, 0.018, 0.12);
  }

  #open(when, level) {
    this.#openChoke = this.#metalHit(when, level * 0.9, 0.11, 0.7);
  }

  // Palma: quatro rajadas curtas de ruído (as "mãos" quase juntas) e uma cauda mais longa
  #clap(when, level) {
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1300;
    band.Q.value = 1.1;
    band.connect(this.#snareDrive);
    [0, 0.011, 0.023, 0.036].forEach((offset, i) => {
      const last = i === 3;
      const burst = this.#noiseSource(when + offset, last ? 0.3 : 0.03);
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(level * (last ? 0.9 : 0.6), when + offset);
      amp.gain.setTargetAtTime(0, when + offset + (last ? 0 : 0.004), last ? 0.07 : 0.006);
      burst.connect(amp).connect(band);
    });
  }

  // Tom grave: seno que cai de afinação (como o bumbo, mas mais agudo e mais longo)
  #tom(when, level) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(190, when);
    osc.frequency.exponentialRampToValueAtTime(105, when + 0.12);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(level * 0.9, when);
    amp.gain.setTargetAtTime(0, when + 0.01, 0.11);
    osc.connect(amp).connect(this.#snareDrive);
    osc.start(when);
    osc.stop(when + 0.8);
    const click = this.#noiseSource(when, 0.02); // ataque da baqueta
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const clickAmp = this.ctx.createGain();
    clickAmp.gain.setValueAtTime(level * 0.2, when);
    clickAmp.gain.setTargetAtTime(0, when, 0.003);
    click.connect(hp).connect(clickAmp).connect(this.#bus);
  }

  // Rimshot (estilo 808): dois tons agudos muito curtos, somados a um estalo de ruído
  #rim(when, level) {
    for (const [freq, gain] of [[1700, 0.5], [500, 0.5]]) {
      const tone = this.ctx.createOscillator();
      tone.frequency.value = freq;
      const amp = this.ctx.createGain();
      amp.gain.setValueAtTime(level * gain, when);
      amp.gain.setTargetAtTime(0, when, 0.008);
      tone.connect(amp).connect(this.#bus);
      tone.start(when);
      tone.stop(when + 0.1);
    }
    const click = this.#noiseSource(when, 0.02);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const clickAmp = this.ctx.createGain();
    clickAmp.gain.setValueAtTime(level * 0.5, when);
    clickAmp.gain.setTargetAtTime(0, when, 0.004);
    click.connect(hp).connect(clickAmp).connect(this.#bus);
  }

  // Prato de condução: o banco metálico com decaimento longo, mais baixo que o chimbal
  #ride(when, level) {
    this.#metalHit(when, level * 0.45, 0.28, 1.6);
  }

  // Um golpe do banco metálico: ganho que decai com constante `tau`, desligado depois de
  // `lifetime` s. Retorna o ganho (o chimbal aberto o guarda para poder ser cortado).
  #metalHit(when, level, tau, lifetime) {
    const amp = this.ctx.createGain();
    amp.gain.value = 0; // o banco metálico está sempre ligado: sem isso vazaria antes de `when`
    amp.gain.setValueAtTime(level, when);
    amp.gain.setTargetAtTime(0, when + 0.002, tau);
    this.#metal.connect(amp).connect(this.#bus);
    // Sem desligar, a conexão ficaria para sempre e o nó nunca seria descartado. O fim é
    // marcado por um oscilador mudo, que avisa no relógio do áudio (e não no do JavaScript:
    // com o áudio suspenso, ou renderizando offline, os dois andam em ritmos diferentes).
    const timer = this.ctx.createOscillator();
    timer.connect(this.#mute);
    timer.onended = () => this.#metal.disconnect(amp);
    timer.start(when);
    timer.stop(when + lifetime);
    return amp;
  }

  // Seis quadrados inharmônicos → passa-faixa → passa-altas: o timbre metálico do chimbal.
  // Ficam sempre ligados; cada golpe só abre um ganho (#metalHit).
  #makeMetal() {
    const mix = this.ctx.createGain();
    mix.gain.value = 0.24;
    for (const f of METAL_FREQS) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      osc.connect(mix);
      osc.start();
      this.#oscillators.push(osc);
    }
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 9500;
    band.Q.value = 0.6;
    const high = this.ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 7000;
    return mix.connect(band).connect(high);
  }

  // Saturação suave (tanh normalizada): adiciona harmônicos sem estourar o nível
  #saturator(drive) {
    const shaper = this.ctx.createWaveShaper();
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    return shaper;
  }

  #noiseSource(when, seconds) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.#noise;
    src.loop = true;
    src.start(when);
    src.stop(when + seconds);
    return src;
  }

  #makeNoise() {
    const length = Math.round(this.ctx.sampleRate * NOISE_SECONDS);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  getState() {
    return {
      tracks: Object.fromEntries(this.tracks.map((t) => [t.id, { steps: [...t.steps], level: t.level }])),
      kit: this.kit,
    };
  }

  setState(s) {
    for (const track of this.tracks) {
      const saved = s.tracks?.[track.id];
      if (!saved) continue;
      if (saved.steps?.length === 16) saved.steps = fitBars(saved.steps); // cena de um compasso só
      saved.steps?.slice(0, STEPS).forEach((on, i) => { track.steps[i] = Boolean(on); });
      track.level = saved.level ?? track.level;
    }
    if (s.kit) this.setKit(s.kit);
  }
}
