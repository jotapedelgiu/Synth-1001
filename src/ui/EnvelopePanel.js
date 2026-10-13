import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';

const HOLD_MS = 500; // trecho fixo de sustentação, só para o desenho da curva

// Painel de um Envelope: liga/desliga, gate, quatro knobs e a curva ADSR resultante.
export function createEnvelopePanel(envelope) {
  const { params } = envelope;
  const { element, body, row } = createPanel('Envelope ADSR', envelope);

  const toggle = document.createElement('button');
  const gate = document.createElement('button');
  const buttons = document.createElement('div');
  buttons.className = 'panel-buttons';
  buttons.append(toggle, gate);

  const canvas = document.createElement('canvas');
  canvas.className = 'env-curve';
  canvas.width = 440;
  canvas.height = 120;

  const knob = (key, label, max, step, unit) =>
    createKnob({
      min: 0, max, value: params[key], step, label, unit,
      onChange: (v) => { params[key] = v; draw(); },
    }).element;
  row.append(
    knob('attack', 'Attack', 2000, 25, 'ms'),
    knob('decay', 'Decay', 2000, 25, 'ms'),
    knob('sustain', 'Sustain', 100, 5, '%'),
    knob('release', 'Release', 3000, 50, 'ms'),
  );
  body.append(buttons, canvas);

  function render() {
    toggle.textContent = envelope.enabled ? 'Envelope: ligado' : 'Envelope: desligado';
    gate.hidden = !envelope.enabled;
    gate.textContent = envelope.gateOn ? 'Tocando…' : 'Tocar (segure / Espaço)';
  }

  toggle.addEventListener('click', () => {
    envelope.setEnabled(!envelope.enabled);
    render();
  });
  gate.addEventListener('pointerdown', (e) => {
    gate.setPointerCapture(e.pointerId);
    envelope.noteOn();
  });
  for (const ev of ['pointerup', 'pointercancel']) gate.addEventListener(ev, () => envelope.noteOff());
  envelope.onGate = render; // o gate também muda pelo teclado

  function draw() {
    const c = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    const pad = 8;
    const total = Math.max(1, params.attack + params.decay + HOLD_MS + params.release);
    const x = (ms) => pad + (ms / total) * (w - 2 * pad);
    const y = (lvl) => h - pad - lvl * (h - 2 * pad);
    const s = params.sustain / 100;
    const t1 = params.attack;
    const t2 = t1 + params.decay;
    const t3 = t2 + HOLD_MS;
    const t4 = t3 + params.release;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#33ff66';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x(0), y(0));
    c.lineTo(x(t1), y(1));
    c.lineTo(x(t2), y(s));
    c.lineTo(x(t3), y(s));
    c.lineTo(x(t4), y(0));
    c.stroke();
  }
  draw();
  render();

  return element;
}
