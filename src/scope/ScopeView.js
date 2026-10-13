import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const TRACE_GAIN = 0.6; // amplitude vertical (1 = encosta nas bordas); folga para somar ondas

// Tela do osciloscópio: cena 2D (câmera ortográfica) com o traço verde, desenhada dentro
// de `container` e do tamanho dele. x e y vão de -1 a 1; y = 0 é o centro.
// O fundo é transparente: a retícula (grade) é desenhada pelo CSS do container.
export class ScopeView {
  constructor(container, points) {
    this.container = container;
    this.points = points;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    const initial = new Float32Array(points * 3);
    for (let i = 0; i < points; i++) initial[i * 3] = (i / (points - 1)) * 2 - 1;
    this.geometry = new LineGeometry();
    this.geometry.setPositions(initial);

    this.material = new LineMaterial({ color: 0x33ff66, linewidth: 2, worldUnits: false });
    this.scene.add(new Line2(this.geometry, this.material));

    this.#resize();
    this.observer = new ResizeObserver(() => this.#resize());
    this.observer.observe(container);
  }

  // Para o desenho e libera a memória da GPU (quando o osciloscópio é removido)
  dispose() {
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // Com zoom maior que 1 a tela é ampliada pelo navegador; mais pixels evitam o borrão
  setDetail(zoom) {
    const ratio = Math.min(window.devicePixelRatio * Math.max(1, zoom), 3);
    if (Math.abs(ratio - this.renderer.getPixelRatio()) < 0.05) return;
    this.renderer.setPixelRatio(ratio);
    this.#resize();
  }

  // Atualiza o traço in-place (evita recriar buffers a cada frame)
  setTrace(samples) {
    const { points } = this;
    const data = this.geometry.attributes.instanceStart.data;
    const arr = data.array;
    for (let i = 0; i < points - 1; i++) {
      const o = i * 6;
      arr[o] = (i / (points - 1)) * 2 - 1;
      arr[o + 1] = samples[i] * TRACE_GAIN;
      arr[o + 3] = ((i + 1) / (points - 1)) * 2 - 1;
      arr[o + 4] = samples[i + 1] * TRACE_GAIN;
    }
    data.needsUpdate = true;
  }

  // Chama `onFrame` e desenha, a cada quadro
  run(onFrame) {
    this.renderer.setAnimationLoop(() => {
      onFrame();
      this.renderer.render(this.scene, this.camera);
    });
  }

  // Segue o tamanho do container (em px de layout, sem a escala da área de trabalho)
  #resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.material.resolution.set(w, h);
  }
}
