// Sons de baixo prontos. Cada um é o estado completo do módulo Baixo (`Bass.setState`).
// `freq` é a nota base em Hz; `envAmount` quanto o envelope abre o filtro; decay/sustain dão o "pluck".
export const BASS_PRESETS = [
  { id: 'sub', name: 'Sub profundo', waveform: 'sine', freq: 41, sub: 70, cutoff: 400, q: 1, envAmount: 0, decay: 500, sustain: 80, drive: 10, level: 75 },
  { id: 'acid', name: 'Acid 303', waveform: 'sawtooth', freq: 55, sub: 0, cutoff: 300, q: 14, envAmount: 3500, decay: 180, sustain: 10, drive: 45, level: 65 },
  { id: 'reese', name: 'Reese (DnB)', waveform: 'sawtooth', freq: 41, sub: 50, cutoff: 500, q: 3, envAmount: 600, decay: 700, sustain: 85, drive: 55, level: 65 },
  { id: 'pluck', name: 'Pluck funk', waveform: 'square', freq: 55, sub: 30, cutoff: 200, q: 5, envAmount: 2800, decay: 140, sustain: 5, drive: 20, level: 70 },
  { id: 'moog', name: 'Moog clássico', waveform: 'sawtooth', freq: 55, sub: 40, cutoff: 350, q: 7, envAmount: 1800, decay: 300, sustain: 40, drive: 30, level: 70 },
  { id: 'wobble', name: 'Dubstep grave', waveform: 'sawtooth', freq: 36, sub: 60, cutoff: 250, q: 10, envAmount: 2200, decay: 600, sustain: 60, drive: 70, level: 60 },
  { id: 'house', name: 'House curto', waveform: 'triangle', freq: 55, sub: 40, cutoff: 500, q: 3, envAmount: 1200, decay: 110, sustain: 0, drive: 25, level: 75 },
  { id: 'fuzz', name: 'Fuzz sujo', waveform: 'square', freq: 55, sub: 20, cutoff: 900, q: 2, envAmount: 800, decay: 400, sustain: 60, drive: 95, level: 55 },
];
