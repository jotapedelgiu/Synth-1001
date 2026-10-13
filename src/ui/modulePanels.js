import { createChordPanel } from './ChordPanel.js';
import { createDelayPanel } from './DelayPanel.js';
import { createDrumPanel } from './DrumPanel.js';
import { createEnvelopePanel } from './EnvelopePanel.js';
import { createFilterPanel } from './FilterPanel.js';
import { createMixer4Panel } from './Mixer4Panel.js';
import { createOscillatorPanel } from './OscillatorPanel.js';
import { createPhaserPanel } from './PhaserPanel.js';
import { createSequencerPanel } from './SequencerPanel.js';
import {
  createMicrophonePanel,
  createMixerPanel,
  createScopePanel,
  createSpeakerPanel,
} from './UtilityPanels.js';

// Cria o painel de um módulo conforme o tipo dele. Retorna { element, screen? }: `screen` só
// existe no osciloscópio (o elemento onde o ScopeView desenha).
//   title    (opcional) troca o título padrão do painel
//   refresh  avisa que algo que aparece no status mudou
//   tempo    o BPM compartilhado
export function createModulePanel(module, { title, refresh, tempo }) {
  let panel;
  switch (module.moduleType) {
    case 'oscillator': panel = createOscillatorPanel('Onda', module, refresh); break;
    case 'chord': panel = createChordPanel(module, refresh); break;
    case 'filter': panel = createFilterPanel(module); break;
    case 'envelope': panel = createEnvelopePanel(module); break;
    case 'delay': panel = createDelayPanel(module, () => tempo.bpm); break;
    case 'phaser': panel = createPhaserPanel(module); break;
    case 'mixer': panel = createMixerPanel(module); break;
    case 'mixer4': panel = createMixer4Panel(module); break;
    case 'speaker': panel = createSpeakerPanel(module); break;
    case 'microphone': panel = createMicrophonePanel(module); break;
    case 'sequencer': panel = createSequencerPanel(module); break;
    case 'drums': panel = createDrumPanel(module); break;
    case 'scope': panel = createScopePanel(module); break;
    default: throw new Error(`Sem painel para o tipo "${module.moduleType}"`);
  }
  const result = panel instanceof HTMLElement ? { element: panel } : panel;
  if (title) result.element.querySelector('.panel-title-text').textContent = title;
  return result;
}
