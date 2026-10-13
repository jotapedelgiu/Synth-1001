import { Module } from '../Module.js';
import { Gain } from './Gain.js';

// Entrada de microfone. O acesso só é pedido ao usuário em enable().
export class Microphone extends Module {
  static type = 'microphone';
  #stream = null;

  constructor(ctx) {
    super(ctx);
    this.ready = false;
    this.level = new Gain(ctx);
    this.outputs.out = this.level.node;
  }

  dispose() {
    this.#stream?.getTracks().forEach((track) => track.stop()); // apaga a luz do microfone
  }

  async enable() {
    if (this.ready) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.#stream = stream;
      this.ctx.createMediaStreamSource(stream).connect(this.level.node);
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('Microfone indisponível:', err);
      return false;
    }
  }
}
