import { portKind } from './Module.js';

// O patch: módulos nomeados e os cabos entre as portas deles.
// Cada cabo vira uma chamada real de node.connect() no grafo do Web Audio.
export class Patch {
  #modules = new Map();
  #cables = [];
  #nextId = 1;
  #listeners = new Set();

  add(id, module) {
    module.id = id;
    this.#modules.set(id, module);
    return module;
  }

  module(id) {
    return this.#modules.get(id);
  }

  get modules() {
    return [...this.#modules.values()];
  }

  // Id livre para um módulo novo do tipo dado (ex.: "filter-3")
  uniqueId(type) {
    let n = 1;
    while (this.#modules.has(`${type}-${n}`)) n++;
    return `${type}-${n}`;
  }

  // Tira um módulo do patch: desfaz todos os cabos dele e libera seus recursos
  remove(id) {
    const module = this.#modules.get(id);
    if (!module) return;
    for (const cable of [...this.#cables]) {
      if (cable.from.module === id || cable.to.module === id) this.disconnect(cable);
    }
    this.#modules.delete(id);
    module.dispose();
    this.#emit();
  }

  // cabo = { id, from: { module, port }, to: { module, port } }
  get cables() {
    return this.#cables;
  }

  // Avisa quando um cabo é criado ou removido. Retorna a função para cancelar.
  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  // Retorna o cabo criado, ou null se a ligação for inválida
  // (porta inexistente, tipos diferentes, cabo repetido ou que fecharia um ciclo).
  connect(fromId, fromPort, toId, toPort) {
    const from = this.#modules.get(fromId);
    const to = this.#modules.get(toId);
    if (!from?.outputs[fromPort] || !to?.inputs[toPort]) return null;
    if (portKind(from.outputs[fromPort]) !== portKind(to.inputs[toPort])) return null; // áudio ≠ gate
    if (this.#find(fromId, fromPort, toId, toPort)) return null;
    if (from === to || this.#reaches(toId, fromId)) return null; // ciclo

    from.connect(to, fromPort, toPort);
    const cable = {
      id: this.#nextId++,
      from: { module: fromId, port: fromPort },
      to: { module: toId, port: toPort },
    };
    this.#cables.push(cable);
    this.#emit();
    return cable;
  }

  disconnect(cable) {
    const i = this.#cables.indexOf(cable);
    if (i < 0) return;
    const { from, to } = cable;
    this.#modules.get(from.module).disconnect(this.#modules.get(to.module), from.port, to.port);
    this.#cables.splice(i, 1);
    this.#emit();
  }

  // Todos os módulos que alimentam `id`, direta ou indiretamente
  upstream(id) {
    const found = new Set();
    const stack = [id];
    while (stack.length) {
      const current = stack.pop();
      for (const c of this.#cables) {
        if (c.to.module === current && !found.has(c.from.module)) {
          found.add(c.from.module);
          stack.push(c.from.module);
        }
      }
    }
    return [...found].map((m) => this.#modules.get(m));
  }

  #find(fromId, fromPort, toId, toPort) {
    return this.#cables.find(
      (c) =>
        c.from.module === fromId && c.from.port === fromPort &&
        c.to.module === toId && c.to.port === toPort,
    );
  }

  // `start` consegue chegar em `target` seguindo os cabos?
  #reaches(start, target) {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      if (current === target) return true;
      for (const c of this.#cables) {
        if (c.from.module === current && !seen.has(c.to.module)) {
          seen.add(c.to.module);
          stack.push(c.to.module);
        }
      }
    }
    return false;
  }

  #emit() {
    for (const fn of this.#listeners) fn();
  }
}
