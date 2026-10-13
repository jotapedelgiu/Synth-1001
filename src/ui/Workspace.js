const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const ZOOM_SPEED = 0.0015; // por unidade de deltaY da roda
const GRID = 28; // espaçamento da grade de fundo, em px do mundo
const FIT_PADDING = 40;
const SAVE_DELAY = 300; // ms
const CLICK_SLOP = 4; // px: abaixo disso o botão direito é um clique, não um arrasto

// Controles que não devem iniciar o arrasto do nó (ficam com o próprio comportamento)
const INTERACTIVE = 'button, select, input, textarea, a, .knob, .jack, .step-note';

// Área de trabalho infinita, no estilo dos editores de nós (Blueprint/Material da Unreal):
//  - roda do mouse: zoom em direção ao cursor;
//  - arrastar o fundo (botão esquerdo, do meio ou direito): move a vista;
//  - arrastar um nó (por qualquer parte que não seja um controle): move o nó;
//  - clicar com o botão direito (sem arrastar): avisa quem registrou onContextMenu, que pode abrir
//    um menu (no fundo ou sobre um nó).
// Os nós são elementos HTML posicionados no "mundo", que recebe a translação e a escala.
// Posições e vista são salvas no navegador e restauradas na próxima visita.
export class Workspace {
  #nodes = new Map(); // id → { element, x, y, home: { x, y } }
  #listeners = new Set();
  #menuListeners = new Set();
  #z = 1;
  #saveTimer = null;

