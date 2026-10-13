import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';
import { createWaveformButtons } from './WaveformButtons.js';

// Painel de um Oscillator: forma de onda, frequência, amplitude, fase e profundidade de FM.
// `onChange` avisa a interface que algum valor mudou.
export function createOscillatorPanel(title, osc, onChange) {
  const { element, body, row } = createPanel(title, osc);

  body.prepend(createWaveformButtons(osc));

  row.append(
    createKnob({
      min: 0, max: 1000, value: osc.freq, step: 5, label: 'Frequência', unit: 'Hz',
      onChange: (hz) => { osc.setFreq(hz); onChange(); },
    }).element,
    createKnob({
      min: 0, max: 100, value: osc.amp, step: 5, label: 'Amplitude', unit: '%',
      onChange: (pct) => { osc.setAmp(pct); onChange(); },
    }).element,
    createKnob({
      min: 0, max: 360, value: osc.phase, step: 15, label: 'Fase', unit: '°',
      onChange: (deg) => { osc.setPhase(deg); onChange(); },
    }).element,
    createKnob({
      min: 0, max: 1000, value: osc.fmDepth, label: 'Depth FM', unit: 'Hz',
      onChange: (hz) => osc.setFmDepth(hz),
    }).element,
  );
  return element;
}
