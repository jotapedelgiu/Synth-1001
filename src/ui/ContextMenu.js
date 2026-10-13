// Menu de contexto (botão direito). show(x, y, entries) abre o menu no ponto da tela;
// cada entrada é { header: 'Título' } (rótulo de grupo) ou { label, onSelect }.
// Fecha ao escolher um item, ao clicar fora, com Esc, ao rolar a roda ou ao redimensionar a janela.
export class ContextMenu {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'context-menu';
    this.element.hidden = true;
    document.body.appendChild(this.element);

    // fase de captura: fecha antes de qualquer outro tratamento do clique
    window.addEventListener('pointerdown', (e) => {
      if (!this.element.hidden && !this.element.contains(e.target)) this.hide();
    }, true);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
    window.addEventListener('wheel', () => this.hide(), { passive: true });
    window.addEventListener('resize', () => this.hide());
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  show(x, y, entries) {
    this.element.replaceChildren();
    for (const entry of entries) {
      if (entry.header) {
        const header = document.createElement('div');
        header.className = 'context-menu-header';
        header.textContent = entry.header;
        this.element.appendChild(header);
        continue;
      }
      const item = document.createElement('button');
      item.className = 'context-menu-item';
      item.textContent = entry.label;
      item.addEventListener('click', () => {
        this.hide();
        entry.onSelect();
      });
      this.element.appendChild(item);
    }

    // mede o menu para mantê-lo inteiro dentro da janela
    this.element.hidden = false;
    const { width, height } = this.element.getBoundingClientRect();
    this.element.style.left = `${Math.max(4, Math.min(x, window.innerWidth - width - 4))}px`;
    this.element.style.top = `${Math.max(4, Math.min(y, window.innerHeight - height - 4))}px`;
  }

  hide() {
    this.element.hidden = true;
  }
}
