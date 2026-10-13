import { CHANNELS, EQ_RANGE } from '../audio/modules/Mixer4.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';

const db = (v) => `${v > 0 ? '+' : ''}${v} dB`;
const pan = (v) => (v === 0 ? 'C' : `${Math.abs(v)}${v < 0 ? 'L' : 'R'}`);

// Fader vertical com medidor de pico ao lado. `onInput(0–1)`; retorna { element, meter(level) }.
function createFader(value, onInput) {
  const element = document.createElement('div');
  element.className = 'fader';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = 100;
  slider.value = Math.round(value * 100);
  slider.className = 'fader-slider';
  slider.setAttribute('aria-label', 'Nível');
  slider.addEventListener('input', () => onInput(slider.valueAsNumber / 100));

  const meter = document.createElement('div');
  meter.className = 'meter';
  const bar = document.createElement('div');
  bar.className = 'meter-bar';
  meter.appendChild(bar);

  element.append(meter, slider);
  let shown = 0;
  return {
    element,
    // queda suave: sobe na hora, desce devagar
    meter(level) {
      shown = Math.max(level, shown * 0.85);
      bar.style.transform = `scaleX(${shown})`;
      bar.classList.toggle('clip', level >= 0.99);
    },
  };
}

function toggleButton(text, className, initial, onToggle) {
  const button = document.createElement('button');
  button.textContent = text;
  button.className = className;
  button.classList.toggle('on', initial);
  button.addEventListener('click', () => {
    const on = !button.classList.contains('on');
    button.classList.toggle('on', on);
    onToggle(on);
  });
  return button;
}

// Painel do Mixer de 4 canais: uma tira por canal (trim, EQ, envio, pan, mute/solo, fader e
// medidor) mais a tira do master.
export function createMixer4Panel(mixer) {
  const { element, row } = createPanel('Mixer 4 canais', mixer);
  row.className = 'mixer-strips';
  const meters = [];

  const knob = (label, min, max, value, format, onChange, step = 1) =>
    createKnob({ min, max, value, step, label, format, onChange }).element;

  mixer.channels.forEach((ch, i) => {
    const strip = document.createElement('div');
    strip.className = 'strip';

    const name = document.createElement('div');
    name.className = 'strip-name';
    name.textContent = `CH ${i + 1}`;

    const fader = createFader(ch.level, (level) => mixer.setLevel(i, level));
    meters.push({ fn: fader.meter, read: () => mixer.peak(i) });

    const buttons = document.createElement('div');
    buttons.className = 'strip-buttons';
    buttons.append(
      toggleButton('M', 'mute', ch.mute, (on) => mixer.setMute(i, on)),
      toggleButton('S', 'solo', ch.solo, (on) => mixer.setSolo(i, on)),
    );

    strip.append(
      name,
      knob('Trim', -EQ_RANGE, EQ_RANGE, ch.trimDb, db, (v) => mixer.setTrim(i, v)),
      knob('Agudos', -EQ_RANGE, EQ_RANGE, ch.eq.high, db, (v) => mixer.setEq(i, 'high', v)),
      knob('Médios', -EQ_RANGE, EQ_RANGE, ch.eq.mid, db, (v) => mixer.setEq(i, 'mid', v)),
      knob('Graves', -EQ_RANGE, EQ_RANGE, ch.eq.low, db, (v) => mixer.setEq(i, 'low', v)),
      knob('Envio', 0, 100, Math.round(ch.send * 100), (v) => `${v}%`, (v) => mixer.setSend(i, v / 100), 5),
      knob('Pan', -100, 100, Math.round(ch.panValue * 100), pan, (v) => mixer.setPan(i, v / 100), 5),
      buttons,
      fader.element,
    );
    row.appendChild(strip);
  });

  const master = document.createElement('div');
  master.className = 'strip master';
  const masterName = document.createElement('div');
  masterName.className = 'strip-name';
  masterName.textContent = 'Master';
  const masterFader = createFader(mixer.master, (level) => mixer.setMaster(level));
  meters.push({ fn: masterFader.meter, read: () => mixer.peak() });
  const spacer = document.createElement('div');
  spacer.style.flex = '1'; // empurra o fader do master para alinhar com os dos canais
  master.append(masterName, spacer, masterFader.element);
  row.appendChild(master);

  // Medidores: um laço por quadro, que termina quando o painel sai da tela (módulo removido)
  const tick = () => {
    if (!element.isConnected) return;
    if (mixer.ctx.state === 'running') for (const m of meters) m.fn(m.read());
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return element;
}
