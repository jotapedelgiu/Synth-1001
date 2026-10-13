import { DRUM_KITS } from '../audio/drumKits.js';
import { DRUM_PATTERNS } from '../audio/drumPatterns.js';
import { createKnob } from './Knob.js';
import { createPresetSelect } from './PresetSelect.js';
import { createPanel } from './Panel.js';

// Painel da Bateria: lista de batidas, nível de cada trilha e a grade de 32 passos por trilha
// (dois compassos, um embaixo do outro).
// O andamento é só do sequenciador: escolher uma batida não mexe no BPM.
export function createDrumPanel(drums) {
  const { element, body, row } = createPanel('Bateria', drums);

  // Seletor do kit de sons (gravações ou sintetizado)
  const kit = document.createElement('select');
  kit.className = 'presets';
  kit.title = 'Kit de sons';
  kit.append(...DRUM_KITS.map((k) => new Option(k.name, k.id)));
  kit.value = drums.kit;
  drums.onKit = (id) => { kit.value = id; }; // o kit padrão termina de carregar depois
  kit.addEventListener('change', async () => {
    const wanted = kit.value;
    kit.disabled = true;
    kit.title = 'Carregando…';
    const ok = await drums.setKit(wanted);
    kit.disabled = false;
    kit.title = ok ? 'Kit de sons' : 'Não foi possível carregar este kit';
    kit.value = drums.kit; // se falhou, volta ao kit em uso
  });
  const kitRow = document.createElement('div');
  kitRow.className = 'panel-buttons';
  const kitLabel = document.createElement('span');
  kitLabel.className = 'drum-label';
  kitLabel.textContent = 'Kit';
  kitRow.append(kitLabel, kit);

  const { select: presets, markCustom } = createPresetSelect(
    DRUM_PATTERNS, DRUM_PATTERNS[0].id, 'Batidas prontas',
  );

  if (drums.restored) markCustom();

  for (const track of drums.tracks) {
    row.appendChild(
      createKnob({
        min: 0, max: 100, value: track.level, step: 5, label: track.name, unit: '%',
        onChange: (v) => { track.level = v; },
      }).element,
    );
  }

  const grid = document.createElement('div');
  grid.className = 'drum-grid';
  const renders = [];
  const cells = drums.tracks.map((track) => {
    const line = document.createElement('div');
    line.className = 'drum-row';
    const label = document.createElement('span');
    label.className = 'drum-label';
    label.textContent = track.name;
    const bars = [0, 1].map(() => {
      const bar = document.createElement('div');
      bar.className = 'drum-bar';
      return bar;
    });
    const stack = document.createElement('div');
    stack.className = 'drum-bars';
    stack.append(...bars);
    line.append(label, stack);

    const buttons = track.steps.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'drum-step';
      if (i % 16 > 0 && i % 4 === 0) b.classList.add('group'); // separa os tempos do compasso
      b.addEventListener('click', () => {
        track.steps[i] = !track.steps[i];
        markCustom();
        render();
      });
      bars[Math.floor(i / 16)].appendChild(b);
      return b;
    });
    const render = () => buttons.forEach((b, i) => b.classList.toggle('on', track.steps[i]));
    render();
    renders.push(render);
    grid.appendChild(line);
    return buttons;
  });

  presets.addEventListener('change', () => {
    const pattern = DRUM_PATTERNS.find((p) => p.id === presets.value);
    if (!pattern) return;
    drums.load(pattern);
    for (const render of renders) render();
  });

  body.prepend(kitRow, presets);
  body.append(grid);

  // Destaca o passo que está tocando (consulta o relógio do áudio a cada quadro)
  let lit = -1;
  (function follow() {
    const now = drums.playheadStep();
    if (now !== lit) {
      for (const buttons of cells) {
        buttons[lit]?.classList.remove('playing');
        buttons[now]?.classList.add('playing');
      }
      lit = now;
    }
    requestAnimationFrame(follow);
  })();

  return element;
}
