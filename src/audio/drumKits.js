// Kits de sons da bateria. O kit "synth" usa as vozes sintetizadas do próprio DrumMachine;
// os demais tocam gravações (arquivos em public/samples/<kit>/, com os créditos e licenças
// em public/samples/LICENSES.md).
const BASE = import.meta.env?.BASE_URL ?? '/';

const files = (dir) =>
  Object.fromEntries(['kick', 'snare', 'hat', 'open'].map((id) => [id, `${BASE}samples/${dir}/${id}.wav`]));

// `mix`: volume relativo de cada trilha (cada gravação é normalizada para o mesmo pico antes)
export const DRUM_KITS = [
  { id: 'synth', name: 'Sintetizada' },
  {
    id: 'tr808',
    name: 'Roland TR-808 (gravação real)',
    files: files('tr808'),
    mix: { kick: 1, snare: 0.85, hat: 0.55, open: 0.55 },
  },
  {
    id: 'rock',
    name: 'Rock acústica (Hydrogen GMRockKit)',
    files: files('rock'),
    mix: { kick: 1, snare: 0.9, hat: 0.55, open: 0.55 },
  },
];

export const DEFAULT_KIT = 'tr808';