  constructor(container, { storageKey, topInset = 56 } = {}) {
    this.storageKey = storageKey;
    this.topInset = topInset; // faixa da barra superior, que o "ajustar" não ocupa
    this.view = { x: 0, y: 0, zoom: 1 };

    this.element = document.createElement('div');
    this.element.className = 'workspace';
    this.world = document.createElement('div');
    this.world.className = 'world';
    this.element.appendChild(this.world);
    container.appendChild(this.element);

    this.element.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
    this.element.addEventListener('wheel', (e) => this.#onWheel(e), { passive: false });
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
    // quando um nó muda de tamanho (ex.: texto novo), os cabos precisam acompanhar
    this.resizeObserver = new ResizeObserver(() => this.#notify());

    this.saved = this.#load();
    if (this.saved?.view) Object.assign(this.view, this.saved.view);
    this.#applyView();
  }

  get zoom() {
    return this.view.zoom;
  }

  // Quem quiser acompanhar mudanças de posição/zoom (ex.: redesenhar os cabos)
  onChange(fn) {
    this.#listeners.add(fn);
  }

  // fn({ x, y, nodeId }) — x e y em px da tela; nodeId é null quando o clique foi no fundo
  onContextMenu(fn) {
    this.#menuListeners.add(fn);
  }

  // Ponto da tela → ponto do mundo (onde os nós são posicionados)
  screenToWorld(x, y) {
    return { x: (x - this.view.x) / this.view.zoom, y: (y - this.view.y) / this.view.zoom };
  }

  // Adiciona um nó. `id` identifica o nó na memória; `home` é a posição padrão no mundo.
  // Com `restore: false` a posição salva de uma visita anterior é ignorada (módulos criados
  // depois pelo usuário reutilizam ids, e devem aparecer onde foram pedidos).
  addNode(id, element, home, { restore = true } = {}) {
    const saved = restore ? this.saved?.nodes?.[id] : null;
    const node = { element, x: saved?.x ?? home.x, y: saved?.y ?? home.y, home: { ...home } };
    this.#nodes.set(id, node);
    element.classList.add('node');
    element.dataset.node = id;
    this.#place(node);
    this.world.appendChild(element);
    this.resizeObserver.observe(element);
    this.#notify();
  }

  removeNode(id) {
    const node = this.#nodes.get(id);
    if (!node) return;
    this.resizeObserver.unobserve(node.element);
    node.element.remove();
    this.#nodes.delete(id);
    this.#notify();
    this.#scheduleSave();
  }

  // Volta os nós às posições padrão e ajusta a vista
  resetLayout() {
    for (const node of this.#nodes.values()) {
      node.x = node.home.x;
      node.y = node.home.y;
      this.#place(node);
    }
    this.fit();
  }

  // Enquadra todos os nós na janela
  fit() {
    if (!this.#nodes.size) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const { element, x, y } of this.#nodes.values()) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + element.offsetWidth);
      maxY = Math.max(maxY, y + element.offsetHeight);
    }
    const width = window.innerWidth - 2 * FIT_PADDING;
    const height = window.innerHeight - this.topInset - FIT_PADDING;
    const zoom = clamp(Math.min(width / (maxX - minX), height / (maxY - minY)), MIN_ZOOM, 1);
    this.view.zoom = zoom;
    this.view.x = FIT_PADDING + (width - (maxX - minX) * zoom) / 2 - minX * zoom;
    this.view.y = this.topInset + (height - (maxY - minY) * zoom) / 2 - minY * zoom;
    this.#applyView();
  }

  // Muda o zoom em torno de um ponto da tela (por padrão, o centro)
  zoomBy(factor, cx = window.innerWidth / 2, cy = window.innerHeight / 2) {
    const zoom = clamp(this.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const ratio = zoom / this.view.zoom;
    // o ponto do mundo sob (cx, cy) fica onde está
    this.view.x = cx - (cx - this.view.x) * ratio;
    this.view.y = cy - (cy - this.view.y) * ratio;
    this.view.zoom = zoom;
    this.#applyView();
  }

  // --- interação ---

  #onWheel(e) {
    if (e.defaultPrevented) return; // um knob ou nota já usou a roda
    e.preventDefault();
    this.zoomBy(Math.exp(-e.deltaY * ZOOM_SPEED), e.clientX, e.clientY);
  }

  #onPointerDown(e) {
    const nodeEl = e.target.closest('.node');
    if (e.button === 2) {
      this.#rightButton(e, nodeEl);
      return;
    }
    if (nodeEl) {
      if (e.button === 0 && !e.target.closest(INTERACTIVE)) this.#dragNode(e, nodeEl);
      return;
    }
    this.#pan(e); // fundo
  }

  // Botão direito: arrastar o fundo move a vista; soltar sem ter arrastado abre o menu
  #rightButton(e, nodeEl) {
    this.element.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
    let dragged = false;
    const move = (ev) => {
      if (!dragged && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < CLICK_SLOP) return;
      dragged = true;
      if (nodeEl) return; // sobre um nó, o botão direito não move nada
      this.element.classList.add('panning');
      this.view.x = start.vx + ev.clientX - start.x;
      this.view.y = start.vy + ev.clientY - start.y;
      this.#applyView();
    };
    this.#track(e, this.element, move, () => {
      this.element.classList.remove('panning');
      if (dragged) return;
      const nodeId = nodeEl?.dataset.node ?? null;
      for (const fn of this.#menuListeners) fn({ x: start.x, y: start.y, nodeId });
    });
  }

  #pan(e) {
    this.element.setPointerCapture(e.pointerId);
    this.element.classList.add('panning');
    const start = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
    const move = (ev) => {
      this.view.x = start.vx + ev.clientX - start.x;
      this.view.y = start.vy + ev.clientY - start.y;
      this.#applyView();
    };
    this.#track(e, this.element, move, () => this.element.classList.remove('panning'));
  }

  #dragNode(e, element) {
    const node = [...this.#nodes.values()].find((n) => n.element === element);
    if (!node) return;
    element.setPointerCapture(e.pointerId);
    element.classList.add('dragging');
    element.style.zIndex = ++this.#z; // o nó arrastado fica por cima
    const start = { x: e.clientX, y: e.clientY, nx: node.x, ny: node.y };
    const move = (ev) => {
      node.x = start.nx + (ev.clientX - start.x) / this.view.zoom;
      node.y = start.ny + (ev.clientY - start.y) / this.view.zoom;
      this.#place(node);
      this.#notify();
    };
    this.#track(e, element, move, () => {
      element.classList.remove('dragging');
      this.#scheduleSave();
    });
  }

  // Acompanha o ponteiro até ele ser solto
  #track(e, target, onMove, onEnd) {
    const id = e.pointerId;
    const move = (ev) => { if (ev.pointerId === id) onMove(ev); };
    const up = (ev) => {
      if (ev.pointerId !== id) return;
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      onEnd();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  // --- vista e persistência ---

  #place(node) {
    node.element.style.left = `${node.x}px`;
    node.element.style.top = `${node.y}px`;
  }

  #applyView() {
    const { x, y, zoom } = this.view;
    this.world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    // a grade de fundo acompanha o mundo
    const style = this.element.style;
    style.setProperty('--grid', `${GRID * zoom}px`);
    style.setProperty('--grid-x', `${x}px`);
    style.setProperty('--grid-y', `${y}px`);
    this.#notify();
    this.#scheduleSave();
  }

  #notify() {
    for (const fn of this.#listeners) fn();
  }

  #scheduleSave() {
    if (!this.storageKey) return;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.#save(), SAVE_DELAY);
  }

  #save() {
    const nodes = {};
    for (const [id, { x, y }] of this.#nodes) nodes[id] = { x: Math.round(x), y: Math.round(y) };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ nodes, view: this.view }));
    } catch { /* armazenamento indisponível: o layout só não será lembrado */ }
  }

  #load() {
    if (!this.storageKey) return null;
    try {
      return JSON.parse(localStorage.getItem(this.storageKey));
    } catch {
      return null;
    }
  }

  // Havia um layout salvo?
  get restored() {
    return Boolean(this.saved?.view);
  }
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
