import { Module } from '../Module.js';
import { ClockOut, GateOut } from '../EventPorts.js';
import { Tempo } from '../Tempo.js';
import { PATTERNS, resolveSteps } from '../patterns.js';
import { STEPS, fitBars } from '../steps.js';

export { STEPS };
export const NOTE_MIN = -12; // semitons em relação à frequência do oscilador
export const NOTE_MAX = 24;

const LOOKAHEAD = 0.12; // s: quanto à frente os passos são agendados
const TICK_MS = 25; // intervalo do timer que reabastece a fila
const SLIDE_TAU = 0.02; // s: a nota com slide chega à seguinte em ~60 ms

// Sequenciador de passos de semicolcheias: 32 passos (dois compassos de 16) antes de repetir.
// Portas de saída:
//   `gate`  (evento) liga/desliga a nota em cada passo ativo → entrada gate do envelope
//   `pitch` (sinal)  nota do passo, em oitavas, relativa à frequência do oscilador
//   `accent` (evento, tipo gate) fica ligado durante os passos marcados com accent → Synth acid
//   `clock` (evento) um pulso por passo (ligado ou não) → bateria e outros módulos que seguem o andamento
//
// Cada passo pode ter `slide` (a nota não é solta e a afinação escorrega até o passo seguinte,
// que não redispara o envelope: o legato do TB-303) e `accent`.
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
  #held = false; // o passo anterior tinha slide: a nota dele ainda está soando

  // `tempo`: o andamento compartilhado (BPM), que quem manda é a barra superior; sem ele o
  // sequenciador tem o seu próprio
  constructor(ctx, tempo = new Tempo()) {
    super(ctx);
    this.tempo = tempo;
    this.gateLength = 50; // % da duração do passo
    this.playing = false;
    this.steps = Array.from({ length: STEPS }, () => ({ on: false, note: 0, slide: false, accent: false }));
    this.load(PATTERNS[0]); // padrão inicial

    this.pitchSource = ctx.createConstantSource();
    this.pitchSource.offset.value = 0;
    this.pitchSource.start();
    this.gate = new GateOut();
    this.accent = new GateOut();
    this.clock = new ClockOut();

    this.outputs.pitch = this.pitchSource;
    this.outputs.gate = this.gate;
    this.outputs.accent = this.accent;
    this.outputs.clock = this.clock;
  }

  // O andamento é do Tempo compartilhado, ajustado na barra superior
  get bpm() {
    return this.tempo.bpm;
  }

  dispose() {
    this.stop();
    this.pitchSource.stop();
  }

  // Carrega um padrão de patterns.js: troca os passos e, se o padrão sugerir, o gate.
  // O BPM não muda: é global (o `bpm` do padrão é só uma sugestão).
  // Os objetos dos passos são alterados no lugar (a interface os referencia).
  load(pattern) {
    resolveSteps(pattern).forEach((step, i) => Object.assign(this.steps[i], step));
    if (pattern.gate) this.gateLength = pattern.gate;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.#nextTime = this.ctx.currentTime + 0.05;
    this.#nextStep = 0;
    this.#queue = [];
    this.#held = false;
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
    this.accent.off(now);
  }

  // Passo que está soando agora (0–31), ou -1 se parado. Chamado pela interface a cada quadro.
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
      if (step.accent) {
        this.accent.on(t);
        this.accent.off(t + duration);
      }
      if (this.#held) {
        // chegando por slide: a afinação escorrega e o envelope não redispara
        this.pitchSource.offset.setTargetAtTime(step.note / 12, t, SLIDE_TAU);
      } else {
        this.pitchSource.offset.setValueAtTime(step.note / 12, t);
        this.gate.on(t);
      }
      // com slide a nota fica presa até o próximo passo, que a solta (ou a emenda em outra)
      this.#held = step.slide;
      if (!step.slide) this.gate.off(t + (duration * this.gateLength) / 100);
    } else if (this.#held) {
      this.#held = false;
      this.gate.off(t);
    }
    this.clock.tick(t, i, duration);
    this.#queue.push({ step: i, time: t });

    this.#nextTime += duration; // o BPM pode mudar a qualquer momento: vale a partir do próximo passo
    this.#nextStep = (i + 1) % STEPS;
  }

  getState() {
    return {
      steps: this.steps.map(({ on, note, slide, accent }) => ({ on, note, slide, accent })),
      gateLength: this.gateLength,
    };
  }

  setState(s) {
    // cenas salvas antes dos dois compassos têm 16 passos: o compasso é repetido
    if (s.steps?.length === 16) s = { ...s, steps: fitBars(s.steps) };
    s.steps?.slice(0, STEPS).forEach((step, i) => Object.assign(this.steps[i], {
      on: Boolean(step.on), note: step.note | 0, slide: Boolean(step.slide), accent: Boolean(step.accent),
    }));
    if (s.gateLength) this.gateLength = s.gateLength;
  }
}
