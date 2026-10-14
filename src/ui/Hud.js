// Barra superior: ativar o áudio, controles da área de trabalho (zoom, ajustar, reorganizar)
// e o texto de status.
const BPM_MIN = 40;
const BPM_MAX = 300;

export class Hud {
  constructor({ onStart, onZoom, onFit, onReset, onSave, onBpm }) {
    this.element = document.createElement('div');
    this.element.className = 'hud';

    this.start = this.#button('Ativar áudio', onStart);
    this.status = document.createElement('span');
    this.status.className = 'hud-status';

    // zoom − 100% +
    const zoom = document.createElement('div');
    zoom.className = 'hud-group';
    this.zoom = this.#button('100%', onFit);
    this.zoom.title = 'Zoom (roda do mouse). Clique para ajustar tudo à tela';
    zoom.append(this.#button('−', () => onZoom(1 / 1.25)), this.zoom, this.#button('+', () => onZoom(1.25)));

    // BPM global: todos os módulos que seguem o andamento (sequenciador, bateria, delay) usam este
    const bpm = document.createElement('div');
    bpm.className = 'hud-group hud-bpm';
    bpm.title = 'Andamento (BPM) de todo o patch';
    const bpmLabel = document.createElement('span');
    bpmLabel.textContent = 'BPM';
    this.bpm = document.createElement('input');
    this.bpm.type = 'number';
    this.bpm.min = BPM_MIN;
    this.bpm.max = BPM_MAX;
    this.bpm.step = 1;
    this.bpm.addEventListener('change', () => {
      const value = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(Number(this.bpm.value)) || BPM_MIN));
      this.bpm.value = value;
      onBpm(value);
    });
    bpm.append(bpmLabel, this.#button('−', () => onBpm(this.#clampBpm(Number(this.bpm.value) - 1))),
      this.bpm, this.#button('+', () => onBpm(this.#clampBpm(Number(this.bpm.value) + 1))));

    const fit = this.#button('Ajustar', onFit);
    fit.title = 'Enquadra todos os módulos na tela';
    const reset = this.#button('Reorganizar', onReset);
    reset.title = 'Devolve cada módulo à posição original';

    // onSave() retorna se deu certo; o botão avisa por um instante
    const save = this.#button('Salvar cena', () => {
      save.textContent = onSave() ? 'Salvo ✓' : 'Falhou';
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { save.textContent = 'Salvar cena'; }, 1200);
    });
    save.title = 'Salva o projeto inteiro (módulos, ajustes, posições e cabos); ele reabre assim na próxima visita';

    this.element.append(this.start, bpm, zoom, fit, reset, save, this.status);
    document.body.appendChild(this.element);
  }

  // state: { started, paused, status } — o botão vira pausa/play depois que o áudio é ativado
  render({ started, paused, status }) {
    this.start.textContent = !started ? 'Ativar áudio' : paused ? '▶ Tocar' : '⏸ Pausar';
    this.start.title = 'Pausa/retoma o áudio (barra de espaço)';
    this.status.textContent = status;
  }

  setBpm(bpm) {
    this.bpm.value = bpm;
  }

  #clampBpm(value) {
    return Math.min(BPM_MAX, Math.max(BPM_MIN, value));
  }

  setZoom(zoom) {
    this.zoom.textContent = `${Math.round(zoom * 100)}%`;
  }

  #button(text, onClick) {
    const b = document.createElement('button');
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }
}
