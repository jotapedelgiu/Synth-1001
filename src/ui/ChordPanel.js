import { CHORDS, NOTE_MAX, NOTE_MIN, midiToHz, midiToName } from '../audio/modules/ChordOscillator.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';
import { createWaveformButtons } from './WaveformButtons.js';

// Painel do gerador de acordes: forma de onda, tipo de acorde, nota raiz, inversão e amplitude.
// `onChange` avisa a interface que algo que aparece no status mudou.
export function createChordPanel(chord, onChange) {
  const { element, body, row } = createPanel('Acordes', chord);

  const type = document.createElement('select');
  type.className = 'presets';
  type.title = 'Tipo de acorde';
  type.append(...CHORDS.map((c) => new Option(c.name, c.id)));
  type.value = chord.chord;

  // cifra e notas que estão soando
  const readout = document.createElement('div');
  readout.className = 'chord-readout';
  const renderReadout = () => {
    readout.replaceChildren();
    const symbol = document.createElement('strong');
    symbol.textContent = chord.symbol;
    const notes = document.createElement('span');
    notes.textContent = chord.notes.map(midiToName).join('  ');
    readout.append(symbol, notes);
  };
  renderReadout();

  const changed = () => { renderReadout(); onChange?.(); };
  type.addEventListener('change', () => { chord.setChord(type.value); changed(); });

  body.prepend(createWaveformButtons(chord), type, readout);

  row.append(
    createKnob({
      min: NOTE_MIN, max: NOTE_MAX, value: chord.note, step: 1, label: 'Nota raiz',
      format: (m) => `${midiToName(m)} ${Math.round(midiToHz(m))}Hz`,
      onChange: (m) => { chord.setNote(m); changed(); },
    }).element,
    createKnob({
      min: 0, max: 3, value: chord.inversion, step: 1, label: 'Inversão',
      format: (n) => (n === 0 ? 'raiz' : `${n}ª inv.`),
      onChange: (n) => { chord.setInversion(n); changed(); },
    }).element,
    createKnob({
      min: 0, max: 100, value: chord.amp, step: 5, label: 'Amplitude', unit: '%',
      onChange: (pct) => chord.setAmp(pct),
    }).element,
  );
  return element;
}
