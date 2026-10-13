import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';

// Divisões do tempo para o eco sincronizado com o BPM (em tempos de semínima)
const SYNC_MODES = [
  { label: 'livre', beats: null },
  { label: '1/16', beats: 0.25 },
  { label: '1/8', beats: 0.5 },
  { label: '3/16', beats: 0.75 },
  { label: '1/4', beats: 1 },
];

// Painel de um Delay: tempo (livre ou sincronizado com o BPM), realimentação e mixagem.
// `getBpm()` informa o andamento atual do sequenciador.
export function createDelayPanel(delay, getBpm) {
  const { element, body, row } = createPanel('Delay', delay);

  const time = createKnob({
    min: 1, max: 1500, value: Math.round(delay.time), step: 10, label: 'Tempo', unit: 'ms',
    onChange: (ms) => {
      // mexer no knob à mão tira o delay da sincronia
      delay.sync = null;
      renderSync();
      delay.setTime(ms);
    },
  });
  delay.onTime = (ms) => time.set(ms, false); // o BPM mudou: só atualiza o número

  const sync = document.createElement('button');
  const renderSync = () => {
    const mode = SYNC_MODES.find((m) => m.beats === delay.sync) ?? SYNC_MODES[0];
    sync.textContent = `Sync BPM: ${mode.label}`;
  };
  sync.addEventListener('click', () => {
    const i = SYNC_MODES.findIndex((m) => m.beats === delay.sync);
    const next = SYNC_MODES[(i + 1) % SYNC_MODES.length];
    delay.setSync(next.beats, getBpm());
    renderSync();
  });
  renderSync();
  body.prepend(sync);

  row.append(
    time.element,
    createKnob({
      min: 0, max: 95, value: delay.feedback, step: 5, label: 'Feedback', unit: '%',
      onChange: (pct) => delay.setFeedback(pct),
    }).element,
    createKnob({
      min: 0, max: 100, value: delay.mix, step: 5, label: 'Mix', unit: '%',
      onChange: (pct) => delay.setMix(pct),
    }).element,
  );
  return element;
}
