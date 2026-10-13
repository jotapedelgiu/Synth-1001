// Andamento (BPM) compartilhado: o sequenciador o define e quem segue o tempo (delay
// sincronizado, batidas da bateria) o consulta ou é avisado quando muda.
export class Tempo {
  #bpm = 120;
  #listeners = new Set();

  get bpm() {
    return this.#bpm;
  }

  set bpm(value) {
    if (value === this.#bpm) return;
    this.#bpm = value;
    for (const fn of this.#listeners) fn(value);
  }

  // Retorna a função que cancela o aviso
  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }
}
