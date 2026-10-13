// Trigger de borda ascendente em 0, como num osciloscópio digital: a aquisição roda
// continuamente e o trigger marca o ponto de início da janela exibida.
// - Busca de trás para frente: usa sempre o trigger mais RECENTE (sem mostrar áudio antigo).
// - Histerese (ex.: microfone): arma abaixo de -H e dispara acima de 0, ignorando ruído.
// - Interpolação sub-amostra do cruzamento: elimina o tremor de ±1 amostra.
// - Janela (base de tempo): ~CYCLES ciclos da menor frequência conhecida.
const MIN_WINDOW = 1024;
const CYCLES = 3;
const PHASE_MARGIN = 4096; // amostras reservadas após o trigger para deslocar a fase
const ARM_LOOKBACK = 64; // quantas amostras olhar para trás procurando o "armar"

export class Trigger {
  constructor({ fftSize, points }) {
    this.fftSize = fftSize;
    this.maxWindow = fftSize / 2;
    this.points = points;
    this.buffer = new Float32Array(fftSize);
    this.view = new Float32Array(points);
  }

  // Lê o `scope` e devolve `points` amostras prontas para desenhar.
  //   sampleRate: taxa de amostragem
  //   baseFreq:   frequência (Hz) que define a janela; 0 = janela mínima
  //   hysteresis: histerese do trigger (0 = sem)
  //   shift:      { freq, phase } desloca a janela em `phase` graus de um ciclo de `freq`
  //               (posição horizontal), ou null
  read(scope, { sampleRate, baseFreq, hysteresis, shift }) {
    const { buffer, view, points } = this;
    scope.capture(buffer);

    let windowSize = MIN_WINDOW;
    if (baseFreq > 0) {
      windowSize = Math.round((CYCLES * sampleRate) / baseFreq);
      windowSize = Math.min(this.maxWindow, Math.max(MIN_WINDOW, windowSize));
    }

    const last = this.fftSize - windowSize - PHASE_MARGIN - 2; // amostras suficientes após o trigger
    let start = last; // sem trigger (ex.: 0 Hz): mostra o trecho mais recente
    for (let i = last; i > 0; i--) {
      if (buffer[i - 1] < 0 && buffer[i] >= 0 && this.#wasArmed(i - 1, hysteresis)) {
        // fração sub-amostra do cruzamento entre i-1 e i
        start = i - 1 - buffer[i - 1] / (buffer[i] - buffer[i - 1]);
        break;
      }
    }

    // Fase positiva atrasa a onda, ou seja, desloca para a direita.
    if (shift) {
      const period = Math.min(sampleRate / shift.freq, PHASE_MARGIN);
      start += period * (1 - shift.phase / 360);
    }

    const step = windowSize / points;
    for (let i = 0; i < points; i++) {
      const pos = start + i * step;
      const k = pos | 0;
      const f = pos - k;
      view[i] = buffer[k] + (buffer[k + 1] - buffer[k]) * f; // interpolação linear
    }
    return view;
  }

  // O trigger só vale se o sinal esteve abaixo de -hysteresis pouco antes
  #wasArmed(i, hysteresis) {
    if (hysteresis === 0) return true;
    const stop = Math.max(0, i - ARM_LOOKBACK);
    for (let j = i; j >= stop; j--) if (this.buffer[j] < -hysteresis) return true;
    return false;
  }
}
