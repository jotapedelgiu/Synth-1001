// Botão rotativo (estilo osciloscópio). Arraste na vertical, use a roda do mouse
// ou as setas do teclado. Shift = ajuste fino.
const SWEEP = 270; // graus totais de giro (-135° a +135°)
const NS = 'http://www.w3.org/2000/svg';

export function createKnob({ min = 0, max = 1000, value = 440, step = 10, label = '', unit = '', format, onChange }) {
  const root = document.createElement('div');
  root.className = 'knob';
  root.tabIndex = 0;
  root.setAttribute('role', 'slider');
  root.setAttribute('aria-valuemin', min);
  root.setAttribute('aria-valuemax', max);
  root.setAttribute('aria-label', label);

  // Escala com marcações ao redor do botão
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-60 -60 120 120');
  const TICKS = 11;
  for (let i = 0; i < TICKS; i++) {
    const a = ((i / (TICKS - 1)) * SWEEP - SWEEP / 2) * (Math.PI / 180);
    const major = i % 5 === 0;
    const r0 = major ? 44 : 47;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', Math.sin(a) * r0);
    line.setAttribute('y1', -Math.cos(a) * r0);
    line.setAttribute('x2', Math.sin(a) * 54);
    line.setAttribute('y2', -Math.cos(a) * 54);
    line.setAttribute('class', major ? 'tick major' : 'tick');
    svg.appendChild(line);
  }
  root.appendChild(svg);

  const dial = document.createElement('div');
  dial.className = 'knob-dial';
  const pointer = document.createElement('div');
  pointer.className = 'knob-pointer';
  dial.appendChild(pointer);
  root.appendChild(dial);

  const readout = document.createElement('div');
  readout.className = 'knob-readout';
  const caption = document.createElement('div');
  caption.className = 'knob-label';
  caption.textContent = label;

  const wrap = document.createElement('div');
  wrap.className = 'knob-wrap';
  wrap.append(root, readout, caption);

  let current = value;

  function set(v, emit = true) {
    v = Math.round(Math.min(max, Math.max(min, v)));
    const changed = v !== current;
    current = v;
    const angle = ((v - min) / (max - min)) * SWEEP - SWEEP / 2;
    dial.style.transform = `rotate(${angle}deg)`;
    readout.textContent = format ? format(v) : `${v} ${unit}`;
    root.setAttribute('aria-valuenow', v);
    if (emit && changed) onChange?.(v);
  }

  // Arrastar: 300px de curso vertical cobrem toda a faixa
  let drag = null;
  root.addEventListener('pointerdown', (e) => {
    root.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, v: current };
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const range = (max - min) / (e.shiftKey ? 10 : 1);
    set(drag.v + ((drag.y - e.clientY) / 300) * range);
  });
  const end = () => { drag = null; };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  root.addEventListener('wheel', (e) => {
    e.preventDefault();
    set(current + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 1 : step));
  }, { passive: false });

  root.addEventListener('keydown', (e) => {
    const inc = e.shiftKey ? 1 : step;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(current + inc);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(current - inc);
    else if (e.key === 'Home') set(min);
    else if (e.key === 'End') set(max);
    else return;
    e.preventDefault();
  });

  set(value, false);
  return { element: wrap, get value() { return current; }, set };
}
