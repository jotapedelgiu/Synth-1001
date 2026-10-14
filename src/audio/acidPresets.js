// Sons prontos do Synth acid. Cada um é o estado completo do módulo (`Acid.setState`).
// `note` é a nota base (MIDI); `env` quanto o envelope abre o filtro; `q` a ressonância (o "squelch").
export const ACID_PRESETS = [
  { id: 'classic', name: 'Acid clássico (serra)', waveform: 'sawtooth', note: 45, cutoff: 300, q: 14, env: 60, decay: 200, accent: 60, drive: 35, level: 60 },
  { id: 'bubble', name: 'Bolha (melodia)', waveform: 'sawtooth', note: 57, cutoff: 220, q: 18, env: 70, decay: 120, accent: 70, drive: 20, level: 60 },
  { id: 'hollow', name: 'Quadrada oca', waveform: 'square', note: 57, cutoff: 260, q: 15, env: 55, decay: 180, accent: 60, drive: 25, level: 55 },
  { id: 'squelch', name: 'Squelch agressivo', waveform: 'sawtooth', note: 45, cutoff: 180, q: 20, env: 85, decay: 260, accent: 90, drive: 70, level: 50 },
  { id: 'rubber', name: 'Borracha (decay longo)', waveform: 'square', note: 45, cutoff: 150, q: 16, env: 65, decay: 600, accent: 50, drive: 40, level: 55 },
  { id: 'soft', name: 'Suave (pouca ressonância)', waveform: 'sawtooth', note: 57, cutoff: 600, q: 6, env: 35, decay: 300, accent: 40, drive: 10, level: 65 },
  { id: 'lead', name: 'Lead agudo', waveform: 'pulse', note: 69, cutoff: 400, q: 12, env: 50, decay: 150, accent: 60, drive: 30, level: 55 },
];
