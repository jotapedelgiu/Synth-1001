import { STEPS, fitBars } from './steps.js';

// Padrões de 16 ou 32 passos (semicolcheias) para o sequenciador, inspirados em linhas clássicas
// de sintetizadores analógicos. São aproximações no estilo de cada um, não transcrições.
//
// `steps`: 16 posições (um compasso, repetido) ou 32 (dois compassos), separadas por espaço. "." = passo desligado; um número = passo ligado
// naquela nota, em semitons acima (ou abaixo, se negativo) da frequência do oscilador.
// Um passo ligado pode levar marcas: "~" = slide (a nota escorrega até a próxima, sem soltar)
// e "!" = accent (mais forte). Ex.: "0! . 0~ 12".
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
  // Com slide (~) e accent (!): feitos para o Synth acid (ligue também a saída "accent")
  {
    id: 'acid-bubble', group: 'Acid',
    name: 'Acid: bolhas (slide e accent)',
    bpm: 126, gate: 50,
    steps: '0! 0 12~ 0 . 0~ 3! . 0 12! 0~ 7 . 0 3~ 5!',
  },
  {
    id: 'acid-squelch', group: 'Acid',
    name: 'Acid: squelch em oitavas',
    bpm: 130, gate: 45,
    steps: '0! 12~ 0 0 12! . 0~ 12 0! 0 15~ 12 . 0 10~ 12!',
  },
  {
    id: 'acid-melody', group: 'Acid',
    name: 'Acid: melodia em dois compassos',
    bpm: 124, gate: 55,
    steps: '0! . 7~ 12 . 10~ 7! . 3 . 5~ 7 . 0! 3~ 5  0! . 7~ 12 . 15~ 12! . 10 . 7~ 5 . 3! 5~ 0',
  },
  {
    id: 'acid-chicago', group: 'Acid',
    name: 'Acid: Chicago (Acid Tracks)',
    bpm: 120, gate: 50,
    steps: '0! . 0 12~ . 0 0! . 3~ 0 . 0! 12 . 0~ 7',
  },
  {
    id: 'acid-rolling', group: 'Acid',
    name: 'Acid: rolante (16avos)',
    bpm: 132, gate: 40,
    steps: '0! 0 0 0~ 12 0 0! 0 0 0~ 7 0! 0 0 3~ 0',
  },
  {
    id: 'acid-offbeat', group: 'Acid',
    name: 'Acid: contratempo com slides',
    bpm: 126, gate: 45,
    steps: '. . 0! . . 12~ . . . . 0! . . 7~ 5 .',
  },
  {
    id: 'acid-sparse', group: 'Acid',
    name: 'Acid: esparso e hipnótico',
    bpm: 122, gate: 60,
    steps: '0! . . . 0~ . . 12 . . 0! . . . 3~ .',
  },
  {
    id: 'acid-jump', group: 'Acid',
    name: 'Acid: saltos de oitava',
    bpm: 128, gate: 40,
    steps: '0! 12 0 12~ 0! 12 0 24~ 0! 12 0 12~ 0! 12~ 24! 12',
  },
  {
    id: 'acid-minor', group: 'Acid',
    name: 'Acid: escala menor (dois compassos)',
    bpm: 125, gate: 50,
    steps: '0! . 3 0~ 7 . 0! 10~ . 7 5~ 3 . 0 5! .  0! . 3 0~ 7 . 12! 10~ . 15~ 12 10 . 7 5! 3~',
  },
  {
    id: 'acid-fast', group: 'Acid',
    name: 'Acid: acelerado (hard acid)',
    bpm: 145, gate: 35,
    steps: '0! 0 12 0 0! 0~ 12 0 0! 0 15~ 0 0! 12 10~ 7',
  },
  {
    id: 'acid-tension', group: 'Acid',
    name: 'Acid: tensão (dois compassos)',
    bpm: 130, gate: 45,
    steps: '0! 0 0 . 0~ 0 1! 0 0 . 0! 0 0 1~ 0 .  0! 0 0 . 0~ 0 6! 0 0 . 7! 0 0 6~ 1 0',
  },
  // Linhas de baixo, para o módulo Baixo (a nota 0 é a nota base dele)
  {
    id: 'bass-house-offbeat', group: 'Linhas de baixo',
    name: 'House: baixo no contratempo',
    bpm: 124, gate: 45,
    steps: '. . 0 . . . 0 . . . 0 . . . 3 .',
  },
  {
    id: 'bass-house-rolling', group: 'Linhas de baixo',
    name: 'House: rolante (16avos)',
    bpm: 124, gate: 40,
    steps: '. 0 0 . . 0 0 -2 . 0 0 . . 0 3 5',
  },
  {
    id: 'bass-deep', group: 'Linhas de baixo',
    name: 'Deep house: notas longas',
    bpm: 120, gate: 80,
    steps: '0 . . . . . 0 . 3 . . . . . 5 .',
  },
  {
    id: 'bass-disco', group: 'Linhas de baixo',
    name: 'Disco: oitavas saltitantes',
    bpm: 118, gate: 55,
    steps: '0 . 12 . 0 . 12 . 5 . 17 . 7 . 19 .',
  },
  {
    id: 'bass-funk-slap', group: 'Linhas de baixo',
    name: 'Funk: sincopado',
    bpm: 98, gate: 35,
    steps: '0 . . 0 . . 12 . 0 . 3 . . 5 . 7',
  },
  {
    id: 'bass-garage', group: 'Linhas de baixo',
    name: 'UK garage: sub deslocado',
    bpm: 130, gate: 60,
    steps: '0 . . . . . 0 . . . 3 . . . . 0',
  },
  {
    id: 'bass-reggae', group: 'Linhas de baixo',
    name: 'Dub / reggae: baixo pesado',
    bpm: 76, gate: 85,
    steps: '0 . . . . . 0 . . . 3 . 5 . . .',
  },
  {
    id: 'bass-walking', group: 'Linhas de baixo',
    name: 'Walking bass (dois compassos)',
    bpm: 110, gate: 70,
    steps: '0 . 4 . 7 . 9 . 12 . 9 . 7 . 4 .  5 . 9 . 12 . 14 . 12 . 9 . 7 . 4 .',
  },
  {
    id: 'bass-driving', group: 'Linhas de baixo',
    name: 'Rock: colcheias constantes',
    bpm: 128, gate: 60,
    steps: '0 . 0 . 0 . 0 . 3 . 3 . 5 . 5 .',
  },
  {
    id: 'bass-progression', group: 'Linhas de baixo',
    name: 'Progressão i – VI – III – VII (dois compassos)',
    bpm: 122, gate: 50,
    steps: '0 . 0 . . 0 . 0 -4 . -4 . . -4 . -4  3 . 3 . . 3 . 3 -2 . -2 . . -2 . -2',
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
  // Dois compassos: o segundo responde ao primeiro, então a frase só se repete a cada 32 passos
  {
    id: 'bass-call-response', group: 'Dois compassos',
    name: 'Baixo: pergunta e resposta',
    bpm: 120, gate: 50,
    steps: '0 . . 3 . . 0 . 7 . . 3 . 5 . 0  0 . . 3 . . 0 . 7 . . 10 . 12 . 7',
  },
  {
    id: 'acid-2bar', group: 'Dois compassos',
    name: 'Acid em dois compassos',
    bpm: 128, gate: 40,
    steps: '0 . 0 12 . 0 3 . 5 . 0 0 12 . 3 5  0 . 0 12 . 0 3 . 5 . 7 7 12 . 10 .',
  },
  {
    id: 'arp-chord-change', group: 'Dois compassos',
    name: 'Arpejo que muda de acorde',
    bpm: 120, gate: 70,
    steps: '0 3 7 12 0 3 7 12 0 3 7 12 0 3 7 12  -4 0 3 8 -4 0 3 8 -4 0 3 8 -4 0 3 8',
  },
  {
    id: 'techno-rolling-2bar', group: 'Dois compassos',
    name: 'Techno rolante com virada',
    bpm: 132, gate: 40,
    steps: '. 0 0 0 . 0 0 -2 . 0 0 0 . 0 0 3  . 0 0 0 . 0 0 -2 . 0 0 3 . 5 3 0',
  },
  {
    id: 'moroder-2bar', group: 'Dois compassos',
    name: 'Moroder com variação',
    bpm: 126, gate: 55,
    steps: '0 0 12 0 0 0 12 0 -2 -2 10 -2 -4 -4 8 -4  0 0 12 0 0 0 12 0 -2 -2 10 -2 -4 -2 0 7',
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
  return Array.from({ length: STEPS }, (_, i) => {
    const on = i === 0 || Math.random() < 0.6; // o primeiro passo sempre soa
    return on ? SCALE[Math.floor(Math.random() * SCALE.length)] : '.';
  }).join(' ');
}

// Converte o padrão em 32 passos { on, note, slide, accent }
export function resolveSteps(pattern) {
  const text = typeof pattern.steps === 'function' ? pattern.steps() : pattern.steps;
  const tokens = text.trim().split(/\s+/);
  return fitBars(tokens, `Padrão "${pattern.name}"`).map((t) => {
    if (t === '.') return { on: false, note: 0, slide: false, accent: false };
    return { on: true, note: parseInt(t, 10), slide: t.includes('~'), accent: t.includes('!') };
  });
}
