import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';
import { createWaveformButtons } from './WaveformButtons.js';

// Painel do Baixo: forma de onda, um botão para testar a nota e duas fileiras de knobs.
//   som:    nota base, sub (uma oitava abaixo), saturação e volume
//   filtro: corte, ressonância, quanto o envelope abre o filtro, decaimento e sustain
export function createBassPanel(bass, onChange) {
  const { element, body, row } = createPanel('Baixo', bass);
  const { params } = bass;

  const play = document.createElement('button');
  const render = () => { play.textContent = 'Tocar (segure)'; };
  play.addEventListener('pointerdown', (e) => {
    play.setPointerCapture(e.pointerId);
    bass.noteOn();
  });
  for (const ev of ['pointerup', 'pointercancel']) play.addEventListener(ev, () => bass.noteOff());
  render();
  const buttons = document.createElement('div');
  buttons.className = 'panel-buttons';
  buttons.appendChild(play);
  body.prepend(createWaveformButtons(bass), buttons);

  const knob = (key, label, min, max, step, unit, set) =>
    createKnob({
      min, max, value: params[key], step, label, unit,
      onChange: (v) => { set(v); onChange?.(); },
    }).element;

  row.append(
    knob('freq', 'Nota base', 20, 200, 1, 'Hz', (v) => bass.setFreq(v)),
    knob('sub', 'Sub', 0, 100, 5, '%', (v) => bass.setSub(v)),
    knob('drive', 'Drive', 0, 100, 5, '%', (v) => bass.setDrive(v)),
    knob('level', 'Nível', 0, 100, 5, '%', (v) => bass.setLevel(v)),
  );

  const filterRow = document.createElement('div');
  filterRow.className = 'knob-row';
  filterRow.append(
    knob('cutoff', 'Corte', 40, 4000, 20, 'Hz', (v) => bass.setCutoff(v)),
    knob('q', 'Resson.', 0, 20, 1, '', (v) => bass.setQ(v)),
    knob('envAmount', 'Env', 0, 6000, 100, 'Hz', (v) => bass.setEnvAmount(v)),
    knob('decay', 'Decay', 30, 1000, 10, 'ms', (v) => bass.setDecay(v)),
    knob('sustain', 'Sustain', 0, 100, 5, '%', (v) => bass.setSustain(v)),
  );
  body.appendChild(filterRow);
  return element;
}
