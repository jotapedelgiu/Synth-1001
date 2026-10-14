import { BASS_PRESETS } from '../audio/bassPresets.js';
import { midiToName } from '../audio/modules/ChordOscillator.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';
import { createPresetSelect } from './PresetSelect.js';
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
  const waves = createWaveformButtons(bass);
  const { select: presets } = createPresetSelect(BASS_PRESETS, '', 'Sons de baixo prontos');
  presets.value = ''; // começa em "Personalizado" até escolher um
  body.prepend(presets, waves, buttons);

  const knobs = {};
  const renderFreq = () => knobs.freq.set(params.freq, false); // redesenha o visor da nota base
  bass.onKey = () => { renderFreq(); onChange?.(); };
  const knob = (key, label, min, max, step, unit, set, format) => {
    knobs[key] = createKnob({
      min, max, value: params[key], step, label, unit, format,
      onChange: (v) => { set(v); onChange?.(); presets.value = ''; },
    });
    return knobs[key].element;
  };

  row.append(
    // com um acorde ligado na porta "tom", o knob escolhe só a oitava e o visor mostra a nota que soa
    knob('freq', 'Nota base', 20, 200, 1, 'Hz', (v) => { bass.setFreq(v); renderFreq(); },
      (v) => (bass.key == null ? `${v} Hz` : `${midiToName(bass.key).replace(/-?\d+$/, '')} ${bass.freq} Hz`)),
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

  presets.addEventListener('change', () => {
    const { id, name, ...state } = BASS_PRESETS.find((p) => p.id === presets.value);
    bass.setState(state);
    waves.refresh();
    for (const [key, k] of Object.entries(knobs)) k.set(params[key], false);
    onChange?.();
  });
  return element;
}
