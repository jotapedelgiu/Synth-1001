import { WAVEFORMS } from '../audio/waveforms.js';

// Botões de escolha da forma de onda (seno, serra, quadrada, triângulo) de qualquer módulo que
// tenha `waveform` e `setWaveform(nome)`: Oscilador, Acordes...
export function createWaveformButtons(module) {
  const element = document.createElement('div');
  element.className = 'segmented';
  const buttons = Object.entries(WAVEFORMS).map(([name, { label }]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => {
      module.setWaveform(name);
      render();
    });
    element.appendChild(b);
    return [name, b];
  });
  const render = () => {
    for (const [name, b] of buttons) b.classList.toggle('active', name === module.waveform);
  };
  render();
  return element;
}
