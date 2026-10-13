import { NOTE_MAX, NOTE_MIN } from '../audio/modules/Sequencer.js';
import { PATTERNS } from '../audio/patterns.js';
import { createKnob } from './Knob.js';
import { createPresetSelect } from './PresetSelect.js';
import { createPanel } from './Panel.js';

const PX_PER_SEMITONE = 8; // arrastar na vertical muda a nota

const formatNote = (n) => (n > 0 ? `+${n}` : `${n}`);

// Painel do Sequenciador: play/stop, lista de ritmos, BPM, duração do gate e a grade de 32 passos (dois compassos).
// Cada passo tem um botão liga/desliga e uma nota (semitons em relação ao oscilador):
// arraste na vertical ou use a roda do mouse.
export function createSequencerPanel(seq) {
  const { element, body, row } = createPanel('Sequenciador', seq);

  const play = document.createElement('button');
  const renderPlay = () => { play.textContent = seq.playing ? '■ Parar' : '▶ Tocar'; };
  play.addEventListener('click', () => {
    if (seq.playing) seq.stop();
    else seq.play();
    renderPlay();
  });
  renderPlay();

  // Lista de ritmos prontos. "Personalizado" aparece quando o usuário edita um passo.
  const { select: presets, markCustom } = createPresetSelect(PATTERNS, PATTERNS[0].id, 'Ritmos prontos');

  if (seq.restored) markCustom();

  const gate = createKnob({
    min: 10, max: 100, value: seq.gateLength, step: 5, label: 'Gate', unit: '%',
    onChange: (v) => { seq.gateLength = v; },
  });
  row.append(gate.element);

  const grid = document.createElement('div');
  grid.className = 'steps';
  const renders = []; // um por passo, para redesenhar tudo quando um ritmo é carregado
  const columns = seq.steps.map((step, i) => {
    const col = document.createElement('div');
    col.className = 'step';

    const toggle = document.createElement('button');
    toggle.className = 'step-toggle';
    toggle.textContent = i + 1;
    toggle.addEventListener('click', () => {
      step.on = !step.on;
      markCustom();
      render();
    });

    const note = document.createElement('div');
    note.className = 'step-note';
    const setNote = (n) => {
      step.note = Math.min(NOTE_MAX, Math.max(NOTE_MIN, n));
      markCustom();
      render();
    };
    let drag = null;
    note.addEventListener('pointerdown', (e) => {
      note.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, n: step.note };
    });
    note.addEventListener('pointermove', (e) => {
      if (drag) setNote(drag.n + Math.round((drag.y - e.clientY) / PX_PER_SEMITONE));
    });
    for (const ev of ['pointerup', 'pointercancel']) note.addEventListener(ev, () => { drag = null; });
    note.addEventListener('wheel', (e) => {
      e.preventDefault();
      setNote(step.note + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });

    col.append(toggle, note);
    grid.appendChild(col);

    const render = () => {
      toggle.classList.toggle('on', step.on);
      note.textContent = formatNote(step.note);
      note.classList.toggle('muted', !step.on);
    };
    render();
    renders.push(render);
    return col;
  });

  presets.addEventListener('change', () => {
    const pattern = PATTERNS.find((p) => p.id === presets.value);
    if (!pattern) return;
    seq.load(pattern);
    for (const render of renders) render();
    gate.set(seq.gateLength);
  });

  const controls = document.createElement('div');
  controls.className = 'panel-buttons';
  controls.append(play, presets);
  body.prepend(controls);
  body.append(grid);

  // Destaca o passo que está soando (consulta o relógio do áudio a cada quadro)
  let lit = -1;
  (function follow() {
    const now = seq.playheadStep();
    if (now !== lit) {
      columns[lit]?.classList.remove('playing');
      columns[now]?.classList.add('playing');
      lit = now;
    }
    requestAnimationFrame(follow);
  })();

  return element;
}
