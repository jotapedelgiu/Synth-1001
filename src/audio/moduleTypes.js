import { ChordOscillator } from './modules/ChordOscillator.js';
import { Delay } from './modules/Delay.js';
import { DrumMachine } from './modules/DrumMachine.js';
import { Envelope } from './modules/Envelope.js';
import { Filter } from './modules/Filter.js';
import { Gain } from './modules/Gain.js';
import { Microphone } from './modules/Microphone.js';
import { Mixer4 } from './modules/Mixer4.js';
import { Oscillator } from './modules/Oscillator.js';
import { FFT_SIZE, Scope } from './modules/Scope.js';
import { Phaser } from './modules/Phaser.js';
import { Sequencer } from './modules/Sequencer.js';
import { Speaker } from './modules/Speaker.js';

// Catálogo dos módulos que podem ser adicionados ao patch (menu do botão direito).
// `type` é o mesmo de `static type` da classe; `create(ctx, { tempo })` devolve uma instância nova.
export const MODULE_TYPES = [
  {
    type: Oscillator.type, label: 'Oscilador', title: 'Onda', group: 'Fontes',
    create: (ctx) => {
      const osc = new Oscillator(ctx, { freq: 220, amp: 60, realPhase: true });
      osc.start();
      return osc;
    },
  },
  { type: ChordOscillator.type, label: 'Acordes', group: 'Fontes', create: (ctx) => new ChordOscillator(ctx) },
  { type: Sequencer.type, label: 'Sequenciador', group: 'Fontes', create: (ctx, { tempo }) => new Sequencer(ctx, tempo) },
  { type: DrumMachine.type, label: 'Bateria', group: 'Fontes', create: (ctx) => new DrumMachine(ctx) },
  { type: Microphone.type, label: 'Microfone', group: 'Fontes', create: (ctx) => new Microphone(ctx) },

  { type: Filter.type, label: 'Filtro', group: 'Processadores', create: (ctx) => new Filter(ctx) },
  { type: Envelope.type, label: 'Envelope ADSR', group: 'Processadores', create: (ctx) => new Envelope(ctx) },
  { type: Delay.type, label: 'Delay', group: 'Processadores', create: (ctx, { tempo }) => new Delay(ctx, { tempo }) },
  { type: Phaser.type, label: 'Phaser', group: 'Processadores', create: (ctx) => new Phaser(ctx) },
  { type: Gain.type, label: 'Mixer', group: 'Processadores', create: (ctx) => new Gain(ctx) },
  { type: Mixer4.type, label: 'Mixer 4 canais', title: 'Mixer 4 canais', group: 'Processadores', create: (ctx) => new Mixer4(ctx) },

  { type: Speaker.type, label: 'Alto-falante', group: 'Saídas', create: (ctx) => new Speaker(ctx) },
  { type: Scope.type, label: 'Osciloscópio', group: 'Saídas', create: (ctx) => new Scope(ctx, FFT_SIZE) },
];

export { FFT_SIZE };
