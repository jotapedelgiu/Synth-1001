// Kits de sons da bateria. O kit "synth" usa as vozes sintetizadas do próprio DrumMachine;
// os demais tocam gravações (arquivos em public/samples/<kit>/, com os créditos e licenças
// em public/samples/LICENSES.md).
const BASE = import.meta.env?.BASE_URL ?? '/';

const BASIC = ['kick', 'snare', 'hat', 'open'];
const FULL = [...BASIC, 'clap', 'tom', 'rim', 'ride'];

// Trilhas que o kit não tem gravadas tocam na voz sintetizada
const files = (dir, ids = BASIC) =>
  Object.fromEntries(ids.map((id) => [id, `${BASE}samples/${dir}/${id}.wav`]));

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
  {
    id: 'tr909',
    name: 'Roland TR-909 (techno, house)',
    files: files('tr909', FULL),
    mix: { kick: 1, snare: 0.9, hat: 0.55, open: 0.55, clap: 0.85, tom: 0.9, rim: 0.7, ride: 0.5 },
  },
  {
    id: 'tr707',
    name: 'Roland TR-707 (house, italo)',
    files: files('tr707', FULL.filter((id) => id !== 'ride')),
    mix: { kick: 1, snare: 0.85, hat: 0.55, open: 0.55, clap: 0.85, tom: 0.9, rim: 0.7 },
  },
  {
    id: 'linndrum',
    name: 'LinnDrum (synth-pop, electro)',
    files: files('linndrum', FULL),
    mix: { kick: 1, snare: 0.9, hat: 0.55, open: 0.55, clap: 0.8, tom: 0.9, rim: 0.7, ride: 0.5 },
  },
  {
    id: 'dmx',
    name: 'Oberheim DMX (electro, hip-hop)',
    files: files('dmx', FULL),
    mix: { kick: 1, snare: 0.9, hat: 0.55, open: 0.55, clap: 0.8, tom: 0.9, rim: 0.7, ride: 0.5 },
  },
  {
    id: 'mpc60',
    name: 'Akai MPC60 (hip-hop, jungle)',
    files: files('mpc60', FULL),
    mix: { kick: 1, snare: 0.9, hat: 0.55, open: 0.55, clap: 0.8, tom: 0.9, rim: 0.7, ride: 0.5 },
  },
];

export const DEFAULT_KIT = 'tr808';
