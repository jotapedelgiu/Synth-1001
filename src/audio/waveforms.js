// Formas de onda como séries de Fourier: x(t) = Σ b_k · sin(k·ω·t).
// O PeriodicWave do Web Audio recebe os coeficientes e faz o band-limiting
// automático por frequência, então não há aliasing nas ondas ricas em harmônicos.
const HARMONICS = 128;

export const WAVEFORMS = {
  sine: { label: 'Seno' },
  sawtooth: { label: 'Serra' },
  square: { label: 'Quadrada' },
  triangle: { label: 'Triângulo' },
  pulse: { label: 'Pulso ¼' }, // timbre "nasal" dos synths de baixo e lead
  pulse12: { label: 'Pulso ⅛' }, // ainda mais fino e agudo
};

// Largura (fração do ciclo em nível alto) dos pulsos
const DUTY = { pulse: 0.25, pulse12: 0.125 };

// Formas escritas como série de cossenos (o pulso, centrado no ciclo); as outras usam senos
const COSINE = new Set(['pulse', 'pulse12']);

// Pulso de largura d, sem a componente contínua e com pico ≈ 1
const pulse = (d) => (k) => (4 * Math.sin(k * Math.PI * d)) / (k * Math.PI) / (2 * (1 - d));

// Amplitude do harmônico k (k >= 1) de cada forma, com pico ≈ 1
const harmonic = {
  sine: (k) => (k === 1 ? 1 : 0),
  sawtooth: (k) => ((k % 2 ? 1 : -1) * 2) / (Math.PI * k),
  square: (k) => (k % 2 ? 4 / (Math.PI * k) : 0),
  triangle: (k) => (k % 2 ? ((((k - 1) / 2) % 2 ? -1 : 1) * 8) / (Math.PI * k) ** 2 : 0),
  pulse: pulse(DUTY.pulse),
  pulse12: pulse(DUTY.pulse12),
};

// Coeficientes { real, imag } (cos e sen) da forma, deslocada em `phaseDeg`.
// Deslocar a onda em φ gira cada harmônico k em k·φ (seno: b·sin(kθ+kφ); cosseno: b·cos(kθ+kφ)).
export function coefficients(name, phaseDeg = 0) {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  const phi = (phaseDeg * Math.PI) / 180;
  for (let k = 1; k <= HARMONICS; k++) {
    const b = harmonic[name](k);
    if (COSINE.has(name)) {
      real[k] = b * Math.cos(k * phi);
      imag[k] = -b * Math.sin(k * phi);
    } else {
      real[k] = b * Math.sin(k * phi);
      imag[k] = b * Math.cos(k * phi);
    }
  }
  return { real, imag };
}
