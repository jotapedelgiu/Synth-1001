// Formas de onda como séries de Fourier: x(t) = Σ b_k · sin(k·ω·t).
// O PeriodicWave do Web Audio recebe os coeficientes e faz o band-limiting
// automático por frequência, então não há aliasing nas ondas ricas em harmônicos.
const HARMONICS = 128;

export const WAVEFORMS = {
  sine: { label: 'Seno' },
  sawtooth: { label: 'Serra' },
  square: { label: 'Quadrada' },
  triangle: { label: 'Triângulo' },
};

// Amplitude do harmônico k (k >= 1) de cada forma, com pico ≈ 1
const harmonic = {
  sine: (k) => (k === 1 ? 1 : 0),
  sawtooth: (k) => ((k % 2 ? 1 : -1) * 2) / (Math.PI * k),
  square: (k) => (k % 2 ? 4 / (Math.PI * k) : 0),
  triangle: (k) => (k % 2 ? ((((k - 1) / 2) % 2 ? -1 : 1) * 8) / (Math.PI * k) ** 2 : 0),
};

// Coeficientes { real, imag } (cos e sen) da forma, deslocada em `phaseDeg`.
// Deslocar a onda em φ gira cada harmônico k em k·φ.
export function coefficients(name, phaseDeg = 0) {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  const phi = (phaseDeg * Math.PI) / 180;
  for (let k = 1; k <= HARMONICS; k++) {
    const b = harmonic[name](k);
    real[k] = b * Math.sin(k * phi);
    imag[k] = b * Math.cos(k * phi);
  }
  return { real, imag };
}
