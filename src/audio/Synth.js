import { MODULE_TYPES } from './moduleTypes.js';
import { Patch } from './Patch.js';
import { Tempo } from './Tempo.js';
import { Acid } from './modules/Acid.js';
import { Bass } from './modules/Bass.js';
import { ChordOscillator } from './modules/ChordOscillator.js';
import { Mixer4 } from './modules/Mixer4.js';
import { Oscillator } from './modules/Oscillator.js';
import { Sequencer } from './modules/Sequencer.js';
import { Speaker } from './modules/Speaker.js';
import { Microphone } from './modules/Microphone.js';
import { FFT_SIZE, Scope } from './modules/Scope.js';

export { FFT_SIZE };
const MIC_HYSTERESIS = 0.01;

// Cria o patch inicial, que é um ponto de partida limpo: um sequenciador solto e um mixer
// ligado à saída de áudio.
//
//   sequencer          mixer ─ speaker
//
// Depois disso, quem manda é o Patch: os cabos podem ser refeitos pela interface e módulos
// podem ser adicionados (add) e removidos (remove).
export class Synth {
  #fed = new Map(); // id do osciloscópio → o que o alimenta (cache, refeito quando os cabos mudam)
  #counts = new Map(); // tipo → quantos módulos já foram numerados (para os títulos)

  constructor(ctx) {
    this.ctx = ctx;
    this.tempo = new Tempo(); // BPM compartilhado
    this.patch = new Patch();
    const add = (id, module) => this.patch.add(id, module);

    this.sequencer = add('seq', new Sequencer(ctx, this.tempo));
    this.mixer = add('mixer', new Mixer4(ctx));
    this.speaker = add('speaker', new Speaker(ctx));

    this.patch.connect('mixer', 'out', 'speaker', 'in');

    // Os cabos mudam raramente; o que alimenta o osciloscópio é recalculado só quando mudam
    this.patch.onChange(() => this.#fed.clear());
  }

  // Cria um módulo novo do tipo dado, já registrado no patch. Retorna { module, title }.
  // `id` fixa o identificador (usado ao carregar uma cena salva); sem ele, um id livre é escolhido.
  add(type, id = this.patch.uniqueId(type)) {
    const def = MODULE_TYPES.find((t) => t.type === type);
    if (!def) throw new Error(`Tipo de módulo desconhecido: ${type}`);
    const module = def.create(this.ctx, { tempo: this.tempo });
    this.patch.add(id, module);
    return { module, title: this.#title(def) };
  }

  remove(id) {
    this.patch.remove(id);
  }

  // "Filtro 2", "Onda 3"... numerados a partir dos que já existem, sem repetir depois de remoções
  #title(def) {
    if (!this.#counts.has(def.type)) {
      this.#counts.set(def.type, this.patch.modules.filter((m) => m.moduleType === def.type).length - 1);
    }
    const n = this.#counts.get(def.type) + 1;
    this.#counts.set(def.type, n);
    return `${def.title ?? def.label} ${n}`;
  }

  // Osciladores e microfones que alimentam o osciloscópio `scopeId`
  #fedBy(scopeId) {
    if (!this.#fed.has(scopeId)) {
      const upstream = this.patch.upstream(scopeId);
      this.#fed.set(scopeId, {
        // fontes de sinal com `freq` e `amp`: osciladores, geradores de acordes, baixos e synths acid
        oscillators: upstream.filter((m) => m instanceof Oscillator || m instanceof ChordOscillator || m instanceof Bass || m instanceof Acid),
        hasMic: upstream.some((m) => m instanceof Microphone),
      });
    }
    return this.#fed.get(scopeId);
  }

  // O que o Trigger precisa saber sobre o sinal que chega ao osciloscópio `scopeId`
  triggerSettings(scopeId) {
    const { oscillators, hasMic } = this.#fedBy(scopeId);
    const base = { sampleRate: this.ctx.sampleRate, baseFreq: 0, hysteresis: 0, shift: null };
    if (hasMic) return { ...base, hysteresis: MIC_HYSTERESIS };

    // Menor frequência audível define a janela
    for (const { amp, freq } of oscillators) {
      if (amp > 0 && freq > 0 && (base.baseFreq === 0 || freq < base.baseFreq)) base.baseFreq = freq;
    }
    // Oscilador de referência (fase "falsa"): a fase dele desloca a janela
    const ref = oscillators.find((o) => !o.realPhase && o.freq > 0 && o.phase > 0);
    if (ref) base.shift = { freq: ref.freq, phase: ref.phase };
    return base;
  }

  // Resumo do que aparece no primeiro osciloscópio do patch
  statusText() {
    const scope = this.patch.modules.find((m) => m instanceof Scope);
    if (!scope) return 'Sem osciloscópio';
    const { oscillators, hasMic } = this.#fedBy(scope.id);
    if (hasMic) return 'Microfone no osciloscópio';
    const audible = oscillators.filter((o) => o.amp > 0);
    return audible.length
      ? 'Osciloscópio: ' + audible.map((o) => `${o.freq} Hz`).join(' + ')
      : 'Sem sinal no osciloscópio';
  }
}
