// Padrões de 16 passos (semicolcheias) para o sequenciador, inspirados em linhas clássicas
// de sintetizadores analógicos. São aproximações no estilo de cada um, não transcrições.
//
// `steps`: 16 posições separadas por espaço. "." = passo desligado; um número = passo ligado
// naquela nota, em semitons acima (ou abaixo, se negativo) da frequência do oscilador.
// `bpm` e `gate` (% do passo) são o andamento e a duração das notas sugeridos; null = não muda.
// `group` (opcional) agrupa o padrão na lista.
export const PATTERNS = [
  {
    id: 'default',
    name: 'Baixo pentatônico (padrão)',
    bpm: 120, gate: 50,
    steps: '0 . . 3 . . 0 . 7 . . 3 . 5 . 0',
  },
  {
    id: 'moog-octaves',
    name: 'Oitavas pulsantes (baixo Moog)',
    bpm: 110, gate: 45,
    steps: '0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12',
  },
  {
    id: 'moroder',
    name: 'Estilo Moroder (disco, 16avos)',
    bpm: 126, gate: 55,
    steps: '0 0 12 0 0 0 12 0 -2 -2 10 -2 -4 -4 8 -4',
  },
  {
    id: 'kraftwerk',
    name: 'Estilo Kraftwerk (arpejo menor)',
    bpm: 108, gate: 60,
    steps: '0 7 3 7 12 7 3 7 0 7 3 7 12 7 3 7',
  },
  {
    id: 'berlin',
    name: 'Estilo Tangerine Dream (ostinato)',
    bpm: 118, gate: 70,
    steps: '0 0 7 0 12 0 7 0 3 3 10 3 15 3 10 3',
  },
  {
    id: 'acid',
    name: 'Acid (estilo TB-303)',
    bpm: 128, gate: 40,
    steps: '0 . 0 12 . 0 3 . 5 . 0 0 12 . 3 5',
  },
  {
    id: 'funk',
    name: 'Baixo funk (estilo Minimoog)',
    bpm: 100, gate: 40,
    steps: '0 . . 0 . 0 3 . . 5 . 7 . 0 . 3',
  },
  {
    id: 'four-floor',
    name: 'Techno 4x4 (bumbo nos tempos)',
    bpm: 130, gate: 50,
    steps: '-12 . . . -12 . . . -12 . . . -12 . . .',
  },
  {
    id: 'offbeat',
    name: 'Contratempo (off-beat)',
    bpm: 126, gate: 35,
    steps: '. . 0 . . . 0 . . . 0 . . . 0 .',
  },
  {
    id: 'arp-up',
    name: 'Arpejo menor ↑',
    bpm: 120, gate: 70,
    steps: '0 3 7 12 0 3 7 12 0 3 7 12 0 3 7 12',
  },
  {
    id: 'arp-updown',
    name: 'Arpejo menor ↑↓',
    bpm: 120, gate: 70,
    steps: '0 3 7 12 15 12 7 3 0 3 7 12 15 12 7 3',
  },
  {
    id: 'penta-down',
    name: 'Pentatônica descendente',
    bpm: 112, gate: 60,
    steps: '12 10 7 5 3 0 . . 12 10 7 5 3 0 . .',
  },
  {
    id: 'techno-rolling', group: 'Techno',
    name: 'Techno: baixo rolante (16avos)',
    bpm: 132, gate: 40,
    steps: '. 0 0 0 . 0 0 -2 . 0 0 0 . 0 0 3',
  },
  {
    id: 'techno-minimal', group: 'Techno',
    name: 'Techno minimal: pulso curto',
    bpm: 125, gate: 30,
    steps: '. . 0 . . . 0 . . . 0 . . . 0 3',
  },
  {
    id: 'techno-detroit', group: 'Techno',
    name: 'Techno Detroit: arpejo',
    bpm: 126, gate: 60,
    steps: '0 . 7 . 12 . 7 . 3 . 10 . 15 . 10 .',
  },
  {
    id: 'techno-hard', group: 'Techno',
    name: 'Hard techno: martelo',
    bpm: 150, gate: 35,
    steps: '0 0 . 0 0 0 . 0 0 0 . 0 0 0 . 0',
  },
  {
    id: 'techno-dub', group: 'Techno',
    name: 'Dub techno: notas longas',
    bpm: 118, gate: 90,
    steps: '0 . . . . . . 3 . . . . 7 . . .',
  },
  {
    id: 'random',
    name: 'Aleatório (pentatônica menor)',
    bpm: null, gate: null,
    steps: randomSteps, // sorteado a cada vez que é escolhido
  },
  {
    id: 'empty',
    name: 'Vazio',
    bpm: null, gate: null,
    steps: '. . . . . . . . . . . . . . . .',
  },
];

const SCALE = [0, 3, 5, 7, 10, 12, 15]; // pentatônica menor, até a terça menor da oitava de cima

function randomSteps() {
  return Array.from({ length: 16 }, (_, i) => {
    const on = i === 0 || Math.random() < 0.6; // o primeiro passo sempre soa
    return on ? SCALE[Math.floor(Math.random() * SCALE.length)] : '.';
  }).join(' ');
}

// Converte o padrão em 16 passos { on, note }
export function resolveSteps(pattern) {
  const text = typeof pattern.steps === 'function' ? pattern.steps() : pattern.steps;
  const tokens = text.trim().split(/\s+/);
  if (tokens.length !== 16) throw new Error(`Padrão "${pattern.name}" não tem 16 passos`);
  return tokens.map((t) => (t === '.' ? { on: false, note: 0 } : { on: true, note: Number(t) }));
}
