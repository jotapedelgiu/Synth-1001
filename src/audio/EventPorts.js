// Portas de evento: em vez de um sinal de áudio, carregam mensagens com o instante exato
// (no relógio do AudioContext) em que devem acontecer, inclusive no futuro.
// Têm a mesma interface connect/disconnect dos AudioNodes, então o Module e o Patch
// as tratam como qualquer outra porta; `kind` as distingue das portas de áudio e
// entre si (só portas do mesmo tipo se ligam).

class EventOut {
  #targets = new Set();

  connect(target) {
    this.#targets.add(target);
  }

  disconnect(target) {
    this.#targets.delete(target);
  }

  _each(fn) {
    for (const t of this.#targets) fn(t);
  }
}

// --- gate: liga/desliga uma nota (ex.: sequenciador → envelope) ---

export class GateOut extends EventOut {
  kind = 'gate';

  on(when) {
    this._each((t) => t.on(when));
  }

  off(when) {
    this._each((t) => t.off(when));
  }
}

export class GateIn {
  kind = 'gate';

  constructor({ on, off }) {
    this.on = on;
    this.off = off;
  }
}

// --- note: uma nota (número MIDI) que vale até mudar (ex.: raiz do acorde → tom do baixo) ---
// Quem se liga recebe na hora a nota atual; ao desligar, recebe `null` (sem nota).

export class NoteOut extends EventOut {
  kind = 'note';
  #note;

  constructor(note = null) {
    super();
    this.#note = note;
  }

  set(note) {
    this.#note = note;
    this._each((t) => t.set(note));
  }

  connect(target) {
    super.connect(target);
    target.set(this.#note);
  }

  disconnect(target) {
    super.disconnect(target);
    target.set(null);
  }
}

export class NoteIn {
  kind = 'note';

  constructor(onNote) {
    this.set = onNote;
  }
}

// --- clock: um pulso por passo (ex.: sequenciador → bateria) ---
// tick(when, step, duration): `step` é o número do passo (0–15) e `duration` a duração dele em segundos

export class ClockOut extends EventOut {
  kind = 'clock';

  tick(when, step, duration) {
    this._each((t) => t.tick(when, step, duration));
  }
}

export class ClockIn {
  kind = 'clock';

  constructor(onTick) {
    this.tick = onTick;
  }
}
