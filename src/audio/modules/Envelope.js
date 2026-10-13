import { Module } from '../Module.js';
import { GateIn } from '../EventPorts.js';

const MIN_RAMP = 0.002; // evita rampa de duração zero (clique)
const EPS = 1e-6; // s: cancelar logo DEPOIS de um vértice, preservando o evento dele

// Envelope ADSR aplicado ao sinal que passa por ele.
// Attack: 0 → 1; Decay: 1 → sustain; (segura enquanto o gate está aberto);
// Release: nível atual → 0. Rampas lineares no relógio do AudioContext.
// Desabilitado, o sinal passa direto (ganho 1).
//
// Portas: `in`, `out` e `gate` (evento). Receber um gate liga o envelope sozinho.
// Os eventos de gate trazem o instante exato em que devem soar, inclusive no futuro
// (o sequenciador agenda com antecedência); por isso o nível do envelope é acompanhado
// também em JS: `#points` guarda os vértices da curva agendada (linear por partes),
// permitindo saber o nível em qualquer instante, mesmo futuro.
export class Envelope extends Module {
  static type = 'envelope';

  #points = [{ t: 0, v: 1 }];

  constructor(ctx, { attack = 10, decay = 200, sustain = 60, release = 300 } = {}) {
    super(ctx);
    // tempos em ms, sustain em %
    this.params = { attack, decay, sustain, release };
    this.enabled = false;
    this.gateOn = false;
    this.onGate = null; // callback(gateOn) para a interface

    this.node = ctx.createGain();
    this.inputs.in = this.node;
    this.inputs.gate = new GateIn({
      on: (when) => {
        if (!this.enabled) this.setEnabled(true);
        this.#start(when);
      },
      off: (when) => this.#release(when),
    });
    this.outputs.out = this.node;
  }

  setEnabled(on) {
    this.enabled = on;
    this.gateOn = false;
    const t = this.ctx.currentTime;
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(on ? 0 : 1, t);
    this.#points = [{ t, v: on ? 0 : 1 }];
  }

  // Gate manual (botão e teclado)
  noteOn() {
    if (!this.enabled || this.gateOn) return;
    this.#start(this.ctx.currentTime);
  }

  noteOff() {
    if (!this.gateOn) return;
    this.#release(this.ctx.currentTime);
  }

  #start(when) {
    this.#setGate(true);
    const { attack, decay, sustain } = this.params;
    this.#schedule(when, [
      { dt: Math.max(MIN_RAMP, attack / 1000), v: 1 },
      { dt: Math.max(MIN_RAMP, decay / 1000), v: sustain / 100 },
    ]);
  }

  #release(when) {
    this.#setGate(false);
    if (!this.enabled) return;
    this.#schedule(when, [{ dt: Math.max(MIN_RAMP, this.params.release / 1000), v: 0 }]);
  }

  // Descarta o que estava agendado a partir de `when` e agenda novas rampas, partindo
  // do nível que o envelope terá em `when` (retrigger sem salto).
  //
  // Cuidado: cancelScheduledValues(when) apagaria também o FIM de uma rampa que está em
  // andamento em `when`; o parâmetro ficaria parado no valor antigo até `when` e depois
  // saltaria para o valor certo (um clique). Por isso o cancelamento começa logo depois do
  // vértice anterior da curva (que fica intacto) e o trecho até `when` é refeito como uma
  // rampa. Cancelar NO vértice o apagaria e o recriaria como degrau, outro clique.
  #schedule(when, steps) {
    const g = this.node.gain;
    const v0 = this.#levelAt(when);
    const prev = this.#points.findLast((p) => p.t < when);
    if (prev) {
      g.cancelScheduledValues(prev.t + EPS); // mantém o próprio vértice `prev` (que é uma rampa ou um set)
      g.linearRampToValueAtTime(v0, when);
    } else {
      g.cancelScheduledValues(when);
      g.setValueAtTime(v0, when);
    }

    const points = [{ t: when, v: v0 }];
    let t = when;
    for (const { dt, v } of steps) {
      t += dt;
      g.linearRampToValueAtTime(v, t);
      points.push({ t, v });
    }
    const keepFrom = this.ctx.currentTime - 1; // vértices antigos não servem mais
    this.#points = [
      ...this.#points.filter((p) => p.t < when && (p.t > keepFrom || p === prev)),
      ...points,
    ];
  }

  #levelAt(t) {
    const pts = this.#points;
    if (t <= pts[0].t) return pts[0].v;
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].t) {
        const a = pts[i - 1];
        const b = pts[i];
        return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
      }
    }
    return pts[pts.length - 1].v;
  }

  #setGate(on) {
    this.gateOn = on;
    this.onGate?.(on);
  }

  getState() {
    return { params: { ...this.params }, enabled: this.enabled };
  }

  setState(s) {
    Object.assign(this.params, s.params);
    if (typeof s.enabled === 'boolean') this.setEnabled(s.enabled);
  }
}
