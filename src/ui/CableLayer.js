const NS = 'http://www.w3.org/2000/svg';
// cabos de evento têm cor fixa (e tracejado, no CSS); os de áudio alternam as demais
const KIND_COLORS = { gate: '#ffb000', clock: '#33d6ff', note: '#ff6b8b' };
const COLORS = ['#33ff66', '#c8ff33', '#ff5fd2', '#b388ff', '#ff7a59'];

// Camada SVG sobre a tela que desenha os cabos do Patch e permite editá-los:
//  - arrastar de um jack de saída até um de entrada cria um cabo;
//  - arrastar de um jack de entrada já ligado "pega" o cabo (move ou solta);
//  - clicar num cabo o remove.
export class CableLayer {
  // `rack` é o elemento que contém os painéis (e seus jacks); `getZoom()` informa a escala
  // da área de trabalho, para a espessura dos cabos acompanhar o zoom.
  constructor(patch, rack, getZoom = () => 1) {
    this.patch = patch;
    this.rack = rack;
    this.getZoom = getZoom;
    this.drag = null;

    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'cables');
    this.cables = document.createElementNS(NS, 'g');
    this.temp = document.createElementNS(NS, 'path');
    this.temp.setAttribute('class', 'cable cable-temp');
    this.svg.append(this.cables, this.temp);
    document.body.appendChild(this.svg);

    patch.onChange(() => this.render());
    window.addEventListener('resize', () => this.render());
    rack.addEventListener('pointerdown', (e) => {
      const jack = e.target.closest('.jack');
      if (jack) this.#start(jack, e);
    });
    // Os cabos terminam nos jacks e sua área de clique os cobre: o ponteiro "vê" o cabo, não o
    // jack. Por isso o clique no cabo também procura um jack embaixo antes de remover o cabo.
    this.svg.addEventListener('pointerdown', (e) => {
      const jack = this.#jackAt(e.clientX, e.clientY);
      if (jack) this.#start(jack, e);
    });
    this.justDragged = false;
    this.render();
  }

  render() {
    this.svg.style.setProperty('--zoom', this.getZoom());
    this.cables.replaceChildren();
    for (const cable of this.patch.cables) {
      const a = this.#center(this.#jack(cable.from.module, cable.from.port, 'out'));
      const b = this.#center(this.#jack(cable.to.module, cable.to.port, 'in'));
      if (!a || !b) continue;
      const d = this.#path(a, b);

      const hit = document.createElementNS(NS, 'path'); // área de clique mais larga
      hit.setAttribute('class', 'cable-hit');
      hit.setAttribute('d', d);
      hit.addEventListener('click', (e) => {
        if (this.justDragged || this.#jackAt(e.clientX, e.clientY)) return; // era um arrasto de jack
        this.patch.disconnect(cable);
      });
      const line = document.createElementNS(NS, 'path');
      const kind = this.#jack(cable.from.module, cable.from.port, 'out').dataset.kind;
      line.setAttribute('class', `cable cable-${kind}`);
      line.setAttribute('d', d);
      line.style.stroke = KIND_COLORS[kind] ?? COLORS[cable.id % COLORS.length];
      this.cables.append(line, hit);
    }
  }

  #start(jack, e) {
    e.preventDefault();
    let origin = { module: jack.dataset.module, port: jack.dataset.port, dir: jack.dataset.dir };

    if (origin.dir === 'in') {
      // pega o cabo mais recente ligado a esta entrada, se houver
      const taken = this.patch.cables.findLast(
        (c) => c.to.module === origin.module && c.to.port === origin.port,
      );
      if (taken) {
        this.patch.disconnect(taken);
        origin = { module: taken.from.module, port: taken.from.port, dir: 'out' };
      }
    }

    this.drag = origin;
    const wanted = origin.dir === 'out' ? 'in' : 'out';
    // só as portas do mesmo tipo (áudio com áudio, gate com gate) são destinos válidos
    for (const j of this.rack.querySelectorAll(`.jack-${wanted}[data-kind="${jack.dataset.kind}"]`)) {
      j.classList.add('jack-hot');
    }
    this.#moveTemp(e);

    const move = (ev) => this.#moveTemp(ev);
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.#drop(ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  #moveTemp(e) {
    const a = this.#center(this.#jack(this.drag.module, this.drag.port, this.drag.dir));
    const b = { x: e.clientX, y: e.clientY };
    this.temp.setAttribute('d', this.drag.dir === 'out' ? this.#path(a, b) : this.#path(b, a));
  }

  #drop(e) {
    const origin = this.drag;
    this.drag = null;
    this.temp.removeAttribute('d');
    for (const j of this.rack.querySelectorAll('.jack-hot')) j.classList.remove('jack-hot');

    this.justDragged = true; // evita que o "click" que sucede o arrasto remova um cabo
    setTimeout(() => { this.justDragged = false; }, 0);

    const target = this.#jackAt(e.clientX, e.clientY);
    if (!target || target.dataset.dir === origin.dir) return;
    const t = { module: target.dataset.module, port: target.dataset.port };
    if (origin.dir === 'out') this.patch.connect(origin.module, origin.port, t.module, t.port);
    else this.patch.connect(t.module, t.port, origin.module, origin.port);
  }

  // O jack sob um ponto da tela, mesmo que um cabo esteja por cima dele
  #jackAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      const jack = el.closest?.('.jack');
      if (jack) return jack;
    }
    return null;
  }

  #jack(module, port, dir) {
    return this.rack.querySelector(
      `.jack[data-module="${module}"][data-port="${port}"][data-dir="${dir}"]`,
    );
  }

  #center(el) {
    if (!el) return null;
    const r = el.querySelector('.jack-dot').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Curva em S: sai do jack de saída para a direita e chega ao de entrada vindo da esquerda,
  // seguindo o fluxo do sinal (esquerda → direita).
  #path(a, b) {
    const reach = Math.max(20, Math.min(260, Math.abs(b.x - a.x) * 0.5));
    return `M${a.x},${a.y} C${a.x + reach},${a.y} ${b.x - reach},${b.y} ${b.x},${b.y}`;
  }
}
