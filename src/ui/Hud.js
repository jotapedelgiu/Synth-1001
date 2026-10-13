// Barra superior: ativar o áudio, controles da área de trabalho (zoom, ajustar, reorganizar)
// e o texto de status.
export class Hud {
  constructor({ onStart, onZoom, onFit, onReset }) {
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

    const fit = this.#button('Ajustar', onFit);
    fit.title = 'Enquadra todos os módulos na tela';
    const reset = this.#button('Reorganizar', onReset);
    reset.title = 'Devolve cada módulo à posição original';

    this.element.append(this.start, zoom, fit, reset, this.status);
    document.body.appendChild(this.element);
  }

  // state: { started, status }
  render({ started, status }) {
    this.start.hidden = started;
    this.status.textContent = status;
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
