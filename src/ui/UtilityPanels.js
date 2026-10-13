import { NOISE_COLORS } from '../audio/modules/Noise.js';
import { RATE_MAX, RATE_MIN } from '../audio/modules/Lfo.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';
import { createWaveformButtons } from './WaveformButtons.js';

// Painéis dos módulos simples (mixer, alto-falante, microfone, osciloscópio, ruído e LFO).

export function createMixerPanel(mixer) {
  const { element, row } = createPanel('Mixer', mixer);
  row.appendChild(
    createKnob({
      min: 0, max: 100, value: Math.round(mixer.value * 100), step: 5, label: 'Nível', unit: '%',
      onChange: (pct) => mixer.set(pct / 100, 0.01),
    }).element,
  );
  return element;
}

export function createSpeakerPanel(speaker) {
  const { element, body } = createPanel('Alto-falante', speaker);
  const toggle = document.createElement('button');
  const render = () => { toggle.textContent = speaker.active ? 'Som: ligado' : 'Som: desligado'; };
  toggle.addEventListener('click', () => {
    speaker.setActive(!speaker.active);
    render();
  });
  render();
  body.appendChild(toggle);
  return element;
}

export function createMicrophonePanel(mic) {
  const { element, body } = createPanel('Microfone', mic);
  const button = document.createElement('button');
  button.textContent = 'Ativar microfone';
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = (await mic.enable()) ? 'Microfone ativo' : 'Microfone indisponível';
    button.disabled = mic.ready;
    if (!mic.ready) setTimeout(() => { button.textContent = 'Ativar microfone'; }, 2000);
  });
  body.appendChild(button);
  return element;
}

// A tela do osciloscópio mora dentro do painel; o ScopeView desenha no elemento `screen`.
export function createScopePanel(scope) {
  const { element, body } = createPanel('Osciloscópio', scope);
  const screen = document.createElement('div');
  screen.className = 'scope-screen';
  body.appendChild(screen);
  return { element, screen };
}

export function createNoisePanel(noise) {
  const { element, body, row } = createPanel('Ruído', noise);

  const colors = document.createElement('div');
  colors.className = 'segmented';
  const buttons = NOISE_COLORS.map(({ id, label }) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => { noise.setColor(id); render(); });
    colors.appendChild(b);
    return [id, b];
  });
  const render = () => { for (const [id, b] of buttons) b.classList.toggle('active', id === noise.color); };
  render();
  body.prepend(colors);

  row.appendChild(
    createKnob({
      min: 0, max: 100, value: noise.amount, step: 5, label: 'Nível', unit: '%',
      onChange: (pct) => noise.setLevel(pct),
    }).element,
  );
  return element;
}

// A taxa vai de 0,1 a 30 Hz; o botão guarda décimos de Hz (o Knob só usa inteiros)
export function createLfoPanel(lfo) {
  const { element, body, row } = createPanel('LFO', lfo);
  body.prepend(createWaveformButtons(lfo));
  row.append(
    createKnob({
      min: RATE_MIN * 10, max: RATE_MAX * 10, value: Math.round(lfo.rate * 10), step: 1, label: 'Taxa',
      format: (v) => `${(v / 10).toFixed(1)} Hz`,
      onChange: (v) => lfo.setRate(v / 10),
    }).element,
    createKnob({
      min: 0, max: 100, value: lfo.depth, step: 1, label: 'Prof.', unit: '%',
      onChange: (pct) => lfo.setDepth(pct),
    }).element,
  );
  return element;
}
