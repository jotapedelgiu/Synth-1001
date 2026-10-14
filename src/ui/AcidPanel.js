import { ACID_PRESETS } from '../audio/acidPresets.js';
import { NOTE_MAX, NOTE_MIN } from '../audio/modules/Acid.js';
import { midiToName } from '../audio/modules/ChordOscillator.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';
import { createPresetSelect } from './PresetSelect.js';
import { createWaveformButtons } from './WaveformButtons.js';

// Painel do Synth acid: sons prontos, forma de onda, um botão para testar a nota e duas fileiras de knobs.
//   som:    nota base, accent, saturação e volume
//   filtro: corte, ressonância, quanto o envelope abre o filtro e decaimento
export function createAcidPanel(acid, onChange) {
  const { element, body, row } = createPanel('Synth acid', acid);
  const { params } = acid;

  const play = document.createElement('button');
  play.textContent = 'Tocar (segure)';
  play.addEventListener('pointerdown', (e) => {
    play.setPointerCapture(e.pointerId);
    acid.noteOn();
  });
  for (const ev of ['pointerup', 'pointercancel']) play.addEventListener(ev, () => acid.noteOff());
  const buttons = document.createElement('div');
  buttons.className = 'panel-buttons';
  buttons.appendChild(play);
  const waves = createWaveformButtons(acid);
  const { select: presets } = createPresetSelect(ACID_PRESETS, '', 'Sons de acid prontos');
  presets.value = ''; // começa em "Personalizado" até escolher um
  body.prepend(presets, waves, buttons);

  const knobs = {};
  const renderNote = () => knobs.note.set(params.note, false); // redesenha o visor da nota base
  acid.onKey = () => { renderNote(); onChange?.(); };
  const knob = (key, label, min, max, step, unit, set, format) => {
    knobs[key] = createKnob({
      min, max, value: params[key], step, label, unit, format,
      onChange: (v) => { set(v); onChange?.(); presets.value = ''; },
    });
    return knobs[key].element;
  };

  row.append(
    // com um acorde ligado na porta "tom", o knob escolhe só a oitava e o visor mostra a nota que soa
    knob('note', 'Nota base', NOTE_MIN, NOTE_MAX, 1, '', (v) => { acid.setNote(v); renderNote(); },
      () => `${midiToName(acid.baseNote)} ${acid.freq}Hz`),
    knob('accent', 'Accent', 0, 100, 5, '%', (v) => acid.setAccent(v)),
    knob('drive', 'Drive', 0, 100, 5, '%', (v) => acid.setDrive(v)),
    knob('level', 'Nível', 0, 100, 5, '%', (v) => acid.setLevel(v)),
  );

  const filterRow = document.createElement('div');
  filterRow.className = 'knob-row';
  filterRow.append(
    knob('cutoff', 'Corte', 60, 3000, 20, 'Hz', (v) => acid.setCutoff(v)),
    knob('q', 'Resson.', 0, 25, 1, '', (v) => acid.setQ(v)),
    knob('env', 'Env', 0, 100, 5, '%', (v) => acid.setEnv(v)),
    knob('decay', 'Decay', 30, 1500, 10, 'ms', (v) => acid.setDecay(v)),
  );
  body.appendChild(filterRow);

  presets.addEventListener('change', () => {
    const { id, name, ...state } = ACID_PRESETS.find((p) => p.id === presets.value);
    acid.setState(state);
    waves.refresh();
    for (const [key, k] of Object.entries(knobs)) k.set(params[key], false);
    onChange?.();
  });
  return element;
}
