import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';

// Painéis dos módulos simples (mixer, alto-falante, microfone e osciloscópio).

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
