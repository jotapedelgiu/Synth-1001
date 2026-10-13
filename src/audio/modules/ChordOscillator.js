import { Module } from '../Module.js';
import { coefficients } from '../waveforms.js';
import { Gain } from './Gain.js';

// Acordes disponíveis: `intervals` são semitons acima da nota raiz; `symbol` é o sufixo da cifra
export const CHORDS = [
  { id: 'maj', name: 'Maior', symbol: '', intervals: [0, 4, 7] },
  { id: 'min', name: 'Menor', symbol: 'm', intervals: [0, 3, 7] },
  { id: 'dim', name: 'Diminuto', symbol: 'dim', intervals: [0, 3, 6] },
  { id: 'aug', name: 'Aumentado', symbol: 'aug', intervals: [0, 4, 8] },
  { id: 'sus2', name: 'Suspenso 2', symbol: 'sus2', intervals: [0, 2, 7] },
  { id: 'sus4', name: 'Suspenso 4', symbol: 'sus4', intervals: [0, 5, 7] },
  { id: '6', name: 'Maior com sexta', symbol: '6', intervals: [0, 4, 7, 9] },
  { id: '7', name: 'Sétima (dominante)', symbol: '7', intervals: [0, 4, 7, 10] },
  { id: 'maj7', name: 'Sétima maior', symbol: 'maj7', intervals: [0, 4, 7, 11] },
  { id: 'm7', name: 'Menor com sétima', symbol: 'm7', intervals: [0, 3, 7, 10] },
  { id: 'm7b5', name: 'Meio-diminuto', symbol: 'm7♭5', intervals: [0, 3, 6, 10] },
  { id: 'power', name: 'Power chord (5ª)', symbol: '5', intervals: [0, 7, 12] },
  { id: 'octave', name: 'Oitava', symbol: '8', intervals: [0, 12] },
];

export const NOTE_MIN = 24; // C1
export const NOTE_MAX = 84; // C6
const VOICES = 4; // o maior acorde tem 4 notas
const LEVEL = 1.5; // soma das vozes ≈ LEVEL no total, qualquer que seja o número de notas

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiToName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

// Gerador de acordes: um grupo de osciladores afinados nos intervalos do acorde, somados na saída.
// Portas: `pitch` (transpõe o acorde inteiro; 1 unidade = 1 oitava, como no Oscilador) e `out`.
// Ligando o sequenciador em `pitch`, as notas dele viram uma progressão de acordes.
export class ChordOscillator extends Module {
  static type = 'chord';

  constructor(ctx, { note = 45, chord = 'min', inversion = 0, amp = 60, waveform = 'sine', unison = 0 } = {}) {
    super(ctx);
    this.note = note; // nota raiz, em número MIDI (45 = lá 2 = 110 Hz)
    this.chord = chord;
    this.inversion = inversion;
    this.amp = amp; // %
    this.waveform = waveform;
    this.unison = unison; // cents: cada nota ganha duas cópias desafinadas (um pad mais largo)
    // para o osciloscópio tratar este módulo como uma fonte qualquer
    this.realPhase = true;
    this.phase = 0;

    this.level = new Gain(ctx, amp / 100);
    this.pitch = new Gain(ctx, 1200); // 1 unidade de entrada = 1200 cents
    // cada voz (nota do acorde) tem 3 osciladores: o central e os dois desafinados
    this.voices = Array.from({ length: VOICES }, () => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.level.node);
      const oscs = [0, -1, 1].map((side) => {
        const osc = ctx.createOscillator();
        const mix = ctx.createGain();
        osc.connect(mix).connect(gain);
        this.pitch.connect(osc.detune);
        osc.start();
        return { osc, mix, side };
      });
      return { oscs, gain };
    });

    this.inputs.pitch = this.pitch.node;
    this.outputs.out = this.level.node;
    this.#applyWave();
    this.#applyNotes(false);
  }

  get chordDef() {
    return CHORDS.find((c) => c.id === this.chord);
  }

  // Semitons de cada nota acima da raiz, já com a inversão (as notas mais graves sobem uma oitava)
  get offsets() {
    const { intervals } = this.chordDef;
    const flipped = Math.min(this.inversion, intervals.length - 1);
    return intervals.map((s, i) => (i < flipped ? s + 12 : s));
  }

  // Números MIDI das notas que estão soando
  get notes() {
    return this.offsets.map((o) => this.note + o);
  }

  get rootHz() {
    return midiToHz(this.note);
  }

  // Frequência da nota mais grave (define a janela do osciloscópio)
  get freq() {
    return Math.round(midiToHz(Math.min(...this.notes)));
  }

  // Cifra, ex.: "Am", "G7", "Cmaj7"
  get symbol() {
    return `${NAMES[this.note % 12]}${this.chordDef.symbol}`;
  }

  setNote(midi) {
    this.note = midi;
    this.#applyNotes(true);
  }

  setChord(id) {
    this.chord = id;
    this.#applyNotes(true);
  }

  setInversion(n) {
    this.inversion = n;
    this.#applyNotes(true);
  }

  setAmp(pct) {
    this.amp = pct;
    this.level.set(pct / 100, 0.01);
  }

  setWaveform(name) {
    this.waveform = name;
    this.#applyWave();
  }

  setUnison(cents) {
    this.unison = cents;
    this.#applyNotes(true);
  }

  dispose() {
    for (const { oscs } of this.voices) {
      for (const { osc } of oscs) {
        try { osc.stop(); } catch { /* já parado */ }
      }
    }
  }

  // Afina as vozes: a frequência é a da raiz e o `detune` de cada voz leva até a nota dela
  #applyNotes(smooth) {
    const offsets = this.offsets;
    const now = this.ctx.currentTime;
    const share = LEVEL / offsets.length;
    const spread = Math.min(1, this.unison / 5); // as vozes de fora entram aos poucos
    this.voices.forEach(({ oscs, gain }, i) => {
      const on = i < offsets.length;
      if (smooth) gain.gain.setTargetAtTime(on ? share : 0, now, 0.01);
      else gain.gain.value = on ? share : 0;
      for (const { osc, mix, side } of oscs) {
        const level = side === 0 ? 1 - 0.4 * spread : 0.4 * spread;
        const cents = (on ? offsets[i] * 100 : 0) + side * this.unison;
        if (smooth) {
          osc.frequency.setTargetAtTime(this.rootHz, now, 0.01);
          osc.detune.setTargetAtTime(cents, now, 0.01);
          mix.gain.setTargetAtTime(level, now, 0.01);
        } else {
          osc.frequency.value = this.rootHz;
          osc.detune.value = cents;
          mix.gain.value = level;
        }
      }
    });
  }

  #applyWave() {
    const { real, imag } = coefficients(this.waveform, 0);
    const wave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    for (const { oscs } of this.voices) {
      for (const { osc } of oscs) osc.setPeriodicWave(wave);
    }
  }

  getState() {
    const { note, chord, inversion, amp, waveform, unison } = this;
    return { note, chord, inversion, amp, waveform, unison };
  }

  setState(s) {
    if (s.waveform) this.setWaveform(s.waveform);
    if (CHORDS.some((c) => c.id === s.chord)) this.chord = s.chord;
    this.inversion = s.inversion ?? this.inversion;
    this.unison = s.unison ?? this.unison;
    this.setNote(s.note ?? this.note); // reafina as vozes com o acorde e a inversão novos
    this.setAmp(s.amp ?? this.amp);
  }
}
