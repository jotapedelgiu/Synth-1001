import { STAGE_OPTIONS } from '../audio/modules/Phaser.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';

// Painel de um Phaser: nº de estágios, velocidade do LFO, profundidade, frequência central,
// realimentação e mixagem.
export function createPhaserPanel(phaser) {
  const { element, body, row } = createPanel('Phaser', phaser);

  const stages = document.createElement('button');
  const renderStages = () => { stages.textContent = `Estágios: ${phaser.stages}`; };
  stages.addEventListener('click', () => {
    const i = STAGE_OPTIONS.indexOf(phaser.stages);
    phaser.setStages(STAGE_OPTIONS[(i + 1) % STAGE_OPTIONS.length]);
    renderStages();
  });
  renderStages();
  body.prepend(stages);

  const knob = (opts) => createKnob(opts).element;
  row.append(
    knob({
      min: 1, max: 100, value: Math.round(phaser.rate * 10), step: 1, label: 'Taxa',
      format: (v) => `${(v / 10).toFixed(1)} Hz`, onChange: (v) => phaser.setRate(v / 10),
    }),
    knob({
      min: 0, max: 100, value: phaser.depth, step: 5, label: 'Prof.', unit: '%',
      onChange: (pct) => phaser.setDepth(pct),
    }),
    knob({
      min: 100, max: 4000, value: phaser.center, step: 50, label: 'Centro', unit: 'Hz',
      onChange: (hz) => phaser.setCenter(hz),
    }),
    knob({
      min: 0, max: 90, value: phaser.feedback, step: 5, label: 'Feedback', unit: '%',
      onChange: (pct) => phaser.setFeedback(pct),
    }),
    knob({
      min: 0, max: 100, value: phaser.mix, step: 5, label: 'Mix', unit: '%',
      onChange: (pct) => phaser.setMix(pct),
    }),
  );
  return element;
}
