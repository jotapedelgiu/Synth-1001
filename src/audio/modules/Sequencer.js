import { Module } from '../Module.js';
import { ClockOut, GateOut } from '../EventPorts.js';
import { Tempo } from '../Tempo.js';
import { PATTERNS, resolveSteps } from '../patterns.js';

export const STEPS = 16;
export const NOTE_MIN = -12; // semitons em relação à frequência do oscilador
export const NOTE_MAX = 24;

const LOOKAHEAD = 0.12; // s: quanto à frente os passos são agendados
const TICK_MS = 25; // intervalo do timer que reabastece a fila

// Sequenciador de passos de semicolcheias (16 passos).
// Portas de saída:
//   `gate`  (evento) liga/desliga a nota em cada passo ativo → entrada gate do envelope
//   `pitch` (sinal)  nota do passo, em oitavas, relativa à frequência do oscilador
//   `clock` (evento) um pulso por passo (ligado ou não) → bateria e outros módulos que seguem o andamento
//
// O relógio é o do AudioContext. Um timer comum só reabastece uma fila com ~LOOKAHEAD de
// antecedência; quem marca o tempo das notas é o relógio de áudio, então atrasos do timer
// (JavaScript) não deixam o ritmo escorregar.
export class Sequencer extends Module {
  static type = 'sequencer';
  #timer = null;
  #nextTime = 0;
  #nextStep = 0;
  #queue = []; // { step, time } agendados, para a interface acompanhar o passo atual
  #stops = new Set(); // cancelamentos dos avisos de BPM registrados por quem usa este módulo

  // `tempo`: o andamento compartilhado (BPM); sem ele o sequenciador tem o seu próprio
  constructor(ctx, tempo = new Tempo()) {
    super(ctx);
    this.tempo = tempo;
    this.gateLength = 50; // % da duração do passo
    this.playing = false;
    this.steps = Array.from({ length: STEPS }, () => ({ on: false, note: 0 }));
    this.load(PATTERNS[0]); // padrão inicial

    this.pitchSource = ctx.createConstantSource();
    this.pitchSource.offset.value = 0;
    this.pitchSource.start();
    this.gate = new GateOut();
    this.clock = new ClockOut();

    this.outputs.pitch = this.pitchSource;
    this.outputs.gate = this.gate;
    this.outputs.clock = this.clock;
  }

  // O andamento é do Tempo compartilhado: mudar aqui muda para todos que o seguem
  get bpm() {
    return this.tempo.bpm;
  }

  set bpm(value) {
    this.tempo.bpm = value;
  }

  onBpmChange(fn) {
    const stop = this.tempo.onChange(fn);
    this.#stops.add(stop);
    return stop;
  }

  dispose() {
    this.stop();
    for (const stop of this.#stops) stop();
    this.pitchSource.stop();
  }

  // Carrega um padrão de patterns.js: troca os passos e, se o padrão sugerir, o BPM e o gate.
  // Os objetos dos passos são alterados no lugar (a interface os referencia).
  load(pattern) {
    resolveSteps(pattern).forEach((step, i) => Object.assign(this.steps[i], step));
    if (pattern.bpm) this.bpm = pattern.bpm;
    if (pattern.gate) this.gateLength = pattern.gate;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.#nextTime = this.ctx.currentTime + 0.05;
    this.#nextStep = 0;
    this.#queue = [];
    this.#timer = setInterval(() => this.#tick(), TICK_MS);
    this.#tick();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.#timer);
    this.#queue = [];
    const now = this.ctx.currentTime;
    this.pitchSource.offset.cancelScheduledValues(now); // descarta notas já agendadas
    this.gate.off(now); // solta a nota que estiver soando (e cancela as agendadas)
  }

  // Passo que está soando agora (0–15), ou -1 se parado. Chamado pela interface a cada quadro.
  playheadStep() {
    if (!this.playing) return -1;
    const now = this.audibleTime(); // destaca o que se ouve, não o que está sendo processado
    while (this.#queue.length > 1 && this.#queue[1].time <= now) this.#queue.shift();
    const head = this.#queue[0];
    return head && head.time <= now ? head.step : -1;
  }

  #tick() {
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    while (this.#nextTime < horizon) this.#scheduleStep();
  }

  #scheduleStep() {
    const t = this.#nextTime;
    const i = this.#nextStep;
    const step = this.steps[i];
    const duration = 60 / this.bpm / 4; // semicolcheia

    if (step.on) {
      this.pitchSource.offset.setValueAtTime(step.note / 12, t);
      this.gate.on(t);
      this.gate.off(t + (duration * this.gateLength) / 100);
    }
    this.clock.tick(t, i, duration);
    this.#queue.push({ step: i, time: t });

    this.#nextTime += duration; // o BPM pode mudar a qualquer momento: vale a partir do próximo passo
    this.#nextStep = (i + 1) % STEPS;
  }

  getState() {
    return {
      steps: this.steps.map(({ on, note }) => ({ on, note })),
      gateLength: this.gateLength,
      bpm: this.bpm,
    };
  }

  setState(s) {
    s.steps?.slice(0, STEPS).forEach((step, i) => Object.assign(this.steps[i], { on: Boolean(step.on), note: step.note | 0 }));
    if (s.gateLength) this.gateLength = s.gateLength;
    if (s.bpm) this.bpm = s.bpm;
  }
}
