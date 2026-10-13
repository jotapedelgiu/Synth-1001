import { FILTER_TYPES } from '../audio/modules/Filter.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';

const TYPE_LABELS = { lowpass: 'Passa-baixas', highpass: 'Passa-altas', bandpass: 'Passa-faixa' };
const MIN_HZ = 20;
const MAX_HZ = 10000;

// O ouvido percebe frequência em escala logarítmica: o knob (0–1000) percorre 20 Hz–10 kHz em log
const knobToHz = (v) => Math.round(MIN_HZ * (MAX_HZ / MIN_HZ) ** (v / 1000));
const hzToKnob = (hz) => Math.round((1000 * Math.log(hz / MIN_HZ)) / Math.log(MAX_HZ / MIN_HZ));
const formatHz = (hz) => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`);

// Ressonância: knob 0–100 → Q de 0,5 a 15
const knobToQ = (v) => 0.5 + (v / 100) * 14.5;
const qToKnob = (q) => Math.round(((q - 0.5) / 14.5) * 100);

export function createFilterPanel(filter) {
  const { element, body, row } = createPanel('Filtro', filter);

  const type = document.createElement('button');
  const renderType = () => { type.textContent = `Tipo: ${TYPE_LABELS[filter.type]}`; };
  type.addEventListener('click', () => {
    filter.setType(FILTER_TYPES[(FILTER_TYPES.indexOf(filter.type) + 1) % FILTER_TYPES.length]);
    renderType();
  });
  renderType();
  body.prepend(type);

  row.append(
    createKnob({
      min: 0, max: 1000, value: hzToKnob(filter.cutoff), step: 25, label: 'Corte',
      format: (v) => formatHz(knobToHz(v)),
      onChange: (v) => filter.setCutoff(knobToHz(v)),
    }).element,
    createKnob({
      min: 0, max: 100, value: qToKnob(filter.q), step: 5, label: 'Ressonância',
      format: (v) => knobToQ(v).toFixed(1),
      onChange: (v) => filter.setQ(knobToQ(v)),
    }).element,
    createKnob({
      min: 0, max: 5000, value: filter.cvDepth, step: 100, label: 'Depth corte', unit: 'Hz',
      onChange: (hz) => filter.setCvDepth(hz),
    }).element,
  );
  return element;
}
