import { EQ_RANGE } from '../audio/modules/Equalizer.js';
import { MAX_DECAY, MIN_DECAY } from '../audio/modules/Reverb.js';
import { createKnob } from './Knob.js';
import { createPanel } from './Panel.js';

// Painéis dos efeitos de timbre: reverb, distorção, chorus, compressor e equalizador.

const knob = (opts) => createKnob(opts).element;
const db = (v) => `${v > 0 ? '+' : ''}${v} dB`;

export function createReverbPanel(reverb) {
  const { element, row } = createPanel('Reverb', reverb);
  row.append(
    knob({
      min: MIN_DECAY * 10, max: MAX_DECAY * 10, value: Math.round(reverb.size * 10), step: 1, label: 'Tamanho',
      format: (v) => `${(v / 10).toFixed(1)} s`, onChange: (v) => reverb.setSize(v / 10),
    }),
    knob({
      min: 500, max: 12000, value: reverb.damping, step: 100, label: 'Abafar', unit: 'Hz',
      onChange: (hz) => reverb.setDamping(hz),
    }),
    knob({
      min: 0, max: 100, value: reverb.predelay, step: 5, label: 'Pré-delay', unit: 'ms',
      onChange: (ms) => reverb.setPredelay(ms),
    }),
    knob({
      min: 0, max: 100, value: reverb.mix, step: 5, label: 'Mix', unit: '%',
      onChange: (pct) => reverb.setMix(pct),
    }),
  );
  return element;
}

export function createDistortionPanel(distortion) {
  const { element, row } = createPanel('Distorção', distortion);
  row.append(
    knob({
      min: 0, max: 100, value: distortion.drive, step: 5, label: 'Drive', unit: '%',
      onChange: (pct) => distortion.setDrive(pct),
    }),
    knob({
      min: 500, max: 12000, value: distortion.tone, step: 100, label: 'Tom', unit: 'Hz',
      onChange: (hz) => distortion.setTone(hz),
    }),
    knob({
      min: 0, max: 100, value: distortion.level, step: 5, label: 'Nível', unit: '%',
      onChange: (pct) => distortion.setLevel(pct),
    }),
    knob({
      min: 0, max: 100, value: distortion.mix, step: 5, label: 'Mix', unit: '%',
      onChange: (pct) => distortion.setMix(pct),
    }),
  );
  return element;
}

export function createChorusPanel(chorus) {
  const { element, row } = createPanel('Chorus', chorus);
  row.append(
    knob({
      min: 1, max: 80, value: Math.round(chorus.rate * 10), step: 1, label: 'Taxa',
      format: (v) => `${(v / 10).toFixed(1)} Hz`, onChange: (v) => chorus.setRate(v / 10),
    }),
    knob({
      min: 0, max: 100, value: chorus.depth, step: 5, label: 'Prof.', unit: '%',
      onChange: (pct) => chorus.setDepth(pct),
    }),
    knob({
      min: 0, max: 100, value: chorus.mix, step: 5, label: 'Mix', unit: '%',
      onChange: (pct) => chorus.setMix(pct),
    }),
  );
  return element;
}

export function createCompressorPanel(compressor) {
  const { element, row } = createPanel('Compressor', compressor);
  row.append(
    knob({
      min: -60, max: 0, value: compressor.threshold, step: 1, label: 'Limiar', unit: 'dB',
      onChange: (v) => compressor.setThreshold(v),
    }),
    knob({
      min: 1, max: 20, value: compressor.ratio, step: 1, label: 'Razão',
      format: (v) => `${v}:1`, onChange: (v) => compressor.setRatio(v),
    }),
    knob({
      min: 1, max: 100, value: compressor.attack, step: 1, label: 'Ataque', unit: 'ms',
      onChange: (ms) => compressor.setAttack(ms),
    }),
    knob({
      min: 20, max: 1000, value: compressor.release, step: 10, label: 'Soltura', unit: 'ms',
      onChange: (ms) => compressor.setRelease(ms),
    }),
    knob({
      min: 0, max: 24, value: compressor.makeup, step: 1, label: 'Ganho',
      format: db, onChange: (v) => compressor.setMakeup(v),
    }),
  );
  return element;
}

export function createEqualizerPanel(eq) {
  const { element, row } = createPanel('Equalizador', eq);
  const band = (name, label) => knob({
    min: -EQ_RANGE, max: EQ_RANGE, value: eq.gains[name], step: 1, label,
    format: db, onChange: (v) => eq.setBand(name, v),
  });
  row.append(band('low', 'Graves'), band('mid', 'Médios'), band('high', 'Agudos'));
  return element;
}
